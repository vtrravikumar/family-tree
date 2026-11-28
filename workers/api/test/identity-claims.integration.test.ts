import { beforeEach, describe, expect, it } from "vitest";
import { env, SELF } from "cloudflare:test";
import { identityNamesMatch, isGoogleRegistrationAllowed } from "../src/index";

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
          { key: "00000000-0000-4000-8000-000000000001", givenName: "Would Have Been Imported" },
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
          { key: "00000000-0000-4000-8000-000000000002", givenName: "Imported Parent" },
          { key: "00000000-0000-4000-8000-000000000003", givenName: "Imported Child" },
        ],
        relationships: [
          { from: "00000000-0000-4000-8000-000000000002", to: "00000000-0000-4000-8000-000000000003", type: "biological_parent" },
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
          { key: "00000000-0000-4000-8000-000000000006", givenName: "First Import Row" },
          { key: "00000000-0000-4000-8000-000000000007", givenName: "TriggerFailure" },
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

async function markPersonDeceased() {
  return SELF.fetch(
    `https://vansvriksh.test/v1/families/${FAMILY_ID}/people/${PERSON_ID}/deceased`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ confirmed: true, deathDateKind: "unknown" }),
    },
  );
}

async function restorePerson() {
  return SELF.fetch(
    `https://vansvriksh.test/v1/families/${FAMILY_ID}/people/${PERSON_ID}/restore`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ confirmed: true, reason: "Integration test restore" }),
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
  it("matches exact name tokens flexibly without accepting substrings or spelling guesses", () => {
    expect(identityNamesMatch("Ravi", "Ravi Kumar")).toBe(true);
    expect(identityNamesMatch("Ravi Kumar", "Ravi Venkata Ramana Kumar")).toBe(true);
    expect(identityNamesMatch("RAVI-KUMAR", "Ravi Kumar")).toBe(true);
    expect(identityNamesMatch("Rav", "Ravi Kumar")).toBe(false);
    expect(identityNamesMatch("Ravi Kumaar", "Ravi Kumar")).toBe(false);
    expect(identityNamesMatch("", "Ravi Kumar")).toBe(false);
  });

  it("respects stricter global matching policy settings", () => {
    const strict = { enabled:true, allowPartial:false, minMatchingTokens:1, ignoreCase:true, ignorePunctuation:true, allowMissingMiddle:false, allowTokenOrderVariations:false };
    expect(identityNamesMatch("Ravi", "Ravi Kumar", strict)).toBe(false);
    expect(identityNamesMatch("Ravi Kumar", "Kumar Ravi", strict)).toBe(false);
    expect(identityNamesMatch("Ravi Kumar", "Ravi Kumar", strict)).toBe(true);
  });

  it("allows registration for any non-empty email after Google credential verification", () => {
    expect(isGoogleRegistrationAllowed("outsider@example.test")).toBe(true);
    expect(isGoogleRegistrationAllowed("ALLOWLISTED@example.test")).toBe(true);
    expect(isGoogleRegistrationAllowed("invitee@example.test")).toBe(true);
    expect(isGoogleRegistrationAllowed("   ")).toBe(false);
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
            { key: "00000000-0000-4000-8000-000000000004", givenName: "Cycle Person A" },
            { key: "00000000-0000-4000-8000-000000000005", givenName: "Cycle Person B" },
          ],
          relationships: [
            { from: "00000000-0000-4000-8000-000000000004", to: "00000000-0000-4000-8000-000000000005", type: "biological_parent" },
            { from: "00000000-0000-4000-8000-000000000005", to: "00000000-0000-4000-8000-000000000004", type: "biological_parent" },
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

  it("marks a person deceased and restores them with matching local D1 audit records", async () => {
    const marked = await markPersonDeceased();
    expect(marked.status).toBe(200);
    const deceased = await env.DB.prepare(
      "SELECT life_status FROM persons WHERE id=? AND family_id=?",
    ).bind(PERSON_ID, FAMILY_ID).first<{ life_status: string }>();
    expect(deceased?.life_status).toBe("deceased");

    const restored = await restorePerson();
    expect(restored.status).toBe(200);
    const alive = await env.DB.prepare(
      "SELECT life_status FROM persons WHERE id=? AND family_id=?",
    ).bind(PERSON_ID, FAMILY_ID).first<{ life_status: string }>();
    const audit = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM audit_logs WHERE entity_id=? AND action IN ('person.marked_deceased','person.restored_to_alive')",
    ).bind(PERSON_ID).first<{ count: number }>();

    expect(alive?.life_status).toBe("alive");
    expect(audit?.count).toBe(2);
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

  it("rejects foreign-family resource IDs across member, invitation, identity, person and relationship mutations", async () => {
    const timestamp = "2026-11-24T00:00:00.000Z";
    const foreignFamily = "family-foreign";
    const foreignOwner = "foreign-owner";
    const foreignMember = "foreign-member";
    const foreignPerson = "foreign-person";
    const foreignDeceasedPerson = "foreign-deceased-person";
    const foreignRelationship = "foreign-relationship";
    const foreignInvitation = "foreign-invitation";
    const foreignClaim = "foreign-claim";

    await run(
      "INSERT INTO users(id,identity_provider,provider_subject,email,display_name,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
      [foreignOwner, "google", "foreign-owner-subject", "foreign-owner@example.test", "Foreign Owner", timestamp, timestamp],
    );
    await run(
      "INSERT INTO users(id,identity_provider,provider_subject,email,display_name,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
      [foreignMember, "google", "foreign-member-subject", "foreign-member@example.test", "Foreign Member", timestamp, timestamp],
    );
    await run(
      "INSERT INTO families(id,name,owner_user_id,created_at,updated_at) VALUES(?,?,?,?,?)",
      [foreignFamily, "Foreign Family", foreignOwner, timestamp, timestamp],
    );
    await run(
      "INSERT INTO family_members(family_id,user_id,role,joined_at) VALUES(?,?,?,?)",
      [foreignFamily, foreignOwner, "owner", timestamp],
    );
    await run(
      "INSERT INTO family_members(family_id,user_id,role,joined_at) VALUES(?,?,?,?)",
      [foreignFamily, foreignMember, "editor", timestamp],
    );
    await run(
      "INSERT INTO persons(id,family_id,given_name,life_status,created_at,updated_at) VALUES(?,?,?,?,?,?)",
      [foreignPerson, foreignFamily, "Foreign Person", "alive", timestamp, timestamp],
    );
    await run(
      "INSERT INTO persons(id,family_id,given_name,life_status,created_at,updated_at) VALUES(?,?,?,?,?,?)",
      [foreignDeceasedPerson, foreignFamily, "Foreign Deceased Person", "deceased", timestamp, timestamp],
    );
    await run(
      "INSERT INTO relationships(id,family_id,from_person_id,to_person_id,relationship_type,created_by_user_id,created_at) VALUES(?,?,?,?,?,?,?)",
      [foreignRelationship, foreignFamily, foreignPerson, foreignDeceasedPerson, "sibling", foreignOwner, timestamp],
    );
    await run(
      "INSERT INTO invitations(id,family_id,inviter_user_id,invitee_email,invite_code_hash,offered_role,status,expires_at,created_at) VALUES(?,?,?,?,?,?, 'pending',?,?)",
      [foreignInvitation, foreignFamily, foreignOwner, "outside-invitee@example.test", "foreign-invite-hash", "viewer", "2026-12-01T00:00:00.000Z", timestamp],
    );
    await run(
      "INSERT INTO person_identity_claims(id,family_id,person_id,requester_user_id,status,requested_at) VALUES(?,?,?,?,?,?)",
      [foreignClaim, foreignFamily, foreignPerson, foreignMember, "pending", timestamp],
    );

    const send = (path: string, method: string, payload?: unknown) => SELF.fetch(
      `https://vansvriksh.test${path}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          ...(payload ? { "Content-Type": "application/json" } : {}),
        },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
      },
    );

    const responses = await Promise.all([
      send(`/v1/families/${FAMILY_ID}/members/${foreignMember}`, "PUT", { role: "viewer" }),
      send(`/v1/families/${FAMILY_ID}/members/${foreignMember}`, "DELETE"),
      send(`/v1/families/${FAMILY_ID}/invitations/${foreignInvitation}`, "DELETE"),
      send(`/v1/families/${FAMILY_ID}/identity-claims/${foreignClaim}/review`, "POST", { decision: "reject" }),
      send(`/v1/families/${FAMILY_ID}/identity`, "DELETE", { personId: foreignPerson }),
      send(`/v1/families/${FAMILY_ID}/people/${foreignPerson}`, "PUT", { givenName: "Tampered", gender: "unspecified" }),
      send(`/v1/families/${FAMILY_ID}/people/${foreignPerson}`, "DELETE", { confirmed: true }),
      send(`/v1/families/${FAMILY_ID}/people/${foreignPerson}/deceased`, "POST", { confirmed: true, deathDateKind: "unknown" }),
      send(`/v1/families/${FAMILY_ID}/people/${foreignDeceasedPerson}/restore`, "POST", { confirmed: true }),
      send(`/v1/families/${FAMILY_ID}/relationships/${foreignRelationship}`, "PUT", { fromPersonId: PERSON_ID, toPersonId: foreignPerson, relationshipType: "sibling" }),
      send(`/v1/families/${FAMILY_ID}/relationships/${foreignRelationship}`, "DELETE"),
    ]);

    expect(responses.map(response => response.status)).toEqual([
      404, 404, 404, 404, 404, 404, 404, 409, 409, 404, 404,
    ]);

    const foreignMemberRow = await env.DB.prepare(
      "SELECT role FROM family_members WHERE family_id=? AND user_id=?",
    ).bind(foreignFamily, foreignMember).first<{ role: string }>();
    const foreignInvitationRow = await env.DB.prepare(
      "SELECT status FROM invitations WHERE id=? AND family_id=?",
    ).bind(foreignInvitation, foreignFamily).first<{ status: string }>();
    const foreignClaimRow = await env.DB.prepare(
      "SELECT status FROM person_identity_claims WHERE id=? AND family_id=?",
    ).bind(foreignClaim, foreignFamily).first<{ status: string }>();
    const foreignPersonRow = await env.DB.prepare(
      "SELECT given_name, life_status FROM persons WHERE id=? AND family_id=?",
    ).bind(foreignPerson, foreignFamily).first<{ given_name: string; life_status: string }>();
    const foreignRelationshipRow = await env.DB.prepare(
      "SELECT id FROM relationships WHERE id=? AND family_id=?",
    ).bind(foreignRelationship, foreignFamily).first<{ id: string }>();
    const foreignAudits = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM audit_logs WHERE family_id=? AND entity_id IN (?,?,?,?,?)",
    ).bind(foreignFamily, foreignMember, foreignInvitation, foreignClaim, foreignPerson, foreignRelationship).first<{ count: number }>();

    expect(foreignMemberRow?.role).toBe("editor");
    expect(foreignInvitationRow?.status).toBe("pending");
    expect(foreignClaimRow?.status).toBe("pending");
    expect(foreignPersonRow).toEqual({ given_name: "Foreign Person", life_status: "alive" });
    expect(foreignRelationshipRow?.id).toBe(foreignRelationship);
    expect(foreignAudits?.count).toBe(0);
  });

  it("does not merge a same-name person and preserves Tamil and Devanagari identities", async () => {
    const ids = [
      "00000000-0000-4000-8000-000000000011",
      "00000000-0000-4000-8000-000000000012",
      "00000000-0000-4000-8000-000000000013",
    ];
    const response = await SELF.fetch(`https://vansvriksh.test/v1/families/${FAMILY_ID}/import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmed: true,
        confirmDeceasedRecords: true,
        people: [
          { key: ids[0], givenName: "Test Person" },
          { key: ids[1], givenName: "சீதா" },
          { key: ids[2], givenName: "सीता" },
        ],
        relationships: [],
      }),
    });
    expect(response.status).toBe(200);
    const rows = await env.DB.prepare(
      "SELECT id,given_name FROM persons WHERE family_id=? AND id IN (?,?,?) ORDER BY id",
    ).bind(FAMILY_ID, ...ids).all<{ id: string; given_name: string }>();
    expect(rows.results).toHaveLength(3);
    expect(rows.results.map(row => row.given_name).sort()).toEqual(["Test Person", "சீதா", "सीता"].sort());
    const sameNameCount = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM persons WHERE family_id=? AND given_name='Test Person'",
    ).bind(FAMILY_ID).first<{ count: number }>();
    expect(sameNameCount?.count).toBe(2);
  });

  it("rejects a person ID owned by another family without importing any rows", async () => {
    const timestamp = "2026-11-24T00:00:00.000Z";
    const foreignId = "00000000-0000-4000-8000-000000000014";
    await run(
      "INSERT INTO families(id,name,owner_user_id,created_at,updated_at) VALUES(?,?,?,?,?)",
      ["family-import-foreign", "Foreign Import Family", OWNER_ID, timestamp, timestamp],
    );
    await run(
      "INSERT INTO persons(id,family_id,given_name,created_at,updated_at) VALUES(?,?,?,?,?)",
      [foreignId, "family-import-foreign", "Foreign Person", timestamp, timestamp],
    );
    const response = await SELF.fetch(`https://vansvriksh.test/v1/families/${FAMILY_ID}/import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmed: true,
        confirmDeceasedRecords: true,
        people: [
          { key: "00000000-0000-4000-8000-000000000015", givenName: "Would Not Be Created" },
          { key: foreignId, givenName: "Foreign Person" },
        ],
        relationships: [],
      }),
    });
    expect(response.status).toBe(409);
    const partial = await env.DB.prepare(
      "SELECT id FROM persons WHERE family_id=? AND given_name='Would Not Be Created'",
    ).bind(FAMILY_ID).first<{ id: string }>();
    expect(partial).toBeNull();
  });

  it("preserves date precision, original text, birthplace and biography for imported people", async () => {
    const personId = "00000000-0000-4000-8000-000000000016";
    const response = await SELF.fetch(`https://vansvriksh.test/v1/families/${FAMILY_ID}/import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmed: true,
        confirmDeceasedRecords: true,
        people: [{
          key: personId,
          givenName: "Historical Person",
          gender: "female",
          lifeStatus: "deceased",
          birthDateKind: "range",
          birthRangeStartYear: 1930,
          birthRangeEndYear: 1935,
          birthOriginalText: "circa 1932, family recollection",
          birthPlace: "Madurai",
          birthCountry: "India",
          deathDateKind: "approximate_year",
          deathYear: 2001,
          deathOriginalText: "around 2001",
          biography: "A preserved family history note.",
        }],
        relationships: [],
      }),
    });
    expect(response.status).toBe(200);
    const person = await env.DB.prepare(
      "SELECT life_status,birth_date_kind,birth_range_start_year,birth_range_end_year,birth_original_text,birth_place,birth_country,death_date_kind,death_year,death_original_text,biography FROM persons WHERE id=? AND family_id=?",
    ).bind(personId, FAMILY_ID).first<Record<string, unknown>>();
    expect(person).toMatchObject({
      life_status: "deceased",
      birth_date_kind: "range",
      birth_range_start_year: 1930,
      birth_range_end_year: 1935,
      birth_original_text: "circa 1932, family recollection",
      birth_place: "Madurai",
      birth_country: "India",
      death_date_kind: "approximate_year",
      death_year: 2001,
      death_original_text: "around 2001",
      biography: "A preserved family history note.",
    });
  });

  it("makes repeated imports of the same stable person ID idempotent", async () => {
    const personId = "00000000-0000-4000-8000-000000000017";
    const payload = {
      confirmed: true,
      confirmDeceasedRecords: true,
      people: [{ key: personId, givenName: "Repeat Import Person", birthDateKind: "unknown" }],
      relationships: [],
    };
    const send = () => SELF.fetch(`https://vansvriksh.test/v1/families/${FAMILY_ID}/import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const first = await send();
    const second = await send();
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const firstBody = await first.json() as { data: { peopleCreated: number } };
    const secondBody = await second.json() as { data: { peopleCreated: number; peopleMatched: number } };
    expect(firstBody.data.peopleCreated).toBe(1);
    expect(secondBody.data.peopleCreated).toBe(0);
    expect(secondBody.data.peopleMatched).toBe(1);
    const count = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM persons WHERE id=? AND family_id=?",
    ).bind(personId, FAMILY_ID).first<{ count: number }>();
    expect(count?.count).toBe(1);
  });

});

