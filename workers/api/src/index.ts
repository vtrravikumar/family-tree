export interface Env {
  APP_ENV: string;
  DB: D1Database;
  DEV_API_TOKEN?: string;
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
async function authorize(request: Request, env: Env): Promise<Response | null> {
  if (env.APP_ENV !== "development") return fail(503, "auth_not_configured", "Authentication is not configured.");
  if (!env.DEV_API_TOKEN) return fail(503, "dev_token_not_configured", "Configure the DEV_API_TOKEN Worker secret.");
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return safeEqual(token, env.DEV_API_TOKEN) ? null : fail(401, "unauthorized", "A valid development bearer token is required.");
}
async function ensureDevUser(db: D1Database) {
  const t = now();
  await db.prepare(`INSERT INTO users(id,identity_provider,provider_subject,email,display_name,created_at,updated_at)
    VALUES('dev-owner','dev','dev-owner','dev-owner@vansvriksh.local','Development Owner',?,?)
    ON CONFLICT(identity_provider,provider_subject) DO UPDATE SET updated_at=excluded.updated_at`).bind(t,t).run();
}
async function roleFor(db: D1Database, familyId: string) {
  const row = await db.prepare("SELECT role FROM family_members WHERE family_id=? AND user_id='dev-owner'").bind(familyId).first<{role:string}>();
  return row?.role ?? null;
}
const textOrNull = (v: unknown) => typeof v === "string" && v.trim() ? v.trim() : null;
const yearOrNull = (v: unknown) => Number.isInteger(v) && Number(v) >= 1 && Number(v) <= 9999 ? Number(v) : null;
const parentTypes = ["biological_parent", "adoptive_parent", "step_parent"];
const relationshipTypes = [...parentTypes, "spouse", "partner", "sibling"];

async function api(request: Request, env: Env, url: URL): Promise<Response> {
  const denied = await authorize(request, env);
  if (denied) return denied;
  await ensureDevUser(env.DB);

  if (url.pathname === "/v1/families" && request.method === "GET") {
    const result = await env.DB.prepare(`SELECT f.id,f.name,f.created_at,f.updated_at,fm.role FROM families f
      JOIN family_members fm ON fm.family_id=f.id WHERE fm.user_id='dev-owner' ORDER BY f.created_at DESC`).all();
    return json({data:result.results});
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

  const familyDeleteMatch=url.pathname.match(/^\/v1\/families\/([^/]+)$/);
  if (familyDeleteMatch && request.method === "DELETE") {
    const familyId=familyDeleteMatch[1], role=await roleFor(env.DB,familyId);
    if (!role) return fail(404,"family_not_found","Family not found.");
    if (role !== "owner") return fail(403,"forbidden","Only the family owner can delete this family.");
    const input=await body(request);
    if (input?.confirmed !== true) return fail(400,"confirmation_required","Explicit confirmation is required.");
    const family=await env.DB.prepare("SELECT name FROM families WHERE id=?").bind(familyId).first<{name:string}>();
    if (!family) return fail(404,"family_not_found","Family not found.");
    try {
      await env.DB.prepare("DELETE FROM families WHERE id=?").bind(familyId).run();
      return json({data:{id:familyId,name:family.name,deleted:true}});
    } catch {
      return fail(409,"family_delete_blocked","This family could not be deleted because dependent records are protected. No family data was intentionally changed.");
    }
  }

  const peopleMatch=url.pathname.match(/^\/v1\/families\/([^/]+)\/people$/);
  if (peopleMatch) {
    const familyId=peopleMatch[1], role=await roleFor(env.DB,familyId);
    if (!role) return fail(404,"family_not_found","Family not found.");
    if (request.method === "GET") {
      const result=await env.DB.prepare(`SELECT id,family_id,given_name,middle_name,family_name,display_name,gender,life_status,
        birth_date_kind,birth_exact_date,birth_year,birth_range_start_year,birth_range_end_year,birth_original_text,
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
          birth_date_kind,birth_exact_date,birth_year,birth_range_start_year,birth_range_end_year,birth_original_text,
          death_date_kind,death_exact_date,death_year,death_range_start_year,death_range_end_year,death_original_text,
          created_by_user_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'dev-owner',?,?)`).bind(
          personId,familyId,input.givenName.trim(),textOrNull(input.middleName),textOrNull(input.familyName),displayName,
          textOrNull(input.gender),life,birthKind,textOrNull(input.birthExactDate),yearOrNull(input.birthYear),
          yearOrNull(input.birthRangeStartYear),yearOrNull(input.birthRangeEndYear),textOrNull(input.birthOriginalText),
          deathKind,textOrNull(input.deathExactDate),yearOrNull(input.deathYear),yearOrNull(input.deathRangeStartYear),
          yearOrNull(input.deathRangeEndYear),textOrNull(input.deathOriginalText),t,t).run();
        await env.DB.prepare("INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,created_at) VALUES(?,?,'dev-owner','person',?,'person.created',?)")
          .bind(id(),familyId,personId,t).run();
        return json({data:{id:personId,familyId,displayName,lifeStatus:life,createdAt:t}},{status:201});
      } catch { return fail(400,"invalid_person","Person data violates the family or historical-date constraints."); }
    }
  }

  const importMatch=url.pathname.match(/^\/v1\/families\/([^/]+)\/import$/);
  if (importMatch && request.method === "POST") {
    const familyId=importMatch[1], role=await roleFor(env.DB,familyId);
    if (role !== "owner" && role !== "admin") return fail(role?403:404,"forbidden","Only a family owner or admin can import family records.");
    const input=await body(request);
    if (input?.confirmed !== true || input?.confirmDeceasedRecords !== true || !Array.isArray(input.people))
      return fail(400,"confirmation_required","Confirm the import and deceased records before proceeding.");
    if (input.people.length > 100) return fail(400,"import_too_large","Import exceeds the supported record limit.");
    const existing=await env.DB.prepare("SELECT id,display_name,given_name,family_name FROM persons WHERE family_id=?").bind(familyId).all<{id:string;display_name:string;given_name:string;family_name:string|null}>();
    const normalize=(value:string)=>value.toLocaleLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu," ").trim().replace(/\s+/g," ");
    const existingByName=new Map(existing.results.map(p=>[normalize(p.display_name||[p.given_name,p.family_name].filter(Boolean).join(" ")),p.id]));
    const keyToId=new Map<string,string>(), created:string[]=[], matched:string[]=[], updated:string[]=[];
    const t=now();
    for (const raw of input.people) {
      if (!isObject(raw) || typeof raw.key!=="string" || typeof raw.givenName!=="string" || !raw.givenName.trim()) return fail(400,"invalid_import_person","Every imported person needs a key and given name.");
      const key=raw.key, given=raw.givenName.trim(), family=textOrNull(raw.familyName), display=[given,family].filter(Boolean).join(" ");
      const aliases=Array.isArray(raw.aliases)?raw.aliases.filter((v):v is string=>typeof v==="string"):[];
      let match=existingByName.get(normalize(display));
      if (!match) {
        const aliasMatches=[...new Set(aliases.map(a=>existingByName.get(normalize(a))).filter((v):v is string=>!!v))];
        if (aliasMatches.length===1) match=aliasMatches[0];
      }
      if (match) {
        keyToId.set(key,match);matched.push(match);
        if ((raw.sourceName==="Varsha"||raw.sourceName==="Bhoodevi") && raw.gender==="female") {
          await env.DB.prepare("UPDATE persons SET gender='female',updated_at=? WHERE id=? AND family_id=? AND life_status='alive'").bind(t,match,familyId).run();
          updated.push(match);
        }
        continue;
      }
      const suppliedBirth=textOrNull(raw.birthExactDate), suppliedDeath=textOrNull(raw.deathExactDate);
      const validDate=(v:string|null)=>{
        if (!v || !/^\\d{4}-\\d{2}-\\d{2}$/.test(v)) return false;
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
      await env.DB.prepare(`INSERT INTO persons(id,family_id,given_name,middle_name,family_name,display_name,gender,life_status,birth_date_kind,birth_exact_date,death_date_kind,death_exact_date,created_by_user_id,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'dev-owner',?,?)`).bind(personId,familyId,given,middle,family,[given,middle,family].filter(Boolean).join(" "),gender,life,birthKind,birth,deathKind,death,t,t).run();
      await env.DB.prepare("INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,change_summary,created_at) VALUES(?,?,'dev-owner','person',?,?,?,?)")
        .bind(id(),familyId,personId,"person.imported",JSON.stringify({source:"family-tree.xlsx",lifeStatus:life}),t).run();
      if (death) await env.DB.prepare("INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,change_summary,created_at) VALUES(?,?,'dev-owner','person',?,'person.marked_deceased',?,?)")
        .bind(id(),familyId,personId,JSON.stringify({source:"family-tree.xlsx",deathDate:death}),t).run();
      keyToId.set(key,personId);created.push(personId);existingByName.set(normalize(display),personId);
    }
    const sourceKeys=new Map<string,string>();
    for (const raw of input.people) if (isObject(raw)&&typeof raw.key==="string"&&typeof raw.sourceName==="string") sourceKeys.set(normalize(raw.sourceName),raw.key);
    for (const raw of input.people) if (isObject(raw)&&typeof raw.key==="string"&&typeof raw.givenName==="string") {
      sourceKeys.set(normalize(raw.givenName),raw.key);
      sourceKeys.set(normalize([raw.givenName,textOrNull(raw.familyName)].filter(Boolean).join(" ")),raw.key);
    }
    const relationshipInputs:JsonObject[]=[];
    const edgeSeen=new Set<string>();
    for (const raw of (Array.isArray(input.relationships)?input.relationships:[])) if (isObject(raw) && typeof raw.from==="string" && typeof raw.to==="string" && typeof raw.type==="string") { const k=raw.from+"|"+raw.to+"|"+raw.type; if(!edgeSeen.has(k)){edgeSeen.add(k);relationshipInputs.push(raw);} }
    for (const raw of input.people) if (isObject(raw)&&typeof raw.key==="string") {
      if (Array.isArray(raw.parents)) for (const parent of raw.parents) if (typeof parent==="string") {
        const from=sourceKeys.get(normalize(parent)); if(from&&from!==raw.key){const k=from+"|"+raw.key+"|biological_parent";if(!edgeSeen.has(k)){edgeSeen.add(k);relationshipInputs.push({from,to:raw.key,type:"biological_parent"});}}
      }
      if (Array.isArray(raw.partners)) for (const partner of raw.partners) if (typeof partner==="string") {
        const to=sourceKeys.get(normalize(partner)); if(to&&to!==raw.key){const [a,b]=[raw.key,to].sort();const k=a+"|"+b+"|spouse";if(!edgeSeen.has(k)){edgeSeen.add(k);relationshipInputs.push({from:a,to:b,type:"spouse"});}}
      }
    }
    let relationshipsCreated=0, relationshipsSkipped=0;
    const skippedByReason:Record<string,number>={};
    const skippedRelationshipDetails:Array<{from:string;to:string;type:string;reason:string}>=[];
    const skipRelationship=(raw:JsonObject,reason:string)=>{
      relationshipsSkipped++;skippedByReason[reason]=(skippedByReason[reason]??0)+1;
      skippedRelationshipDetails.push({from:String(raw.from??""),to:String(raw.to??""),type:String(raw.type??""),reason});
    };
    for (const raw of relationshipInputs) {
      if (!isObject(raw)||typeof raw.from!=="string"||typeof raw.to!=="string"||!relationshipTypes.includes(String(raw.type))) { if(isObject(raw))skipRelationship(raw,"unsupported_or_malformed"); continue; }
      const fromId=keyToId.get(raw.from),toId=keyToId.get(raw.to),type=String(raw.type);
      if (!fromId||!toId) { skipRelationship(raw,"person_key_not_resolved");continue; }
      if (fromId===toId) { skipRelationship(raw,"self_relationship_after_matching");continue; }
      const duplicate=type==="spouse"
        ? await env.DB.prepare("SELECT id FROM relationships WHERE family_id=? AND relationship_type='spouse' AND ((from_person_id=? AND to_person_id=?) OR (from_person_id=? AND to_person_id=?)) LIMIT 1").bind(familyId,fromId,toId,toId,fromId).first()
        : await env.DB.prepare("SELECT id FROM relationships WHERE family_id=? AND from_person_id=? AND to_person_id=? AND relationship_type=? LIMIT 1").bind(familyId,fromId,toId,type).first();
      if (duplicate) {skipRelationship(raw,"already_exists");continue;}
      if (type==="biological_parent") {
        const cycle=await env.DB.prepare(`WITH RECURSIVE descendants(person_id) AS (SELECT to_person_id FROM relationships WHERE family_id=? AND from_person_id=? AND relationship_type IN ('biological_parent','adoptive_parent','step_parent') UNION SELECT r.to_person_id FROM relationships r JOIN descendants d ON r.from_person_id=d.person_id WHERE r.family_id=? AND r.relationship_type IN ('biological_parent','adoptive_parent','step_parent')) SELECT 1 FROM descendants WHERE person_id=? LIMIT 1`).bind(familyId,toId,familyId,fromId).first();
        if (cycle) {skipRelationship(raw,"would_create_ancestry_cycle");continue;}
      }
      const rid=id();
      await env.DB.batch([
        env.DB.prepare("INSERT INTO relationships(id,family_id,from_person_id,to_person_id,relationship_type,created_by_user_id,created_at) VALUES(?,?,?,?,?,'dev-owner',?)").bind(rid,familyId,fromId,toId,type,t),
        env.DB.prepare("INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,created_at) VALUES(?,?,'dev-owner','relationship',?,'relationship.imported',?)").bind(id(),familyId,rid,t)
      ]);
      relationshipsCreated++;
    }
    return json({data:{peopleCreated:created.length,peopleMatched:matched.length,peopleUpdated:updated.length,relationshipsConsidered:relationshipInputs.length,relationshipsCreated,relationshipsSkipped,relationshipsSkippedByReason:skippedByReason,skippedRelationshipDetails}});
  }

  const personUpdateMatch=url.pathname.match(/^\/v1\/families\/([^/]+)\/people\/([^/]+)$/);
  if (personUpdateMatch && request.method === "PUT") {
    const familyId=personUpdateMatch[1], personId=personUpdateMatch[2], role=await roleFor(env.DB,familyId);
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
    const validExact=(v:string|null)=>{if(!v||!/^\\d{4}-\\d{2}-\\d{2}$/.test(v))return false;const [y,m,d]=v.split("-").map(Number);const dt=new Date(Date.UTC(y,m-1,d));return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d;};
    if ((birthKind==="exact"&&!validExact(exact)) || ((birthKind==="year"||birthKind==="approximate_year")&&!year) || (birthKind==="range"&&(!start||!end||start>end)) || (birthKind==="unknown"&&(exact||year||start||end)))
      return fail(400,"invalid_birth_date","Provide a valid value matching the selected birth-date precision.");
    const t=now(), display=[given,middle,family].filter(Boolean).join(" ");
    try {
      await env.DB.prepare(`UPDATE persons SET given_name=?,middle_name=?,family_name=?,display_name=?,gender=?,
        birth_date_kind=?,birth_exact_date=?,birth_year=?,birth_range_start_year=?,birth_range_end_year=?,birth_original_text=?,
        biography=?,updated_at=? WHERE id=? AND family_id=? AND life_status='alive'`).bind(
        given,middle,family,display,gender,birthKind,birthKind==="exact"?exact:null,
        (birthKind==="year"||birthKind==="approximate_year")?year:null,birthKind==="range"?start:null,
        birthKind==="range"?end:null,original,textOrNull(input.biography),t,personId,familyId).run();
      await env.DB.prepare("INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,change_summary,created_at) VALUES(?,?,'dev-owner','person',?,'person.updated',?,?)")
        .bind(id(),familyId,personId,JSON.stringify({fields:["name","gender","birth_date","biography"]}),t).run();
      return json({data:{id:personId,displayName:display,updatedAt:t}});
    } catch { return fail(409,"person_immutable","This profile could not be changed. It may have been marked deceased."); }
  }

  const deceasedMatch=url.pathname.match(/^\/v1\/families\/([^/]+)\/people\/([^/]+)\/deceased$/);
  if (deceasedMatch && request.method === "POST") {
    const familyId=deceasedMatch[1], personId=deceasedMatch[2], role=await roleFor(env.DB,familyId);
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
      await env.DB.prepare("INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,change_summary,created_at) VALUES(?,?,'dev-owner','person',?,'person.marked_deceased',?,?)").bind(id(),familyId,personId,JSON.stringify({deathDateKind:deathKind}),t).run();
      return json({data:{id:personId,lifeStatus:"deceased",deathDateKind:deathKind,updatedAt:t}});
    } catch { return fail(409,"person_immutable","This person's profile cannot be changed."); }
  }

  const relationshipsMatch=url.pathname.match(/^\/v1\/families\/([^/]+)\/relationships$/);
  if (relationshipsMatch) {
    const familyId=relationshipsMatch[1], role=await roleFor(env.DB,familyId);
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
        await env.DB.batch([
          env.DB.prepare("INSERT INTO relationships(id,family_id,from_person_id,to_person_id,relationship_type,created_by_user_id,created_at) VALUES(?,?,?,?,?,'dev-owner',?)").bind(relationshipId,familyId,fromId,toId,type,t),
          env.DB.prepare("INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,created_at) VALUES(?,?,'dev-owner','relationship',?,'relationship.created',?)").bind(id(),familyId,relationshipId,t)
        ]);
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
    const allowedOrigins = new Set([
      "https://vansvriksh-web-dev.pages.dev",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ]);
    const corsHeaders: Record<string, string> = {
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };
    if (allowedOrigins.has(origin)) corsHeaders["Access-Control-Allow-Origin"] = origin;
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
