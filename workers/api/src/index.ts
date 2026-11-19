export interface Env {
  APP_ENV: string;
  DB: D1Database;
  DEV_API_TOKEN?: string;
}

type JsonObject = Record<string, unknown>;
const json = (data: unknown, init: ResponseInit = {}) =>
  Response.json(data, { ...init, headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...init.headers,
  }});
const fail = (status: number, code: string, message: string) =>
  json({ error: { code, message } }, { status });
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const isObject = (v: unknown): v is JsonObject => typeof v === "object" && v !== null && !Array.isArray(v);

function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}
async function body(request: Request): Promise<JsonObject | null> {
  const n = Number(request.headers.get("content-length") ?? 0);
  if (n > 16384) return null;
  try { const value: unknown = await request.json(); return isObject(value) ? value : null; }
  catch { return null; }
}
async function authorize(request: Request, env: Env): Promise<Response | null> {
  if (env.APP_ENV !== "development") return fail(503, "auth_not_configured", "Authentication is not configured.");
  if (!env.DEV_API_TOKEN) return fail(503, "dev_token_not_configured", "Configure the DEV_API_TOKEN Worker secret.");
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return safeEqual(token, env.DEV_API_TOKEN) ? null : fail(401, "unauthorized", "A valid development bearer token is required.");
}
async function ensureDevUser(db: D1Database) {
  const t = now();
  await db.prepare(`INSERT INTO users (id, identity_provider, provider_subject, email, display_name, created_at, updated_at)
    VALUES ('dev-owner','dev','dev-owner','dev-owner@vansvriksh.local','Development Owner',?,?)
    ON CONFLICT(identity_provider,provider_subject) DO UPDATE SET updated_at=excluded.updated_at`).bind(t,t).run();
}
async function roleFor(db: D1Database, familyId: string) {
  const row = await db.prepare("SELECT role FROM family_members WHERE family_id=? AND user_id='dev-owner'")
    .bind(familyId).first<{role:string}>();
  return row?.role ?? null;
}
const textOrNull = (v: unknown) => typeof v === "string" && v.trim() ? v.trim() : null;
const yearOrNull = (v: unknown) => Number.isInteger(v) && Number(v) >= 1 && Number(v) <= 9999 ? Number(v) : null;

async function api(request: Request, env: Env, url: URL): Promise<Response> {
  const denied = await authorize(request, env);
  if (denied) return denied;
  await ensureDevUser(env.DB);

  if (url.pathname === "/v1/families" && request.method === "GET") {
    const result = await env.DB.prepare(`SELECT f.id,f.name,f.created_at,f.updated_at,fm.role
      FROM families f JOIN family_members fm ON fm.family_id=f.id
      WHERE fm.user_id='dev-owner' ORDER BY f.created_at DESC`).all();
    return json({data: result.results});
  }
  if (url.pathname === "/v1/families" && request.method === "POST") {
    const input = await body(request);
    if (!input || typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 120)
      return fail(400,"invalid_name","Family name must contain between 1 and 120 characters.");
    const familyId=id(), t=now(), name=input.name.trim();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO families(id,name,owner_user_id,privacy,created_at,updated_at) VALUES(?,?,'dev-owner','private',?,?)").bind(familyId,name,t,t),
      env.DB.prepare("INSERT INTO family_members(family_id,user_id,role,joined_at) VALUES(?,'dev-owner','owner',?)").bind(familyId,t),
      env.DB.prepare("INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,change_summary,created_at) VALUES(?,?,'dev-owner','family',?,'family.created',?,?)").bind(id(),familyId,familyId,JSON.stringify({name}),t)
    ]);
    return json({data:{id:familyId,name,role:"owner",createdAt:t}},{status:201});
  }

  const match=url.pathname.match(/^\/v1\/families\/([^/]+)\/people$/);
  if (match) {
    const familyId=match[1], role=await roleFor(env.DB,familyId);
    if (!role) return fail(404,"family_not_found","Family not found.");
    if (request.method === "GET") {
      const result=await env.DB.prepare(`SELECT id,family_id,given_name,middle_name,family_name,display_name,gender,life_status,
        birth_date_kind,birth_exact_date,birth_year,birth_range_start_year,birth_range_end_year,birth_original_text,
        death_date_kind,death_exact_date,death_year,death_range_start_year,death_range_end_year,death_original_text,created_at,updated_at
        FROM persons WHERE family_id=? ORDER BY family_name,given_name`).bind(familyId).all();
      return json({data:result.results});
    }
    if (request.method === "POST") {
      if (role === "viewer") return fail(403,"forbidden","Viewer access cannot add people.");
      const input=await body(request);
      if (!input || typeof input.givenName !== "string" || !input.givenName.trim() || input.givenName.trim().length>120)
        return fail(400,"invalid_given_name","Given name must contain between 1 and 120 characters.");
      const allowed=["exact","year","approximate_year","range","unknown"];
      const birthKind=typeof input.birthDateKind==="string"?input.birthDateKind:"unknown";
      const deathKind=typeof input.deathDateKind==="string"?input.deathDateKind:"unknown";
      if (!allowed.includes(birthKind)||!allowed.includes(deathKind))
        return fail(400,"invalid_date_precision","Unsupported historical date precision.");
      const personId=id(), t=now(), life=input.lifeStatus==="deceased"?"deceased":"alive";
      const displayName=[textOrNull(input.givenName),textOrNull(input.middleName),textOrNull(input.familyName)].filter(Boolean).join(" ");
      try {
        await env.DB.prepare(`INSERT INTO persons(id,family_id,given_name,middle_name,family_name,display_name,gender,life_status,
          birth_date_kind,birth_exact_date,birth_year,birth_range_start_year,birth_range_end_year,birth_original_text,
          death_date_kind,death_exact_date,death_year,death_range_start_year,death_range_end_year,death_original_text,
          created_by_user_id,created_at,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'dev-owner',?,?)`).bind(
          personId,familyId,input.givenName.trim(),textOrNull(input.middleName),textOrNull(input.familyName),displayName,
          textOrNull(input.gender),life,birthKind,textOrNull(input.birthExactDate),yearOrNull(input.birthYear),
          yearOrNull(input.birthRangeStartYear),yearOrNull(input.birthRangeEndYear),textOrNull(input.birthOriginalText),
          deathKind,textOrNull(input.deathExactDate),yearOrNull(input.deathYear),yearOrNull(input.deathRangeStartYear),
          yearOrNull(input.deathRangeEndYear),textOrNull(input.deathOriginalText),t,t).run();
        await env.DB.prepare("INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,created_at) VALUES(?,?,'dev-owner','person',?,'person.created',?)")
          .bind(id(),familyId,personId,t).run();
        return json({data:{id:personId,familyId,displayName,lifeStatus:life,createdAt:t}},{status:201});
      } catch {
        return fail(400,"invalid_person","Person data violates the family or historical-date constraints.");
      }
    }
  }
  return fail(404,"not_found","Route not found.");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url=new URL(request.url);
    if (request.method==="GET" && url.pathname==="/health") {
      try {
        const result=await env.DB.prepare("SELECT 1 AS ok").first<{ok:number}>();
        return json({status:"ok",service:"family-tree-api",environment:env.APP_ENV,database:result?.ok===1?"connected":"unavailable"});
      } catch {
        return json({status:"degraded",service:"family-tree-api",environment:env.APP_ENV,database:"unavailable"},{status:503});
      }
    }
    if (url.pathname.startsWith("/v1/")) {
      try { return await api(request,env,url); }
      catch { return fail(500,"internal_error","The request could not be completed."); }
    }
    return fail(404,"not_found","Route not found.");
  }
};
