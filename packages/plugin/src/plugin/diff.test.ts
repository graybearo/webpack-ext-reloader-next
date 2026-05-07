import { describe, expect, it } from "vitest";
import { BuildTracker, classify } from "./diff";
import type { ResolvedManifest } from "./resolve";

const manifest: ResolvedManifest = {
	path: "/x/manifest.json",
	manifest: { manifest_version: 3 },
	backgroundFilename: "background.js",
	contentScriptFilenames: ["content.js"],
	contentScriptCss: ["content.css"],
	contentScriptMatches: ["*://mail.google.com/*"],
	pageFilenames: ["popup.html"],
};

describe("classify", () => {
	it.each([
		[new Set(["manifest.json"]), "reload:full", "manifest"],
		[new Set(["_locales/en/messages.json"]), "reload:full", "manifest"],
		[new Set(["background.js"]), "reload:full", "background"],
		[new Set(["popup.js"]), "reload:page", undefined],
		[new Set(["content.js"]), "reload:tabs", undefined],
		[new Set(["content.css"]), "css:update", undefined],
		[new Set(["assets/icon.png"]), "build:success", undefined],
		[new Set<string>(), "build:success", undefined],
		// most disruptive wins
		[new Set(["manifest.json", "content.js"]), "reload:full", "manifest"],
		[new Set(["background.js", "content.js"]), "reload:full", "background"],
		[new Set(["popup.js", "content.js"]), "reload:page", undefined],
	])("changes %j → %s", (changed, expectedType, expectedReason) => {
		const msg = classify(changed, manifest, 100);
		expect(msg.type).toBe(expectedType);
		if (expectedReason && msg.type === "reload:full") {
			expect(msg.reason).toBe(expectedReason);
		}
	});
});

describe("BuildTracker.flush", () => {
	const snap = (entries: Record<string, string>): Map<string, string> =>
		new Map(Object.entries(entries));

	it("coalesces multiple recordSuccess calls into one message reflecting the latest cumulative diff", () => {
		const tracker = new BuildTracker();

		// First build sets the baseline (firstBuild → build:success regardless of diff).
		tracker.recordSuccess(snap({ "background.js": "h0" }), 10);
		expect(tracker.flush(manifest)?.type).toBe("build:success");

		// Three rapid rebuilds. Only flush() at the end. The most disruptive change
		// (manifest.json) should win even though it appeared in only the last record.
		tracker.recordSuccess(snap({ "background.js": "h0", "popup.js": "p1" }), 5);
		tracker.recordSuccess(snap({ "background.js": "h1", "popup.js": "p1" }), 5);
		tracker.recordSuccess(
			snap({ "background.js": "h1", "popup.js": "p1", "manifest.json": "m1" }),
			5,
		);

		const msg = tracker.flush(manifest);
		expect(msg?.type).toBe("reload:full");
		if (msg?.type === "reload:full") expect(msg.reason).toBe("manifest");
	});

	it("returns undefined when there's nothing pending", () => {
		const tracker = new BuildTracker();
		expect(tracker.flush(manifest)).toBeUndefined();
	});

	it("coalesces a chokidar manifest change with a webpack rebuild into one reload:full", () => {
		const tracker = new BuildTracker();
		// Initial baseline so subsequent flushes diff normally.
		tracker.recordSuccess(snap({ "background.js": "h0", "manifest.json": "m0" }), 10);
		tracker.flush(manifest);

		// chokidar fires before webpack finishes recompiling.
		tracker.recordManifestChange();
		tracker.recordSuccess(snap({ "background.js": "h0", "manifest.json": "m1" }), 5);

		const msg = tracker.flush(manifest);
		expect(msg?.type).toBe("reload:full");
		if (msg?.type === "reload:full") expect(msg.reason).toBe("manifest");
	});
});
