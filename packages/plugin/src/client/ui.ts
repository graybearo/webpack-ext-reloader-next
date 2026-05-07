type BuildError = { message: string; file?: string; line?: number; column?: number };

const OVERLAY_ID = "__ext_reloader_next_overlay__";
const TOAST_ID = "__ext_reloader_next_toast__";

export function showOverlay(errors: BuildError[]): void {
	if (typeof document === "undefined") return;
	let host = document.getElementById(OVERLAY_ID);
	if (!host) {
		host = document.createElement("div");
		host.id = OVERLAY_ID;
		Object.assign(host.style, {
			position: "fixed",
			inset: "0",
			background: "rgba(20,0,0,0.94)",
			color: "#ffefef",
			zIndex: "2147483647",
			padding: "32px",
			overflow: "auto",
			font: "13px/1.5 ui-monospace, monospace",
			whiteSpace: "pre-wrap",
		});
		document.documentElement.appendChild(host);
	}
	host.textContent = errors
		.map((e) => `${e.message}\n  at ${e.file ?? "?"}${e.line ? `:${e.line}` : ""}`)
		.join("\n\n");
}

export function hideOverlay(): void {
	if (typeof document === "undefined") return;
	document.getElementById(OVERLAY_ID)?.remove();
}

export function showToast(text: string): void {
	if (typeof document === "undefined" || !document.body) return;
	let toast = document.getElementById(TOAST_ID);
	if (!toast) {
		toast = document.createElement("div");
		toast.id = TOAST_ID;
		Object.assign(toast.style, {
			position: "fixed",
			top: "12px",
			right: "12px",
			background: "rgba(15,23,42,0.95)",
			color: "#a7f3d0",
			padding: "8px 12px",
			borderRadius: "6px",
			zIndex: "2147483647",
			font: "12px/1 ui-sans-serif, system-ui, sans-serif",
			boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
			pointerEvents: "none",
		});
		document.body.appendChild(toast);
	}
	toast.textContent = text;
	clearTimeout((toast as HTMLElement & { _t?: number })._t);
	(toast as HTMLElement & { _t?: number })._t = window.setTimeout(() => toast.remove(), 1500);
}
