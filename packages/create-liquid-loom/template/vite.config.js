import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => ({
	base: "",
	plugins: [tailwindcss()],
	build: {
		assetsDir: "",
		cssCodeSplit: false,
		emptyOutDir: false,
		minify: mode === "production" ? "esbuild" : false,
		outDir: path.join(projectRoot, "dist", "theme", "assets"),
		rollupOptions: {
			input: path.join(projectRoot, "src", "entrypoints", "theme.js"),
			output: {
				assetFileNames: "[name][extname]",
				entryFileNames: "theme.js"
			}
		},
		sourcemap: mode !== "production",
		target: "baseline-widely-available"
	},
	css: {
		devSourcemap: mode !== "production"
	}
}));
