import { createHash } from "node:crypto";
import type { Compilation } from "webpack";
import type { ServerMessage } from "../shared/messages";
import type { ResolvedManifest } from "./resolve";

export type ErrorPayload = {
	message: string;
	file?: string;
	line?: number;
	column?: number;
	stack?: string;
	moduleId?: string;
};

type Pending =
	| { kind: "ok"; snapshot: Map<string, string>; durationMs: number }
	| { kind: "error"; errors: ErrorPayload[] };

export class BuildTracker {
	private prev = new Map<string, string>();
	private pending?: Pending;
	private manifestTouched = false;
	private firstBuild = true;

	recordSuccess(snapshot: Map<string, string>, durationMs: number): void {
		this.pending = { kind: "ok", snapshot, durationMs };
	}

	recordError(errors: ErrorPayload[]): void {
		this.pending = { kind: "error", errors };
	}

	recordManifestChange(): void {
		this.manifestTouched = true;
	}

	flush(resolved: ResolvedManifest): ServerMessage | undefined {
		const p = this.pending;
		const m = this.manifestTouched;
		if (!p && !m) return undefined;

		this.pending = undefined;
		this.manifestTouched = false;
		const ts = Date.now();

		if (p?.kind === "error") return { v: 1, type: "build:error", ts, errors: p.errors };

		if (m) {
			const durationMs = p?.kind === "ok" ? p.durationMs : 0;
			if (p?.kind === "ok") this.prev = p.snapshot;
			return { v: 1, type: "reload:full", ts, reason: "manifest", durationMs };
		}

		if (!p || p.kind !== "ok") return undefined;

		if (this.firstBuild) {
			this.firstBuild = false;
			this.prev = p.snapshot;
			return { v: 1, type: "build:success", ts, durationMs: p.durationMs };
		}

		const changed = this.diff(p.snapshot);
		this.prev = p.snapshot;
		return classify(changed, resolved, p.durationMs);
	}

	private diff(cur: Map<string, string>): Set<string> {
		const out = new Set<string>();
		for (const [name, hash] of cur) {
			if (this.prev.get(name) !== hash) out.add(name);
		}
		for (const name of this.prev.keys()) {
			if (!cur.has(name)) out.add(name);
		}
		return out;
	}
}

export function snapshotCompilation(compilation: Compilation): Map<string, string> {
	const out = new Map<string, string>();
	for (const name of Object.keys(compilation.assets)) {
		const asset = compilation.getAsset(name);
		if (!asset) continue;
		out.set(name, fingerprint(asset));
	}
	return out;
}

type AssetLike = NonNullable<ReturnType<Compilation["getAsset"]>>;

function fingerprint(asset: AssetLike): string {
	const ch = asset.info.contenthash;
	if (typeof ch === "string") return ch;
	if (Array.isArray(ch) && typeof ch[0] === "string") return ch[0];
	try {
		return hashOf(asset.source.buffer());
	} catch {
		return `size-${asset.source.size()}`;
	}
}

function hashOf(buf: Buffer): string {
	return createHash("sha1").update(buf).digest("base64");
}

export function classify(
	changed: ReadonlySet<string>,
	r: ResolvedManifest,
	durationMs: number,
): ServerMessage {
	const ts = Date.now();
	if (changed.size === 0) return { v: 1, type: "build:success", ts, durationMs };

	const has = { manifest: false, background: false, content: false, page: false, css: false };
	const cssFiles: { publicPath: string; contentHash: string }[] = [];

	for (const file of changed) {
		if (file === "manifest.json" || file.startsWith("_locales/")) {
			has.manifest = true;
		} else if (file === r.backgroundFilename) {
			has.background = true;
		} else if (r.contentScriptFilenames.includes(file)) {
			has.content = true;
		} else if (r.pageFilenames.some((p) => p === file || stripExt(p) === stripExt(file))) {
			has.page = true;
		} else if (file.endsWith(".css")) {
			has.css = true;
			cssFiles.push({ publicPath: `/${file}`, contentHash: ts.toString(36) });
		}
	}

	if (has.manifest) return { v: 1, type: "reload:full", ts, reason: "manifest", durationMs };
	if (has.background) return { v: 1, type: "reload:full", ts, reason: "background", durationMs };
	if (has.page) return { v: 1, type: "reload:page", ts, pages: pages(r), durationMs };
	if (has.content) {
		return { v: 1, type: "reload:tabs", ts, matches: r.contentScriptMatches, durationMs };
	}
	if (has.css) return { v: 1, type: "css:update", ts, files: cssFiles };

	return { v: 1, type: "build:success", ts, durationMs };
}

function stripExt(p: string): string {
	return p.replace(/\.[^.]+$/, "");
}

function pages(r: ResolvedManifest): string[] {
	return r.pageFilenames.map((p) => stripExt(p).split("/").pop() ?? p);
}
