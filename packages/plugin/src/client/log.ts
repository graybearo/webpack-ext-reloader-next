type Level = "info" | "success" | "warn" | "error";

const TAG_BG = "#0b1020";
const TAG_FG = "#7dd3fc";

const LEVEL_COLOR: Record<Level, string> = {
	info: "#7dd3fc",
	success: "#22c55e",
	warn: "#facc15",
	error: "#ef4444",
};

function emit(level: Level, text: string): void {
	const tagStyle = `background:${TAG_BG};color:${TAG_FG};font-weight:600;border-radius:3px;padding:1px 4px`;
	const msgStyle = `color:${LEVEL_COLOR[level]};font-weight:500`;
	console.log(`%c ext-reloader-next %c ${text}`, tagStyle, msgStyle);
}

export const log = {
	info(text: string): void {
		emit("info", text);
	},
	success(text: string): void {
		emit("success", text);
	},
	warn(text: string): void {
		emit("warn", text);
	},
	error(text: string): void {
		emit("error", text);
	},

	ready(port: number): void {
		emit("info", `connected · ws://localhost:${port}`);
	},
	reconnected(): void {
		emit("success", "reconnected");
	},
	disconnected(): void {
		emit("warn", "disconnected · retrying");
	},
	gaveUp(): void {
		emit("error", "dev server unreachable · stopped retrying");
	},
	reloadFull(reason: string): void {
		emit("info", `↻ full reload (${reason})`);
	},
	reloadTabs(): void {
		emit("info", "↻ tabs reload");
	},
	reloadPage(): void {
		emit("info", "↻ page reload");
	},
	cssUpdate(count: number): void {
		emit("success", `≈ swapped ${count} stylesheet${count === 1 ? "" : "s"}`);
	},
	buildError(count: number): void {
		emit("error", `✗ build failed (${count} error${count === 1 ? "" : "s"})`);
	},
	buildSuccess(): void {
		emit("success", "✓ build done");
	},
};
