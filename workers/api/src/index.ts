export interface Env {
  APP_ENV: string;
  ALLOWED_ORIGINS?: string;
  DB: D1Database;
  DEV_API_TOKEN?: string;
  GOOGLE_CLIENT_ID?: string;
  INITIAL_OWNER_EMAIL?: string;
  SUPER_ADMIN_EMAIL?: string;
}

type JsonObject = Record<string, unknown>;
const json = (data: unknown, init: ResponseInit = {}) => Response.json(data, { ...init, headers: {
  "content-type": "application/json; charset=utf-8", "cache-control": "no-store",
  "x-content-type-options": "nosniff", ...init.headers,
}});
const fail = (status: number, code: string, message: string) => json({ error: { code, message } }, { status });
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
  if (Number(request.headers.get("content-length") ?? 0) > 65536) return null;
  try { const value: unknown = await request.json(); return isObject(value) ? value : null; }
  catch { return null; }
}
const SESSION_COOKIE = "vansvriksh_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
let googleJwksCache: {keys: JsonWebKey[]; expiresAt: number} | null = null;
function base64UrlBytes(value: string): Uint8Array {
  const padded=value.replace(/-/g,"+").replace(/_/g,"/")+"===".slice((value.length+3)%4);
  const binary=atob(padded);return Uint8Array.from(binary,ch=>ch.charCodeAt(0));
}
function base64Url(value: Uint8Array): string {
  let binary="";for(const byte of value)binary+=String.fromCharCode(byte);
  return btoa(binary).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
}
async function sha256(value: string): Promise<string> {
  return base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))));
}
async function enforceRateLimit(request:Request,db:D1Database,scope:string,limit:number,windowMs:number,keySuffix=""):Promise<Response|null>{
  const timestamp=Date.now(),windowStart=Math.floor(timestamp/windowMs)*windowMs;
  const address=request.headers.get("CF-Connecting-IP")?.trim()||"unknown";
  const keyHash=await sha256(`${scope}:${address}:${keySuffix}:${windowStart}`);
  const result=await db.prepare(`INSERT INTO api_rate_limits(scope,key_hash,window_started_at,request_count) VALUES(?,?,?,1)
    ON CONFLICT(scope,key_hash) DO UPDATE SET request_count=api_rate_limits.request_count+1 RETURNING request_count`)
    .bind(scope,keyHash,windowStart).first<{request_count:number}>();
  await db.prepare("DELETE FROM api_rate_limits WHERE scope=? AND window_started_at<?").bind(scope,windowStart-windowMs*2).run();
  if(!result)return fail(503,"rate_limit_unavailable","Request security checks are temporarily unavailable.");
  if(result.request_count>limit){
    const retryAfter=Math.max(1,Math.ceil((windowStart+windowMs-timestamp)/1000));
    return json({error:{code:"rate_limited",message:"Too many requests. Please try again later."}},{status:429,headers:{"retry-after":String(retryAfter)}});
  }
  return null;
}
function cookieValue(request: Request,name: string): string | null {
  const cookie=request.headers.get("Cookie")||"";
  for(const part of cookie.split(";")){const [key,...rest]=part.trim().split("=");if(key===name)return rest.join("=")||"";}
  return null;
}
async function verifyGoogleCredential(credential: string, clientId: string): Promise<{sub:string;email:string;name:string;picture:string|null}|null> {
  try {
    const parts=credential.split(".");if(parts.length!==3)return null;
    const header=JSON.parse(new TextDecoder().decode(base64UrlBytes(parts[0]))) as {alg?:string;kid?:string};
    const claims=JSON.parse(new TextDecoder().decode(base64UrlBytes(parts[1]))) as {iss?:string;aud?:string;exp?:number;sub?:string;email?:string;email_verified?:boolean;name?:string;picture?:string};
    if(header.alg!=="RS256"||!header.kid||!claims.sub||claims.aud!==clientId||
      !["accounts.google.com","https://accounts.google.com"].includes(claims.iss||"")||
      !claims.exp||claims.exp<=Math.floor(Date.now()/1000)||!claims.email||claims.email_verified!==true)return null;
    if(!googleJwksCache||googleJwksCache.expiresAt<Date.now()){
      const response=await fetch("https://www.googleapis.com/oauth2/v3/certs",{headers:{"Accept":"application/json"}});
      if(!response.ok)return null;
      const data=await response.json() as {keys:JsonWebKey[]};
      googleJwksCache={keys:data.keys,expiresAt:Date.now()+60*60*1000};
    }
    const jwk=googleJwksCache.keys.find(key=>(key as JsonWebKey & {kid?:string}).kid===header.kid);
    if(!jwk)return null;
    const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
    const valid=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,base64UrlBytes(parts[2]),new TextEncoder().encode(parts[0]+"."+parts[1]));
    if(!valid)return null;
    return {sub:claims.sub,email:claims.email,name:claims.name||claims.email,picture:claims.picture||null};
  } catch { return null; }
}
async function currentSession(request: Request,db: D1Database): Promise<{id:string;email:string;displayName:string}|null> {
  const token=cookieValue(request,SESSION_COOKIE);if(!token)return null;
  const tokenHash=await sha256(token),t=now();
  const row=await db.prepare(`SELECT u.id,u.email,u.display_name,s.id AS session_id FROM auth_sessions s
    JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? LIMIT 1`).bind(tokenHash,t).first<{id:string;email:string;display_name:string;session_id:string}>();
  if(!row)return null;
  await db.prepare("UPDATE auth_sessions SET last_seen_at=? WHERE id=?").bind(t,row.session_id).run();
  return {id:row.id,email:row.email,displayName:row.display_name};
}
async function authRoute(request: Request,env: Env,url: URL): Promise<Response|null> {
  if(url.pathname==="/v1/auth/google"&&request.method==="POST"){
    if(!env.GOOGLE_CLIENT_ID)return fail(503,"google_auth_not_configured","Google sign-in is not configured on the API.");
    const limited=await enforceRateLimit(request,env.DB,"google_sign_in",20,15*60*1000);
    if(limited)return limited;
    const input=await body(request),credential=typeof input?.credential==="string"?input.credential:"";
    if(!credential)return fail(400,"missing_credential","A Google identity credential is required.");
    const identity=await verifyGoogleCredential(credential,env.GOOGLE_CLIENT_ID);
    if(!identity)return fail(401,"invalid_google_credential","Google could not verify this sign-in. Please try again.");
    const timestamp=now();
    // Preserve the legacy owner identity for the configured first account; allow other verified Google identities to register independently.
    let user=await env.DB.prepare("SELECT id,email,display_name FROM users WHERE identity_provider='google' AND provider_subject=?")
      .bind(identity.sub).first<{id:string;email:string;display_name:string}>();
    if(!user){
      const emailOwner=await env.DB.prepare("SELECT id,identity_provider FROM users WHERE lower(email)=lower(?) LIMIT 1")
        .bind(identity.email).first<{id:string;identity_provider:string}>();
      if(emailOwner){
        if(emailOwner.id!=="dev-owner"||emailOwner.identity_provider!=="dev"||!env.INITIAL_OWNER_EMAIL||identity.email.toLowerCase()!==env.INITIAL_OWNER_EMAIL.toLowerCase()) return fail(409,"account_email_in_use","This email is already associated with another account identity. Contact platform support.");
        await env.DB.prepare("UPDATE users SET identity_provider='google',provider_subject=?,email=?,display_name=?,avatar_url=?,updated_at=? WHERE id='dev-owner' AND identity_provider='dev'")
          .bind(identity.sub,identity.email,identity.name,identity.picture,timestamp).run();
        user={id:"dev-owner",email:identity.email,display_name:identity.name};
      }else{
        const newUserId=id();
        await env.DB.prepare("INSERT INTO users(id,identity_provider,provider_subject,email,display_name,avatar_url,created_at,updated_at) VALUES(?,'google',?,?,?,?,?,?)")
          .bind(newUserId,identity.sub,identity.email,identity.name,identity.picture,timestamp,timestamp).run();
        user={id:newUserId,email:identity.email,display_name:identity.name};
      }
    }
    const superAdminEmail=env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
    if(superAdminEmail&&identity.email.toLowerCase()===superAdminEmail){
      await env.DB.prepare("INSERT OR IGNORE INTO platform_super_admins(user_id,granted_by_user_id,granted_at,reason) VALUES(?,NULL,?,'Initial platform super administrator bootstrap')").bind(user.id,timestamp).run();
    }
    await env.DB.prepare("UPDATE users SET email=?,display_name=?,avatar_url=?,updated_at=? WHERE id=?")
      .bind(identity.email,identity.name,identity.picture,timestamp,user.id).run();
    const random=new Uint8Array(32);crypto.getRandomValues(random);const sessionToken=base64Url(random);
    const expiresAt=new Date(Date.now()+SESSION_TTL_SECONDS*1000).toISOString();
    await env.DB.prepare("INSERT INTO auth_sessions(id,user_id,token_hash,expires_at,created_at,last_seen_at) VALUES(?,?,?,?,?,?)")
      .bind(id(),user.id,await sha256(sessionToken),expiresAt,timestamp,timestamp).run();
    await ensureSampleAccess(env.DB,user.id);
    const response=json({data:{user:{id:user.id,email:user.email,displayName:user.display_name},expiresAt}});
    response.headers.append("Set-Cookie",SESSION_COOKIE+"="+sessionToken+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age="+SESSION_TTL_SECONDS);
    return response;
  }
  if(url.pathname==="/v1/auth/me"&&request.method==="GET"){
    const user=await currentSession(request,env.DB);
    return user?json({data:{user}}):fail(401,"not_authenticated","Please sign in to continue.");
  }
  if(url.pathname==="/v1/auth/logout"&&request.method==="POST"){
    const token=cookieValue(request,SESSION_COOKIE);
    if(token)await env.DB.prepare("DELETE FROM auth_sessions WHERE token_hash=?").bind(await sha256(token)).run();
    const response=json({data:{signedOut:true}});
    response.headers.append("Set-Cookie",SESSION_COOKIE+"=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
    return response;
  }
  return null;
}
async function authorize(request: Request, env: Env): Promise<Response | null> {
  if(await currentSession(request,env.DB))return null;
  if (env.APP_ENV !== "development") return fail(401, "unauthorized", "Please sign in with Google.");
  if (!env.DEV_API_TOKEN) return fail(503, "dev_token_not_configured", "Configure the DEV_API_TOKEN Worker secret.");
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return safeEqual(token, env.DEV_API_TOKEN) ? null : fail(401, "unauthorized", "A valid sign-in session is required.");
}
async function ensureDevUser(db: D1Database) {
  const t = now();
  await db.prepare(`INSERT OR IGNORE INTO users(id,identity_provider,provider_subject,email,display_name,created_at,updated_at)
    VALUES('dev-owner','dev','dev-owner','dev-owner@vansvriksh.local','Development Owner',?,?)
    ON CONFLICT(identity_provider,provider_subject) DO UPDATE SET updated_at=excluded.updated_at`).bind(t,t).run();
}
async function isSuperAdmin(db:D1Database,userId:string):Promise<boolean>{
  const row=await db.prepare("SELECT 1 AS allowed FROM platform_super_admins WHERE user_id=?").bind(userId).first<{allowed:number}>();
  return !!row;
}
async function writePlatformAudit(db:D1Database,actorUserId:string,action:string,targetType:string,targetId:string|null,reason:string,metadata?:unknown){
  await db.prepare("INSERT INTO platform_audit_logs(id,actor_user_id,action,target_type,target_id,reason,metadata,created_at) VALUES(?,?,?,?,?,?,?,?)")
    .bind(id(),actorUserId,action,targetType,targetId,reason,metadata?JSON.stringify(metadata):null,now()).run();
}
async function roleFor(db: D1Database, familyId: string, userId: string) {
  const row = await db.prepare("SELECT role FROM family_members WHERE family_id=? AND user_id=?").bind(familyId,userId).first<{role:string}>();
  return row?.role ?? null;
}
async function sampleFamilyId(db:D1Database):Promise<string|null>{
  const row=await db.prepare("SELECT id FROM families WHERE is_sample=1 LIMIT 1").first<{id:string}>();
  return row?.id??null;
}
async function ensureSampleAccess(db:D1Database,userId:string):Promise<boolean>{
  const familyId=await sampleFamilyId(db);if(!familyId)return false;
  const dismissal=await db.prepare("SELECT 1 AS dismissed FROM sample_family_dismissals WHERE user_id=?").bind(userId).first();
  if(dismissal)return false;
  await db.prepare("INSERT OR IGNORE INTO family_members(family_id,user_id,role,joined_at) VALUES(?,?,'viewer',?)")
    .bind(familyId,userId,now()).run();
  return true;
}
async function isSampleFamily(db:D1Database,familyId:string):Promise<boolean>{
  const row=await db.prepare("SELECT 1 AS sample FROM families WHERE id=? AND is_sample=1").bind(familyId).first();
  return !!row;
}
const textOrNull = (v: unknown) => typeof v === "string" && v.trim() ? v.trim() : null;
const yearOrNull = (v: unknown) => Number.isInteger(v) && Number(v) >= 1 && Number(v) <= 9999 ? Number(v) : null;
const parentTypes = ["biological_parent", "adoptive_parent", "step_parent"];
const relationshipTypes = [...parentTypes, "spouse", "partner", "sibling"];

async function api(request: Request, env: Env, url: URL): Promise<Response> {
  const authResponse=await authRoute(request,env,url);if(authResponse)return authResponse;
  const denied = await authorize(request, env);
  if (denied) return denied;
  if(env.APP_ENV==="development")await ensureDevUser(env.DB);
  const session=await currentSession(request,env.DB);
  if(env.APP_ENV!=="development"&&!session)return fail(401,"unauthorized","Please sign in with Google.");
  const actorUserId=session?.id??"dev-owner";
  const superAdmin=!!session&&await isSuperAdmin(env.DB,session.id);

  if(url.pathname==="/v1/onboarding/sample-access"&&request.method==="POST"){
    const attached=await ensureSampleAccess(env.DB,actorUserId);
    const familyId=attached?await sampleFamilyId(env.DB):null;
    return json({data:{available:!!familyId,attached:!!familyId, familyId, role:familyId?"viewer":null}});
  }
  if(url.pathname==="/v1/onboarding/sample-access"&&request.method==="DELETE"){
    const familyId=await sampleFamilyId(env.DB);
    if(!familyId)return json({data:{removed:false}});
    const timestamp=now();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO sample_family_dismissals(user_id,dismissed_at) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET dismissed_at=excluded.dismissed_at").bind(actorUserId,timestamp),
      env.DB.prepare("DELETE FROM family_members WHERE family_id=? AND user_id=? AND role='viewer'").bind(familyId,actorUserId),
    ]);
    return json({data:{removed:true, familyId}});
  }

  if(url.pathname==="/v1/platform/me"&&request.method==="GET"){
    return json({data:{isSuperAdmin:superAdmin,user:session?{id:session.id,email:session.email,displayName:session.displayName}:null}});
  }
  if(url.pathname==="/v1/platform/overview"&&request.method==="GET"){
    if(!superAdmin)return fail(403,"platform_admin_required","Super Admin access is required.");
    const [users,families]=await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS count FROM users").first<{count:number}>(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM families").first<{count:number}>()
    ]);
    return json({data:{userCount:users?.count??0,familyCount:families?.count??0}});
  }
  if(url.pathname==="/v1/platform/users"&&request.method==="GET"){
    if(!superAdmin)return fail(403,"platform_admin_required","Super Admin access is required.");
    const result=await env.DB.prepare(`SELECT u.id,u.email,u.display_name,u.avatar_url,u.created_at,
      CASE WHEN sa.user_id IS NULL THEN 0 ELSE 1 END AS is_super_admin,
      (SELECT COUNT(*) FROM family_members fm WHERE fm.user_id=u.id) AS family_count
      FROM users u LEFT JOIN platform_super_admins sa ON sa.user_id=u.id ORDER BY u.created_at DESC`).all();
    return json({data:result.results});
  }
  if(url.pathname==="/v1/platform/families"&&request.method==="GET"){
    if(!superAdmin)return fail(403,"platform_admin_required","Super Admin access is required.");
    const result=await env.DB.prepare(`SELECT f.id,f.name,f.created_at,f.updated_at,u.email AS owner_email,
      (SELECT COUNT(*) FROM family_members fm WHERE fm.family_id=f.id) AS member_count,
      (SELECT COUNT(*) FROM persons p WHERE p.family_id=f.id) AS person_count
      FROM families f JOIN users u ON u.id=f.owner_user_id ORDER BY f.created_at DESC`).all();
    return json({data:result.results});
  }
  const supportAccess=url.pathname.match(/^\/v1\/platform\/families\/([^/]+)\/support-access$/);
  if(supportAccess&&request.method==="POST"){
    if(!superAdmin)return fail(403,"platform_admin_required","Super Admin access is required.");
    const familyId=supportAccess[1],input=await body(request),reason=typeof input?.reason==="string"?input.reason.trim():"";
    if(reason.length<12||reason.length>500)return fail(400,"support_reason_required","Provide a clear support or recovery reason (12–500 characters).");
    const family=await env.DB.prepare("SELECT id,name FROM families WHERE id=?").bind(familyId).first<{id:string;name:string}>();
    if(!family)return fail(404,"family_not_found","Family not found.");
    await writePlatformAudit(env.DB,actorUserId,"family.support_access","family",familyId,reason,{familyName:family.name});
    const people=await env.DB.prepare(`SELECT id,given_name,middle_name,family_name,display_name,gender,life_status,
      birth_date_kind,birth_exact_date,birth_year,birth_range_start_year,birth_range_end_year,birth_original_text,birth_place,birth_country,
      death_date_kind,death_exact_date,death_year,death_range_start_year,death_range_end_year,death_original_text,biography
      FROM persons WHERE family_id=? ORDER BY family_name,given_name`).bind(familyId).all();
    const relationships=await env.DB.prepare("SELECT id,from_person_id,to_person_id,relationship_type FROM relationships WHERE family_id=?").bind(familyId).all();
    return json({data:{family,people:people.results,relationships:relationships.results,auditLogged:true}});
  }
  const platformExport=url.pathname.match(/^\/v1\/platform\/families\/([^/]+)\/export$/);
  if(platformExport&&request.method==="POST"){
    if(!superAdmin)return fail(403,"platform_admin_required","Super Admin access is required.");
    const familyId=platformExport[1],input=await body(request),reason=typeof input?.reason==="string"?input.reason.trim():"";
    if(reason.length<12||reason.length>500)return fail(400,"support_reason_required","Provide a clear export reason (12–500 characters).");
    const family=await env.DB.prepare("SELECT id,name FROM families WHERE id=?").bind(familyId).first<{id:string;name:string}>();
    if(!family)return fail(404,"family_not_found","Family not found.");
    await writePlatformAudit(env.DB,actorUserId,"family.export","family",familyId,reason,{familyName:family.name});
    const [people,relationships]=await Promise.all([
      env.DB.prepare("SELECT * FROM persons WHERE family_id=? ORDER BY family_name,given_name").bind(familyId).all(),
      env.DB.prepare("SELECT id,from_person_id,to_person_id,relationship_type,metadata_json,created_at FROM relationships WHERE family_id=? ORDER BY created_at").bind(familyId).all(),
    ]);
    return json({data:{family,people:people.results,relationships:relationships.results,auditLogged:true}});
  }
  if(url.pathname==="/v1/platform/audit-logs"&&request.method==="GET"){
    if(!superAdmin)return fail(403,"platform_admin_required","Super Admin access is required.");
    const result=await env.DB.prepare(`SELECT l.id,l.actor_user_id,u.email AS actor_email,l.action,l.target_type,l.target_id,l.reason,l.metadata,l.created_at
      FROM platform_audit_logs l JOIN users u ON u.id=l.actor_user_id ORDER BY l.created_at DESC LIMIT 200`).all();
    return json({data:result.results});
  }

  const familyPath=url.pathname.match(/^\/v1\/families\/([^/]+)(?:\/|$)/);
  if(familyPath&&["POST","PUT","PATCH","DELETE"].includes(request.method)&&await isSampleFamily(env.DB,familyPath[1])){
    return fail(403,"sample_read_only","The shared sample is read-only. Export it and import the workbook into a family you own to make changes.");
  }

  if (url.pathname === "/v1/families" && request.method === "GET") {
    const result = await env.DB.prepare("SELECT f.id,f.name,f.created_at,f.updated_at,fm.role,f.is_sample FROM families f JOIN family_members fm ON fm.family_id=f.id WHERE fm.user_id=? ORDER BY f.created_at DESC").bind(actorUserId).all();
    return json({data:result.results});
  }
  if (url.pathname === "/v1/families" && request.method === "POST") {
    const input = await body(request);
    if (!input || typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 120) return fail(400,"invalid_name","Family name must contain between 1 and 120 characters.");
    const familyId=id(), t=now(), name=input.name.trim();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO families(id,name,owner_user_id,privacy,created_at,updated_at) VALUES(?,?,?,'private',?,?)").bind(familyId,name,actorUserId,t,t),
      env.DB.prepare("INSERT INTO family_members(family_id,user_id,role,joined_at) VALUES(?,?,'owner',?)").bind(familyId,actorUserId,t),
      env.DB.prepare("INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,change_summary,created_at) VALUES(?,?,?,'family',?,'family.created',?,?)").bind(id(),familyId,actorUserId,familyId,JSON.stringify({name}),t)
    ]);
    return json({data:{id:familyId,name,role:"owner",createdAt:t}},{status:201});
  }


  const familyMembersMatch=url.pathname.match(/^\/v1\/families\/([^/]+)\/members$/);
  if(familyMembersMatch&&request.method==="GET"){
    const familyId=familyMembersMatch[1],role=await roleFor(env.DB,familyId,actorUserId);
    if(!role)return fail(404,"family_not_found","Family not found.");
    if(await isSampleFamily(env.DB,familyId))return json({data:[]});
    if(role==="viewer")return fail(403,"forbidden","Viewer access cannot view the family member roster.");
    const members=await env.DB.prepare("SELECT u.id,u.email,u.display_name,u.avatar_url,fm.role,fm.joined_at FROM family_members fm JOIN users u ON u.id=fm.user_id WHERE fm.family_id=? ORDER BY CASE fm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'editor' THEN 2 ELSE 3 END,fm.joined_at").bind(familyId).all();
    return json({data:members.results});
  }
  const familyInvitationsMatch=url.pathname.match(/^\/v1\/families\/([^/]+)\/invitations$/);
  if(familyInvitationsMatch&&request.method==="POST"){
    const familyId=familyInvitationsMatch[1],role=await roleFor(env.DB,familyId,actorUserId);
    if(role!=="owner"&&role!=="admin")return fail(role?403:404,"forbidden","Only a family owner or admin can invite collaborators.");
    const ipLimited=await enforceRateLimit(request,env.DB,"invitation_create_ip",20,60*60*1000);
    if(ipLimited)return ipLimited;
    const userLimited=await enforceRateLimit(request,env.DB,"invitation_create_user",10,60*60*1000,actorUserId);
    if(userLimited)return userLimited;
    const input=await body(request),email=textOrNull(input?.email)?.toLowerCase()||null;
    const offeredRole=typeof input?.role==="string"?input.role:"viewer";
    if(!email||email.length>254||!/^\S+@\S+\.\S+$/.test(email))return fail(400,"invalid_invitee_email","Provide a valid email address for the invitation.");
    if(!["admin","editor","viewer"].includes(offeredRole))return fail(400,"invalid_invitation_role","Invitations can offer Admin, Editor or Viewer access.");
    if(role==="admin"&&offeredRole==="admin")return fail(403,"role_assignment_forbidden","Family admins can invite Editors or Viewers, not other Admins.");
    const existing=await env.DB.prepare("SELECT u.id,fm.role FROM users u LEFT JOIN family_members fm ON fm.user_id=u.id AND fm.family_id=? WHERE lower(u.email)=lower(?) LIMIT 1").bind(familyId,email).first<{id:string;role:string|null}>();
    if(existing?.role)return fail(409,"already_a_member","This user is already a member of the family.");
    const codeBytes=new Uint8Array(32);crypto.getRandomValues(codeBytes);const code=base64Url(codeBytes),created=now(),expires=new Date(Date.now()+7*24*60*60*1000).toISOString();
    await env.DB.prepare("INSERT INTO invitations(id,family_id,inviter_user_id,invitee_email,invite_code_hash,offered_role,status,expires_at,created_at) VALUES(?,?,?,?,?,?,'pending',?,?)")
      .bind(id(),familyId,actorUserId,email,await sha256(code),offeredRole,expires,created).run();
    await env.DB.prepare("INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,change_summary,created_at) VALUES(?,?,?,'invitation',?,'invitation.created',?,?)")
      .bind(id(),familyId,actorUserId,email,JSON.stringify({email,role:offeredRole,expiresAt:expires}),created).run();
    return json({data:{inviteCode:code,email,role:offeredRole,expiresAt:expires}},{status:201});
  }
  if(familyInvitationsMatch&&request.method==="GET"){
    const familyId=familyInvitationsMatch[1],role=await roleFor(env.DB,familyId,actorUserId);
    if(role!=="owner"&&role!=="admin")return fail(role?403:404,"forbidden","Only a family owner or admin can view invitations.");
    const invitations=await env.DB.prepare(`SELECT id,invitee_email,offered_role,status,expires_at,created_at
      FROM invitations WHERE family_id=? AND status='pending' AND expires_at>? ORDER BY created_at DESC`).bind(familyId,now()).all();
    return json({data:invitations.results});
  }
  const invitationRevokeMatch=url.pathname.match(/^\/v1\/families\/([^/]+)\/invitations\/([^/]+)$/);
  if(invitationRevokeMatch&&request.method==="DELETE"){
    const familyId=invitationRevokeMatch[1],invitationId=invitationRevokeMatch[2],role=await roleFor(env.DB,familyId,actorUserId);
    if(role!=="owner"&&role!=="admin")return fail(role?403:404,"forbidden","Only a family owner or admin can revoke invitations.");
    const timestamp=now();
    const results=await env.DB.batch([
      env.DB.prepare("UPDATE invitations SET status='revoked',revoked_at=?,revoked_by_user_id=? WHERE id=? AND family_id=? AND status='pending' AND expires_at>?").bind(timestamp,actorUserId,invitationId,familyId,timestamp),
      env.DB.prepare(`INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,change_summary,created_at)
        SELECT ?,?,?, 'invitation',?,'invitation.revoked',?,? WHERE changes()=1`).bind(id(),familyId,actorUserId,invitationId,JSON.stringify({invitationId}),timestamp),
    ]);
    const changes=(results[0] as {meta?:{changes?:number}}|undefined)?.meta?.changes??0;
    if(!changes)return fail(404,"invitation_unavailable","This pending invitation is no longer available.");
    return json({data:{id:invitationId,revoked:true}});
  }
  const invitationAcceptMatch=url.pathname.match(/^\/v1\/invitations\/([^/]+)\/accept$/);
  if(invitationAcceptMatch&&request.method==="POST"){
    const ipLimited=await enforceRateLimit(request,env.DB,"invitation_accept_ip",30,60*60*1000);
    if(ipLimited)return ipLimited;
    if(!session)return fail(401,"not_authenticated","Sign in with Google before accepting an invitation.");
    const userLimited=await enforceRateLimit(request,env.DB,"invitation_accept_user",20,60*60*1000,actorUserId);
    if(userLimited)return userLimited;
    const code=invitationAcceptMatch[1],hash=await sha256(code),timestamp=now();
    const invitation=await env.DB.prepare("SELECT id,family_id,invitee_email,offered_role,status,expires_at FROM invitations WHERE invite_code_hash=?").bind(hash).first<{id:string;family_id:string;invitee_email:string|null;offered_role:string;status:string;expires_at:string}>();
    if(!invitation||invitation.status!=="pending"||invitation.expires_at<=timestamp)return fail(404,"invitation_unavailable","This invitation is invalid, expired or no longer available.");
    if(invitation.invitee_email&&invitation.invitee_email.toLowerCase()!==session.email.toLowerCase())return fail(403,"invitation_email_mismatch","Sign in with the Google account that received this invitation.");
    const member=await env.DB.prepare("SELECT role FROM family_members WHERE family_id=? AND user_id=?").bind(invitation.family_id,actorUserId).first();
    if(member)return fail(409,"already_a_member","You are already a member of this family.");
    const results=await env.DB.batch([
      env.DB.prepare("UPDATE invitations SET status='accepted',accepted_at=?,accepted_by_user_id=? WHERE id=? AND status='pending' AND expires_at>?").bind(timestamp,actorUserId,invitation.id,timestamp),
      env.DB.prepare(`INSERT INTO family_members(family_id,user_id,role,joined_at)
        SELECT family_id,?,?,? FROM invitations WHERE id=? AND changes()=1`).bind(actorUserId,invitation.offered_role,timestamp,invitation.id),
      env.DB.prepare(`INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,change_summary,created_at)
        SELECT ?,family_id,?,'invitation',?,'invitation.accepted',?,? FROM invitations WHERE id=? AND changes()=1`)
        .bind(id(),actorUserId,invitation.id,JSON.stringify({role:invitation.offered_role}),timestamp,invitation.id)
    ]);
    const changes=(results[0] as {meta?:{changes?:number}}|undefined)?.meta?.changes??0;
    if(!changes)return fail(404,"invitation_unavailable","This invitation is invalid, expired or no longer available.");
    return json({data:{familyId:invitation.family_id,role:invitation.offered_role,accepted:true}});
  }
  const familyMemberRoleMatch=url.pathname.match(/^\/v1\/families\/([^/]+)\/members\/([^/]+)$/);
  if(familyMemberRoleMatch&&request.method==="PUT"){
    const familyId=familyMemberRoleMatch[1],targetUserId=familyMemberRoleMatch[2],actorRole=await roleFor(env.DB,familyId,actorUserId);
    if(actorRole!=="owner"&&actorRole!=="admin")return fail(actorRole?403:404,"forbidden","Only a family owner or admin can manage member roles.");
    const input=await body(request),newRole=typeof input?.role==="string"?input.role:"";
    if(!["admin","editor","viewer"].includes(newRole))return fail(400,"invalid_member_role","Choose Admin, Editor or Viewer.");
    if(actorRole==="admin"&&newRole==="admin")return fail(403,"role_assignment_forbidden","Family admins cannot assign Admin privileges.");
    const target=await env.DB.prepare("SELECT role FROM family_members WHERE family_id=? AND user_id=?").bind(familyId,targetUserId).first<{role:string}>();
    if(!target)return fail(404,"member_not_found","Family member not found.");
    if(target.role==="owner")return fail(409,"owner_role_protected","Use the ownership transfer workflow to change the family owner.");
    if(actorRole==="admin"&&target.role==="admin")return fail(403,"role_assignment_forbidden","Family admins cannot modify another Admin.");
    const timestamp=now();
    const results=await env.DB.batch([
      env.DB.prepare(`UPDATE family_members AS target SET role=?
        WHERE target.family_id=? AND target.user_id=? AND target.role=? AND target.role<>'owner'
          AND EXISTS (SELECT 1 FROM family_members AS actor WHERE actor.family_id=? AND actor.user_id=?
            AND actor.role IN ('owner','admin')
            AND (actor.role='owner' OR (?<>'admin' AND target.role<>'admin')))`).bind(newRole,familyId,targetUserId,target.role,familyId,actorUserId,newRole),
      env.DB.prepare(`INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,change_summary,created_at)
        SELECT ?,?,?, 'family_member',?,'member.role_changed',?,? WHERE changes()=1`).bind(id(),familyId,actorUserId,targetUserId,JSON.stringify({from:target.role,to:newRole}),timestamp)
    ]);
    const changes=(results[0] as {meta?:{changes?:number}}|undefined)?.meta?.changes??0;
    if(!changes)return fail(409,"member_change_unavailable","The member or your permissions changed. Refresh and try again.");
    return json({data:{userId:targetUserId,role:newRole}});
  }
  if(familyMemberRoleMatch&&request.method==="DELETE"){
    const familyId=familyMemberRoleMatch[1],targetUserId=familyMemberRoleMatch[2],actorRole=await roleFor(env.DB,familyId,actorUserId);
    if(actorRole!=="owner"&&actorRole!=="admin")return fail(actorRole?403:404,"forbidden","Only a family owner or admin can remove a member.");
    const target=await env.DB.prepare("SELECT role FROM family_members WHERE family_id=? AND user_id=?").bind(familyId,targetUserId).first<{role:string}>();
    if(!target)return fail(404,"member_not_found","Family member not found.");
    if(target.role==="owner")return fail(409,"owner_role_protected","The family owner cannot be removed. Transfer ownership first.");
    if(actorRole==="admin"&&target.role==="admin")return fail(403,"role_assignment_forbidden","Family admins cannot remove another Admin.");
    const timestamp=now();
    const results=await env.DB.batch([
      env.DB.prepare(`DELETE FROM family_members AS target
        WHERE target.family_id=? AND target.user_id=? AND target.role=? AND target.role<>'owner'
          AND EXISTS (SELECT 1 FROM family_members AS actor WHERE actor.family_id=? AND actor.user_id=?
            AND actor.role IN ('owner','admin')
            AND (actor.role='owner' OR target.role<>'admin'))`).bind(familyId,targetUserId,target.role,familyId,actorUserId),
      env.DB.prepare(`INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,change_summary,created_at)
        SELECT ?,?,?, 'family_member',?,'member.removed',?,? WHERE changes()=1`).bind(id(),familyId,actorUserId,targetUserId,JSON.stringify({role:target.role}),timestamp)
    ]);
    const changes=(results[0] as {meta?:{changes?:number}}|undefined)?.meta?.changes??0;
    if(!changes)return fail(409,"member_change_unavailable","The member or your permissions changed. Refresh and try again.");
    return json({data:{userId:targetUserId,removed:true}});
  }

  const familyDeleteMatch=url.pathname.match(/^\/v1\/families\/([^/]+)$/);
  if (familyDeleteMatch && request.method === "DELETE") {
    const familyId=familyDeleteMatch[1], role=await roleFor(env.DB,familyId,actorUserId);
    if (!role) return fail(404,"family_not_found","Family not found.");
    if (role !== "owner") return fail(403,"forbidden","Only the family owner can delete this family.");
    const input=await body(request);
    if (input?.confirmed !== true) return fail(400,"confirmation_required","Explicit confirmation is required.");
    const family=await env.DB.prepare("SELECT name FROM families WHERE id=?").bind(familyId).first<{name:string}>();
    if (!family) return fail(404,"family_not_found","Family not found.");
    try {
      const results=await env.DB.batch([
        env.DB.prepare("DELETE FROM families WHERE id=? AND EXISTS (SELECT 1 FROM family_members actor WHERE actor.family_id=? AND actor.user_id=? AND actor.role='owner')").bind(familyId,familyId,actorUserId),
      ]);
      if(!results[0]?.meta.changes)return fail(409,"family_delete_unavailable","The family ownership changed before deletion could complete.");
      return json({data:{id:familyId,name:family.name,deleted:true}});
    } catch {
      return fail(409,"family_delete_blocked","This family could not be deleted because dependent records are protected. No family data was intentionally changed.");
    }
  }


  // Identity claims are separate from family membership and never grant additional access.
  const identityMatch=url.pathname.match(/^\/v1\/families\/([^/]+)\/identity$/);
  if(identityMatch&&request.method==="GET"){
    const familyId=identityMatch[1],role=await roleFor(env.DB,familyId,actorUserId);
    if(!role)return fail(404,"family_not_found","Family not found.");
    const [link,claims,pending]=await Promise.all([
      env.DB.prepare("SELECT l.person_id,p.display_name,l.linked_at FROM person_identity_links l JOIN persons p ON p.id=l.person_id WHERE l.family_id=? AND l.user_id=?").bind(familyId,actorUserId).first(),
      env.DB.prepare("SELECT c.id,c.person_id,p.display_name,c.status,c.requested_at,c.reviewed_at,c.review_reason FROM person_identity_claims c JOIN persons p ON p.id=c.person_id WHERE c.family_id=? AND c.requester_user_id=? ORDER BY c.requested_at DESC").bind(familyId,actorUserId).all(),
      role==="owner"||role==="admin" ? env.DB.prepare("SELECT c.id,c.person_id,p.display_name,c.requester_user_id,u.display_name AS requester_name,u.email AS requester_email,c.requested_at FROM person_identity_claims c JOIN persons p ON p.id=c.person_id JOIN users u ON u.id=c.requester_user_id WHERE c.family_id=? AND c.status='pending' ORDER BY c.requested_at").bind(familyId).all() : Promise.resolve({results:[]})
    ]);
    return json({data:{link:link??null,claims:claims.results,pendingClaims:pending.results,canReview:role==="owner"||role==="admin",canDirectClaim:role==="owner"}});
  }
  const claimCollection=url.pathname.match(/^\/v1\/families\/([^/]+)\/identity-claims$/);
  if(claimCollection&&request.method==="POST"){
    const familyId=claimCollection[1],role=await roleFor(env.DB,familyId,actorUserId);
    if(!role)return fail(404,"family_not_found","Family not found.");
    const input=await body(request),personId=textOrNull(input?.personId);
    if(!personId)return fail(400,"person_required","Select an existing person record.");
    const person=await env.DB.prepare("SELECT id FROM persons WHERE id=? AND family_id=?").bind(personId,familyId).first();
    if(!person)return fail(404,"person_not_found","That person does not belong to this family.");
    const linked=await env.DB.prepare("SELECT user_id FROM person_identity_links WHERE family_id=? AND (user_id=? OR person_id=?) LIMIT 1").bind(familyId,actorUserId,personId).first();
    if(linked)return fail(409,"identity_already_linked","This account or person is already linked.");
    const t=now();
    if(role==="owner"){
      try{
        const results=await env.DB.batch([
          env.DB.prepare("INSERT INTO person_identity_links(family_id,person_id,user_id,linked_by_user_id,linked_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM family_members actor WHERE actor.family_id=? AND actor.user_id=? AND actor.role='owner') AND EXISTS (SELECT 1 FROM persons p WHERE p.id=? AND p.family_id=?)").bind(familyId,personId,actorUserId,actorUserId,t,familyId,actorUserId,personId,familyId),
          env.DB.prepare("INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,change_summary,created_at) SELECT ?,?,?, 'person',?,'identity.claimed_directly',?,? WHERE changes()=1").bind(id(),familyId,actorUserId,personId,JSON.stringify({userId:actorUserId}),t)
        ]);
        if(!results[0]?.meta.changes)return fail(409,"claim_unavailable","Your family membership or the selected person changed before the identity could be linked.");
      }catch{return fail(409,"identity_conflict","This person or account has already been linked.");}
      return json({data:{personId,status:"approved",linkedAt:t}},{status:201});
    }
    const claimId=id();
    try{
      const results=await env.DB.batch([
        env.DB.prepare("INSERT INTO person_identity_claims(id,family_id,person_id,requester_user_id,status,requested_at) SELECT ?,?,?,?,'pending',? WHERE EXISTS (SELECT 1 FROM family_members actor WHERE actor.family_id=? AND actor.user_id=?) AND EXISTS (SELECT 1 FROM persons p WHERE p.id=? AND p.family_id=?)").bind(claimId,familyId,personId,actorUserId,t,familyId,actorUserId,personId,familyId),
        env.DB.prepare("INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,change_summary,created_at) SELECT ?,?,?, 'person',?,'identity.claim_requested',?,? WHERE changes()=1").bind(id(),familyId,actorUserId,personId,JSON.stringify({claimId}),t)
      ]);
      if(!results[0]?.meta.changes)return fail(409,"claim_unavailable","Your family membership or the selected person changed before the claim could be created.");
    }catch{return fail(409,"claim_already_pending","A pending claim already exists or an identity association is already in place.");}
    return json({data:{id:claimId,personId,status:"pending",requestedAt:t}},{status:201});
  }
  const claimReview=url.pathname.match(/^\/v1\/families\/([^/]+)\/identity-claims\/([^/]+)\/review$/);
  if(claimReview&&request.method==="POST"){
    const familyId=claimReview[1],claimId=claimReview[2],role=await roleFor(env.DB,familyId,actorUserId);
    if(role!=="owner"&&role!=="admin")return fail(role?403:404,"forbidden","Only the family owner or admin can review claims.");
    const input=await body(request),decision=input?.decision,reason=textOrNull(input?.reason);
    if(decision!=="approve"&&decision!=="reject")return fail(400,"invalid_claim_decision","Choose approve or reject.");
    const claim=await env.DB.prepare("SELECT id,person_id,requester_user_id,status FROM person_identity_claims WHERE id=? AND family_id=?").bind(claimId,familyId).first<{id:string;person_id:string;requester_user_id:string;status:string}>();
    if(!claim||claim.status!=="pending")return fail(404,"claim_unavailable","This pending claim is no longer available.");
    if(claim.requester_user_id===actorUserId)return fail(403,"self_review_forbidden","You cannot review your own claim.");
    const t=now();
    if(decision==="reject"){
      const results=await env.DB.batch([
        env.DB.prepare("UPDATE person_identity_claims SET status='rejected',reviewed_by_user_id=?,reviewed_at=?,review_reason=? WHERE id=? AND status='pending'").bind(actorUserId,t,reason,claimId),
        env.DB.prepare("INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,change_summary,created_at) SELECT ?,?,?, 'person',?,'identity.claim_rejected',?,? WHERE changes()=1").bind(id(),familyId,actorUserId,claim.person_id,JSON.stringify({claimId,requesterUserId:claim.requester_user_id,reason}),t)
      ]);
      if(results[0]?.meta?.changes!==1)return fail(409,"claim_unavailable","This pending claim has already been reviewed.");
      return json({data:{id:claimId,status:"rejected",reviewedAt:t}});
    }
    try{
      const results=await env.DB.batch([
        env.DB.prepare("UPDATE person_identity_claims SET status='approved',reviewed_by_user_id=?,reviewed_at=?,review_reason=? WHERE id=? AND status='pending'").bind(actorUserId,t,reason,claimId),
        env.DB.prepare("INSERT INTO person_identity_links(family_id,person_id,user_id,linked_by_user_id,linked_at) SELECT ?,?,?,?,? WHERE changes()=1").bind(familyId,claim.person_id,claim.requester_user_id,actorUserId,t),
        env.DB.prepare("INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,change_summary,created_at) SELECT ?,?,?, 'person',?,'identity.claim_approved',?,? WHERE EXISTS (SELECT 1 FROM person_identity_claims WHERE id=? AND status='approved' AND reviewed_by_user_id=? AND reviewed_at=?) AND EXISTS (SELECT 1 FROM person_identity_links WHERE family_id=? AND person_id=? AND user_id=?)").bind(id(),familyId,actorUserId,claim.person_id,JSON.stringify({claimId,requesterUserId:claim.requester_user_id}),t,claimId,actorUserId,t,familyId,claim.person_id,claim.requester_user_id)
      ]);
      if((results[0] as D1Result<unknown>|undefined)?.meta?.changes!==1)return fail(409,"claim_unavailable","This pending claim has already been reviewed.");
    }catch{return fail(409,"identity_conflict","This person or account has already been linked.");}
    return json({data:{id:claimId,status:"approved",personId:claim.person_id,reviewedAt:t}});
  }
  const identityUnlink=url.pathname.match(/^\/v1\/families\/([^/]+)\/identity$/);
  if(identityUnlink&&request.method==="DELETE"){
    const familyId=identityUnlink[1],role=await roleFor(env.DB,familyId,actorUserId);
    if(role!=="owner"&&role!=="admin")return fail(role?403:404,"forbidden","Only the family owner or admin can unlink an identity.");
    const input=await body(request),personId=textOrNull(input?.personId);
    if(!personId)return fail(400,"person_required","Specify the person to unlink.");
    const link=await env.DB.prepare("SELECT user_id FROM person_identity_links WHERE family_id=? AND person_id=?").bind(familyId,personId).first<{user_id:string}>();
    if(!link)return fail(404,"identity_link_not_found","No linked account exists for this person.");
    const t=now();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM person_identity_links WHERE family_id=? AND person_id=?").bind(familyId,personId),
      env.DB.prepare("UPDATE person_identity_claims SET status='withdrawn',reviewed_by_user_id=?,reviewed_at=?,review_reason='Identity association removed' WHERE family_id=? AND person_id=? AND status='approved'").bind(actorUserId,t,familyId,personId),
      env.DB.prepare("INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,change_summary,created_at) VALUES(?,?,?,'person',?,'identity.unlinked',?,?)").bind(id(),familyId,actorUserId,personId,JSON.stringify({userId:link.user_id}),t)
    ]);
    return json({data:{personId,unlinked:true}});
  }

  const peopleMatch=url.pathname.match(/^\/v1\/families\/([^/]+)\/people$/);
  if (peopleMatch) {
    const familyId=peopleMatch[1], role=await roleFor(env.DB,familyId,actorUserId);
    if (!role) return fail(404,"family_not_found","Family not found.");
    if (request.method === "GET") {
      const result=await env.DB.prepare(`SELECT id,family_id,given_name,middle_name,family_name,display_name,gender,life_status,
        birth_date_kind,birth_exact_date,birth_year,birth_range_start_year,birth_range_end_year,birth_original_text,birth_place,birth_country,
        death_date_kind,death_exact_date,death_year,death_range_start_year,death_range_end_year,death_original_text,biography,created_at,updated_at
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
      if (!allowed.includes(birthKind)||!allowed.includes(deathKind)) return fail(400,"invalid_date_precision","Unsupported historical date precision.");
      if (input.lifeStatus === "deceased") return fail(400,"use_death_confirmation","New profiles start as alive. Marking someone deceased requires the separate confirmation workflow.");
      const personId=id(), t=now(), life="alive";
      const displayName=[textOrNull(input.givenName),textOrNull(input.middleName),textOrNull(input.familyName)].filter(Boolean).join(" ");
      try {
        await env.DB.prepare(`INSERT INTO persons(id,family_id,given_name,middle_name,family_name,display_name,gender,life_status,
          birth_date_kind,birth_exact_date,birth_year,birth_range_start_year,birth_range_end_year,birth_original_text,birth_place,birth_country,
          death_date_kind,death_exact_date,death_year,death_range_start_year,death_range_end_year,death_original_text,
          created_by_user_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
          personId,familyId,input.givenName.trim(),textOrNull(input.middleName),textOrNull(input.familyName),displayName,
          textOrNull(input.gender),life,birthKind,textOrNull(input.birthExactDate),yearOrNull(input.birthYear),
          yearOrNull(input.birthRangeStartYear),yearOrNull(input.birthRangeEndYear),textOrNull(input.birthOriginalText),textOrNull(input.birthPlace),textOrNull(input.birthCountry),
          deathKind,textOrNull(input.deathExactDate),yearOrNull(input.deathYear),yearOrNull(input.deathRangeStartYear),
          yearOrNull(input.deathRangeEndYear),textOrNull(input.deathOriginalText),actorUserId,t,t).run();
        await env.DB.prepare("INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,created_at) VALUES(?,?,?,'person',?,'person.created',?)")
          .bind(id(),familyId,actorUserId,personId,t).run();
        return json({data:{id:personId,familyId,displayName,lifeStatus:life,createdAt:t}},{status:201});
      } catch { return fail(400,"invalid_person","Person data violates the family or historical-date constraints."); }
    }
  }

  const importMatch=url.pathname.match(/^\/v1\/families\/([^/]+)\/import$/);
  if (importMatch && request.method === "POST") {
    const familyId=importMatch[1], role=await roleFor(env.DB,familyId,actorUserId);
    const familyAdmin=role==="owner"||role==="admin",platformImport=superAdmin&&!familyAdmin;
    if(!familyAdmin&&!platformImport)return fail(role?403:404,"forbidden","Only a family owner, admin or explicitly authorized Super Admin can import family records.");
    const input=await body(request);
    if (input?.confirmed !== true || input?.confirmDeceasedRecords !== true || !Array.isArray(input.people))
      return fail(400,"confirmation_required","Confirm the import and deceased records before proceeding.");
    const importReason=typeof input.reason==="string"?input.reason.trim():"";
    if(platformImport&&(importReason.length<12||importReason.length>500))return fail(400,"support_reason_required","Provide a clear import reason (12–500 characters).");
    if (input.people.length > 100) return fail(400,"import_too_large","Import exceeds the supported record limit.");

    // Validate the entire people collection before preparing any writes.
    const importKeys=new Set<string>();
    for (const raw of input.people) {
      if (!isObject(raw) || typeof raw.key!=="string" || !raw.key.trim() ||
          typeof raw.givenName!=="string" || !raw.givenName.trim()) {
        return fail(400,"invalid_import_person","Every imported person needs a key and given name.");
      }
      if (importKeys.has(raw.key)) return fail(400,"duplicate_import_person_key","Each imported person must have a unique key.");
      importKeys.add(raw.key);
      const given=raw.givenName.trim(), middle=textOrNull(raw.middleName), familyName=textOrNull(raw.familyName);
      if (given.length>120 || (middle&&middle.length>120) || (familyName&&familyName.length>120)) {
        return fail(400,"invalid_import_person","Imported name fields must be 120 characters or fewer.");
      }
    }

    let platformFamilyName:string|null=null;
    if(platformImport){
      const family=await env.DB.prepare("SELECT id,name FROM families WHERE id=?").bind(familyId).first<{id:string;name:string}>();
      if(!family)return fail(404,"family_not_found","Family not found.");
      platformFamilyName=family.name;
    }
    const importPeople=input.people as JsonObject[];
    const existing=await env.DB.prepare("SELECT id,display_name,given_name,family_name FROM persons WHERE family_id=?").bind(familyId).all<{id:string;display_name:string;given_name:string;family_name:string|null}>();
    const existingRelationships=await env.DB.prepare("SELECT id,from_person_id,to_person_id,relationship_type FROM relationships WHERE family_id=?").bind(familyId).all<{id:string;from_person_id:string;to_person_id:string;relationship_type:string}>();
    const normalize=(value:string)=>value.toLocaleLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu," ").trim().replace(/\s+/g," ");
    const existingByName=new Map(existing.results.map(p=>[normalize(p.display_name||[p.given_name,p.family_name].filter(Boolean).join(" ")),p.id]));
    const keyToId=new Map<string,string>(), created:string[]=[], matched:string[]=[], updated:string[]=[];
    const t=now();
    const importAuthSql=platformImport
      ? "EXISTS (SELECT 1 FROM platform_super_admins actor WHERE actor.user_id=?)"
      : "EXISTS (SELECT 1 FROM family_members actor WHERE actor.family_id=? AND actor.user_id=? AND actor.role IN ('owner','admin'))";
    const importAuthBindings=platformImport?[actorUserId]:[familyId,actorUserId];
    const importWrites: D1PreparedStatement[]=[];
    const guard=env.DB.prepare("UPDATE families SET updated_at=updated_at WHERE id=? AND "+importAuthSql).bind(familyId,...importAuthBindings);

    if(platformImport){
      importWrites.push(env.DB.prepare("INSERT INTO platform_audit_logs(id,actor_user_id,action,target_type,target_id,reason,metadata,created_at) SELECT ?,?,'family.import','family',?,?,?,? WHERE EXISTS (SELECT 1 FROM platform_super_admins actor WHERE actor.user_id=?)")
        .bind(id(),actorUserId,familyId,importReason,JSON.stringify({familyName:platformFamilyName,peopleCount:input.people.length}),t,actorUserId));
    }

    for (const raw of importPeople) {
      const key=raw.key as string, given=(raw.givenName as string).trim(), familyName=textOrNull(raw.familyName);
      const display=[given,familyName].filter(Boolean).join(" ");
      const aliases=Array.isArray(raw.aliases)?raw.aliases.filter((v):v is string=>typeof v==="string"):[];
      let match=existingByName.get(normalize(display));
      if (!match) {
        const aliasMatches=[...new Set(aliases.map(a=>existingByName.get(normalize(a))).filter((v):v is string=>!!v))];
        if (aliasMatches.length===1) match=aliasMatches[0];
      }
      if (match) {
        keyToId.set(key,match);matched.push(match);
        if ((raw.sourceName==="Varsha"||raw.sourceName==="Bhoodevi") && raw.gender==="female") {
          importWrites.push(env.DB.prepare("UPDATE persons SET gender='female',updated_at=? WHERE id=? AND family_id=? AND life_status='alive' AND "+importAuthSql)
            .bind(t,match,familyId,...importAuthBindings));
          importWrites.push(env.DB.prepare("INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,change_summary,created_at) SELECT ?,?,?, 'person',?,'person.import_match_updated',?,? WHERE changes()=1")
            .bind(id(),familyId,actorUserId,match,JSON.stringify({source:"family-tree.xlsx",field:"gender"}),t));
          updated.push(match);
        }
        continue;
      }
      const suppliedBirth=textOrNull(raw.birthExactDate), suppliedDeath=textOrNull(raw.deathExactDate);
      const validDate=(v:string|null)=>{
        if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
        const [year,month,day]=v.split("-").map(Number);
        const parsed=new Date(Date.UTC(year,month-1,day));
        return parsed.getUTCFullYear()===year && parsed.getUTCMonth()===month-1 && parsed.getUTCDate()===day;
      };
      // Uncertain historical dates are retained as unknown precision, not treated as import errors.
      const birth=validDate(suppliedBirth)?suppliedBirth:null;
      const death=validDate(suppliedDeath)?suppliedDeath:null;
      const hasDeathRecord=raw.lifeStatus==="deceased" || Boolean(suppliedDeath);
      const personId=id(), gender=["female","male","non_binary","unspecified"].includes(String(raw.gender))?String(raw.gender):"unspecified";
      const life=hasDeathRecord?"deceased":"alive";
      const middle=textOrNull(raw.middleName);
      const birthKind=birth?(raw.birthDateKind==="exact"?"exact":"exact"):"unknown";
      const deathKind=hasDeathRecord?(death?"exact":"unknown"):"unknown";
      importWrites.push(env.DB.prepare("INSERT INTO persons(id,family_id,given_name,middle_name,family_name,display_name,gender,life_status,birth_date_kind,birth_exact_date,death_date_kind,death_exact_date,biography,created_by_user_id,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE "+importAuthSql)
        .bind(personId,familyId,given,middle,familyName,[given,middle,familyName].filter(Boolean).join(" "),gender,life,birthKind,birth,deathKind,death,textOrNull(raw.biography),actorUserId,t,t,...importAuthBindings));
      importWrites.push(env.DB.prepare("INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,change_summary,created_at) SELECT ?,?,?, 'person',?,?,?,? WHERE changes()=1")
        .bind(id(),familyId,actorUserId,personId,"person.imported",JSON.stringify({source:"family-tree.xlsx",lifeStatus:life}),t));
      if (death) importWrites.push(env.DB.prepare("INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,change_summary,created_at) SELECT ?,?,?, 'person',?,'person.marked_deceased',?,? WHERE changes()=1")
        .bind(id(),familyId,actorUserId,personId,JSON.stringify({source:"family-tree.xlsx",deathDate:death}),t));
      keyToId.set(key,personId);created.push(personId);existingByName.set(normalize(display),personId);
    }

    const sourceKeys=new Map<string,string>();
    for (const raw of importPeople) if (typeof raw.sourceName==="string") sourceKeys.set(normalize(raw.sourceName),raw.key as string);
    for (const raw of importPeople) {
      const key=raw.key as string, given=raw.givenName as string;
      sourceKeys.set(normalize(given),key);
      sourceKeys.set(normalize([given,textOrNull(raw.familyName)].filter(Boolean).join(" ")),key);
    }
    const relationshipInputs:JsonObject[]=[];
    const edgeSeen=new Set<string>();
    for (const raw of (Array.isArray(input.relationships)?input.relationships:[])) {
      if (isObject(raw) && typeof raw.from==="string" && typeof raw.to==="string" && typeof raw.type==="string") {
        const k=raw.from+"|"+raw.to+"|"+raw.type;
        if(!edgeSeen.has(k)){edgeSeen.add(k);relationshipInputs.push(raw);}
      }
    }
    for (const raw of importPeople) {
      const key=raw.key as string;
      if (Array.isArray(raw.parents)) for (const parent of raw.parents) if (typeof parent==="string") {
        const from=sourceKeys.get(normalize(parent));
        if(from&&from!==key){const k=from+"|"+key+"|biological_parent";if(!edgeSeen.has(k)){edgeSeen.add(k);relationshipInputs.push({from,to:key,type:"biological_parent"});}}
      }
      if (Array.isArray(raw.partners)) for (const partner of raw.partners) if (typeof partner==="string") {
        const to=sourceKeys.get(normalize(partner));
        if(to&&to!==key){const pair=[key,to].sort(),k=pair[0]+"|"+pair[1]+"|spouse";if(!edgeSeen.has(k)){edgeSeen.add(k);relationshipInputs.push({from:pair[0],to:pair[1],type:"spouse"});}}
      }
    }
    if(relationshipInputs.length>250)return fail(400,"import_too_large","Import exceeds the supported relationship limit of 250.");

    let relationshipsSkipped=0;
    const skippedByReason:Record<string,number>={};
    const skippedRelationshipDetails:Array<{from:string;to:string;type:string;reason:string}>=[];
    const skipRelationship=(raw:JsonObject,reason:string)=>{
      relationshipsSkipped++;skippedByReason[reason]=(skippedByReason[reason]??0)+1;
      skippedRelationshipDetails.push({from:String(raw.from??""),to:String(raw.to??""),type:String(raw.type??""),reason});
    };
    const relationshipKey=(from:string,to:string,type:string)=>type==="spouse"
      ? [...[from,to].sort(),type].join("|")
      : [from,to,type].join("|");
    const knownRelationshipKeys=new Set<string>();
    const parentGraph=new Map<string,Set<string>>();
    const addParentEdge=(from:string,to:string)=>{
      if(!parentGraph.has(from))parentGraph.set(from,new Set());
      parentGraph.get(from)!.add(to);
    };
    for(const relation of existingRelationships.results){
      knownRelationshipKeys.add(relationshipKey(relation.from_person_id,relation.to_person_id,relation.relationship_type));
      if(parentTypes.includes(relation.relationship_type))addParentEdge(relation.from_person_id,relation.to_person_id);
    }
    const hasPath=(from:string,to:string):boolean=>{
      const visited=new Set<string>(),stack=[from];
      while(stack.length){
        const current=stack.pop()!;
        if(current===to)return true;
        if(visited.has(current))continue;
        visited.add(current);
        for(const next of parentGraph.get(current)??[])stack.push(next);
      }
      return false;
    };
    const relationshipResultIndexes:Array<{index:number;raw:JsonObject}>=[];
    for (const raw of relationshipInputs) {
      if (typeof raw.from!=="string"||typeof raw.to!=="string"||!relationshipTypes.includes(String(raw.type))) {
        skipRelationship(raw,"unsupported_or_malformed");continue;
      }
      const fromId=keyToId.get(raw.from),toId=keyToId.get(raw.to),type=String(raw.type);
      if (!fromId||!toId) { skipRelationship(raw,"person_key_not_resolved");continue; }
      if (fromId===toId) { skipRelationship(raw,"self_relationship_after_matching");continue; }
      const key=relationshipKey(fromId,toId,type);
      if(knownRelationshipKeys.has(key)){skipRelationship(raw,"already_exists");continue;}
      if(type==="biological_parent"&&hasPath(toId,fromId)){skipRelationship(raw,"would_create_ancestry_cycle");continue;}
      knownRelationshipKeys.add(key);
      if(parentTypes.includes(type))addParentEdge(fromId,toId);
      const rid=id();
      const duplicateSql=type==="spouse"
        ? "NOT EXISTS (SELECT 1 FROM relationships r WHERE r.family_id=? AND r.relationship_type='spouse' AND ((r.from_person_id=? AND r.to_person_id=?) OR (r.from_person_id=? AND r.to_person_id=?)))"
        : "NOT EXISTS (SELECT 1 FROM relationships r WHERE r.family_id=? AND r.from_person_id=? AND r.to_person_id=? AND r.relationship_type=?)";
      const duplicateBindings=type==="spouse"?[familyId,fromId,toId,toId,fromId]:[familyId,fromId,toId,type];
      const cycleSql=type==="biological_parent"
        ? " AND NOT EXISTS (WITH RECURSIVE descendants(person_id) AS (SELECT to_person_id FROM relationships WHERE family_id=? AND from_person_id=? AND relationship_type IN ('biological_parent','adoptive_parent','step_parent') UNION SELECT r.to_person_id FROM relationships r JOIN descendants d ON r.from_person_id=d.person_id WHERE r.family_id=? AND r.relationship_type IN ('biological_parent','adoptive_parent','step_parent')) SELECT 1 FROM descendants WHERE person_id=?)"
        : "";
      const cycleBindings=type==="biological_parent"?[familyId,toId,familyId,fromId]:[];
      const insertSql="INSERT INTO relationships(id,family_id,from_person_id,to_person_id,relationship_type,created_by_user_id,created_at) SELECT ?,?,?,?,?,?,? WHERE "+importAuthSql+" AND EXISTS (SELECT 1 FROM persons a JOIN persons b ON b.family_id=a.family_id WHERE a.id=? AND b.id=? AND a.family_id=?) AND "+duplicateSql+cycleSql;
      const resultIndex=importWrites.length+1;
      importWrites.push(env.DB.prepare(insertSql).bind(rid,familyId,fromId,toId,type,actorUserId,t,...importAuthBindings,fromId,toId,familyId,...duplicateBindings,...cycleBindings));
      importWrites.push(env.DB.prepare("INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,created_at) SELECT ?,?,?, 'relationship',?,'relationship.imported',? WHERE changes()=1")
        .bind(id(),familyId,actorUserId,rid,t));
      relationshipResultIndexes.push({index:resultIndex,raw});
    }

    if(importWrites.length+1>900)return fail(400,"import_too_large","Import contains too many records or relationships for one atomic operation.");
    const statements=[guard,...importWrites];
    try{
      const results=await env.DB.batch(statements);
      if(!results[0]?.meta.changes)return fail(409,"import_unavailable","Your import permissions or the family changed before the import could be applied.");
      let relationshipsCreated=0;
      for(const entry of relationshipResultIndexes){
        if(results[entry.index]?.meta.changes)relationshipsCreated++;
        else skipRelationship(entry.raw,"already_exists_or_no_longer_available");
      }
      return json({data:{peopleCreated:created.length,peopleMatched:matched.length,peopleUpdated:updated.length,relationshipsConsidered:relationshipInputs.length,relationshipsCreated,relationshipsSkipped,relationshipsSkippedByReason:skippedByReason,skippedRelationshipDetails}});
    }catch{
      return fail(409,"import_failed","The import could not be completed. No imported family records or audit entries were committed.");
    }
  }

  const personUpdateMatch=url.pathname.match(/^\/v1\/families\/([^/]+)\/people\/([^/]+)$/);
  if (personUpdateMatch && request.method === "PUT") {
    const familyId=personUpdateMatch[1], personId=personUpdateMatch[2], role=await roleFor(env.DB,familyId,actorUserId);
    if (!role) return fail(404,"family_not_found","Family not found.");
    if (role === "viewer") return fail(403,"forbidden","Viewer access cannot edit family members.");
    const input=await body(request);
    if (!input) return fail(400,"invalid_person","Provide the profile fields to update.");
    const current=await env.DB.prepare("SELECT life_status FROM persons WHERE id=? AND family_id=?").bind(personId,familyId).first<{life_status:string}>();
    if (!current) return fail(404,"person_not_found","Family member not found.");
    if (current.life_status === "deceased") return fail(409,"person_immutable","Deceased profiles are read-only. Relationships can still be corrected.");
    const given=textOrNull(input.givenName), middle=textOrNull(input.middleName), family=textOrNull(input.familyName);
    const gender=typeof input.gender==="string"?input.gender:"unspecified";
    const allowed=["exact","year","approximate_year","range","unknown"];
    const birthKind=typeof input.birthDateKind==="string"?input.birthDateKind:"unknown";
    if (!given || given.length>120 || (middle&&middle.length>120) || (family&&family.length>120))
      return fail(400,"invalid_name","Given name is required; each name field must be 120 characters or fewer.");
    if (!["female","male","non_binary","unspecified"].includes(gender)) return fail(400,"invalid_gender","Choose a supported gender value.");
    if (!allowed.includes(birthKind)) return fail(400,"invalid_date_precision","Unsupported birth-date precision.");
    const exact=textOrNull(input.birthExactDate), year=yearOrNull(input.birthYear);
    const start=yearOrNull(input.birthRangeStartYear), end=yearOrNull(input.birthRangeEndYear);
    const original=textOrNull(input.birthOriginalText);
    const validExact=(v:string|null)=>{if(!v||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const [y,m,d]=v.split("-").map(Number);const dt=new Date(Date.UTC(y,m-1,d));return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d;};
    if ((birthKind==="exact"&&!validExact(exact)) || ((birthKind==="year"||birthKind==="approximate_year")&&!year) || (birthKind==="range"&&(!start||!end||start>end)) || (birthKind==="unknown"&&(exact||year||start||end)))
      return fail(400,"invalid_birth_date","Provide a valid value matching the selected birth-date precision.");
    const t=now(), display=[given,middle,family].filter(Boolean).join(" ");
    try {
      await env.DB.prepare(`UPDATE persons SET given_name=?,middle_name=?,family_name=?,display_name=?,gender=?,
        birth_date_kind=?,birth_exact_date=?,birth_year=?,birth_range_start_year=?,birth_range_end_year=?,birth_original_text=?,birth_place=?,birth_country=?,
        biography=?,updated_at=? WHERE id=? AND family_id=? AND life_status='alive'`).bind(
        given,middle,family,display,gender,birthKind,birthKind==="exact"?exact:null,
        (birthKind==="year"||birthKind==="approximate_year")?year:null,birthKind==="range"?start:null,
        birthKind==="range"?end:null,original,textOrNull(input.birthPlace),textOrNull(input.birthCountry),textOrNull(input.biography),t,personId,familyId).run();
      await env.DB.prepare("INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,change_summary,created_at) VALUES(?,?,?,'person',?,'person.updated',?,?)")
        .bind(id(),familyId,actorUserId,personId,JSON.stringify({fields:["name","gender","birth_date","birth_place","birth_country","biography"]}),t).run();
      return json({data:{id:personId,displayName:display,updatedAt:t}});
    } catch { return fail(409,"person_immutable","This profile could not be changed. It may have been marked deceased."); }
  }

  const personDeleteMatch=url.pathname.match(/^\/v1\/families\/([^/]+)\/people\/([^/]+)$/);
  if (personDeleteMatch && request.method === "DELETE") {
    const familyId=personDeleteMatch[1], personId=personDeleteMatch[2], role=await roleFor(env.DB,familyId,actorUserId);
    if (!role) return fail(404,"family_not_found","Family not found.");
    if (role !== "owner" && role !== "admin") return fail(403,"forbidden","Only a family owner or admin can delete a person.");
    const input=await body(request);
    if (input?.confirmed !== true) return fail(400,"confirmation_required","Explicit confirmation is required.");
    const current=await env.DB.prepare("SELECT display_name,life_status FROM persons WHERE id=? AND family_id=?").bind(personId,familyId).first<{display_name:string|null,life_status:string}>();
    if (!current) return fail(404,"person_not_found","Family member not found.");
    if (current.life_status === "deceased") return fail(409,"person_immutable","Deceased profiles cannot be deleted.");
    const dependencies=await env.DB.prepare("SELECT (SELECT COUNT(*) FROM media WHERE person_id=? AND family_id=?) AS media_count,(SELECT COUNT(*) FROM tree_layouts WHERE focus_person_id=? AND family_id=?) AS layout_count,(SELECT COUNT(*) FROM share_links WHERE focus_person_id=? AND family_id=?) AS share_count").bind(personId,familyId,personId,familyId,personId,familyId).first<{media_count:number,layout_count:number,share_count:number}>();
    if (dependencies && (dependencies.media_count||dependencies.layout_count||dependencies.share_count)) return fail(409,"person_has_dependencies","This person is referenced by a photo, saved layout, or branch share link. Remove or reassign those items before deleting the person.");
    const t=now();
    try {
      await env.DB.batch([
        env.DB.prepare("INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,change_summary,created_at) VALUES(?,?,?,'person',?,'person.deleted',?,?)").bind(id(),familyId,actorUserId,personId,JSON.stringify({displayName:current.display_name,relationships:"cascade_deleted"}),t),
        env.DB.prepare("DELETE FROM persons WHERE id=? AND family_id=? AND life_status='alive'").bind(personId,familyId)
      ]);
      return json({data:{id:personId,deleted:true,relationshipsDeleted:"all"}});
    } catch { return fail(409,"person_delete_failed","This person could not be deleted. No records were removed."); }
  }

  const restoreMatch=url.pathname.match(/^\/v1\/families\/([^/]+)\/people\/([^/]+)\/restore$/);
  if (restoreMatch && request.method === "POST") {
    const familyId=restoreMatch[1], personId=restoreMatch[2], role=await roleFor(env.DB,familyId,actorUserId);
    if (!role) return fail(404,"family_not_found","Family not found.");
    if (role !== "owner" && role !== "admin") return fail(403,"forbidden","Only a family owner or admin can restore a profile.");
    const input=await body(request);
    if (input?.confirmed !== true) return fail(400,"confirmation_required","Explicit confirmation is required.");
    const t=now();
    try {
      const result=await env.DB.prepare("UPDATE persons SET life_status='alive',death_date_kind='unknown',death_exact_date=NULL,death_year=NULL,death_range_start_year=NULL,death_range_end_year=NULL,death_original_text=NULL,updated_at=? WHERE id=? AND family_id=? AND life_status='deceased'").bind(t,personId,familyId).run();
      if (!result.meta.changes) return fail(409,"person_not_restorable","Person not found or is already living.");
      await env.DB.prepare("INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,change_summary,created_at) VALUES(?,?,?,'person',?,'person.restored_to_alive',?,?)").bind(id(),familyId,actorUserId,personId,JSON.stringify({reason:textOrNull(input.reason)}),t).run();
      return json({data:{id:personId,lifeStatus:"alive",updatedAt:t}});
    } catch { return fail(409,"person_restore_failed","This profile could not be restored."); }
  }

  const deceasedMatch=url.pathname.match(/^\/v1\/families\/([^/]+)\/people\/([^/]+)\/deceased$/);
  if (deceasedMatch && request.method === "POST") {
    const familyId=deceasedMatch[1], personId=deceasedMatch[2], role=await roleFor(env.DB,familyId,actorUserId);
    if (!role) return fail(404,"family_not_found","Family not found.");
    if (role !== "owner" && role !== "admin") return fail(403,"forbidden","Only a family owner or admin can mark someone deceased.");
    const input=await body(request);
    if (input?.confirmed !== true) return fail(400,"confirmation_required","Explicit confirmation is required.");
    const allowed=["exact","year","approximate_year","range","unknown"];
    const deathKind=typeof input.deathDateKind==="string"?input.deathDateKind:"unknown";
    if (!allowed.includes(deathKind)) return fail(400,"invalid_date_precision","Unsupported death-date precision.");
    const exact=textOrNull(input.deathExactDate), year=yearOrNull(input.deathYear);
    const start=yearOrNull(input.deathRangeStartYear), end=yearOrNull(input.deathRangeEndYear);
    const original=textOrNull(input.deathOriginalText);
    if ((deathKind==="exact" && !exact) || ((deathKind==="year"||deathKind==="approximate_year")&&!year) || (deathKind==="range"&&(!start||!end||start>end)) || (deathKind==="unknown"&&(exact||year||start||end))) return fail(400,"invalid_death_date","Provide a valid date value matching the selected precision.");
    const t=now();
    try {
      const result=await env.DB.prepare(`UPDATE persons SET life_status='deceased',death_date_kind=?,death_exact_date=?,death_year=?,death_range_start_year=?,death_range_end_year=?,death_original_text=?,updated_at=? WHERE id=? AND family_id=? AND life_status='alive'`).bind(deathKind,deathKind==="exact"?exact:null,(deathKind==="year"||deathKind==="approximate_year")?year:null,deathKind==="range"?start:null,deathKind==="range"?end:null,original,t,personId,familyId).run();
      if (!result.meta.changes) return fail(409,"person_not_markable","Person not found or is already deceased.");
      await env.DB.prepare("INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,change_summary,created_at) VALUES(?,?,?,'person',?,'person.marked_deceased',?,?)").bind(id(),familyId,actorUserId,personId,JSON.stringify({deathDateKind:deathKind}),t).run();
      return json({data:{id:personId,lifeStatus:"deceased",deathDateKind:deathKind,updatedAt:t}});
    } catch { return fail(409,"person_immutable","This person's profile cannot be changed."); }
  }

  const relationshipItemMatch=url.pathname.match(/^\/v1\/families\/([^/]+)\/relationships\/([^/]+)$/);
  if (relationshipItemMatch && (request.method === "PUT" || request.method === "DELETE")) {
    const familyId=relationshipItemMatch[1], relationshipId=relationshipItemMatch[2], role=await roleFor(env.DB,familyId,actorUserId);
    if (!role) return fail(404,"family_not_found","Family not found.");
    if (role === "viewer") return fail(403,"forbidden","Viewer access cannot change relationships.");
    const current=await env.DB.prepare("SELECT id,from_person_id,to_person_id,relationship_type FROM relationships WHERE id=? AND family_id=?").bind(relationshipId,familyId).first<{id:string;from_person_id:string;to_person_id:string;relationship_type:string}>();
    if (!current) return fail(404,"relationship_not_found","Relationship not found.");
    const t=now();
    if (request.method === "DELETE") {
      const results=await env.DB.batch([
        env.DB.prepare("DELETE FROM relationships WHERE id=? AND family_id=? AND EXISTS (SELECT 1 FROM family_members actor WHERE actor.family_id=? AND actor.user_id=? AND actor.role IN ('owner','admin','editor'))").bind(relationshipId,familyId,familyId,actorUserId),
        env.DB.prepare("INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,change_summary,created_at) SELECT ?,?,?, 'relationship',?,'relationship.deleted',?,? WHERE changes()=1").bind(id(),familyId,actorUserId,relationshipId,JSON.stringify({from:current.from_person_id,to:current.to_person_id,type:current.relationship_type}),t)
      ]);
      if(!results[0]?.meta.changes)return fail(409,"relationship_change_unavailable","This relationship changed or your editing permission is no longer available.");
      return json({data:{id:relationshipId,deleted:true}});
    }
    const input=await body(request);
    const fromId=textOrNull(input?.fromPersonId),toId=textOrNull(input?.toPersonId),type=textOrNull(input?.relationshipType);
    if (!fromId||!toId||!type||!relationshipTypes.includes(type)) return fail(400,"invalid_relationship","Provide two people and a supported relationship type.");
    if(fromId===toId)return fail(400,"self_relationship","A person cannot have a relationship with themselves.");
    const people=await env.DB.prepare("SELECT id FROM persons WHERE family_id=? AND id IN (?,?)").bind(familyId,fromId,toId).all<{id:string}>();
    if(people.results.length!==2)return fail(400,"person_not_in_family","Both people must belong to this family.");
    const duplicate=type==="spouse"
      ? await env.DB.prepare("SELECT id FROM relationships WHERE family_id=? AND relationship_type='spouse' AND id<>? AND ((from_person_id=? AND to_person_id=?) OR (from_person_id=? AND to_person_id=?)) LIMIT 1").bind(familyId,relationshipId,fromId,toId,toId,fromId).first()
      : await env.DB.prepare("SELECT id FROM relationships WHERE family_id=? AND from_person_id=? AND to_person_id=? AND relationship_type=? AND id<>? LIMIT 1").bind(familyId,fromId,toId,type,relationshipId).first();
    if(duplicate)return fail(409,"duplicate_relationship","This relationship already exists.");
    if(parentTypes.includes(type)){
      const cycle=await env.DB.prepare(`WITH RECURSIVE descendants(person_id) AS (SELECT to_person_id FROM relationships WHERE family_id=? AND from_person_id=? AND relationship_type IN ('biological_parent','adoptive_parent','step_parent') AND id<>? UNION SELECT r.to_person_id FROM relationships r JOIN descendants d ON r.from_person_id=d.person_id WHERE r.family_id=? AND r.relationship_type IN ('biological_parent','adoptive_parent','step_parent') AND r.id<>?) SELECT 1 FROM descendants WHERE person_id=? LIMIT 1`).bind(familyId,toId,relationshipId,familyId,relationshipId,fromId).first();
      if(cycle)return fail(409,"relationship_cycle","This parent-child relationship would create an ancestry cycle.");
    }
    const duplicateWriteSql=type==="spouse"
      ? " AND NOT EXISTS (SELECT 1 FROM relationships r WHERE r.family_id=? AND r.relationship_type='spouse' AND r.id<>? AND ((r.from_person_id=? AND r.to_person_id=?) OR (r.from_person_id=? AND r.to_person_id=?)))"
      : " AND NOT EXISTS (SELECT 1 FROM relationships r WHERE r.family_id=? AND r.from_person_id=? AND r.to_person_id=? AND r.relationship_type=? AND r.id<>?)";
    const duplicateWriteBindings=type==="spouse"
      ? [familyId,relationshipId,fromId,toId,toId,fromId]
      : [familyId,fromId,toId,type,relationshipId];
    const cycleWriteSql=parentTypes.includes(type)
      ? " AND NOT EXISTS (WITH RECURSIVE descendants(person_id) AS (SELECT to_person_id FROM relationships WHERE family_id=? AND from_person_id=? AND relationship_type IN ('biological_parent','adoptive_parent','step_parent') AND id<>? UNION SELECT r.to_person_id FROM relationships r JOIN descendants d ON r.from_person_id=d.person_id WHERE r.family_id=? AND r.relationship_type IN ('biological_parent','adoptive_parent','step_parent') AND r.id<>?) SELECT 1 FROM descendants WHERE person_id=?)"
      : "";
    const cycleWriteBindings=parentTypes.includes(type)?[familyId,toId,relationshipId,familyId,relationshipId,fromId]:[];
    const results=await env.DB.batch([
      env.DB.prepare("UPDATE relationships SET from_person_id=?,to_person_id=?,relationship_type=? WHERE id=? AND family_id=? AND EXISTS (SELECT 1 FROM family_members actor WHERE actor.family_id=? AND actor.user_id=? AND actor.role IN ('owner','admin','editor')) AND EXISTS (SELECT 1 FROM persons a JOIN persons b ON b.family_id=a.family_id WHERE a.id=? AND b.id=? AND a.family_id=?)"+duplicateWriteSql+cycleWriteSql).bind(fromId,toId,type,relationshipId,familyId,familyId,actorUserId,fromId,toId,familyId,...duplicateWriteBindings,...cycleWriteBindings),
      env.DB.prepare("INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,change_summary,created_at) SELECT ?,?,?, 'relationship',?,'relationship.updated',?,? WHERE changes()=1").bind(id(),familyId,actorUserId,relationshipId,JSON.stringify({from:fromId,to:toId,type}),t)
    ]);
    if(!results[0]?.meta.changes)return fail(409,"relationship_change_unavailable","This relationship changed or your editing permission is no longer available.");
    return json({data:{id:relationshipId,fromPersonId:fromId,toPersonId:toId,relationshipType:type,updatedAt:t}});
  }

  const relationshipsMatch=url.pathname.match(/^\/v1\/families\/([^/]+)\/relationships$/);
  if (relationshipsMatch) {
    const familyId=relationshipsMatch[1], role=await roleFor(env.DB,familyId,actorUserId);
    if (!role) return fail(404,"family_not_found","Family not found.");
    if (request.method === "GET") {
      const result=await env.DB.prepare(`SELECT r.id,r.from_person_id,r.to_person_id,r.relationship_type,r.metadata_json,r.created_at,
        a.display_name AS from_name,b.display_name AS to_name
        FROM relationships r JOIN persons a ON a.id=r.from_person_id AND a.family_id=r.family_id
        JOIN persons b ON b.id=r.to_person_id AND b.family_id=r.family_id
        WHERE r.family_id=? ORDER BY r.created_at`).bind(familyId).all();
      return json({data:result.results});
    }
    if (request.method === "POST") {
      if (role === "viewer") return fail(403,"forbidden","Viewer access cannot add relationships.");
      const input=await body(request);
      const fromId=textOrNull(input?.fromPersonId), toId=textOrNull(input?.toPersonId), type=textOrNull(input?.relationshipType);
      if (!fromId || !toId || !type || !relationshipTypes.includes(type))
        return fail(400,"invalid_relationship","Provide fromPersonId, toPersonId and a supported relationshipType.");
      if (fromId===toId) return fail(400,"self_relationship","A person cannot have a relationship with themselves.");
      const people=await env.DB.prepare("SELECT id FROM persons WHERE family_id=? AND id IN (?,?)").bind(familyId,fromId,toId).all<{id:string}>();
      if (people.results.length!==2) return fail(400,"person_not_in_family","Both people must belong to this family.");
      if (parentTypes.includes(type)) {
        const cycle=await env.DB.prepare(`WITH RECURSIVE descendants(person_id) AS (
          SELECT to_person_id FROM relationships WHERE family_id=? AND from_person_id=? AND relationship_type IN ('biological_parent','adoptive_parent','step_parent')
          UNION SELECT r.to_person_id FROM relationships r JOIN descendants d ON r.from_person_id=d.person_id
          WHERE r.family_id=? AND r.relationship_type IN ('biological_parent','adoptive_parent','step_parent')
        ) SELECT 1 AS found FROM descendants WHERE person_id=? LIMIT 1`).bind(familyId,toId,familyId,fromId).first();
        if (cycle) return fail(409,"relationship_cycle","This parent-child relationship would create an ancestry cycle.");
      }
      const relationshipId=id(), t=now();
      try {
        const duplicateWriteSql=type==="spouse"
          ? " AND NOT EXISTS (SELECT 1 FROM relationships r WHERE r.family_id=? AND r.relationship_type='spouse' AND ((r.from_person_id=? AND r.to_person_id=?) OR (r.from_person_id=? AND r.to_person_id=?)))"
          : " AND NOT EXISTS (SELECT 1 FROM relationships r WHERE r.family_id=? AND r.from_person_id=? AND r.to_person_id=? AND r.relationship_type=?)";
        const duplicateWriteBindings=type==="spouse"?[familyId,fromId,toId,toId,fromId]:[familyId,fromId,toId,type];
        const cycleWriteSql=parentTypes.includes(type)
          ? " AND NOT EXISTS (WITH RECURSIVE descendants(person_id) AS (SELECT to_person_id FROM relationships WHERE family_id=? AND from_person_id=? AND relationship_type IN ('biological_parent','adoptive_parent','step_parent') UNION SELECT r.to_person_id FROM relationships r JOIN descendants d ON r.from_person_id=d.person_id WHERE r.family_id=? AND r.relationship_type IN ('biological_parent','adoptive_parent','step_parent')) SELECT 1 FROM descendants WHERE person_id=?)"
          : "";
        const cycleWriteBindings=parentTypes.includes(type)?[familyId,toId,familyId,fromId]:[];
        const results=await env.DB.batch([
          env.DB.prepare("INSERT INTO relationships(id,family_id,from_person_id,to_person_id,relationship_type,created_by_user_id,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM family_members actor WHERE actor.family_id=? AND actor.user_id=? AND actor.role IN ('owner','admin','editor')) AND EXISTS (SELECT 1 FROM persons a JOIN persons b ON b.family_id=a.family_id WHERE a.id=? AND b.id=? AND a.family_id=?)"+duplicateWriteSql+cycleWriteSql).bind(relationshipId,familyId,fromId,toId,type,actorUserId,t,familyId,actorUserId,fromId,toId,familyId,...duplicateWriteBindings,...cycleWriteBindings),
          env.DB.prepare("INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,created_at) SELECT ?,?,?, 'relationship',?,'relationship.created',? WHERE changes()=1").bind(id(),familyId,actorUserId,relationshipId,t)
        ]);
        if(!results[0]?.meta.changes)return fail(409,"relationship_create_unavailable","Your editing permission or the selected family members changed before this relationship could be saved.");
        return json({data:{id:relationshipId,familyId,fromPersonId:fromId,toPersonId:toId,relationshipType:type,createdAt:t}},{status:201});
      } catch { return fail(409,"duplicate_relationship","This relationship already exists or violates a database constraint."); }
    }
  }
  return fail(404,"not_found","Route not found.");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") ?? "";
    const defaultOrigins=env.APP_ENV==="development"?[
      "https://vansvriksh-web-dev.pages.dev",
      "https://vansvriksh.vtrrk.in",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ]:[];
    const allowedOrigins=new Set((env.ALLOWED_ORIGINS??defaultOrigins.join(",")).split(",").map(value=>value.trim()).filter(Boolean));
    const corsHeaders: Record<string, string> = {
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };
    if (allowedOrigins.has(origin)) corsHeaders["Access-Control-Allow-Origin"] = origin;
    if (origin && !allowedOrigins.has(origin) && ["POST","PUT","DELETE"].includes(request.method)) return fail(403,"origin_not_allowed","This browser origin is not allowed to modify family data.");
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

    let response: Response;
    if (request.method === "GET" && url.pathname === "/health") {
      try {
        const result = await env.DB.prepare("SELECT 1 AS ok").first<{ok:number}>();
        response = json({status:"ok",service:"family-tree-api",environment:env.APP_ENV,database:result?.ok===1?"connected":"unavailable"});
      } catch {
        response = json({status:"degraded",service:"family-tree-api",environment:env.APP_ENV,database:"unavailable"},{status:503});
      }
    } else if (url.pathname.startsWith("/v1/")) {
      try { response = await api(request,env,url); }
      catch { response = fail(500,"internal_error","The request could not be completed."); }
    } else {
      response = fail(404,"not_found","Route not found.");
    }
    const headers = new Headers(response.headers);
    for (const [key,value] of Object.entries(corsHeaders)) headers.set(key,value);
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }
};
