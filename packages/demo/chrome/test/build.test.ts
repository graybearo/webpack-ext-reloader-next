import { existsSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import webpack, { type Configuration, type Stats } from "webpack";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "..");
const distDir = resolve(projectRoot, "dist");

const config = require(resolve(projectRoot, "webpack.config.cjs")) as Configuration;

function runWebpack(c: Configuration): Promise<Stats> {
	return new Promise((res, rej) => {
		webpack(c, (err, stats) => {
			if (err) return rej(err);
			if (!stats) return rej(new Error("webpack returned no stats"));
			res(stats);
		});
	});
}

describe("demo build", () => {
	beforeAll(() => {
		if (existsSync(distDir)) rmSync(distDir, { recursive: true, force: true });
	});

	it("produces a loadable MV3 build with the plugin registered", async () => {
		const stats = await runWebpack(config);

		expect(stats.hasErrors()).toBe(false);

		for (const file of ["manifest.json", "background.js", "content.js", "popup.js", "popup.html"]) {
			expect(existsSync(resolve(distDir, file)), `expected ${file} in dist`).toBe(true);
		}

		const manifest = JSON.parse(readFileSync(resolve(distDir, "manifest.json"), "utf8"));
		expect(manifest.manifest_version).toBe(3);

		const background = readFileSync(resolve(distDir, "background.js"), "utf8");
		expect(background).toContain("__EXT_RELOADER_NEXT__");
		expect(background).toContain("ReconnectingSocket");
	});

	afterAll(async () => {
		const ExtReloaderPlugin = config.plugins?.find(
			(p) => (p as { constructor: { name: string } }).constructor.name === "ExtReloader",
		) as { close?: () => Promise<void> } | undefined;
		await ExtReloaderPlugin?.close?.();
	});
});
