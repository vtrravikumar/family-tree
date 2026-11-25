import { describe, expect, it } from "vitest";
import worker, { isGoogleRegistrationAllowed, type Env } from "./index";

describe("open Google registration policy", () => {
  it("allows any non-empty email after Google verifies the identity", () => {
    expect(isGoogleRegistrationAllowed("new.person@gmail.com", true)).toBe(true);
    expect(isGoogleRegistrationAllowed("relative@outlook.com", true)).toBe(true);
  });

  it("rejects unverified or empty email identities", () => {
    expect(isGoogleRegistrationAllowed("person@gmail.com", false)).toBe(false);
    expect(isGoogleRegistrationAllowed("   ", true)).toBe(false);
  });
});

function makeEnv(role: string | null = "owner", session = false, batchChanges = 1, superAdmin = false, initialRateCount = 0, targetRole = "editor", expiredSession = false, personStatus = "alive", invitationEmail: string | null = "member@example.com", invitationExpiresAt = new Date(Date.now() + 60_000).toISOString(), observedWrites?: Array<{sql:string;bound:unknown[]}>, claimRequesterUserId = "another-user", claimStatus = "pending"): Env {
  let rateCount=initialRateCount;
  const db = {
    prepare(sql: string) {
      let bound: unknown[]=[];
      const statement = {
        __sql: sql,
        __bound: () => [...bound],
        bind(...values: unknown[]) { bound=values; return statement; },
        async first() {
          if(sql.includes("RETURNING request_count"))return {request_count:++rateCount};
          if(sql.includes("SELECT id FROM families WHERE is_sample=1"))return {id:"sample-family-v1"};
          if(sql.includes("is_sample=1"))return bound[0]==="sample-family-v1"?{sample:1}:null;
          if(sql.includes("sample_family_dismissals"))return null;
          if (sql.includes("FROM auth_sessions")) return session&&!expiredSession
            ? { id: "user-1", email: "member@example.com", display_name: "Member", session_id: "session-1" }
            : null;
          if (sql.includes("FROM platform_super_admins")) return superAdmin ? { allowed: 1 } : null;
          if (sql.includes("FROM families WHERE id=?")) return { id: "family-1", name: "Family" };
          if (sql.includes("FROM invitations WHERE invite_code_hash")) return {
            id: "invite-1", family_id: "family-1", invitee_email: invitationEmail, offered_role: "editor",
            status: "pending", expires_at: invitationExpiresAt,
          };
          if(sql.includes("FROM persons WHERE id=? AND family_id=?"))return bound[0]==="person-1"&&bound[1]==="family-1"?{id:"person-1",display_name:"Asha",life_status:personStatus}:null;
          if(sql.includes("SELECT life_status FROM persons"))return {life_status:personStatus};
          if(sql.includes("FROM relationships WHERE id=? AND family_id=?"))return {id:"relationship-1",from_person_id:"person-1",to_person_id:"person-2",relationship_type:"sibling"};
          if (sql.includes("FROM family_members")) {
            if(bound[0]==="sample-family-v1")return bound[1]===(session?"user-1":"dev-owner")?{role:"viewer"}:null;
            if(bound[0]!=="family-1")return null;
            if(bound[1]===(session?"user-1":"dev-owner"))return role?{role}:null;
            return bound[1]==="target-1"?{role:targetRole}:null;
          }
          if(sql.includes("FROM person_identity_claims"))return {id:"claim-1",person_id:"person-1",requester_user_id:claimRequesterUserId,status:claimStatus};
          if(sql.includes("FROM person_identity_links"))return sql.includes("OR person_id")?null:{user_id:"linked-user"};
          return null;
        },
        async all() {
          if(sql.includes("FROM persons WHERE family_id=? AND id IN (?,?)")){
            const familyId=bound[0],requested=[bound[1],bound[2]];
            return {results:familyId==="family-1"?requested.filter(personId=>personId==="person-1"||personId==="person-2").map(id=>({id})):[]};
          }
          return sql.includes("id IN (?,?)")?{results:[{id:"person-1"},{id:"person-2"}]}:{ results: [] };
        },
        async run() { observedWrites?.push({sql,bound:[...bound]}); return { success: true, meta: { changes: 1 } }; },
      };
      return statement;
    },
    async batch(statements: Array<{__sql:string;__bound:()=>unknown[]}>) {
      observedWrites?.push(...statements.map(statement=>({sql:statement.__sql,bound:statement.__bound()})));
      return statements.map(()=>({meta:{changes:batchChanges}}));
    },
  } as unknown as Env["DB"];
  return { APP_ENV: "development", DEV_API_TOKEN: "test-token", GOOGLE_CLIENT_ID:"test-client", DB: db };
}

async function request(path: string, role: string | null, method = "GET", payload?: unknown, session = false, batchChanges = 1, superAdmin = false, initialRateCount=0, targetRole="editor", expiredSession=false, personStatus="alive", invitationEmail: string | null = "member@example.com", invitationExpiresAt = new Date(Date.now() + 60_000).toISOString(), observedWrites?: Array<{sql:string;bound:unknown[]}>, claimRequesterUserId = "another-user", claimStatus = "pending") {
  return worker.fetch(new Request("https://api.example.test" + path, {
    method,
    headers: { Authorization: "Bearer test-token", ...(session ? { Cookie: "vansvriksh_session=test-session" } : {}), ...(payload ? { "Content-Type": "application/json" } : {}) },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  }), makeEnv(role, session, batchChanges, superAdmin, initialRateCount, targetRole, expiredSession, personStatus, invitationEmail, invitationExpiresAt, observedWrites, claimRequesterUserId, claimStatus));
}

describe("server-side authorization", () => {
  it("accepts a valid development bearer token and rejects an invalid one", async () => {
    const valid = await worker.fetch(new Request("https://api.example.test/v1/families", {
      headers: { Authorization: "Bearer test-token" },
    }), makeEnv());
    const invalid = await worker.fetch(new Request("https://api.example.test/v1/families", {
      headers: { Authorization: "Bearer wrong-token" },
    }), makeEnv());
    expect(valid.status).toBe(200);
    expect(invalid.status).toBe(401);
  });

  it("rejects expired sessions and state-changing requests from unapproved browser origins", async () => {
    expect((await request("/v1/auth/me",null,"GET",undefined,true,1,false,0,"editor",true)).status).toBe(401);
    const response=await worker.fetch(new Request("https://api.example.test/v1/families",{
      method:"POST",headers:{Origin:"https://hostile.example","Content-Type":"application/json"},body:JSON.stringify({name:"Forged"}),
    }),makeEnv());
    expect(response.status).toBe(403);
  });

  it("restricts production browser origins to the configured production frontend", async () => {
    const env=makeEnv();
    env.APP_ENV="production";
    env.ALLOWED_ORIGINS="https://vansvriksh.vtrrk.in";
    const production=await worker.fetch(new Request("https://api.example.test/health",{
      headers:{Origin:"https://vansvriksh.vtrrk.in"},
    }),env);
    expect(production.headers.get("access-control-allow-origin")).toBe("https://vansvriksh.vtrrk.in");

    const development=await worker.fetch(new Request("https://api.example.test/v1/families",{
      method:"POST",headers:{Origin:"https://vansvriksh-web-dev.pages.dev","Content-Type":"application/json"},
      body:JSON.stringify({name:"Not allowed"}),
    }),env);
    expect(development.status).toBe(403);
    expect(development.headers.get("access-control-allow-origin")).toBeNull();

    const local=await worker.fetch(new Request("https://api.example.test/v1/families",{
      method:"OPTIONS",headers:{Origin:"http://localhost:5173"},
    }),env);
    expect(local.status).toBe(204);
    expect(local.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("does not seed or fall back to a development identity in production", async () => {
    const env=makeEnv("owner",true);
    env.APP_ENV="production";
    const originalPrepare=env.DB.prepare.bind(env.DB);
    let seededDevelopmentIdentity=false;
    env.DB.prepare=(sql:string)=>{
      if(sql.includes("INSERT OR IGNORE INTO users")&&sql.includes("dev-owner"))seededDevelopmentIdentity=true;
      return originalPrepare(sql);
    };
    const withSession=await worker.fetch(new Request("https://api.example.test/v1/families",{
      headers:{Cookie:"vansvriksh_session=test-session"},
    }),env);
    expect(withSession.status).toBe(200);
    expect(seededDevelopmentIdentity).toBe(false);

    const bearerOnly=await worker.fetch(new Request("https://api.example.test/v1/families",{
      headers:{Authorization:"Bearer test-token"},
    }),env);
    expect(bearerOnly.status).toBe(401);
  });

  it.each(["owner","admin","editor","viewer"])("enforces %s permissions in production through a Google session", async (role) => {
    const env=makeEnv(role,true);
    env.APP_ENV="production";
    const call=(path:string,method="GET",payload?:unknown)=>worker.fetch(new Request("https://api.example.test"+path,{
      method,headers:{Cookie:"vansvriksh_session=test-session",...(payload?{"Content-Type":"application/json"}:{})},
      ...(payload?{body:JSON.stringify(payload)}:{}),
    }),env);
    expect((await call("/v1/families/family-1/people")).status).toBe(200);
    const write=await call("/v1/families/family-1/people","POST",{givenName:"Asha"});
    expect(write.status).toBe(role==="viewer"?403:201);
  });

  it("keeps session responses private and clears cookies on logout", async () => {
    const me=await request("/v1/auth/me",null,"GET",undefined,true);
    expect(me.status).toBe(200);
    expect(me.headers.get("cache-control")).toBe("no-store");
    expect(me.headers.get("x-content-type-options")).toBe("nosniff");
    const logout=await worker.fetch(new Request("https://api.example.test/v1/auth/logout",{
      method:"POST",headers:{Cookie:"vansvriksh_session=test-session"},
    }),makeEnv());
    expect(logout.status).toBe(200);
    expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("allows only Owners to delete a family", async () => {
    expect((await request("/v1/families/family-1","owner","DELETE",{confirmed:true})).status).toBe(200);
    for(const role of ["admin","editor","viewer"]){
      expect((await request("/v1/families/family-1",role,"DELETE",{confirmed:true})).status).toBe(403);
    }
  });

  it("rechecks Owner membership inside the family deletion statement", async () => {
    const writes:Array<{sql:string;bound:unknown[]}> = [];
    expect((await request("/v1/families/family-1","owner","DELETE",{confirmed:true},false,1,false,0,"editor",false,"alive","member@example.com",new Date(Date.now()+60_000).toISOString(),writes)).status).toBe(200);
    const deletion=writes.find(write=>write.sql.includes("DELETE FROM families"));
    expect(deletion?.sql).toContain("actor.role='owner'");
    expect(deletion?.sql).toContain("actor.user_id=?");

    expect((await request("/v1/families/family-1","owner","DELETE",{confirmed:true},false,0)).status).toBe(409);
  });

  it("keeps the shared sample read-only for every family role, including Owners", async () => {
    for(const role of ["owner","admin","editor","viewer"]){
      expect((await request("/v1/families/sample-family-v1/people",role,"POST",{givenName:"Not allowed"})).status).toBe(403);
      expect((await request("/v1/families/sample-family-v1","owner","DELETE",{confirmed:true})).status).toBe(403);
    }
  });

  it("grants shared sample access on request and hides the shared Viewer roster", async () => {
    const attached=await request("/v1/onboarding/sample-access","owner","POST");
    expect(attached.status).toBe(200);
    expect((await attached.json() as {data:{attached:boolean;role:string}}).data).toMatchObject({attached:true,role:"viewer"});
    expect((await request("/v1/families/sample-family-v1/people","viewer")).status).toBe(200);
    const roster=await request("/v1/families/sample-family-v1/members","viewer");
    expect(roster.status).toBe(200);
    expect((await roster.json() as {data:unknown[]}).data).toEqual([]);
  });

  it("removes only the caller's sample association", async () => {
    const response=await request("/v1/onboarding/sample-access","viewer","DELETE");
    expect(response.status).toBe(200);
    expect((await response.json() as {data:{removed:boolean;familyId:string}}).data).toEqual({removed:true,familyId:"sample-family-v1"});
  });

  it("rate limits Google sign-in attempts by client IP", async () => {
    const env=makeEnv();env.GOOGLE_CLIENT_ID="test-client";
    let last:Response|null=null;
    for(let i=0;i<21;i++)last=await worker.fetch(new Request("https://api.example.test/v1/auth/google",{
      method:"POST",headers:{"Content-Type":"application/json","CF-Connecting-IP":"192.0.2.10"},body:JSON.stringify({credential:"not-a-jwt"}),
    }),env);
    expect(last?.status).toBe(429);
    expect(last?.headers.get("retry-after")).toBeTruthy();
  });

  it.each(["owner", "admin", "editor", "viewer"])("allows %s to read family data", async (role) => {
    expect((await request("/v1/families/family-1/people", role)).status).toBe(200);
    expect((await request("/v1/families/family-1/people", null)).status).toBe(404);
  });

  it("limits the family member roster to Owner, Admin and Editor", async () => {
    for(const role of ["owner","admin","editor"]){
      expect((await request("/v1/families/family-1/members",role)).status).toBe(200);
    }
    expect((await request("/v1/families/family-1/members","viewer")).status).toBe(403);
    expect((await request("/v1/families/family-1/members",null)).status).toBe(404);
  });

  it.each(["owner", "admin", "editor"])("allows %s to add a person", async (role) => {
    expect((await request("/v1/families/family-1/people", role, "POST", { givenName: "Asha" })).status).toBe(201);
  });

  it("denies Viewer writes and denies an unassociated user's family access", async () => {
    expect((await request("/v1/families/family-1/people", "viewer", "POST", { givenName: "Asha" })).status).toBe(403);
    expect((await request("/v1/families/family-1/people", null)).status).toBe(404);
  });

  it("allows Editor updates to living profiles but denies Viewer and deceased-profile edits", async () => {
    const path="/v1/families/family-1/people/person-1",payload={givenName:"Asha",gender:"unspecified",birthDateKind:"unknown"};
    expect((await request(path,"editor","PUT",payload)).status).toBe(200);
    expect((await request(path,"viewer","PUT",payload)).status).toBe(403);
    expect((await request(path,"owner","PUT",payload,false,1,false,0,"editor",false,"deceased")).status).toBe(409);
  });

  it("restricts person deletion and deceased-status actions to Owner/Admin", async () => {
    const person="/v1/families/family-1/people/person-1";
    expect((await request(person,"owner","DELETE",{confirmed:true})).status).toBe(200);
    expect((await request(person,"admin","DELETE",{confirmed:true},false,1,false,0,"editor",false,"deceased")).status).toBe(409);
    expect((await request(person,"editor","DELETE",{confirmed:true})).status).toBe(403);
    expect((await request(person+"/deceased","admin","POST",{confirmed:true,deathDateKind:"unknown"})).status).toBe(200);
    expect((await request(person+"/deceased","editor","POST",{confirmed:true,deathDateKind:"unknown"})).status).toBe(403);
    expect((await request(person+"/restore","admin","POST",{confirmed:true})).status).toBe(200);
    expect((await request(person+"/restore","editor","POST",{confirmed:true})).status).toBe(403);
  });

  it("rechecks Owner/Admin authority for person lifecycle writes and gates each audit", async () => {
    const person="/v1/families/family-1/people/person-1";
    const deletionWrites:Array<{sql:string;bound:unknown[]}>=[]; 
    expect((await request(person,"owner","DELETE",{confirmed:true},false,1,false,0,"editor",false,"alive","member@example.com",new Date(Date.now()+60_000).toISOString(),deletionWrites)).status).toBe(200);
    const deletion=deletionWrites.find(write=>write.sql.includes("DELETE FROM persons"));
    const deletionAudit=deletionWrites.find(write=>write.sql.includes("person.deleted"));
    expect(deletion?.sql).toContain("actor.role IN ('owner','admin')");
    expect(deletionAudit?.sql).toContain("WHERE changes()=1");
    expect((await request(person,"owner","DELETE",{confirmed:true},false,0)).status).toBe(409);

    for(const [suffix,payload,action,rolePredicate] of [
      ["/restore",{confirmed:true},"person.restored_to_alive","actor.role IN ('owner','admin')"],
      ["/deceased",{confirmed:true,deathDateKind:"unknown"},"person.marked_deceased","actor.role IN ('owner','admin')"],
    ] as const){
      const writes:Array<{sql:string;bound:unknown[]}>=[]; 
      const response=await request(person+suffix,"admin","POST",payload,false,1,false,0,"editor",false,"alive","member@example.com",new Date(Date.now()+60_000).toISOString(),writes);
      expect(response.status).toBe(200);
      const mutation=writes.find(write=>write.sql.includes("UPDATE persons SET life_status"));
      const audit=writes.find(write=>write.sql.includes(action));
      expect(mutation?.sql).toContain("EXISTS (SELECT 1 FROM family_members actor");
      expect(mutation?.sql).toContain(rolePredicate);
      expect(audit?.sql).toContain("WHERE changes()=1");
      expect((await request(person+suffix,"admin","POST",payload,false,0)).status).toBe(409);
    }
  });

  it("allows every family role to request claims while only Owners can claim directly", async () => {
    for(const role of ["admin","editor","viewer"]){
      const response=await request("/v1/families/family-1/identity-claims",role,"POST",{personId:"person-1"});
      expect(response.status).toBe(201);
      expect((await response.json() as {data:{status:string}}).data.status).toBe("pending");
    }
    const owner=await request("/v1/families/family-1/identity-claims","owner","POST",{personId:"person-1"});
    expect(owner.status).toBe(201);
    expect((await owner.json() as {data:{status:string}}).data.status).toBe("approved");
  });

  it("rechecks current family editor membership in person updates and gates the audit", async () => {
    const writes:Array<{sql:string;bound:unknown[]}>=[],path="/v1/families/family-1/people/person-1";
    const response=await request(path,"editor","PUT",{givenName:"Asha",familyName:"Raman"},false,1,false,0,"editor",false,"alive","member@example.com",new Date(Date.now()+60_000).toISOString(),writes);
    expect(response.status).toBe(200);
    const update=writes.find(write=>write.sql.includes("UPDATE persons SET given_name"));
    const audit=writes.find(write=>write.sql.includes("person.updated"));
    expect(update?.sql).toContain("EXISTS (SELECT 1 FROM family_members actor");
    expect(update?.sql).toContain("actor.role IN ('owner','admin','editor')");
    expect(audit?.sql).toContain("WHERE changes()=1");
    expect((await request(path,"editor","PUT",{givenName:"Asha"},false,0)).status).toBe(409);
  });

  it("allows editors to manage relationships but denies Viewer relationship writes", async () => {
    const path="/v1/families/family-1/relationships";
    const payload={fromPersonId:"person-1",toPersonId:"person-2",relationshipType:"sibling"};
    expect((await request(path,"editor","POST",payload)).status).toBe(201);
    expect((await request(path,"viewer","POST",payload)).status).toBe(403);
  });

  it("allows Owner/Admin/Editor relationship changes and denies Viewer changes", async () => {
    const item="/v1/families/family-1/relationships/relationship-1";
    for(const role of ["owner","admin","editor"]){
      expect((await request(item,role,"DELETE")).status).toBe(200);
      expect((await request(item,role,"PUT",{})).status).toBe(400);
    }
    expect((await request(item,"viewer","DELETE")).status).toBe(403);
    expect((await request(item,"viewer","PUT",{})).status).toBe(403);
  });

  it("rechecks current editor membership and family-scoped people in relationship writes", async () => {
    const base="/v1/families/family-1/relationships",payload={fromPersonId:"person-1",toPersonId:"person-2",relationshipType:"sibling"};
    const createWrites:Array<{sql:string;bound:unknown[]}>=[];
    expect((await request(base,"editor","POST",payload,false,1,false,0,"editor",false,"alive","member@example.com",new Date(Date.now()+60_000).toISOString(),createWrites)).status).toBe(201);
    const create=createWrites.find(write=>write.sql.includes("INSERT INTO relationships"));
    const createAudit=createWrites.find(write=>write.sql.includes("relationship.created"));
    expect(create?.sql).toContain("actor.role IN ('owner','admin','editor')");
    expect(create?.sql).toContain("FROM persons a JOIN persons b");
    expect(createAudit?.sql).toContain("WHERE changes()=1");
    expect((await request(base,"editor","POST",payload,false,0)).status).toBe(409);

    const item=base+"/relationship-1";
    const updateWrites:Array<{sql:string;bound:unknown[]}>=[];
    expect((await request(item,"editor","PUT",payload,false,1,false,0,"editor",false,"alive","member@example.com",new Date(Date.now()+60_000).toISOString(),updateWrites)).status).toBe(200);
    const update=updateWrites.find(write=>write.sql.includes("UPDATE relationships"));
    const updateAudit=updateWrites.find(write=>write.sql.includes("relationship.updated"));
    expect(update?.sql).toContain("actor.role IN ('owner','admin','editor')");
    expect(update?.sql).toContain("FROM persons a JOIN persons b");
    expect(updateAudit?.sql).toContain("WHERE changes()=1");
    expect((await request(item,"editor","PUT",payload,false,0)).status).toBe(409);

    const deleteWrites:Array<{sql:string;bound:unknown[]}>=[];
    expect((await request(item,"editor","DELETE",undefined,false,1,false,0,"editor",false,"alive","member@example.com",new Date(Date.now()+60_000).toISOString(),deleteWrites)).status).toBe(200);
    const deletion=deleteWrites.find(write=>write.sql.includes("DELETE FROM relationships"));
    const deleteAudit=deleteWrites.find(write=>write.sql.includes("relationship.deleted"));
    expect(deletion?.sql).toContain("actor.role IN ('owner','admin','editor')");
    expect(deleteAudit?.sql).toContain("WHERE changes()=1");
    expect((await request(item,"editor","DELETE",undefined,false,0)).status).toBe(409);
  });

  it("rechecks duplicate and ancestry-cycle constraints in relationship writes", async () => {
    const base="/v1/families/family-1/relationships";
    const payload={fromPersonId:"person-1",toPersonId:"person-2",relationshipType:"biological_parent"};
    const createWrites:Array<{sql:string;bound:unknown[]}> = [];
    expect((await request(base,"editor","POST",payload,false,1,false,0,"editor",false,"alive","member@example.com",new Date(Date.now()+60_000).toISOString(),createWrites)).status).toBe(201);
    const create=createWrites.find(write=>write.sql.includes("INSERT INTO relationships"));
    expect(create?.sql).toContain("NOT EXISTS (SELECT 1 FROM relationships");
    expect(create?.sql).toContain("WITH RECURSIVE descendants");

    const updateWrites:Array<{sql:string;bound:unknown[]}> = [];
    expect((await request(base+"/relationship-1","editor","PUT",payload,false,1,false,0,"editor",false,"alive","member@example.com",new Date(Date.now()+60_000).toISOString(),updateWrites)).status).toBe(200);
    const update=updateWrites.find(write=>write.sql.includes("UPDATE relationships"));
    expect(update?.sql).toContain("NOT EXISTS (SELECT 1 FROM relationships");
    expect(update?.sql).toContain("WITH RECURSIVE descendants");
  });

  it("denies cross-family ID substitution even when the caller belongs to another family", async () => {
    expect((await request("/v1/families/other-family/people", "owner")).status).toBe(404);
    expect((await request("/v1/families/family-1/identity-claims", "editor", "POST", { personId: "person-from-another-family" })).status).toBe(404);
  });

  it("rejects a relationship that mixes a family person with a person from another family", async () => {
    const path="/v1/families/family-1/relationships";
    const localPair=await request(path,"editor","POST",{fromPersonId:"person-1",toPersonId:"person-2",relationshipType:"sibling"});
    const crossFamilyPair=await request(path,"editor","POST",{fromPersonId:"person-1",toPersonId:"person-from-another-family",relationshipType:"sibling"});
    expect(localPair.status).toBe(201);
    expect(crossFamilyPair.status).toBe(400);
    expect((await crossFamilyPair.json() as {error:{code:string}}).error.code).toBe("person_not_in_family");
  });

  it("does not let a family owner manage a member ID belonging only to another family", async () => {
    const member="/v1/families/family-1/members/foreign-member";
    expect((await request(member,"owner","PUT",{role:"viewer"})).status).toBe(404);
    expect((await request(member,"owner","DELETE")).status).toBe(404);
  });

  it.each(["owner", "admin"])("allows %s to list and revoke pending invitations", async (role) => {
    expect((await request("/v1/families/family-1/invitations", role)).status).toBe(200);
    expect((await request("/v1/families/family-1/invitations/invite-1", role, "DELETE")).status).toBe(200);
  });

  it("rechecks inviter permissions in the invitation insert and gates its audit record", async () => {
    const writes:Array<{sql:string;bound:unknown[]}>= [];
    const payload={email:"relative@example.com",role:"viewer"};
    const response=await request("/v1/families/family-1/invitations","owner","POST",payload,false,1,false,0,"editor",false,"alive","member@example.com",new Date(Date.now()+60_000).toISOString(),writes);
    expect(response.status).toBe(201);
    const insert=writes.find(write=>write.sql.includes("INSERT INTO invitations"));
    const audit=writes.find(write=>write.sql.includes("invitation.created"));
    expect(insert?.sql).toContain("EXISTS (SELECT 1 FROM family_members actor");
    expect(insert?.sql).toContain("actor.role IN ('owner','admin')");
    expect(insert?.sql).toContain("actor.role='owner' OR ?<>'admin'");
    expect(audit?.sql).toContain("WHERE changes()=1");
  });

  it("does not report invitation creation when the conditional insert changes no rows", async () => {
    const writes:Array<{sql:string;bound:unknown[]}>= [];
    const response=await request("/v1/families/family-1/invitations","owner","POST",{email:"relative@example.com",role:"viewer"},false,0,false,0,"editor",false,"alive","member@example.com",new Date(Date.now()+60_000).toISOString(),writes);
    expect(response.status).toBe(409);
    expect(writes.some(write=>write.sql.includes("invitation.created")&&write.sql.includes("WHERE changes()=1"))).toBe(true);
  });

  it("rechecks current owner/admin membership in the invitation revocation write", async () => {
    const writes:Array<{sql:string;bound:unknown[]}>= [];
    const response=await request("/v1/families/family-1/invitations/invite-1","owner","DELETE",undefined,false,1,false,0,"editor",false,"alive","member@example.com",new Date(Date.now()+60_000).toISOString(),writes);
    expect(response.status).toBe(200);
    const revokeWrite=writes.find(write=>write.sql.includes("UPDATE invitations SET status='revoked'"));
    const auditWrite=writes.find(write=>write.sql.includes("invitation.revoked"));
    expect(revokeWrite?.sql).toContain("EXISTS (SELECT 1 FROM family_members actor");
    expect(revokeWrite?.sql).toContain("actor.role IN ('owner','admin')");
    expect(auditWrite?.sql).toContain("WHERE changes()=1");
  });

  it("rate limits invitation creation by caller IP and owner account", async () => {
    const path="/v1/families/family-1/invitations",payload={email:"relative@example.com",role:"viewer"};
    expect((await request(path,"owner","POST",payload,false,1,false,20)).status).toBe(429);
    expect((await request(path,"owner","POST",payload,false,1,false,9)).status).toBe(429);
  });

  it.each(["editor", "viewer"])("denies %s invitation administration", async (role) => {
    expect((await request("/v1/families/family-1/invitations", role)).status).toBe(403);
    expect((await request("/v1/families/family-1/invitations/invite-1", role, "DELETE")).status).toBe(403);
  });

  it("requires a Google session before accepting an invitation", async () => {
    expect((await request("/v1/invitations/opaque-code/accept", "owner", "POST", {})).status).toBe(401);
  });

  it("rate limits invitation acceptance attempts by client IP", async () => {
    expect((await request("/v1/invitations/opaque-code/accept",null,"POST",{},false,1,false,30)).status).toBe(429);
  });

  it("accepts an invitation when the request wins the pending-state transition", async () => {
    expect((await request("/v1/invitations/opaque-code/accept", null, "POST", {}, true, 1)).status).toBe(200);
  });

  it("rejects invitation acceptance from a different Google account and rejects expired invitations", async () => {
    const path="/v1/invitations/opaque-code/accept";
    expect((await request(path, null, "POST", {}, true, 1, false, 0, "editor", false, "alive", "someone-else@example.com")).status).toBe(403);
    expect((await request(path, null, "POST", {}, true, 1, false, 0, "editor", false, "alive", "member@example.com", new Date(Date.now() - 60_000).toISOString())).status).toBe(404);
  });

  it("rejects a concurrent invitation acceptance that loses the pending-state transition", async () => {
    expect((await request("/v1/invitations/opaque-code/accept", null, "POST", {}, true, 0)).status).toBe(404);
  });

  it.each(["owner", "admin"])("allows %s to import family records", async (role) => {
    expect((await request("/v1/families/family-1/import", role, "POST", {
      confirmed: true, confirmDeceasedRecords: true, people: [],
    })).status).toBe(200);
  });

  it.each(["editor", "viewer"])("denies %s family imports", async (role) => {
    expect((await request("/v1/families/family-1/import", role, "POST", {
      confirmed: true, confirmDeceasedRecords: true, people: [],
    })).status).toBe(403);
  });

  it("allows an Owner to assign an Admin and prevents an Admin from granting Admin", async () => {
    expect((await request("/v1/families/family-1/members/target-1", "owner", "PUT", { role: "admin" }, false, 1, false, 0, "editor")).status).toBe(200);
    expect((await request("/v1/families/family-1/members/target-1", "admin", "PUT", { role: "admin" }, false, 1, false, 0, "editor")).status).toBe(403);
  });

  it("rechecks actor authority and target role in the member mutation statement", async () => {
    const target="/v1/families/family-1/members/target-1";
    const roleWrites:Array<{sql:string;bound:unknown[]}>=[];
    const roleResponse=await request(target,"owner","PUT",{role:"viewer"},false,1,false,0,"editor",false,"alive","member@example.com",new Date(Date.now()+60_000).toISOString(),roleWrites);
    expect(roleResponse.status).toBe(200);
    const roleMutation=roleWrites.find(write=>write.sql.includes("UPDATE family_members"));
    const roleAudit=roleWrites.find(write=>write.sql.includes("member.role_changed"));
    expect(roleMutation?.sql).toContain("target.role=?");
    expect(roleMutation?.sql).toContain("actor.role IN ('owner','admin')");
    expect(roleAudit?.sql).toContain("WHERE changes()=1");

    const removeWrites:Array<{sql:string;bound:unknown[]}>=[];
    const removeResponse=await request(target,"owner","DELETE",undefined,false,1,false,0,"editor",false,"alive","member@example.com",new Date(Date.now()+60_000).toISOString(),removeWrites);
    expect(removeResponse.status).toBe(200);
    const removeMutation=removeWrites.find(write=>write.sql.includes("DELETE FROM family_members"));
    const removeAudit=removeWrites.find(write=>write.sql.includes("member.removed"));
    expect(removeMutation?.sql).toContain("target.role=?");
    expect(removeMutation?.sql).toContain("actor.role IN ('owner','admin')");
    expect(removeAudit?.sql).toContain("WHERE changes()=1");

    expect((await request(target,"owner","PUT",{role:"viewer"},false,0,false,0,"editor")).status).toBe(409);
    expect((await request(target,"owner","DELETE",undefined,false,0,false,0,"editor")).status).toBe(409);
  });

  it("limits member-role changes and removals to Owner/Admin without allowing owner or peer-admin changes", async () => {
    const target="/v1/families/family-1/members/target-1";
    for(const role of ["editor","viewer"]){
      expect((await request(target,role,"PUT",{role:"viewer"})).status).toBe(403);
      expect((await request(target,role,"DELETE")).status).toBe(403);
    }
    expect((await request(target,"owner","PUT",{role:"viewer"},false,1,false,0,"editor")).status).toBe(200);
    expect((await request(target,"owner","PUT",{role:"viewer"},false,1,false,0,"owner")).status).toBe(409);
    expect((await request(target,"admin","PUT",{role:"viewer"},false,1,false,0,"admin")).status).toBe(403);
    expect((await request(target,"owner","DELETE",undefined,false,1,false,0,"editor")).status).toBe(200);
    expect((await request(target,"owner","DELETE",undefined,false,1,false,0,"owner")).status).toBe(409);
    expect((await request(target,"admin","DELETE",undefined,false,1,false,0,"admin")).status).toBe(403);
  });

  it.each(["editor", "viewer"])("denies %s identity-claim review and unlink", async (role) => {
    expect((await request("/v1/families/family-1/identity-claims/claim-1/review", role, "POST", { decision: "reject" })).status).toBe(403);
    expect((await request("/v1/families/family-1/identity", role, "DELETE", { personId: "person-1" })).status).toBe(403);
  });

  it.each(["owner", "admin"])("allows %s to review a claim and unlink an identity", async (role) => {
    expect((await request("/v1/families/family-1/identity-claims/claim-1/review", role, "POST", { decision: "reject" })).status).toBe(200);
    expect((await request("/v1/families/family-1/identity", role, "DELETE", { personId: "person-1" })).status).toBe(200);
  });

  it("rechecks Owner/Admin authority when unlinking an identity and gates follow-up writes", async () => {
    const writes:Array<{sql:string;bound:unknown[]}>= [];
    const response=await request("/v1/families/family-1/identity","owner","DELETE",{personId:"person-1"},false,1,false,0,"editor",false,"alive","member@example.com",new Date(Date.now()+60_000).toISOString(),writes);
    expect(response.status).toBe(200);
    const deletion=writes.find(write=>write.sql.includes("DELETE FROM person_identity_links"));
    const audit=writes.find(write=>write.sql.includes("identity.unlinked"));
    const claim=writes.find(write=>write.sql.includes("UPDATE person_identity_claims SET status='withdrawn'"));
    expect(deletion?.sql).toContain("actor.role IN ('owner','admin')");
    expect(audit?.sql).toContain("WHERE changes()=1");
    expect(claim?.sql).toContain("EXISTS (SELECT 1 FROM audit_logs");
    expect((await request("/v1/families/family-1/identity","owner","DELETE",{personId:"person-1"},false,0)).status).toBe(409);
  });

  it("transitions a claim before creating its identity link and audit record", async () => {
    const writes:Array<{sql:string;bound:unknown[]}>=[];
    const response=await request("/v1/families/family-1/identity-claims/claim-1/review","owner","POST",{decision:"approve"},false,1,false,0,"editor",false,"alive","member@example.com",new Date(Date.now()+60_000).toISOString(),writes);
    expect(response.status).toBe(200);
    const batchWrites=writes.slice(-3);
    expect(batchWrites).toHaveLength(3);
    expect(batchWrites[0].sql).toContain("UPDATE person_identity_claims SET status='approved'");
    expect(batchWrites[0].sql).toContain("WHERE id=? AND status='pending'");
    expect(batchWrites[0].sql).toContain("actor.role IN ('owner','admin')");
    expect(batchWrites[0].bound.slice(-2)).toEqual(["family-1","dev-owner"]);
    expect(batchWrites[1].sql).toContain("INSERT INTO person_identity_links");
    expect(batchWrites[1].sql).toContain("WHERE changes()=1");
    expect(batchWrites[2].sql).toContain("identity.claim_approved");
    expect(batchWrites[2].sql).toContain("status='approved'");
  });

  it("does not create an identity link or audit entry when approval loses the pending-state transition", async () => {
    const writes:Array<{sql:string;bound:unknown[]}>=[];
    const response=await request("/v1/families/family-1/identity-claims/claim-1/review","owner","POST",{decision:"approve"},false,0,false,0,"editor",false,"alive","member@example.com",new Date(Date.now()+60_000).toISOString(),writes);
    expect(response.status).toBe(409);
    const batchWrites=writes.slice(-3);
    expect(batchWrites).toHaveLength(3);
    expect(batchWrites[0].sql).toContain("WHERE id=? AND status='pending'");
    expect(batchWrites[1].sql).toContain("WHERE changes()=1");
    expect(batchWrites[2].sql).toContain("status='approved'");
  });

  it("rechecks family membership and person scope when creating identity claims", async () => {
    const ownerWrites:Array<{sql:string;bound:unknown[]}> = [];
    expect((await request("/v1/families/family-1/identity-claims","owner","POST",{personId:"person-1"},false,1,false,0,"editor",false,"alive","member@example.com",new Date(Date.now()+60_000).toISOString(),ownerWrites)).status).toBe(201);
    const direct=ownerWrites.find(write=>write.sql.includes("INSERT INTO person_identity_links"));
    expect(direct?.sql).toContain("actor.role='owner'");
    expect(direct?.sql).toContain("p.family_id=?");
    expect(ownerWrites.find(write=>write.sql.includes("identity.claimed_directly"))?.sql).toContain("WHERE changes()=1");

    const memberWrites:Array<{sql:string;bound:unknown[]}> = [];
    expect((await request("/v1/families/family-1/identity-claims","editor","POST",{personId:"person-1"},false,1,false,0,"editor",false,"alive","member@example.com",new Date(Date.now()+60_000).toISOString(),memberWrites)).status).toBe(201);
    const claim=memberWrites.find(write=>write.sql.includes("INSERT INTO person_identity_claims"));
    expect(claim?.sql).toContain("FROM family_members actor");
    expect(claim?.sql).toContain("p.family_id=?");
    expect(memberWrites.find(write=>write.sql.includes("identity.claim_requested"))?.sql).toContain("WHERE changes()=1");

    expect((await request("/v1/families/family-1/identity-claims","editor","POST",{personId:"person-1"},false,0)).status).toBe(409);
  });

  it("prevents an owner or admin from reviewing their own identity claim", async () => {
    for(const role of ["owner","admin"]){
      const writes:Array<{sql:string;bound:unknown[]}>=[]; 
      const response=await request("/v1/families/family-1/identity-claims/claim-1/review",role,"POST",{decision:"approve"},false,1,false,0,"editor",false,"alive","member@example.com",new Date(Date.now()+60_000).toISOString(),writes,"dev-owner");
      expect(response.status).toBe(403);
      expect((await response.json() as {error:{code:string}}).error.code).toBe("self_review_forbidden");
      expect(writes.filter(write=>/person_identity_(claims|links)|identity\\.claim_/.test(write.sql))).toHaveLength(0);
    }
  });

  it("does not review an identity claim that is no longer pending", async () => {
    const writes:Array<{sql:string;bound:unknown[]}>=[]; 
    const response=await request("/v1/families/family-1/identity-claims/claim-1/review","owner","POST",{decision:"reject"},false,1,false,0,"editor",false,"alive","member@example.com",new Date(Date.now()+60_000).toISOString(),writes,"another-user","approved");
    expect(response.status).toBe(404);
    expect((await response.json() as {error:{code:string}}).error.code).toBe("claim_unavailable");
    expect(writes.filter(write=>/person_identity_(claims|links)|identity\\.claim_/.test(write.sql))).toHaveLength(0);
  });

  it("writes a rejection audit only when the pending-state transition succeeds", async () => {
    const writes:Array<{sql:string;bound:unknown[]}>=[];
    const response=await request("/v1/families/family-1/identity-claims/claim-1/review","admin","POST",{decision:"reject"},false,0,false,0,"editor",false,"alive","member@example.com",new Date(Date.now()+60_000).toISOString(),writes);
    expect(response.status).toBe(409);
    const batchWrites=writes.slice(-2);
    expect(batchWrites).toHaveLength(2);
    expect(batchWrites[0].sql).toContain("UPDATE person_identity_claims SET status='rejected'");
    expect(batchWrites[0].sql).toContain("actor.role IN ('owner','admin')");
    expect(batchWrites[0].bound.slice(-2)).toEqual(["family-1","dev-owner"]);
    expect(batchWrites[1].sql).toContain("WHERE changes()=1");
  });

  it.each(["owner", "admin", "editor", "viewer"])("denies family %s access to every platform-only route", async (role) => {
    const protectedReads = [
      "/v1/platform/overview",
      "/v1/platform/users",
      "/v1/platform/families",
      "/v1/platform/audit-logs",
    ];
    for (const path of protectedReads) {
      expect((await request(path, role)).status).toBe(403);
    }
    expect((await request("/v1/platform/families/family-1/support-access", role, "POST", {
      reason: "Approved support investigation",
    })).status).toBe(403);
    expect((await request("/v1/platform/families/family-1/export", role, "POST", {
      reason: "Approved family export investigation",
    })).status).toBe(403);
  });

  it("allows a Super Admin session to read all platform collections and reports its status", async () => {
    const me = await request("/v1/platform/me", null, "GET", undefined, true, 1, true);
    expect(me.status).toBe(200);
    expect((await me.json() as { data: { isSuperAdmin: boolean } }).data.isSuperAdmin).toBe(true);

    for (const path of [
      "/v1/platform/overview",
      "/v1/platform/users",
      "/v1/platform/families",
      "/v1/platform/audit-logs",
    ]) {
      expect((await request(path, null, "GET", undefined, true, 1, true)).status).toBe(200);
    }
  });

  it("keeps platform administration separate from family membership", async () => {
    for(const path of ["/v1/platform/overview","/v1/platform/users","/v1/platform/families","/v1/platform/audit-logs"]){
      expect((await request(path,"owner")).status).toBe(403);
    }
    expect((await request("/v1/platform/families/family-1/support-access","owner","POST",{reason:"Approved support investigation"})).status).toBe(403);
    expect((await request("/v1/platform/families/family-1/export","owner","POST",{reason:"Family data recovery request"})).status).toBe(403);
  });

  it("allows reason-gated Super Admin support access and platform overview", async () => {
    expect((await request("/v1/platform/overview",null,"GET",undefined,true,1,true)).status).toBe(200);
    expect((await request("/v1/platform/families/family-1/support-access",null,"POST",{reason:"Approved support investigation"},true,1,true)).status).toBe(200);
  });

  it("requires a reason-gated Super Admin session for family data export", async () => {
    const path="/v1/platform/families/family-1/export";
    expect((await request(path, null, "POST", { reason: "Family data recovery request" }, true, 1, false)).status).toBe(403);
    expect((await request(path, null, "POST", { reason: "short" }, true, 1, true)).status).toBe(400);
    expect((await request(path, null, "POST", { reason: "Family data recovery request" }, true, 1, true)).status).toBe(200);
  });

  it("validates all imported people before writing any family import records", async () => {
    const writes:Array<{sql:string;bound:unknown[]}> = [];
    const response=await request("/v1/families/family-1/import","owner","POST",{
      confirmed:true,confirmDeceasedRecords:true,
      people:[
        {key:"00000000-0000-4000-8000-000000000021",givenName:"Valid"},
        {key:"",givenName:"Invalid late row"},
      ],
      relationships:[],
    },false,1,false,0,"editor",false,"alive","member@example.com",new Date(Date.now()+60_000).toISOString(),writes);
    expect(response.status).toBe(400);
    expect(writes.some(write=>/INSERT INTO persons|UPDATE persons|INSERT INTO relationships|INSERT INTO audit_logs|INSERT INTO platform_audit_logs/.test(write.sql))).toBe(false);
  });

  it("rechecks current Editor membership when creating a person", async () => {
    const writes:Array<{sql:string;bound:unknown[]}> = [];
    const response=await request("/v1/families/family-1/people","editor","POST",{givenName:"New Person"},false,1,false,0,"editor",false,"alive","member@example.com",new Date(Date.now()+60_000).toISOString(),writes);
    expect(response.status).toBe(201);
    const insert=writes.find(write=>write.sql.includes("INSERT INTO persons"));
    expect(insert?.sql).toContain("actor.role IN ('owner','admin','editor')");
    const audit=writes.find(write=>write.sql.includes("person.created"));
    expect(audit?.sql).toContain("WHERE changes()=1");
    expect((await request("/v1/families/family-1/people","editor","POST",{givenName:"New Person"},false,0)).status).toBe(409);
  });

  it("preserves biographies when importing a family workbook", async () => {
    const writes:Array<{sql:string;bound:unknown[]}> = [];
    const response=await request("/v1/families/family-1/import","owner","POST",{
      confirmed:true,confirmDeceasedRecords:true,
      people:[{key:"00000000-0000-4000-8000-000000000022",givenName:"Mira",familyName:"Raman",biography:"Remembered for her generous storytelling."}],
      relationships:[],
    },false,1,false,0,"editor",false,"alive","member@example.com",new Date(Date.now()+60_000).toISOString(),writes);
    expect(response.status).toBe(200);
    const personInsert=writes.find(write=>write.sql.includes("INSERT INTO persons("));
    expect(personInsert?.sql).toContain("biography");
    expect(personInsert?.bound).toContain("Remembered for her generous storytelling.");
  });

  it("allows Super Admin imports only with a reason and a platform audit path", async () => {
    const path="/v1/families/family-1/import",payload={confirmed:true,confirmDeceasedRecords:true,people:[]};
    expect((await request(path, null, "POST", payload, true, 1, true)).status).toBe(400);
    expect((await request(path, null, "POST", {...payload,reason:"Authorized family restoration"}, true, 1, true)).status).toBe(200);
  });


  it.each(["owner","admin","editor","viewer"])("returns only the %s identity capabilities", async (role) => {
    const response=await request("/v1/families/family-1/identity",role);
    expect(response.status).toBe(200);
    const body=await response.json() as {data:{canReview:boolean;canDirectClaim:boolean;claims:unknown[];pendingClaims:unknown[]}};
    expect(body.data.canReview).toBe(role==="owner"||role==="admin");
    expect(body.data.canDirectClaim).toBe(role==="owner");
    expect(body.data.claims).toEqual([]);
    // The test fixture has no pending claims; the capability flags are the
    // explicit role boundary exposed by this read endpoint.
    expect(body.data.pendingClaims).toEqual([]);
  });

  it("denies invitation creation to Editors and Viewers and limits Admin invitations", async () => {
    const path="/v1/families/family-1/invitations";
    const editor=await request(path,"editor","POST",{email:"relative@example.com",role:"viewer"});
    const viewer=await request(path,"viewer","POST",{email:"relative@example.com",role:"viewer"});
    expect(editor.status).toBe(403);
    expect(viewer.status).toBe(403);

    const adminCannotGrantAdmin=await request(path,"admin","POST",{email:"relative@example.com",role:"admin"});
    expect(adminCannotGrantAdmin.status).toBe(403);
    const adminCanInviteEditor=await request(path,"admin","POST",{email:"relative@example.com",role:"editor"});
    expect(adminCanInviteEditor.status).toBe(201);
    const ownerCanInviteAdmin=await request(path,"owner","POST",{email:"relative@example.com",role:"admin"});
    expect(ownerCanInviteAdmin.status).toBe(201);
  });
});
