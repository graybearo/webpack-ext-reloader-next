import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocket as WSClient, WebSocketServer } from "ws";
import { ReconnectingSocket } from "./reconnect";

function startServer(port = 0): Promise<{ wss: WebSocketServer; port: number }> {
	return new Promise((resolve) => {
		const wss = new WebSocketServer({ port, host: "localhost" });
		wss.once("listening", () => {
			resolve({ wss, port: (wss.address() as AddressInfo).port });
		});
	});
}

function stopServer(wss: WebSocketServer): Promise<void> {
	return new Promise((resolve) => {
		for (const c of wss.clients) c.terminate();
		wss.close(() => resolve());
	});
}

describe("ReconnectingSocket", () => {
	const sockets: ReconnectingSocket[] = [];
	const servers: WebSocketServer[] = [];

	afterEach(async () => {
		for (const s of sockets.splice(0)) s.close();
		for (const w of servers.splice(0)) await stopServer(w);
	});

	it("reconnects after the server restarts", async () => {
		let server = await startServer();
		servers.push(server.wss);

		const connects: number[] = [];
		const sock = new ReconnectingSocket({
			url: `ws://localhost:${server.port}`,
			onMessage: () => {},
			onConnect: () => connects.push(Date.now()),
			WebSocketCtor: WSClient as unknown as new (url: string) => WebSocket,
			baseDelayMs: 50,
			heartbeatMs: 60_000,
		});
		sockets.push(sock);
		sock.connect();

		await vi.waitFor(() => expect(connects.length).toBe(1));

		await stopServer(server.wss);
		servers.length = 0;

		server = await startServer(server.port);
		servers.push(server.wss);

		await vi.waitFor(() => expect(connects.length).toBeGreaterThanOrEqual(2), {
			timeout: 5000,
		});
	});
});
