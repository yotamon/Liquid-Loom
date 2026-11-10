import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [tailwindcss()],
	build: {
		lib: {
			entry: "src/entrypoints/theme.js",
			formats: ["es"],
			fileName: "theme",
			cssFileName: "style"
		}
	}
});
