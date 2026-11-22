import { describe, expect, it } from "vitest";
import worker, { type Env } from "./index";

function makeEnv(role: string | null = "owner", session = false, batchChanges = 1, superAdmin = false, initialRateCount = 0, targetRole = "editor", expiredSession = false, personStatus = "alive"): Env {
  let rateCount=initialRateCount;
  const db = {
    prepare(sql: string) {
      let bound: unknown[]=[];
      const statement = {
        bind(...values: unknown[]) { bound=values; return statement; },
        async first() {
          if(sql.includes("RETURNING request_count"))return {request_count:++rateCount};
          if (sql.includes("FROM auth_sessions")) return session&&!expiredSession
            ? { id: "user-1", email: "member@example.com", display_name: "Member", session_id: "session-1" }
            : null;
          if (sql.includes("FROM platform_super_admins")) return superAdmin ? { allowed: 1 } : null;
          if (sql.includes("FROM families WHERE id=?")) return { id: "family-1", name: "Family" };
          if (sql.includes("FROM invitations WHERE invite_code_hash")) return {
            id: "invite-1", family_id: "family-1", invitee_email: "member@example.com", offered_role: "editor",
            status: "pending", expires_at: new Date(Date.now() + 60_000).toISOString(),
          };
          if(sql.includes("FROM persons WHERE id=? AND family_id=?"))return {id:"person-1",display_name:"Asha",life_status:personStatus};
          if(sql.includes("SELECT life_status FROM persons"))return {life_status:personStatus};
          if(sql.includes("FROM relationships WHERE id=? AND family_id=?"))return {id:"relationship-1",from_person_id:"person-1",to_person_id:"person-2",relationship_type:"sibling"};
          if (sql.includes("FROM family_members")) {
            if(bound[0]!=="family-1")return null;
            if(bound[1]===(session?"user-1":"dev-owner"))return session?null:role?{role}:null;
            return bound[1]==="target-1"?{role:targetRole}:null;
          }
          if(sql.includes("FROM person_identity_claims"))return {id:"claim-1",person_id:"person-1",requester_user_id:"another-user",status:"pending"};
          if(sql.includes("FROM person_identity_links"))return sql.includes("OR person_id")?null:{user_id:"linked-user"};
          return null;
        },
        async all() { return sql.includes("id IN (?,?)")?{results:[{id:"person-1"},{id:"person-2"}]}:{ results: [] }; },
        async run() { return { success: true, meta: { changes: 1 } }; },
      };
      return statement;
    },
    async batch() { return [{ meta: { changes: batchChanges } }, { meta: { changes: batchChanges } }, { meta: { changes: batchChanges } }]; },
  } as unknown as Env["DB"];
  return { APP_ENV: "development", DEV_API_TOKEN: "test-token", GOOGLE_CLIENT_ID:"test-client", DB: db };
}

async function request(path: string, role: string | null, method = "GET", payload?: unknown, session = false, batchChanges = 1, superAdmin = false, initialRateCount=0, targetRole="editor", expiredSession=false, personStatus="alive") {
  return worker.fetch(new Request("https://api.example.test" + path, {
    method,
    headers: { Authorization: "Bearer test-token", ...(session ? { Cookie: "vansvriksh_session=test-session" } : {}), ...(payload ? { "Content-Type": "application/json" } : {}) },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  }), makeEnv(role, session, batchChanges, superAdmin, initialRateCount, targetRole, expiredSession, personStatus));
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

  it("allows editors to manage relationships but denies Viewer relationship writes", async () => {
    const path="/v1/families/family-1/relationships";
    const payload={fromPersonId:"person-1",toPersonId:"person-2",relationshipType:"sibling"};
    expect((await request(path,"editor","POST",payload)).status).toBe(201);
    expect((await request(path,"viewer","POST",payload)).status).toBe(403);
  });

  it("denies cross-family ID substitution even when the caller belongs to another family", async () => {
    expect((await request("/v1/families/other-family/people", "owner")).status).toBe(404);
  });

  it.each(["owner", "admin"])("allows %s to list and revoke pending invitations", async (role) => {
    expect((await request("/v1/families/family-1/invitations", role)).status).toBe(200);
    expect((await request("/v1/families/family-1/invitations/invite-1", role, "DELETE")).status).toBe(200);
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

  it.each(["editor", "viewer"])("denies %s identity-claim review and unlink", async (role) => {
    expect((await request("/v1/families/family-1/identity-claims/claim-1/review", role, "POST", { decision: "reject" })).status).toBe(403);
    expect((await request("/v1/families/family-1/identity", role, "DELETE", { personId: "person-1" })).status).toBe(403);
  });

  it.each(["owner", "admin"])("allows %s to review a claim and unlink an identity", async (role) => {
    expect((await request("/v1/families/family-1/identity-claims/claim-1/review", role, "POST", { decision: "reject" })).status).toBe(200);
    expect((await request("/v1/families/family-1/identity", role, "DELETE", { personId: "person-1" })).status).toBe(200);
  });

  it("keeps platform administration separate from family membership", async () => {
    expect((await request("/v1/platform/overview", "owner")).status).toBe(403);
    expect((await request("/v1/platform/families/family-1/support-access", "owner", "POST", {
      reason: "Approved support investigation",
    })).status).toBe(403);
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

  it("allows Super Admin imports only with a reason and a platform audit path", async () => {
    const path="/v1/families/family-1/import",payload={confirmed:true,confirmDeceasedRecords:true,people:[]};
    expect((await request(path, null, "POST", payload, true, 1, true)).status).toBe(400);
    expect((await request(path, null, "POST", {...payload,reason:"Authorized family restoration"}, true, 1, true)).status).toBe(200);
  });
});
