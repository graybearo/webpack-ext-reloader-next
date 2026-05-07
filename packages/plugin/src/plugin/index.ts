import chokidar, { type FSWatcher } from "chokidar";
import { Compilation, type Compiler } from "webpack";
import type { ServerMessage } from "../shared/messages";
import type { ExtReloaderOptions } from "../shared/options";
import { validateOptions } from "../shared/options";
import { BuildTracker, type ErrorPayload, snapshotCompilation } from "./diff";
import { logEvent, logReady } from "./formatter";
import { type InjectionTarget, injectClients } from "./inject";
import { notifyError, notifyRecovery, notifyReload } from "./notifier";
import { type ResolvedManifest, loadManifest } from "./resolve";
import { ReloaderServer } from "./server";

const PLUGIN_NAME = "ExtReloader";
const DEBOUNCE_MS = 150;

export class ExtReloader {
	readonly server = new ReloaderServer();
	serverReady: Promise<number> | null = null;
	private readonly options: ReturnType<typeof validateOptions>;
	private readonly tracker = new BuildTracker();
	private manifestWatcher?: FSWatcher;
	private flushTimer?: ReturnType<typeof setTimeout>;
	private lastBuildOk = true;
	private latestSnapshot?: Map<string, string>;
	resolved?: ResolvedManifest;

	constructor(options: ExtReloaderOptions = {}) {
		this.options = validateOptions(options);
	}

	get port(): number {
		return this.server.port;
	}

	async close(): Promise<void> {
		if (this.flushTimer) {
			clearTimeout(this.flushTimer);
			this.flushTimer = undefined;
			this.flushNow();
		}
		await this.manifestWatcher?.close();
		this.manifestWatcher = undefined;
		return this.server.stop();
	}

	apply(compiler: Compiler): void {
		if (!this.options.force && compiler.options.mode === "production") return;

		this.resolved = loadManifest(compiler.context, this.options.manifest);
		this.watchManifest(this.resolved.path);

		if (!this.serverReady) {
			this.serverReady = this.server.start(this.options.port).then((p) => {
				logReady(p);
				return p;
			});
		}
		const ready = this.serverReady;

		injectClients(compiler, targets(this.resolved), async () => ({
			port: await ready,
			maxRetries: this.options.maxRetries,
		}));

		// Snapshot assets while their sources are still readable. By `done`,
		// webpack has stripped sources to SizeOnlySource for unchanged assets.
		compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
			compilation.hooks.processAssets.tap(
				{ name: PLUGIN_NAME, stage: Compilation.PROCESS_ASSETS_STAGE_REPORT },
				() => {
					this.latestSnapshot = snapshotCompilation(compilation);
				},
			);
		});

		compiler.hooks.compile.tap(PLUGIN_NAME, () => {
			this.server.broadcast({ v: 1, type: "build:start", ts: Date.now() });
		});

		compiler.hooks.done.tap(PLUGIN_NAME, (stats) => {
			if (stats.hasErrors()) {
				this.tracker.recordError(stats.compilation.errors.slice(0, 10).map(toErrorPayload));
			} else {
				const durationMs = (stats.endTime ?? 0) - (stats.startTime ?? 0);
				const snap = this.latestSnapshot ?? new Map();
				this.tracker.recordSuccess(snap, durationMs);
				this.latestSnapshot = undefined;
			}
			this.scheduleFlush();
		});

		compiler.hooks.shutdown.tapPromise(PLUGIN_NAME, () => this.close());
	}

	private scheduleFlush(): void {
		if (this.flushTimer) clearTimeout(this.flushTimer);
		this.flushTimer = setTimeout(() => this.flushNow(), DEBOUNCE_MS);
	}

	private flushNow(): void {
		this.flushTimer = undefined;
		if (!this.resolved) return;
		const message = this.tracker.flush(this.resolved);
		if (!message) return;

		this.server.broadcast(message);
		if (this.options.logLevel !== "silent") logEvent(message);
		this.handleNotifications(message);
	}

	private handleNotifications(message: ServerMessage): void {
		const osn = this.options.notifications.osNotifications;
		if (osn === false) return;

		if (message.type === "build:error") {
			if (this.lastBuildOk) void notifyError(message.errors.length);
			this.lastBuildOk = false;
			return;
		}
		if (!this.lastBuildOk) void notifyRecovery();
		else if (osn === "all" && message.type.startsWith("reload:")) void notifyReload();
		this.lastBuildOk = true;
	}

	private watchManifest(path: string): void {
		if (this.manifestWatcher) return;
		this.manifestWatcher = chokidar.watch(path, { ignoreInitial: true });
		this.manifestWatcher.on("change", () => {
			this.tracker.recordManifestChange();
			this.scheduleFlush();
		});
	}
}

type WebpackError = {
	message?: string;
	stack?: string;
	module?: { resource?: string };
	loc?: { start?: { line: number; column: number } };
};

function toErrorPayload(e: WebpackError): ErrorPayload {
	const loc = e.loc?.start;
	return {
		message: e.message ?? String(e),
		file: e.module?.resource,
		line: loc?.line,
		column: loc?.column,
		stack: e.stack,
	};
}

function targets(r: ResolvedManifest): InjectionTarget[] {
	const out: InjectionTarget[] = [];
	if (r.backgroundFilename) out.push({ role: "background", filename: r.backgroundFilename });
	for (const f of r.contentScriptFilenames) out.push({ role: "content", filename: f });
	for (const f of r.pageFilenames) {
		const js = f.replace(/\.html$/, ".js");
		out.push({ role: "page", filename: js });
	}
	return out;
}
