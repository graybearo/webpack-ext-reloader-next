import type { AddressInfo } from "node:net";
import { WebSocket, WebSocketServer } from "ws";
import type { ServerMessage } from "../shared/messages";
import { PROTOCOL_VERSION } from "../shared/protocol";

const FIRST_PORT = 9012;
const PORT_RANGE = 50;

export class ReloaderServer {
	private wss?: WebSocketServer;
	private readonly buildId = `${process.pid}-${Date.now()}`;
	port = 0;

	async start(preferred?: number): Promise<number> {
		const start = preferred ?? FIRST_PORT;
		for (let p = start; p < start + PORT_RANGE; p++) {
			const wss = await tryListen(p);
			if (!wss) continue;
			this.wss = wss;
			this.port = p;
			this.wireConnections();
			return p;
		}
		throw new Error(`[ext-reloader-next] no free port in ${start}-${start + PORT_RANGE}`);
	}

	broadcast(message: ServerMessage): void {
		if (!this.wss) return;
		const payload = JSON.stringify(message);
		for (const client of this.wss.clients) {
			if (client.readyState === WebSocket.OPEN) client.send(payload);
		}
	}

	stop(): Promise<void> {
		const wss = this.wss;
		if (!wss) return Promise.resolve();
		this.wss = undefined;
		return new Promise((resolve) => {
			for (const c of wss.clients) c.terminate();
			wss.close(() => resolve());
		});
	}

	private wireConnections(): void {
		this.wss?.on("connection", (socket) => {
			socket.on("message", (data) => this.handleMessage(socket, data));
		});
	}

	private handleMessage(socket: WebSocket, data: WebSocket.RawData): void {
		let parsed: { type?: string; id?: string };
		try {
			parsed = JSON.parse(String(data));
		} catch {
			return;
		}
		if (parsed.type === "hello") {
			socket.send(
				JSON.stringify({
					v: 1,
					type: "welcome",
					ts: Date.now(),
					serverProtocolVersion: PROTOCOL_VERSION,
					buildId: this.buildId,
					features: { cssHotSwap: true, errorOverlay: true, toast: true },
				} satisfies ServerMessage),
			);
		} else if (parsed.type === "ping" && parsed.id) {
			socket.send(
				JSON.stringify({
					v: 1,
					type: "pong",
					ts: Date.now(),
					id: parsed.id,
				} satisfies ServerMessage),
			);
		}
	}
}

function tryListen(port: number): Promise<WebSocketServer | null> {
	return new Promise((resolve) => {
		const wss = new WebSocketServer({ port, host: "localhost" });
		wss.once("listening", () => {
			const info = wss.address() as AddressInfo;
			if (info.port !== port) {
				wss.close();
				resolve(null);
				return;
			}
			resolve(wss);
		});
		wss.once("error", () => resolve(null));
	});
}
