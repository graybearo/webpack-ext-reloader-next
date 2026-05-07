type WSCtor = new (url: string) => WebSocket;

export interface ReconnectOpts {
	url: string;
	onMessage: (m: unknown) => void;
	onConnect?: () => void;
	onDisconnect?: (attempt: number) => void;
	onGiveUp?: () => void;
	WebSocketCtor?: WSCtor;
	baseDelayMs?: number;
	maxDelayMs?: number;
	maxRetries?: number;
	heartbeatMs?: number;
}

export class ReconnectingSocket {
	private ws?: WebSocket;
	private retries = 0;
	private alive = false;
	private heartbeat?: ReturnType<typeof setInterval>;
	private retryTimer?: ReturnType<typeof setTimeout>;
	private closing = false;
	private readonly Ctor: WSCtor;
	private readonly base: number;
	private readonly max: number;
	private readonly hb: number;
	private readonly maxRetries: number;

	constructor(private readonly opts: ReconnectOpts) {
		this.Ctor = opts.WebSocketCtor ?? (WebSocket as unknown as WSCtor);
		this.base = opts.baseDelayMs ?? 1000;
		this.max = opts.maxDelayMs ?? 10_000;
		this.hb = opts.heartbeatMs ?? 5000;
		this.maxRetries = opts.maxRetries ?? Number.POSITIVE_INFINITY;
	}

	async connect(): Promise<void> {
		if (this.closing) return;
		// Probe via HTTP first. The `ws` library's server accepts HTTP requests
		// on the same port (returns 426 Upgrade Required). If the probe fails
		// with a TCP error, the server is down — skip WebSocket creation so
		// Chrome's network stack doesn't log the connection-refused error.
		if (!(await probe(this.opts.url))) {
			this.scheduleReconnect();
			return;
		}
		const ws = new this.Ctor(this.opts.url);
		this.ws = ws;

		ws.addEventListener("open", () => {
			this.retries = 0;
			this.alive = true;
			this.opts.onConnect?.();
			this.startHeartbeat();
		});
		ws.addEventListener("message", (e: MessageEvent) => {
			try {
				this.opts.onMessage(JSON.parse(String(e.data)));
			} catch {
				// drop malformed frames
			}
		});
		ws.addEventListener("close", () => {
			this.alive = false;
			this.stopHeartbeat();
			this.opts.onDisconnect?.(this.retries);
			if (!this.closing) this.scheduleReconnect();
		});
		ws.addEventListener("error", () => ws.close());
	}

	resetRetries(): void {
		this.retries = 0;
	}

	send(data: unknown): void {
		if (!this.alive || this.ws?.readyState !== 1 /* OPEN */) return;
		this.ws.send(JSON.stringify(data));
	}

	ensureAlive(): void {
		if (this.alive || this.closing) return;
		// A new chrome event woke us — try again even if we'd given up.
		this.retries = 0;
		this.connect();
	}

	close(): void {
		this.closing = true;
		this.stopHeartbeat();
		if (this.retryTimer) clearTimeout(this.retryTimer);
		this.ws?.close();
	}

	private scheduleReconnect(): void {
		if (this.retries >= this.maxRetries) {
			this.opts.onGiveUp?.();
			return;
		}
		const delay = Math.min(this.base * 2 ** this.retries++, this.max);
		this.retryTimer = setTimeout(() => this.connect(), delay);
	}

	private startHeartbeat(): void {
		this.heartbeat = setInterval(() => {
			this.send({ v: 1, type: "ping", ts: Date.now(), id: String(Date.now()) });
		}, this.hb);
	}

	private stopHeartbeat(): void {
		if (this.heartbeat) clearInterval(this.heartbeat);
		this.heartbeat = undefined;
	}
}

async function probe(wsUrl: string): Promise<boolean> {
	try {
		await fetch(wsUrl.replace(/^ws/, "http"), { method: "HEAD" });
		return true;
	} catch {
		return false;
	}
}
