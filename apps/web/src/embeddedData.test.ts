import { describe, expect, it } from "vitest";
import { findEmbeddedFamilyData } from "../scripts/embeddedDataGuard.mjs";

// Raw text of every shipped source file (tests excluded) and every public asset.
// Using import.meta.glob keeps this test free of Node-only APIs.
const sourceFiles = import.meta.glob(["./**/*", "!./**/*.test.ts"], { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const publicAssets = import.meta.glob("../public/**/*", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

async function gzipBase64(text: string): Promise<string> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

describe("frontend ships no embedded family data", () => {
  it("scans a non-trivial set of source files and assets", () => {
    expect(Object.keys(sourceFiles)).toContain("./App.tsx");
    expect(Object.keys(publicAssets).length).toBeGreaterThan(0);
  });

  it("has no dataset module (for example a *ImportData file) in the source tree", () => {
    const offenders = Object.keys(sourceFiles).filter((file) => /import-?data|raman/i.test(file));
    expect(offenders).toEqual([]);
  });

  it("contains no embedded gzip payloads or runs of literal person records in source or public assets", () => {
    const offenders = [...Object.entries(sourceFiles), ...Object.entries(publicAssets)]
      .map(([file, text]) => ({ file, findings: findEmbeddedFamilyData(text) }))
      .filter((entry) => entry.findings.length > 0);
    expect(offenders).toEqual([]);
  });

  it("does not need a bundled dataset to run: no module imports one and no gzip decoding is performed", () => {
    for (const [file, text] of Object.entries(sourceFiles)) {
      expect(text, `${file} must not import a data module`).not.toMatch(/from\s+["'][^"']*(import-?data|raman)[^"']*["']/i);
      expect(text, `${file} must not decompress embedded data`).not.toMatch(/DecompressionStream/);
    }
  });
});

describe("embedded data guard (synthetic fixtures)", () => {
  it("flags a gzip+base64 payload that decodes successfully", async () => {
    const payload = JSON.stringify({ people: Array.from({ length: 20 }, (_, i) => ({ key: `p${i}`, givenName: `Example${i}`, parents: [], partners: [] })) });
    const encoded = await gzipBase64(payload);
    expect(encoded.startsWith("H4sI")).toBe(true);
    const findings = findEmbeddedFamilyData(`export const sample = "${encoded}";`);
    expect(findings.map((f) => f.kind)).toContain("gzip-base64-payload");
  });

  it("flags a run of literal person records", () => {
    const text = `const people=[{givenName:"Example One"},{givenName:"Example Two"},{givenName:'Example Three'}];`;
    expect(findEmbeddedFamilyData(text).map((f) => f.kind)).toContain("literal-person-records");
  });

  it("does not flag ordinary application code that assigns givenName from variables", () => {
    const text = "const body={givenName:form.given,middleName:form.middle};const o={givenName:given.trim()};const p={givenName:`${x}`};";
    expect(findEmbeddedFamilyData(text)).toEqual([]);
  });

  it("does not flag an unrelated long base64 string", () => {
    expect(findEmbeddedFamilyData(`const img="data:image/png;base64,${"iVBORw0KGgo".repeat(40)}";`)).toEqual([]);
  });
});
