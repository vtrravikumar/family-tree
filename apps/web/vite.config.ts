import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { assertProductionApiConfiguration } from "./src/apiEnvironment";

const packageJson = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };
const commit = process.env.CF_PAGES_COMMIT_SHA || "";
const buildNumber = process.env.GITHUB_RUN_NUMBER || (commit ? commit.slice(0, 7) : "local");

assertProductionApiConfiguration(process.env.CF_PAGES_BRANCH, process.env.VITE_API_URL);

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __BUILD_NUMBER__: JSON.stringify(buildNumber),
  },
  server: { port: 5173 },
});
