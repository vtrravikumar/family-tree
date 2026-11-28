type BridgeRole = "owner" | "admin" | "editor" | "viewer";
type BridgeEnv = { DB: D1Database };
type AccessResult = {
  role: BridgeRole | null;
  source: "direct" | "bridge" | null;
  bridgeIds: string[];
  sourceFamilyIds: string[];
};

const json = (data: unknown, status = 200) => Response.json(data, {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }
});
const error = (status: number, code: string, message: string) => json({ error: { code, message } }, status);
const newId = () => crypto.randomUUID();
const timestamp = () => new Date().toISOString();
const clean = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch { return null; }
}
async function directRole(db: D1Database, familyId: string, userId: string): Promise<BridgeRole | null> {
  const row = await db.prepare("SELECT role FROM family_members WHERE family_id=? AND user_id=?")
    .bind(familyId, userId).first<{ role: BridgeRole }>();
  return row?.role ?? null;
}

/** Direct membership always wins. Bridge access is a live, non-transitive Viewer grant. */
export async function effectiveFamilyReadAccess(db: D1Database, familyId: string, userId: string): Promise<AccessResult> {
  const direct = await directRole(db, familyId, userId);
  if (direct) return { role: direct, source: "direct", bridgeIds: [], sourceFamilyIds: [] };
  const inherited = await db.prepare(`
    SELECT DISTINCT b.id AS bridge_id,
      CASE WHEN b.family_a_id=? THEN b.family_b_id ELSE b.family_a_id END AS source_family_id
    FROM family_bridges b
    JOIN family_members source_member
      ON source_member.family_id = CASE WHEN b.family_a_id=? THEN b.family_b_id ELSE b.family_a_id END
     AND source_member.user_id=?
    WHERE b.status='active' AND (b.family_a_id=? OR b.family_b_id=?)
  `).bind(familyId, familyId, userId, familyId, familyId).all<{bridge_id:string;source_family_id:string}>();
  const rows = inherited.results ?? [];
  if (!rows.length) return { role: null, source: null, bridgeIds: [], sourceFamilyIds: [] };
  return {
    role: "viewer",
    source: "bridge",
    bridgeIds: [...new Set(rows.map(row => row.bridge_id))],
    sourceFamilyIds: [...new Set(rows.map(row => row.source_family_id))]
  };
}

async function familyOwner(db: D1Database, familyId: string, userId: string): Promise<boolean> {
  return (await directRole(db, familyId, userId)) === "owner";
}
async function personBelongsToFamily(db: D1Database, familyId: string, personId: string): Promise<boolean> {
  const row = await db.prepare("SELECT 1 AS found FROM persons WHERE id=? AND family_id=?")
    .bind(personId, familyId).first();
  return !!row;
}
function orderedPair(a: string, b: string) {
  return a < b ? { first: a, second: b, swapped: false } : { first: b, second: a, swapped: true };
}

export async function handleFamilyBridgeRoute(request: Request, env: BridgeEnv, url: URL, actorUserId: string): Promise<Response | null> {
  const familyList = url.pathname.match(/^\/v1\/families\/([^/]+)\/bridges$/);
  if (familyList && request.method === "GET") {
    const familyId = familyList[1];
    const access = await effectiveFamilyReadAccess(env.DB, familyId, actorUserId);
    if (!access.role) return error(404, "family_not_found", "Family not found.");
    const result = await env.DB.prepare(`
      SELECT b.*, fa.name AS family_a_name, fb.name AS family_b_name,
        aa.display_name AS anchor_a_name, ab.display_name AS anchor_b_name,
        ca.display_name AS connector_a_name, cb.display_name AS connector_b_name
      FROM family_bridges b
      JOIN families fa ON fa.id=b.family_a_id
      JOIN families fb ON fb.id=b.family_b_id
      JOIN persons aa ON aa.id=b.anchor_a_person_id
      JOIN persons ab ON ab.id=b.anchor_b_person_id
      JOIN persons ca ON ca.id=b.connector_a_person_id
      JOIN persons cb ON cb.id=b.connector_b_person_id
      WHERE (b.family_a_id=? OR b.family_b_id=?) AND (b.status='active' OR (b.status='pending' AND (b.initiated_by_user_id=? OR EXISTS (SELECT 1 FROM family_members owner_member WHERE owner_member.family_id=CASE WHEN b.family_a_id=? THEN b.family_b_id ELSE b.family_a_id END AND owner_member.user_id=? AND owner_member.role='owner')))
      ORDER BY b.created_at DESC
    `).bind(familyId, familyId, actorUserId, familyId, actorUserId).all();
    return json({ data: result.results, accessSource: access.source, effectiveRole: access.role });
  }

  if (familyList && request.method === "POST") {
    const initiatingFamilyId = familyList[1];
    if (!(await familyOwner(env.DB, initiatingFamilyId, actorUserId)))
      return error(403, "bridge_owner_required", "Only the initiating family's Owner can create a family connection.");
    const input = await readBody(request);
    const destinationFamilyId = clean(input?.destinationFamilyId);
    const anchorInitiating = clean(input?.anchorPersonId);
    const anchorDestination = clean(input?.destinationAnchorPersonId);
    const connectorInitiating = clean(input?.connectorPersonId);
    const connectorDestination = clean(input?.destinationConnectorPersonId);
    if (!destinationFamilyId || !anchorInitiating || !anchorDestination || !connectorInitiating || !connectorDestination)
      return error(400, "invalid_bridge", "Provide the destination family, both family anchors and both marriage connector people.");
    if (destinationFamilyId === initiatingFamilyId)
      return error(400, "same_family_bridge", "A family cannot be connected to itself.");
    const destinationRole = await directRole(env.DB, destinationFamilyId, actorUserId);
    if (!destinationRole)
      return error(403, "destination_membership_required", "You must have direct membership in the destination family to request a connection.");
    const ids = [
      [initiatingFamilyId, anchorInitiating], [initiatingFamilyId, connectorInitiating],
      [destinationFamilyId, anchorDestination], [destinationFamilyId, connectorDestination]
    ] as const;
    for (const [familyId, personId] of ids) {
      if (!(await personBelongsToFamily(env.DB, familyId, personId)))
        return error(400, "person_not_in_family", "Each anchor and connector person must belong to its specified family.");
    }
    const familyPair = orderedPair(initiatingFamilyId, destinationFamilyId);
    const anchorA = familyPair.swapped ? anchorDestination : anchorInitiating;
    const anchorB = familyPair.swapped ? anchorInitiating : anchorDestination;
    const connectorA = familyPair.swapped ? connectorDestination : connectorInitiating;
    const connectorB = familyPair.swapped ? connectorInitiating : connectorDestination;
    const bridgeId = newId(), t = timestamp();
    try {
      const result = await env.DB.prepare(`INSERT INTO family_bridges(
        id,family_a_id,family_b_id,anchor_a_person_id,anchor_b_person_id,
        connector_a_person_id,connector_b_person_id,relationship_type,status,
        initiated_by_user_id,initiating_family_id,created_at,updated_at
      ) SELECT ?,?,?,?,?,?,?,'marriage','pending',?,?,?,?
      WHERE EXISTS (SELECT 1 FROM family_members WHERE family_id=? AND user_id=? AND role='owner')
        AND EXISTS (SELECT 1 FROM family_members WHERE family_id=? AND user_id=?)
    `).bind(bridgeId,familyPair.first,familyPair.second,anchorA,anchorB,connectorA,connectorB,actorUserId,initiatingFamilyId,t,t,
      initiatingFamilyId,actorUserId,destinationFamilyId,actorUserId).run();
      if ((result.meta?.changes ?? 0) !== 1)
        return error(409, "bridge_create_unavailable", "Your family memberships changed. Refresh and try again.");
      await env.DB.batch([
        env.DB.prepare("INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,change_summary,created_at) VALUES(?,?,?,'family_bridge',?,'family_bridge.requested',?,?)")
          .bind(newId(), initiatingFamilyId, actorUserId, bridgeId, JSON.stringify({ destinationFamilyId }), t),
        env.DB.prepare("INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,change_summary,created_at) VALUES(?,?,?,'family_bridge',?,'family_bridge.request_received',?,?)")
          .bind(newId(), destinationFamilyId, actorUserId, bridgeId, JSON.stringify({ initiatingFamilyId }), t)
      ]);
      return json({ data: { id: bridgeId, status: "pending", initiatingFamilyId, destinationFamilyId, createdAt: t } }, 201);
    } catch {
      return error(409, "duplicate_or_invalid_bridge", "This family connection already exists or could not be created.");
    }
  }

  const decision = url.pathname.match(/^\/v1\/bridges\/([^/]+)\/(approve|reject)$/);
  if (decision && request.method === "POST") {
    const bridgeId = decision[1], action = decision[2];
    const bridge = await env.DB.prepare("SELECT * FROM family_bridges WHERE id=? AND status='pending'")
      .bind(bridgeId).first<{id:string;family_a_id:string;family_b_id:string;initiating_family_id:string;initiated_by_user_id:string}>();
    if (!bridge) return error(404, "bridge_request_not_found", "This pending family connection is no longer available.");
    const destinationFamilyId = bridge.initiating_family_id === bridge.family_a_id ? bridge.family_b_id : bridge.family_a_id;
    if (!(await familyOwner(env.DB, destinationFamilyId, actorUserId)))
      return error(403, "destination_owner_required", "Only the destination family's Owner can approve or reject this connection.");
    const t = timestamp();
    const input = await readBody(request);
    const reason = clean(input?.reason);
    const approved = action === "approve";
    const result = await env.DB.prepare(`UPDATE family_bridges SET status=?,approved_by_user_id=?,approved_at=?,
      rejected_by_user_id=?,rejected_at=?,rejection_reason=?,updated_at=?
      WHERE id=? AND status='pending'
        AND EXISTS (SELECT 1 FROM family_members WHERE family_id=? AND user_id=? AND role='owner')
    `).bind(approved ? "active" : "rejected", approved ? actorUserId : null, approved ? t : null,
      approved ? null : actorUserId, approved ? null : t, approved ? null : reason, t, bridgeId, destinationFamilyId, actorUserId).run();
    if ((result.meta?.changes ?? 0) !== 1) return error(409, "bridge_decision_unavailable", "This request was already decided or your Owner access changed.");
    await env.DB.batch([bridge.family_a_id, bridge.family_b_id].map(familyId =>
      env.DB.prepare("INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,change_summary,created_at) VALUES(?,?,?,'family_bridge',?,?,?,?)")
        .bind(newId(), familyId, actorUserId, bridgeId, approved ? "family_bridge.approved" : "family_bridge.rejected", JSON.stringify({ reason }), t)
    ));
    return json({ data: { id: bridgeId, status: approved ? "active" : "rejected", decidedAt: t } });
  }

  const revoke = url.pathname.match(/^\/v1\/bridges\/([^/]+)$/);
  if (revoke && request.method === "DELETE") {
    const bridgeId = revoke[1];
    const bridge = await env.DB.prepare("SELECT * FROM family_bridges WHERE id=? AND status='active'")
      .bind(bridgeId).first<{id:string;family_a_id:string;family_b_id:string}>();
    if (!bridge) return error(404, "active_bridge_not_found", "This active family connection is no longer available.");
    const ownerA = await familyOwner(env.DB, bridge.family_a_id, actorUserId);
    const ownerB = await familyOwner(env.DB, bridge.family_b_id, actorUserId);
    if (!ownerA && !ownerB) return error(403, "bridge_owner_required", "An Owner of either connected family can revoke this connection.");
    const input = await readBody(request), t = timestamp(), reason = clean(input?.reason);
    const result = await env.DB.prepare(`UPDATE family_bridges SET status='revoked',revoked_by_user_id=?,revoked_at=?,
      revocation_reason=?,updated_at=? WHERE id=? AND status='active'
      AND (EXISTS (SELECT 1 FROM family_members WHERE family_id=? AND user_id=? AND role='owner')
        OR EXISTS (SELECT 1 FROM family_members WHERE family_id=? AND user_id=? AND role='owner'))`)
      .bind(actorUserId,t,reason,t,bridgeId,bridge.family_a_id,actorUserId,bridge.family_b_id,actorUserId).run();
    if ((result.meta?.changes ?? 0) !== 1) return error(409, "bridge_revoke_unavailable", "This connection changed or your Owner access was removed.");
    await env.DB.batch([bridge.family_a_id, bridge.family_b_id].map(familyId =>
      env.DB.prepare("INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,change_summary,created_at) VALUES(?,?,?,'family_bridge',?,'family_bridge.revoked',?,?)")
        .bind(newId(), familyId, actorUserId, bridgeId, JSON.stringify({ reason }), t)
    ));
    return json({ data: { id: bridgeId, status: "revoked", revokedAt: t } });
  }
  return null;
}
