import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import chokidar from "chokidar";
import { classify } from "./plugin/diff";
import { logEvent, logReady } from "./plugin/formatter";
import { loadManifest } from "./plugin/resolve";
import { ReloaderServer } from "./plugin/server";

const HELP = `Usage: webpack-ext-reloader-next [options]

Watches an extension dist directory and broadcasts smart reload messages
over WebSocket to clients in your extension. Use this if you don't build
with webpack — the plugin is the recommended path for webpack users.

Options:
  -p, --port <number>     WebSocket port (default: auto from 9012)
      --manifest <path>   Path to manifest.json (default: probe in --dist)
  -d, --dist <path>       Directory to watch (default: ./dist)
  -h, --help              Show this help`;

async function main(): Promise<void> {
	const { values } = parseArgs({
		options: {
			port: { type: "string", short: "p" },
			manifest: { type: "string" },
			dist: { type: "string", short: "d" },
			help: { type: "boolean", short: "h" },
		},
	});

	if (values.help) {
		console.log(HELP);
		return;
	}

	const distDir = resolve(process.cwd(), values.dist ?? "dist");
	if (!existsSync(distDir)) {
		console.error(`[ext-reloader-next] dist directory not found: ${distDir}`);
		process.exit(1);
	}

	const resolved = loadManifest(distDir, values.manifest);

	const server = new ReloaderServer();
	const port = await server.start(values.port ? Number(values.port) : undefined);
	logReady(port);

	let prev = await snapshot(distDir);

	const watcher = chokidar.watch(distDir, { ignoreInitial: true });
	watcher.on("all", async () => {
		const cur = await snapshot(distDir);
		const changed = diffSnapshots(prev, cur);
		prev = cur;
		if (changed.size === 0) return;
		const message = classify(changed, resolved, 0);
		server.broadcast(message);
		logEvent(message);
	});

	const shutdown = async (): Promise<void> => {
		await watcher.close();
		await server.stop();
		process.exit(0);
	};
	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
}

async function snapshot(root: string): Promise<Map<string, string>> {
	const out = new Map<string, string>();
	await walk(root, root, out);
	return out;
}

async function walk(root: string, dir: string, out: Map<string, string>): Promise<void> {
	const entries = await readdir(dir, { withFileTypes: true });
	for (const entry of entries) {
		const abs = resolve(dir, entry.name);
		if (entry.isDirectory()) {
			await walk(root, abs, out);
		} else if (entry.isFile()) {
			const buf = await readFile(abs);
			const rel = abs
				.slice(root.length + 1)
				.split("\\")
				.join("/");
			out.set(rel, hashOf(buf));
		}
	}
}

function diffSnapshots(prev: Map<string, string>, cur: Map<string, string>): Set<string> {
	const out = new Set<string>();
	for (const [name, hash] of cur) {
		if (prev.get(name) !== hash) out.add(name);
	}
	for (const name of prev.keys()) {
		if (!cur.has(name)) out.add(name);
	}
	return out;
}

function hashOf(buf: Buffer): string {
	let h = 0;
	for (let i = 0; i < buf.length; i++) h = (Math.imul(31, h) + (buf[i] ?? 0)) | 0;
	return String(h);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
