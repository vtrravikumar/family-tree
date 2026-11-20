import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };
const commit = process.env.CF_PAGES_COMMIT_SHA || "";
const buildNumber = process.env.GITHUB_RUN_NUMBER || (commit ? commit.slice(0, 7) : "local");

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __BUILD_NUMBER__: JSON.stringify(buildNumber),
  },
  server: { port: 5173 },
});
