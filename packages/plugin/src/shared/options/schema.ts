import { z } from "zod";

const notifications = z
	.object({
		toast: z.boolean().default(true),
		errorOverlay: z.boolean().default(true),
		osNotifications: z
			.union([z.literal("all"), z.literal("errors"), z.literal(false)])
			.default("errors"),
		badge: z.boolean().default(true),
	})
	.default({});

export const extReloaderOptions = z
	.object({
		manifest: z.string().optional(),

		entries: z
			.object({
				background: z.union([z.string(), z.array(z.string())]).optional(),
				contentScript: z.union([z.string(), z.array(z.string())]).optional(),
				extensionPage: z.union([z.string(), z.array(z.string())]).optional(),
			})
			.optional(),

		port: z.number().int().min(1).max(65535).optional(),

		// How many times the SW client retries the WebSocket before giving up.
		// `-1` means retry forever. The retry loop is silent (HTTP-probed),
		// so a high cap doesn't pollute the console.
		maxRetries: z.number().int().min(-1).default(50),

		// Misnomer kept for migration ergonomics from the incumbent package.
		// Internally we call this `reloadTabsOnContentChange`.
		reloadPage: z.boolean().default(true),

		// Trade-off: avoids SW termination entirely, but the SW never sleeps in
		// dev — can mask production-only bugs around SW wakeup.
		keepAliveInDev: z.boolean().default(true),

		notifications,

		logLevel: z.enum(["silent", "normal", "verbose"]).default("normal"),

		// Skip mode-gating. By default the plugin disables when
		// `compiler.options.mode === "production"`.
		force: z.boolean().default(false),
	})
	.strict()
	.default({});

export type ExtReloaderOptions = z.input<typeof extReloaderOptions>;
