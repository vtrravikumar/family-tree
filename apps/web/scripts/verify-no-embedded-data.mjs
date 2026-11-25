// Fails the build if the built frontend contains embedded family-record payloads.
// Usage: node scripts/verify-no-embedded-data.mjs [directory]   (default: dist)
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { scanDirectory } from "./embeddedDataGuard.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.resolve(root, process.argv[2] ?? "dist");

if (!existsSync(target)) {
  console.error(`verify-no-embedded-data: ${target} does not exist. Build the frontend first.`);
  process.exit(2);
}

const findings = scanDirectory(target);
if (findings.length > 0) {
  console.error("verify-no-embedded-data: embedded family-record data detected in built assets:");
  for (const f of findings) console.error(`  - ${path.relative(root, f.file)}: ${f.kind} (${f.detail})`);
  console.error("Remove the data from the frontend. Real family data must never ship in public assets.");
  process.exit(1);
}
console.log(`verify-no-embedded-data: no embedded family-record payloads found in ${path.relative(root, target) || "."}.`);
