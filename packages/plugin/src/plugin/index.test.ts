import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import webpack from "webpack";
import WebSocket from "ws";
import { ExtReloader } from "./index";

const fixtures = join(tmpdir(), `ext-reloader-next-${process.pid}`);

beforeAll(() => {
	mkdirSync(fixtures, { recursive: true });
	writeFileSync(join(fixtures, "background.js"), 'console.log("bg");\n');
	writeFileSync(
		join(fixtures, "manifest.json"),
		JSON.stringify({
			manifest_version: 3,
			name: "fixture",
			version: "0.0.0",
			background: { service_worker: "background.js" },
		}),
	);
});

afterAll(() => {
	rmSync(fixtures, { recursive: true, force: true });
});

describe("ExtReloader", () => {
	let reloader: ExtReloader | undefined;

	afterEach(async () => {
		await reloader?.close();
		reloader = undefined;
	});

	it("welcomes a client and broadcasts build:success after a build", async () => {
		reloader = new ExtReloader();

		const compiler = webpack({
			mode: "development",
			devtool: false,
			context: fixtures,
			entry: { background: join(fixtures, "background.js") },
			output: { path: join(fixtures, "dist"), filename: "[name].js" },
			plugins: [reloader],
		});

		const port = await reloader.serverReady;
		const ws = new WebSocket(`ws://localhost:${port}`);
		const messages: Array<Record<string, unknown>> = [];
		ws.on("message", (data) => messages.push(JSON.parse(String(data))));
		await new Promise<void>((resolve) => ws.once("open", () => resolve()));

		ws.send(
			JSON.stringify({
				v: 1,
				type: "hello",
				ts: Date.now(),
				role: "background",
				manifestVersion: 3,
				protocolVersion: 1,
			}),
		);

		await vi.waitFor(() => expect(messages.find((m) => m.type === "welcome")).toBeDefined());

		await new Promise<void>((resolve, reject) => {
			compiler.run((err) => (err ? reject(err) : resolve()));
		});

		await vi.waitFor(() => expect(messages.find((m) => m.type === "build:success")).toBeDefined());

		ws.close();
		await new Promise<void>((resolve) => compiler.close(() => resolve()));
	});
});
