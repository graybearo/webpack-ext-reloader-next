import { defineConfig } from "tsup";

export default defineConfig([
	{
		entry: ["src/index.ts"],
		format: ["esm", "cjs"],
		dts: true,
		clean: true,
		sourcemap: true,
		shims: true,
		target: "node20",
		external: ["webpack", "ws", "chokidar", "picocolors", "node-notifier"],
		outExtension({ format }) {
			return { js: format === "cjs" ? ".cjs" : ".mjs" };
		},
	},
	{
		entry: { cli: "src/cli.ts" },
		format: ["esm"],
		target: "node20",
		shims: true,
		clean: false,
		sourcemap: false,
		dts: false,
		external: ["webpack", "ws", "chokidar", "picocolors", "node-notifier"],
		banner: { js: "#!/usr/bin/env node" },
		outExtension() {
			return { js: ".mjs" };
		},
	},
	{
		entry: {
			background: "src/client/background.ts",
			content: "src/client/content.ts",
			page: "src/client/page.ts",
		},
		outDir: "dist/clients",
		format: ["iife"],
		target: "es2022",
		platform: "browser",
		sourcemap: false,
		minify: false,
		dts: false,
		clean: false,
		outExtension() {
			return { js: ".js" };
		},
	},
]);
