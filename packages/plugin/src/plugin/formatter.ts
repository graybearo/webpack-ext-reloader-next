import pc from "picocolors";
import type { ServerMessage } from "../shared/messages";

const TAG = pc.dim("[ext-reloader-next]");

export function logReady(port: number): void {
	console.log(`${TAG} ${pc.cyan(`ws://localhost:${port}`)}`);
}

export function logEvent(message: ServerMessage): void {
	switch (message.type) {
		case "build:start":
			return; // too chatty, swallow
		case "build:success":
			console.log(`${TAG} ${pc.dim("·")} build done in ${ms(message.durationMs)}`);
			return;
		case "build:error":
			console.log(`${TAG} ${pc.red("✗")} build failed (${message.errors.length} error(s))`);
			return;
		case "reload:full":
			console.log(
				`${TAG} ${pc.green("↻")} full reload (${message.reason}) ${pc.dim(ms(message.durationMs))}`,
			);
			return;
		case "reload:tabs":
			console.log(
				`${TAG} ${pc.green("↻")} tabs reload ${pc.dim(`[${message.matches.join(", ")}]`)} ${pc.dim(ms(message.durationMs))}`,
			);
			return;
		case "reload:page":
			console.log(`${TAG} ${pc.green("↻")} page reload ${pc.dim(`[${message.pages.join(", ")}]`)}`);
			return;
		case "css:update":
			console.log(`${TAG} ${pc.green("≈")} swapped ${message.files.length} stylesheet(s)`);
			return;
	}
}

function ms(n: number): string {
	if (n < 1000) return `${n}ms`;
	return `${(n / 1000).toFixed(2)}s`;
}
