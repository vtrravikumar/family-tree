import { describe, expect, it } from "vitest";
import { effectiveFamilyReadAccess } from "./family-bridges";

type QueryResult = { role?: string; bridge_id?: string; source_family_id?: string };
function mockDb(directRole: string | null, inherited: Array<{bridge_id:string;source_family_id:string}> = []) {
  return {
    prepare(sql: string) {
      let values: unknown[] = [];
      const statement = {
        bind(...args: unknown[]) { values = args; return statement; },
        async first() {
          if (sql.includes("SELECT role FROM family_members")) return directRole ? { role: directRole } : null;
          return null;
        },
        async all() {
          if (sql.includes("SELECT DISTINCT b.id AS bridge_id")) return { results: inherited };
          return { results: [] };
        },
      };
      return statement;
    },
  } as unknown as D1Database;
}

describe("family bridge effective read access", () => {
  it("preserves a user's direct destination role instead of downgrading it to inherited Viewer", async () => {
    const access = await effectiveFamilyReadAccess(mockDb("editor", [
      { bridge_id: "bridge-1", source_family_id: "family-a" },
    ]), "family-b", "user-1");
    expect(access).toEqual({
      role: "editor",
      source: "direct",
      bridgeIds: [],
      sourceFamilyIds: [],
    });
  });

  it("grants Viewer only when an active bridge has a current direct source-family membership", async () => {
    const access = await effectiveFamilyReadAccess(mockDb(null, [
      { bridge_id: "bridge-1", source_family_id: "family-a" },
      { bridge_id: "bridge-2", source_family_id: "family-c" },
    ]), "family-b", "user-1");
    expect(access.role).toBe("viewer");
    expect(access.source).toBe("bridge");
    expect(access.bridgeIds).toEqual(["bridge-1", "bridge-2"]);
    expect(access.sourceFamilyIds).toEqual(["family-a", "family-c"]);
  });

  it("denies access when the user has no direct membership and no active bridge path", async () => {
    const access = await effectiveFamilyReadAccess(mockDb(null), "family-b", "user-1");
    expect(access).toEqual({
      role: null,
      source: null,
      bridgeIds: [],
      sourceFamilyIds: [],
    });
  });
});
