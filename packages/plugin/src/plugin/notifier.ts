type Notify = (opts: { title: string; message: string }) => void;

let cached: Notify | null | undefined;

async function getNotifier(): Promise<Notify | null> {
	if (cached !== undefined) return cached;
	try {
		const mod = (await import("node-notifier")) as unknown as {
			default?: { notify: (o: object) => void };
			notify?: (o: object) => void;
		};
		const n = mod.default ?? mod;
		if (typeof n.notify !== "function") {
			cached = null;
			return null;
		}
		cached = ({ title, message }) => n.notify?.({ title, message });
	} catch {
		cached = null;
	}
	return cached;
}

export async function notifyError(count: number): Promise<void> {
	const n = await getNotifier();
	n?.({
		title: "ext-reloader-next",
		message: `Build failed (${count} error${count === 1 ? "" : "s"})`,
	});
}

export async function notifyRecovery(): Promise<void> {
	const n = await getNotifier();
	n?.({ title: "ext-reloader-next", message: "Build recovered" });
}

export async function notifyReload(): Promise<void> {
	const n = await getNotifier();
	n?.({ title: "ext-reloader-next", message: "Extension reloaded" });
}
