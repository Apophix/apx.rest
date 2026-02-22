import { defineConfig } from "vitest/config";
import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Vite plugin: when importing "foo.js", resolve to "foo.ts" if it exists on disk.
// This lets tests import from the TypeScript source rather than pre-compiled artefacts.
const preferTsSource = {
	name: "prefer-ts-source",
	enforce: "pre" as const,
	resolveId(id: string, importer: string | undefined) {
		if (!importer || !id.endsWith(".js")) return;
		const dir = dirname(importer.startsWith("file://") ? fileURLToPath(importer) : importer);
		const tsPath = resolve(dir, id.replace(/\.js$/, ".ts"));
		if (existsSync(tsPath)) return tsPath;
	},
};

export default defineConfig({
	plugins: [preferTsSource],
	test: {
		environment: "node",
		include: ["tests/**/*.test.ts"],
	},
});
