import { log } from "./log";
import { hideOverlay, showOverlay, showToast } from "./ui";

type StatusMsg = {
	type?: string;
	state?: "ready" | "reconnected" | "disconnected" | "gaveUp";
	port?: number;
};

void chrome.runtime
	.sendMessage({ type: "_status:request" })
	.then((reply: StatusMsg | undefined) => {
		if (!reply) return;
		if (reply.state === "ready" && reply.port != null) log.ready(reply.port);
		else if (reply.state === "disconnected") log.disconnected();
		else if (reply.state === "gaveUp") log.gaveUp();
	})
	.catch(() => {
		// SW may not be ready yet — status broadcasts will catch up
	});

chrome.runtime.onMessage.addListener((msg) => {
	const m = msg as {
		type?: string;
		state?: "ready" | "reconnected" | "disconnected" | "gaveUp";
		port?: number;
		files?: { publicPath: string; contentHash: string }[];
		errors?: { message: string; file?: string; line?: number }[];
		reason?: string;
	};

	if (m.type === "_status") {
		if (m.state === "ready" && m.port != null) log.ready(m.port);
		if (m.state === "reconnected") log.reconnected();
		if (m.state === "disconnected") log.disconnected();
		if (m.state === "gaveUp") log.gaveUp();
		return false;
	}

	if (m.type === "build:error" && m.errors) {
		showOverlay(m.errors);
		log.buildError(m.errors.length);
		return false;
	}
	if (m.type === "build:success" || m.type?.startsWith("reload:") || m.type === "css:update") {
		hideOverlay();
	}
	if (m.type === "build:success") log.buildSuccess();
	if (m.type === "css:update" && m.files) {
		hotSwapStyles(m.files);
		showToast(`Styles updated · ${m.files.length}`);
		log.cssUpdate(m.files.length);
	}
	if (m.type === "reload:tabs") {
		showToast("Reloading tab…");
		log.reloadTabs();
	}
	if (m.type === "reload:full") {
		showToast(`Reloading extension${m.reason ? ` (${m.reason})` : ""}…`);
		log.reloadFull(m.reason ?? "");
	}
	return false;
});

function hotSwapStyles(files: { publicPath: string; contentHash: string }[]): void {
	const links = document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]');
	for (const { publicPath, contentHash } of files) {
		const needle = publicPath.replace(/^\//, "");
		for (const link of Array.from(links)) {
			if (!link.href.includes(needle)) continue;
			const clone = link.cloneNode() as HTMLLinkElement;
			clone.href = `${link.href.split("?")[0]}?v=${contentHash}`;
			clone.onload = () => link.remove();
			link.parentNode?.insertBefore(clone, link.nextSibling);
		}
	}
}
