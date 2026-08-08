import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  extends: [ultracite],
  ignorePatterns: ["migrations/*", "*.md"],
  sortImports: {
    ignoreCase: true,
    newlinesBetween: false,
    order: "asc",
  },
  sortTailwindcss: {
    stylesheet: "src/styles/global.css",
  },
});
