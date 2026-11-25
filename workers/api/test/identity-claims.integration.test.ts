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

async function createParentRelationship() {
  const timestamp = "2026-11-24T00:00:00.000Z";
  await run(
    "INSERT INTO persons(id,family_id,given_name,created_at,updated_at) VALUES(?,?,?,?,?)",
    ["parent-child", FAMILY_ID, "Child Person", timestamp, timestamp],
  );
  return SELF.fetch(
    `https://vansvriksh.test/v1/families/${FAMILY_ID}/relationships`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fromPersonId: PERSON_ID,
        toPersonId: "parent-child",
        relationshipType: "biological_parent",
      }),
    },
  );
}

async function createRelationship() {
  const timestamp = "2026-11-24T00:00:00.000Z";
  await run(
    "INSERT INTO persons(id,family_id,given_name,created_at,updated_at) VALUES(?,?,?,?,?)",
    ["person-two", FAMILY_ID, "Second Person", timestamp, timestamp],
  );
  return SELF.fetch(
    `https://vansvriksh.test/v1/families/${FAMILY_ID}/relationships`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fromPersonId: PERSON_ID,
        toPersonId: "person-two",
        relationshipType: "sibling",
      }),
    },
  );
}

async function tokenHash(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  let binary = "";
  for (const byte of digest) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function importMalformedWorkbook() {
  return SELF.fetch(
    `https://vansvriksh.test/v1/families/${FAMILY_ID}/import`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        confirmed: true,
        confirmDeceasedRecords: true,
        people: [
          { key: "valid-first", givenName: "Would Have Been Imported" },
          { key: "", givenName: "Invalid Late Row" },
        ],
        relationships: [],
      }),
    },
  );
}

async function importFamilyWithRelationship() {
  return SELF.fetch(
    `https://vansvriksh.test/v1/families/${FAMILY_ID}/import`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        confirmed: true,
        confirmDeceasedRecords: true,
        people: [
          { key: "import-parent", givenName: "Imported Parent" },
          { key: "import-child", givenName: "Imported Child" },
        ],
        relationships: [
          { from: "import-parent", to: "import-child", type: "biological_parent" },
        ],
      }),
    },
  );
}

async function importWithForcedDatabaseFailure() {
  return SELF.fetch(
    `https://vansvriksh.test/v1/families/${FAMILY_ID}/import`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        confirmed: true,
        confirmDeceasedRecords: true,
        people: [
          { key: "first-row", givenName: "First Import Row" },
          { key: "failing-row", givenName: "TriggerFailure" },
        ],
        relationships: [],
      }),
    },
  );
}

async function deleteFamily() {
  return SELF.fetch(
    `https://vansvriksh.test/v1/families/${FAMILY_ID}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ confirmed: true }),
    },
  );
}

async function createDirectClaim() {
  return SELF.fetch(
    `https://vansvriksh.test/v1/families/${FAMILY_ID}/identity-claims`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ personId: PERSON_ID }),
    },
  );
}

async function createPerson() {
  return SELF.fetch(
    `https://vansvriksh.test/v1/families/${FAMILY_ID}/people`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ givenName: "New Integration Person", gender: "unspecified" }),
    },
  );
}

async function unlinkIdentity() {
  return SELF.fetch(
    `https://vansvriksh.test/v1/families/${FAMILY_ID}/identity`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ personId: PERSON_ID }),
    },
  );
}

async function createInvitation() {
  return SELF.fetch(
    `https://vansvriksh.test/v1/families/${FAMILY_ID}/invitations`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: "new-member@example.test", role: "viewer" }),
    },
  );
}

async function revokeInvitation() {
  const timestamp = "2026-11-24T00:00:00.000Z";
  const expires = "2026-12-01T00:00:00.000Z";
  await run(
    "INSERT INTO invitations(id,family_id,inviter_user_id,invitee_email,invite_code_hash,offered_role,status,expires_at,created_at) VALUES(?,?,?,?,?,?, 'pending',?,?)",
    ["invite-test", FAMILY_ID, OWNER_ID, "invitee@example.test", "unique-invite-hash", "viewer", expires, timestamp],
  );
  return SELF.fetch(
    `https://vansvriksh.test/v1/families/${FAMILY_ID}/invitations/invite-test`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${API_TOKEN}` },
    },
  );
}

async function updatePersonProfile() {
  return SELF.fetch(
    `https://vansvriksh.test/v1/families/${FAMILY_ID}/people/${PERSON_ID}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        givenName: "Updated Person",
        gender: "unspecified",
        birthDateKind: "unknown",
        biography: "Updated through the profile endpoint.",
      }),
    },
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
    await run("DELETE FROM platform_audit_logs");
    await run("DELETE FROM auth_sessions");
    await run("DELETE FROM platform_super_admins");
    await run("DELETE FROM audit_logs");
    await run("DELETE FROM person_identity_links");
    await run("DELETE FROM person_identity_claims");
    await run("DELETE FROM family_members");
    await run("DELETE FROM persons");
    await run("DELETE FROM families");
    await run("DELETE FROM users WHERE id != ?", [OWNER_ID]);
    await seedClaim();
  });
  it("updates a family-scoped person profile and audits the change in local D1", async () => {
    const response = await updatePersonProfile();

    expect(response.status).toBe(200);
    const person = await env.DB.prepare(
      "SELECT given_name, biography FROM persons WHERE id=? AND family_id=?",
    ).bind(PERSON_ID, FAMILY_ID).first<{ given_name: string; biography: string | null }>();
    const audit = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM audit_logs WHERE action='person.updated' AND entity_id=?",
    ).bind(PERSON_ID).first<{ count: number }>();

    expect(person?.given_name).toBe("Updated Person");
    expect(person?.biography).toBe("Updated through the profile endpoint.");
    expect(audit?.count).toBe(1);
  });

  it("creates an invitation and one audit record in local D1", async () => {
    const response = await createInvitation();

    expect(response.status).toBe(201);
    const body = await response.json() as { data: { email: string; role: string } };
    const invitation = await env.DB.prepare(
      "SELECT invitee_email, offered_role, status FROM invitations WHERE family_id=? AND invitee_email=?",
    ).bind(FAMILY_ID, "new-member@example.test").first<{ invitee_email: string; offered_role: string; status: string }>();
    const audit = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM audit_logs WHERE action='invitation.created' AND entity_id=?",
    ).bind("new-member@example.test").first<{ count: number }>();

    expect(body.data.role).toBe("viewer");
    expect(invitation?.offered_role).toBe("viewer");
    expect(invitation?.status).toBe("pending");
    expect(audit?.count).toBe(1);
  });

  it("revokes a pending invitation and writes one audit record in local D1", async () => {
    const response = await revokeInvitation();

    expect(response.status).toBe(200);
    const invitation = await env.DB.prepare(
      "SELECT status, revoked_by_user_id FROM invitations WHERE id=?",
    ).bind("invite-test").first<{ status: string; revoked_by_user_id: string | null }>();
    const audit = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM audit_logs WHERE action='invitation.revoked' AND entity_id=?",
    ).bind("invite-test").first<{ count: number }>();

    expect(invitation?.status).toBe("revoked");
    expect(invitation?.revoked_by_user_id).toBe(OWNER_ID);
    expect(audit?.count).toBe(1);
  });

  it("unlinks an identity, withdraws its approved claim and writes one audit in local D1", async () => {
    const timestamp = "2026-11-24T00:00:00.000Z";
    await run("UPDATE person_identity_claims SET status='approved',reviewed_by_user_id=?,reviewed_at=? WHERE id=?", [OWNER_ID, timestamp, CLAIM_ID]);
    await run(
      "INSERT INTO person_identity_links(family_id,person_id,user_id,linked_by_user_id,linked_at) VALUES(?,?,?,?,?)",
      [FAMILY_ID, PERSON_ID, REQUESTER_ID, OWNER_ID, timestamp],
    );
    const response = await unlinkIdentity();
    expect(response.status).toBe(200);
    const link = await env.DB.prepare(
      "SELECT user_id FROM person_identity_links WHERE family_id=? AND person_id=?",
    ).bind(FAMILY_ID, PERSON_ID).first<{ user_id: string }>();
    const claim = await env.DB.prepare(
      "SELECT status FROM person_identity_claims WHERE id=?",
    ).bind(CLAIM_ID).first<{ status: string }>();
    const audit = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM audit_logs WHERE action='identity.unlinked' AND entity_id=?",
    ).bind(PERSON_ID).first<{ count: number }>();
    expect(link).toBeNull();
    expect(claim?.status).toBe("withdrawn");
    expect(audit?.count).toBe(1);
  });

  it("creates a person and exactly one audit record in local D1", async () => {
    const response = await createPerson();
    expect(response.status).toBe(201);
    const body = await response.json() as { data: { id: string; displayName: string } };
    const person = await env.DB.prepare(
      "SELECT id, display_name FROM persons WHERE id=? AND family_id=?",
    ).bind(body.data.id, FAMILY_ID).first<{ id: string; display_name: string }>();
    const audit = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM audit_logs WHERE action='person.created' AND entity_id=?",
    ).bind(body.data.id).first<{ count: number }>();
    expect(person?.display_name).toBe("New Integration Person");
    expect(audit?.count).toBe(1);
  });

  it("creates a direct identity link for the current family owner and audits it", async () => {
    const response = await createDirectClaim();

    expect(response.status).toBe(201);
    const link = await env.DB.prepare(
      "SELECT user_id, linked_by_user_id FROM person_identity_links WHERE family_id=? AND person_id=?",
    ).bind(FAMILY_ID, PERSON_ID).first<{ user_id: string; linked_by_user_id: string }>();
    const audit = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM audit_logs WHERE action='identity.claimed_directly' AND entity_id=?",
    ).bind(PERSON_ID).first<{ count: number }>();

    expect(link?.user_id).toBe(OWNER_ID);
    expect(link?.linked_by_user_id).toBe(OWNER_ID);
    expect(audit?.count).toBe(1);
  });

  it("deletes a family only for its current owner in local D1", async () => {
    const response = await deleteFamily();

    expect(response.status).toBe(200);
    const family = await env.DB.prepare(
      "SELECT id FROM families WHERE id=?",
    ).bind(FAMILY_ID).first<{ id: string }>();
    const person = await env.DB.prepare(
      "SELECT id FROM persons WHERE id=? AND family_id=?",
    ).bind(PERSON_ID, FAMILY_ID).first<{ id: string }>();

    expect(family).toBeNull();
    expect(person).toBeNull();
  });

  it("rejects a malformed late import row before any person or audit write", async () => {
    const response = await importMalformedWorkbook();

    expect(response.status).toBe(400);
    const importedPerson = await env.DB.prepare(
      "SELECT id FROM persons WHERE family_id=? AND display_name='Would Have Been Imported'",
    ).bind(FAMILY_ID).first<{ id: string }>();
    const importAudit = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM audit_logs WHERE family_id=? AND action='person.imported'",
    ).bind(FAMILY_ID).first<{ count: number }>();

    expect(importedPerson).toBeNull();
    expect(importAudit?.count).toBe(0);
  });

  it("skips an imported ancestry edge that would create a cycle", async () => {
    const response = await SELF.fetch(
      `https://vansvriksh.test/v1/families/${FAMILY_ID}/import`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmed: true,
          confirmDeceasedRecords: true,
          people: [
            { key: "cycle-a", givenName: "Cycle Person A" },
            { key: "cycle-b", givenName: "Cycle Person B" },
          ],
          relationships: [
            { from: "cycle-a", to: "cycle-b", type: "biological_parent" },
            { from: "cycle-b", to: "cycle-a", type: "biological_parent" },
          ],
        }),
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { data: { relationshipsCreated: number; relationshipsSkipped: number } };
    const count = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM relationships WHERE family_id=? AND relationship_type='biological_parent'",
    ).bind(FAMILY_ID).first<{ count: number }>();

    expect(body.data.relationshipsCreated).toBe(1);
    expect(body.data.relationshipsSkipped).toBe(1);
    expect(count?.count).toBe(1);
  });

  it("imports people, relationships and audit records in one local D1 batch", async () => {
    const response = await importFamilyWithRelationship();

    expect(response.status).toBe(200);
    const body = await response.json() as { data: { peopleCreated: number; relationshipsCreated: number } };
    const people = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM persons WHERE family_id=? AND display_name IN ('Imported Parent','Imported Child')",
    ).bind(FAMILY_ID).first<{ count: number }>();
    const relationship = await env.DB.prepare(
      "SELECT id FROM relationships WHERE family_id=? AND relationship_type='biological_parent' AND from_person_id IN (SELECT id FROM persons WHERE display_name='Imported Parent') AND to_person_id IN (SELECT id FROM persons WHERE display_name='Imported Child')",
    ).bind(FAMILY_ID).first<{ id: string }>();
    const audit = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM audit_logs WHERE family_id=? AND action='relationship.imported' AND entity_id=?",
    ).bind(FAMILY_ID, relationship?.id ?? "").first<{ count: number }>();

    expect(body.data.peopleCreated).toBe(2);
    expect(body.data.relationshipsCreated).toBe(1);
    expect(people?.count).toBe(2);
    expect(relationship?.id).toBeTruthy();
    expect(audit?.count).toBe(1);
  });

  it("rolls back all imported rows and audits when a later D1 insert fails", async () => {
    await run(`CREATE TRIGGER fail_import_person BEFORE INSERT ON persons
      WHEN NEW.given_name='TriggerFailure'
      BEGIN SELECT RAISE(ABORT, 'forced import failure'); END`);

    try {
      const response = await importWithForcedDatabaseFailure();
      expect(response.status).toBe(409);

      const firstRow = await env.DB.prepare(
        "SELECT id FROM persons WHERE family_id=? AND display_name='First Import Row'",
      ).bind(FAMILY_ID).first<{ id: string }>();
      const importAudits = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM audit_logs WHERE family_id=? AND action='person.imported'",
      ).bind(FAMILY_ID).first<{ count: number }>();

      expect(firstRow).toBeNull();
      expect(importAudits?.count).toBe(0);
    } finally {
      await run("DROP TRIGGER IF EXISTS fail_import_person");
    }
  });

  it("keeps a Super Admin import audit inside the authorized D1 batch", async () => {
    const timestamp = "2026-11-24T00:00:00.000Z";
    await run("DELETE FROM family_members WHERE family_id=? AND user_id=?", [FAMILY_ID, OWNER_ID]);
    await run(
      "INSERT INTO platform_super_admins(user_id,granted_at,reason) VALUES(?,?,?)",
      [OWNER_ID, timestamp, "Integration test Super Admin"],
    );
    const sessionToken = "platform-import-test-session";
    await run(
      "INSERT INTO auth_sessions(id,user_id,token_hash,expires_at,created_at,last_seen_at) VALUES(?,?,?,?,?,?)",
      ["platform-import-session", OWNER_ID, await tokenHash(sessionToken), "2026-12-01T00:00:00.000Z", timestamp, timestamp],
    );

    const response = await SELF.fetch(
      `https://vansvriksh.test/v1/families/${FAMILY_ID}/import`,
      {
        method: "POST",
        headers: {
          Cookie: `vansvriksh_session=${sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmed: true,
          confirmDeceasedRecords: true,
          reason: "Authorized integration import",
          people: [],
          relationships: [],
        }),
      },
    );

    expect(response.status).toBe(200);
    const audit = await env.DB.prepare(
      "SELECT action, target_id, reason FROM platform_audit_logs WHERE actor_user_id=? AND action='family.import'",
    ).bind(OWNER_ID).first<{ action: string; target_id: string; reason: string }>();

    expect(audit?.target_id).toBe(FAMILY_ID);
    expect(audit?.reason).toBe("Authorized integration import");
  });


  it("executes write-time ancestry-cycle and duplicate guards against local D1", async () => {
    const response = await createParentRelationship();
    expect(response.status).toBe(201);
    const created = await response.json() as { data: { id: string } };
    const update = await SELF.fetch(
      `https://vansvriksh.test/v1/families/${FAMILY_ID}/relationships/${created.data.id}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fromPersonId: PERSON_ID,
          toPersonId: "parent-child",
          relationshipType: "biological_parent",
        }),
      },
    );
    expect(update.status).toBe(200);

    const duplicate = await SELF.fetch(
      `https://vansvriksh.test/v1/families/${FAMILY_ID}/relationships`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fromPersonId: PERSON_ID,
          toPersonId: "parent-child",
          relationshipType: "biological_parent",
        }),
      },
    );
    expect(duplicate.status).toBe(409);

    const cycle = await SELF.fetch(
      `https://vansvriksh.test/v1/families/${FAMILY_ID}/relationships`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fromPersonId: "parent-child",
          toPersonId: PERSON_ID,
          relationshipType: "biological_parent",
        }),
      },
    );
    expect(cycle.status).toBe(409);

    const deleted = await SELF.fetch(
      `https://vansvriksh.test/v1/families/${FAMILY_ID}/relationships/${created.data.id}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${API_TOKEN}` } },
    );
    expect(deleted.status).toBe(200);
    const remaining = await env.DB.prepare(
      "SELECT id FROM relationships WHERE id=? AND family_id=?",
    ).bind(created.data.id, FAMILY_ID).first<{ id: string }>();
    const deletionAudit = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM audit_logs WHERE action='relationship.deleted' AND entity_id=?",
    ).bind(created.data.id).first<{ count: number }>();
    expect(remaining).toBeNull();
    expect(deletionAudit?.count).toBe(1);
  });

  it("creates a family-scoped relationship and one audit record in local D1", async () => {
    const response = await createRelationship();

    expect(response.status).toBe(201);
    const relationship = await env.DB.prepare(
      "SELECT id,from_person_id,to_person_id FROM relationships WHERE family_id=? AND from_person_id=? AND to_person_id=?",
    ).bind(FAMILY_ID, PERSON_ID, "person-two").first<{ id: string; from_person_id: string; to_person_id: string }>();
    const audit = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM audit_logs WHERE action='relationship.created' AND entity_id=?",
    ).bind(relationship?.id ?? "").first<{ count: number }>();

    expect(relationship?.from_person_id).toBe(PERSON_ID);
    expect(relationship?.to_person_id).toBe("person-two");
    expect(audit?.count).toBe(1);
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

