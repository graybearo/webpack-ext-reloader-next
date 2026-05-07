import { log } from "./log";
import { ReconnectingSocket } from "./reconnect";

type ReloaderGlobal = { port: number; maxRetries: number };
type Globals = typeof globalThis & { __EXT_RELOADER_NEXT__?: ReloaderGlobal };

const cfg = (globalThis as Globals).__EXT_RELOADER_NEXT__;
if (!cfg) throw new Error("[ext-reloader-next] missing prelude");

// Give the in-page toast time to render before the reload tears it down.
const RELOAD_DELAY = 300;
const PENDING_KEY = "__ext_reloader_next_pending_tabs__";

let everConnected = false;
let currentState: "ready" | "reconnected" | "disconnected" | "gaveUp" = "disconnected";

void resumePendingTabReload();

const sock = new ReconnectingSocket({
	url: `ws://localhost:${cfg.port}`,
	maxRetries: cfg.maxRetries === -1 ? undefined : cfg.maxRetries,
	onConnect: () => {
		setBadge("●", "#22c55e");
		if (everConnected) {
			log.reconnected();
			relayStatus("reconnected");
		} else {
			log.ready(cfg.port);
			relayStatus("ready", cfg.port);
		}
		everConnected = true;
		sock.send({
			v: 1,
			type: "hello",
			ts: Date.now(),
			role: "background",
			manifestVersion: 3,
			protocolVersion: 1,
		});
	},
	onDisconnect: (attempt: number) => {
		setBadge("●", "#facc15");
		if (attempt === 0 && everConnected) {
			log.disconnected();
			relayStatus("disconnected");
		}
	},
	onGiveUp: () => {
		setBadge("●", "#ef4444");
		log.gaveUp();
		relayStatus("gaveUp");
	},
	onMessage: (msg) => {
		const m = msg as Record<string, unknown> & { type?: string };
		switch (m.type) {
			case "reload:full":
				log.reloadFull(String(m.reason ?? ""));
				relayToTabs(m);
				relayToPages(m);
				setTimeout(() => chrome.runtime.reload(), RELOAD_DELAY);
				return;
			case "reload:tabs":
				log.reloadTabs();
				relayToTabs(m);
				setTimeout(() => stagePendingReload(m.matches as string[]), RELOAD_DELAY);
				return;
			case "reload:page":
				log.reloadPage();
				relayToPages(m);
				return;
			case "css:update": {
				const files = (m.files as { publicPath: string }[] | undefined) ?? [];
				log.cssUpdate(files.length);
				relayToTabs(m);
				return;
			}
			case "build:error":
				setBadge("!", "#ef4444");
				log.buildError(((m.errors as unknown[] | undefined) ?? []).length);
				relayToTabs(m);
				relayToPages(m);
				return;
			case "build:success":
				setBadge("●", "#22c55e");
				log.buildSuccess();
				relayToTabs(m);
				relayToPages(m);
				return;
		}
	},
});

sock.connect();

chrome.runtime.onInstalled.addListener(() => sock.ensureAlive());
chrome.runtime.onStartup?.addListener(() => sock.ensureAlive());
chrome.runtime.onConnect.addListener(() => sock.ensureAlive());

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
	sock.ensureAlive();
	if ((msg as { type?: string })?.type === "_status:request") {
		sendResponse({ type: "_status", state: currentState, port: cfg.port });
	}
	return false;
});

async function relayToTabs(msg: object): Promise<void> {
	const tabs = await chrome.tabs.query({});
	for (const tab of tabs) {
		if (tab.id == null) continue;
		chrome.tabs.sendMessage(tab.id, msg).catch(() => {
			// no content script in this tab — ignore
		});
	}
}

function relayToPages(msg: object): void {
	chrome.runtime.sendMessage(msg).catch(() => {
		// no extension page open — ignore
	});
}

function relayStatus(
	state: "ready" | "reconnected" | "disconnected" | "gaveUp",
	port?: number,
): void {
	currentState = state;
	const msg = { type: "_status", state, port };
	void relayToTabs(msg);
	relayToPages(msg);
}

async function stagePendingReload(matches: string[]): Promise<void> {
	await chrome.storage.local.set({ [PENDING_KEY]: matches });
	chrome.runtime.reload();
}

async function resumePendingTabReload(): Promise<void> {
	const result = await chrome.storage.local.get(PENDING_KEY);
	const matches = result[PENDING_KEY];
	if (!Array.isArray(matches) || matches.length === 0) return;
	await chrome.storage.local.remove(PENDING_KEY);
	const tabs = await chrome.tabs.query({ url: matches });
	await Promise.all(tabs.map((t) => (t.id == null ? null : chrome.tabs.reload(t.id))));
}

function setBadge(text: string, color: string): void {
	chrome.action?.setBadgeText({ text });
	chrome.action?.setBadgeBackgroundColor({ color });
}
