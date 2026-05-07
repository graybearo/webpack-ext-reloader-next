import { z } from "zod";

export const manifestSchema = z.object({
	manifest_version: z.literal(3),
	name: z.string().optional(),
	version: z.string().optional(),

	background: z
		.object({
			service_worker: z.string().optional(),
			type: z.enum(["module", "classic"]).optional(),
		})
		.optional(),

	content_scripts: z
		.array(
			z.object({
				matches: z.array(z.string()),
				js: z.array(z.string()).optional(),
				css: z.array(z.string()).optional(),
				run_at: z.enum(["document_start", "document_end", "document_idle"]).optional(),
			}),
		)
		.optional(),

	action: z.object({ default_popup: z.string().optional() }).optional(),

	options_page: z.string().optional(),
	options_ui: z.object({ page: z.string().optional() }).optional(),
	devtools_page: z.string().optional(),

	default_locale: z.string().optional(),
});

export type ParsedManifest = z.infer<typeof manifestSchema>;
