import { z } from "zod";

const role = z.enum(["background", "content", "page"]);

const hello = z.object({
	v: z.literal(1),
	type: z.literal("hello"),
	ts: z.number(),
	role,
	manifestVersion: z.literal(3),
	extensionId: z.string().optional(),
	pageUrl: z.string().optional(),
	protocolVersion: z.literal(1),
});

const ping = z.object({
	v: z.literal(1),
	type: z.literal("ping"),
	ts: z.number(),
	id: z.string(),
});

const clientError = z.object({
	v: z.literal(1),
	type: z.literal("client:error"),
	ts: z.number(),
	role,
	message: z.string(),
	stack: z.string().optional(),
});

const welcome = z.object({
	v: z.literal(1),
	type: z.literal("welcome"),
	ts: z.number(),
	serverProtocolVersion: z.literal(1),
	buildId: z.string(),
	features: z.object({
		cssHotSwap: z.boolean(),
		errorOverlay: z.boolean(),
		toast: z.boolean(),
	}),
});

const pong = z.object({
	v: z.literal(1),
	type: z.literal("pong"),
	ts: z.number(),
	id: z.string(),
});

const buildStart = z.object({
	v: z.literal(1),
	type: z.literal("build:start"),
	ts: z.number(),
});

const buildError = z.object({
	v: z.literal(1),
	type: z.literal("build:error"),
	ts: z.number(),
	errors: z.array(
		z.object({
			message: z.string(),
			file: z.string().optional(),
			line: z.number().optional(),
			column: z.number().optional(),
			stack: z.string().optional(),
			moduleId: z.string().optional(),
		}),
	),
	warnings: z.array(z.object({ message: z.string(), file: z.string().optional() })).optional(),
});

const buildSuccess = z.object({
	v: z.literal(1),
	type: z.literal("build:success"),
	ts: z.number(),
	durationMs: z.number(),
});

const reloadFull = z.object({
	v: z.literal(1),
	type: z.literal("reload:full"),
	ts: z.number(),
	reason: z.enum(["manifest", "locales", "background", "permissions", "manual"]),
	durationMs: z.number(),
});

const reloadTabs = z.object({
	v: z.literal(1),
	type: z.literal("reload:tabs"),
	ts: z.number(),
	matches: z.array(z.string()),
	durationMs: z.number(),
});

const reloadPage = z.object({
	v: z.literal(1),
	type: z.literal("reload:page"),
	ts: z.number(),
	pages: z.array(z.string()),
	durationMs: z.number(),
});

const cssUpdate = z.object({
	v: z.literal(1),
	type: z.literal("css:update"),
	ts: z.number(),
	files: z.array(z.object({ publicPath: z.string(), contentHash: z.string() })),
});

const serverShutdown = z.object({
	v: z.literal(1),
	type: z.literal("server:shutdown"),
	ts: z.number(),
});

export const clientMessage = z.discriminatedUnion("type", [hello, ping, clientError]);

export const serverMessage = z.discriminatedUnion("type", [
	welcome,
	pong,
	buildStart,
	buildError,
	buildSuccess,
	reloadFull,
	reloadTabs,
	reloadPage,
	cssUpdate,
	serverShutdown,
]);

export type ClientMessage = z.infer<typeof clientMessage>;
export type ServerMessage = z.infer<typeof serverMessage>;
