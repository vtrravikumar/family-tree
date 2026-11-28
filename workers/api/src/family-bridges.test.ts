import { describe, expect, it } from "vitest";
import { effectiveFamilyReadAccess, handleFamilyBridgeRoute } from "./family-bridges";

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


describe("family bridge lifecycle authorization", () => {
  const bridge = {
    id: "bridge-1",
    family_a_id: "family-a",
    family_b_id: "family-b",
    initiating_family_id: "family-a",
    initiated_by_user_id: "owner-a",
  };
  function routeDb(roles: Record<string,string>, bridgeRow: Record<string,string> | null = null) {
    const writes: string[] = [];
    const db = {
      writes,
      prepare(sql: string) {
        let values: unknown[] = [];
        const statement = {
          __sql: sql,
          bind(...args: unknown[]) { values = args; return statement; },
          async first() {
            if (sql.includes("SELECT role FROM family_members")) return roles[String(values[0]) + ":" + String(values[1])] ? { role: roles[String(values[0]) + ":" + String(values[1])] } : null;
            if (sql.includes("SELECT 1 AS found FROM persons")) return { found: 1 };
            if (sql.includes("SELECT * FROM family_bridges")) return bridgeRow;
            return null;
          },
          async all() { return { results: [] }; },
          async run() { writes.push(sql); return { meta: { changes: 1 } }; },
        };
        return statement;
      },
      async batch(statements: Array<{__sql?:string}>) {
        writes.push(...statements.map(statement => statement.__sql ?? "BATCH:unknown"));
        return statements.map(() => ({ meta: { changes: 1 } }));
      },
    };
    return db as unknown as D1Database & { writes: string[] };
  }
  const invoke = (db: D1Database, path: string, method: string, actor: string, payload?: unknown) =>
    handleFamilyBridgeRoute(new Request("https://api.example.test" + path, {
      method,
      ...(payload ? { headers: { "content-type": "application/json" }, body: JSON.stringify(payload) } : {}),
    }), { DB: db }, new URL("https://api.example.test" + path), actor);

  it("allows only the initiating Owner with direct destination membership to create a pending request", async () => {
    const db = routeDb({ "family-a:owner-a": "owner", "family-b:owner-a": "viewer" });
    const response = await invoke(db, "/v1/families/family-a/bridges", "POST", "owner-a", {
      destinationFamilyId: "family-b",
      anchorPersonId: "a-anchor",
      connectorPersonId: "a-connector",
      destinationAnchorPersonId: "b-anchor",
      destinationConnectorPersonId: "b-connector",
    });
    expect(response?.status).toBe(201);
    expect(db.writes.some(sql => sql.includes("INSERT INTO family_bridges"))).toBe(true);
  });

  it("does not allow an inherited-only or non-Owner initiator to create a bridge", async () => {
    const db = routeDb({ "family-a:user-1": "editor" });
    const response = await invoke(db, "/v1/families/family-a/bridges", "POST", "user-1", {
      destinationFamilyId: "family-b",
      anchorPersonId: "a-anchor",
      connectorPersonId: "a-connector",
      destinationAnchorPersonId: "b-anchor",
      destinationConnectorPersonId: "b-connector",
    });
    expect(response?.status).toBe(403);
    expect(db.writes).toHaveLength(0);
  });

  it("requires the destination Owner for the one-time approval", async () => {
    const db = routeDb({ "family-b:user-1": "viewer" }, bridge);
    const response = await invoke(db, "/v1/bridges/bridge-1/approve", "POST", "user-1", {});
    expect(response?.status).toBe(403);
    expect(db.writes).toHaveLength(0);
  });

  it("allows the destination Owner to approve a pending bridge", async () => {
    const db = routeDb({ "family-b:owner-b": "owner" }, bridge);
    const response = await invoke(db, "/v1/bridges/bridge-1/approve", "POST", "owner-b", {});
    expect(response?.status).toBe(200);
    expect(db.writes.some(sql => sql.includes("UPDATE family_bridges SET status=?"))).toBe(true);
  });
});
