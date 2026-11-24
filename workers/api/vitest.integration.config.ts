import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrations = await readD1Migrations(path.join(here, "migrations"));

export default defineWorkersConfig({
  test: {
    include: ["test/**/*.integration.test.ts"],
    setupFiles: ["./test/apply-migrations.ts"],
    poolOptions: {
      workers: {
        wrangler: {
          configPath: "./wrangler.toml",
          environment: "dev",
        },
        miniflare: {
          bindings: {
            DEV_API_TOKEN: "integration-test-token",
            TEST_MIGRATIONS: migrations,
          },
        },
      },
    },
  },
});
