import { log } from "./log";
import { hideOverlay, showOverlay } from "./ui";

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
		errors?: { message: string; file?: string; line?: number }[];
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
	if (m.type === "build:success" || m.type?.startsWith("reload:")) hideOverlay();
	if (m.type === "reload:page") {
		log.reloadPage();
		location.reload();
	}
	return false;
});
