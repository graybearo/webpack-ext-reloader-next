import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Compilation as Comp, type Compilation, type Compiler, sources } from "webpack";

const PLUGIN_NAME = "ExtReloader";

export type ClientRole = "background" | "content" | "page";

export interface InjectionTarget {
	role: ClientRole;
	filename: string;
}

export interface RuntimeConfig {
	port: number;
	maxRetries: number;
}

export function injectClients(
	compiler: Compiler,
	targets: InjectionTarget[],
	getConfig: () => Promise<RuntimeConfig>,
): void {
	if (targets.length === 0) return;

	compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
		compilation.hooks.processAssets.tapPromise(
			{ name: PLUGIN_NAME, stage: Comp.PROCESS_ASSETS_STAGE_ADDITIONS },
			async () => {
				const config = await getConfig();
				for (const target of targets) {
					injectInto(compilation, target, config);
				}
			},
		);
	});
}

function injectInto(
	compilation: Compilation,
	target: InjectionTarget,
	config: RuntimeConfig,
): void {
	const entry = findEntryByFile(compilation, target.filename);
	if (!entry) return;

	const prelude = `;globalThis.__EXT_RELOADER_NEXT__=${JSON.stringify(config)};`;
	const client = readClient(target.role);

	for (const file of entry.getFiles()) {
		if (!file.endsWith(".js")) continue;
		const asset = compilation.getAsset(file);
		if (!asset) continue;
		const original = asset.source.source().toString();
		compilation.updateAsset(file, new sources.RawSource(`${prelude}${client}\n${original}`));
	}
}

function findEntryByFile(compilation: Compilation, filename: string) {
	for (const entry of compilation.entrypoints.values()) {
		if (entry.getFiles().includes(filename)) return entry;
	}
	return undefined;
}

const clientCache = new Map<ClientRole, string>();
function readClient(role: ClientRole): string {
	const cached = clientCache.get(role);
	if (cached) return cached;
	const here = dirname(fileURLToPath(import.meta.url));
	const candidates = [
		resolve(here, "clients", `${role}.js`),
		resolve(here, "..", "..", "dist", "clients", `${role}.js`),
	];
	const found = candidates.find((p) => existsSync(p));
	if (!found) {
		throw new Error(
			"[ext-reloader-next] client bundle not found. Run `pnpm --filter ./packages/plugin build` first.",
		);
	}
	const code = readFileSync(found, "utf8");
	clientCache.set(role, code);
	return code;
}
