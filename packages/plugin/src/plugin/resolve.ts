import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ParsedManifest } from "../shared/options";
import { manifestSchema } from "../shared/options";

const PROBE = [
	"manifest.json",
	"src/manifest.json",
	"public/manifest.json",
	"static/manifest.json",
];

export interface ResolvedManifest {
	path: string;
	manifest: ParsedManifest;
	backgroundFilename?: string;
	contentScriptFilenames: string[];
	contentScriptCss: string[];
	contentScriptMatches: string[];
	pageFilenames: string[];
}

export function loadManifest(context: string, override?: string): ResolvedManifest {
	const path = override
		? resolve(context, override)
		: PROBE.map((p) => resolve(context, p)).find(existsSync);

	if (!path) {
		throw new Error(`[ext-reloader-next] manifest.json not found (probed: ${PROBE.join(", ")})`);
	}

	const raw = JSON.parse(readFileSync(path, "utf8"));
	const manifest = manifestSchema.parse(raw);

	const js: string[] = [];
	const css: string[] = [];
	const matches: string[] = [];
	for (const cs of manifest.content_scripts ?? []) {
		if (cs.js) js.push(...cs.js);
		if (cs.css) css.push(...cs.css);
		matches.push(...cs.matches);
	}

	const pageFilenames: string[] = [];
	if (manifest.action?.default_popup) pageFilenames.push(manifest.action.default_popup);
	const opts = manifest.options_page ?? manifest.options_ui?.page;
	if (opts) pageFilenames.push(opts);
	if (manifest.devtools_page) pageFilenames.push(manifest.devtools_page);

	return {
		path,
		manifest,
		backgroundFilename: manifest.background?.service_worker,
		contentScriptFilenames: dedupe(js),
		contentScriptCss: dedupe(css),
		contentScriptMatches: dedupe(matches),
		pageFilenames: dedupe(pageFilenames),
	};
}

function dedupe<T>(arr: T[]): T[] {
	return Array.from(new Set(arr));
}
