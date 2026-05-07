import { extReloaderOptions } from "./schema";

export function validateOptions(input: unknown) {
	const result = extReloaderOptions.safeParse(input);
	if (result.success) return result.data;

	const issues = result.error.issues
		.map((i) => `  - ${i.path.length ? `${i.path.join(".")}: ` : ""}${i.message}`)
		.join("\n");

	throw new Error(
		`[ext-reloader-next] Invalid plugin options:\n${issues}\n\nSee https://github.com/graybearo/webpack-ext-reloader-next#options for the full schema.`,
	);
}
