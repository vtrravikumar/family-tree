// Detects family-record payloads embedded in frontend source or built assets.
//
// The frontend is public, so it must never carry real family data. This guard is
// deliberately structural: it does not contain a list of names (that would
// re-embed the very data it protects against).
//
// It flags:
//   1. gzip payloads encoded as base64 (they start with "H4sI") that decode
//      successfully, because a compressed blob inside a UI bundle is never expected;
//   2. runs of literal person records, i.e. several `givenName: "<literal>"`
//      properties, which is what an embedded sample dataset looks like. Application
//      code only ever assigns givenName from variables or form state.
import { gunzipSync } from "node:zlib";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const GZIP_BASE64 = /H4sI[A-Za-z0-9+/_-]{100,}={0,2}/g;
const LITERAL_GIVEN_NAME = /givenName["']?\s*:\s*["'`][^"'\`$\\]{1,80}["'`]/g;
export const LITERAL_RECORD_THRESHOLD = 3;

/** @returns {Array<{kind: string, detail: string}>} */
export function findEmbeddedFamilyData(text) {
  const findings = [];
  for (const match of text.matchAll(GZIP_BASE64)) {
    try {
      const raw = Buffer.from(match[0].replace(/-/g, "+").replace(/_/g, "/"), "base64");
      const decoded = gunzipSync(raw).toString("utf8");
      findings.push({
        kind: "gzip-base64-payload",
        detail: `${match[0].length}-char base64 string decodes to ${decoded.length} bytes after gunzip`,
      });
    } catch {
      // Not a valid gzip stream; ignore.
    }
  }
  const literalRecords = text.match(LITERAL_GIVEN_NAME)?.length ?? 0;
  if (literalRecords >= LITERAL_RECORD_THRESHOLD) {
    findings.push({
      kind: "literal-person-records",
      detail: `${literalRecords} literal givenName values found`,
    });
  }
  return findings;
}

const SCANNED_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".json", ".html", ".css", ".svg", ".txt", ".map"]);
const IGNORED_DIRECTORIES = new Set(["node_modules", ".git", ".tmp"]);
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;

/** Recursively scans a directory; returns [{file, kind, detail}]. Test files are skipped (they are not shipped). */
export function scanDirectory(directory, { skipTests = false } = {}) {
  const results = [];
  const walk = (current) => {
    let entries;
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }
    for (const name of entries) {
      const full = path.join(current, name);
      const stats = statSync(full);
      if (stats.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(name)) walk(full);
      } else if (SCANNED_EXTENSIONS.has(path.extname(name)) && !(skipTests && TEST_FILE.test(name))) {
        for (const finding of findEmbeddedFamilyData(readFileSync(full, "utf8"))) {
          results.push({ file: full, ...finding });
        }
      }
    }
  };
  walk(directory);
  return results;
}
