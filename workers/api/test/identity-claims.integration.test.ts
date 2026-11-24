import { beforeEach, describe, expect, it } from "vitest";
import { env, SELF } from "cloudflare:test";

const FAMILY_ID = "family-test";
const OWNER_ID = "dev-owner";
const REQUESTER_ID = "requester-test";
const PERSON_ID = "person-test";
const CLAIM_ID = "claim-test";
const API_TOKEN = "integration-test-token";

async function run(sql: string, values: unknown[] = []) {
  return env.DB.prepare(sql).bind(...values).run();
}

async function seedClaim() {
  const timestamp = "2026-11-24T00:00:00.000Z";
  await run(
    "INSERT OR IGNORE INTO users(id,identity_provider,provider_subject,email,display_name,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
    [OWNER_ID, "dev", OWNER_ID, "owner@example.test", "Test Owner", timestamp, timestamp],
  );
  await run(
    "INSERT OR IGNORE INTO users(id,identity_provider,provider_subject,email,display_name,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
    [REQUESTER_ID, "google", "requester-subject", "requester@example.test", "Test Requester", timestamp, timestamp],
  );
  await run(
    "INSERT INTO families(id,name,owner_user_id,created_at,updated_at) VALUES(?,?,?,?,?)",
    [FAMILY_ID, "Integration Test Family", OWNER_ID, timestamp, timestamp],
  );
  await run(
    "INSERT INTO family_members(family_id,user_id,role,joined_at) VALUES(?,?,?,?)",
    [FAMILY_ID, OWNER_ID, "owner", timestamp],
  );
  await run(
    "INSERT INTO family_members(family_id,user_id,role,joined_at) VALUES(?,?,?,?)",
    [FAMILY_ID, REQUESTER_ID, "editor", timestamp],
  );
  await run(
    "INSERT INTO persons(id,family_id,given_name,created_at,updated_at) VALUES(?,?,?,?,?)",
    [PERSON_ID, FAMILY_ID, "Test Person", timestamp, timestamp],
  );
  await run(
    "INSERT INTO person_identity_claims(id,family_id,person_id,requester_user_id,status,requested_at) VALUES(?,?,?,?,?,?)",
    [CLAIM_ID, FAMILY_ID, PERSON_ID, REQUESTER_ID, "pending", timestamp],
  );
}

async function review(decision: "approve" | "reject") {
  return SELF.fetch(
    `https://vansvriksh.test/v1/families/${FAMILY_ID}/identity-claims/${CLAIM_ID}/review`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ decision, reason: "Integration test review" }),
    },
  );
}

describe("identity claim review against local D1", () => {
  beforeEach(async () => {
    await run("DELETE FROM audit_logs");
    await run("DELETE FROM person_identity_links");
    await run("DELETE FROM person_identity_claims");
    await run("DELETE FROM family_members");
    await run("DELETE FROM persons");
    await run("DELETE FROM families");
    await run("DELETE FROM users WHERE id != ?", [OWNER_ID]);
    await seedClaim();
  });

  it("approves a pending claim and writes exactly one identity link and audit record", async () => {
    const response = await review("approve");

    expect(response.status).toBe(200);
    const claim = await env.DB.prepare(
      "SELECT status, reviewed_by_user_id FROM person_identity_claims WHERE id=?",
    ).bind(CLAIM_ID).first<{ status: string; reviewed_by_user_id: string }>();
    const link = await env.DB.prepare(
      "SELECT user_id FROM person_identity_links WHERE family_id=? AND person_id=?",
    ).bind(FAMILY_ID, PERSON_ID).first<{ user_id: string }>();
    const audit = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM audit_logs WHERE action='identity.claim_approved' AND entity_id=?",
    ).bind(PERSON_ID).first<{ count: number }>();

    expect(claim?.status).toBe("approved");
    expect(claim?.reviewed_by_user_id).toBe(OWNER_ID);
    expect(link?.user_id).toBe(REQUESTER_ID);
    expect(audit?.count).toBe(1);
  });

  it("allows only one of two competing approval/rejection decisions to win", async () => {
    const responses = await Promise.all([review("approve"), review("reject")]);
    const statuses = responses.map((response) => response.status).sort((a, b) => a - b);

    expect(statuses.filter((status) => status === 200)).toHaveLength(1);
    expect(statuses.every((status) => status === 200 || status === 404 || status === 409)).toBe(true);

    const claim = await env.DB.prepare(
      "SELECT status FROM person_identity_claims WHERE id=?",
    ).bind(CLAIM_ID).first<{ status: string }>();
    const audit = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM audit_logs WHERE entity_id=? AND action IN ('identity.claim_approved','identity.claim_rejected')",
    ).bind(PERSON_ID).first<{ count: number }>();
    const links = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM person_identity_links WHERE family_id=?",
    ).bind(FAMILY_ID).first<{ count: number }>();

    expect(["approved", "rejected"]).toContain(claim?.status);
    expect(audit?.count).toBe(1);
    expect(links?.count).toBe(claim?.status === "approved" ? 1 : 0);
  });

  it("rolls back approval when the identity uniqueness constraint rejects the link", async () => {
    const timestamp = "2026-11-24T00:00:00.000Z";
    await run(
      "INSERT INTO persons(id,family_id,given_name,created_at,updated_at) VALUES(?,?,?,?,?)",
      ["another-person", FAMILY_ID, "Another Person", timestamp, timestamp],
    );
    await run(
      "INSERT INTO person_identity_links(family_id,person_id,user_id,linked_by_user_id,linked_at) VALUES(?,?,?,?,?)",
      [FAMILY_ID, "another-person", REQUESTER_ID, OWNER_ID, timestamp],
    );

    const response = await review("approve");

    expect(response.status).toBe(409);
    const claim = await env.DB.prepare(
      "SELECT status, reviewed_at FROM person_identity_claims WHERE id=?",
    ).bind(CLAIM_ID).first<{ status: string; reviewed_at: string | null }>();
    const audit = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM audit_logs WHERE entity_id=? AND action='identity.claim_approved'",
    ).bind(PERSON_ID).first<{ count: number }>();
    const links = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM person_identity_links WHERE family_id=?",
    ).bind(FAMILY_ID).first<{ count: number }>();

    expect(claim?.status).toBe("pending");
    expect(claim?.reviewed_at).toBeNull();
    expect(audit?.count).toBe(0);
    expect(links?.count).toBe(1);
  });
});
