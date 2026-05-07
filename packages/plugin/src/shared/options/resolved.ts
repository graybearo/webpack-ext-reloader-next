import type { ParsedManifest } from "./manifest";

export interface ResolvedOptions {
	manifestPath: string;
	manifest: ParsedManifest;

	entryNames: {
		background: string[];
		contentScript: string[];
		extensionPage: string[];
	};

	contentScriptMatches: string[];

	externalWatchPaths: {
		manifest: string;
		locales: string[];
	};

	port: number;
	reloadTabsOnContentChange: boolean;
	keepAliveInDev: boolean;
	notifications: {
		toast: boolean;
		errorOverlay: boolean;
		osNotifications: "all" | "errors" | false;
		badge: boolean;
	};
	logLevel: "silent" | "normal" | "verbose";
	force: boolean;
}
