import tailwindcss from "@tailwindcss/postcss";
import autoprefixer from "autoprefixer";
import cssnano from "cssnano";

const production = process.env.NODE_ENV === "production";

export default {
	plugins: [tailwindcss(), autoprefixer(), ...(production ? [cssnano({ preset: "default" })] : [])]
};
