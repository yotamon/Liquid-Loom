import { defineConfig } from "vite";

export default defineConfig({
	build: {
		lib: {
			entry: "src/entrypoints/theme.js",
			formats: ["es"],
			fileName: "theme",
			cssFileName: "style"
		}
	}
});
