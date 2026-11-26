import { describe, expect, it } from "vitest";
import { cleanupQueuedPersonPhotoObjects, handlePersonPhoto } from "./person-photos";

function setup(role="owner", lifeStatus="alive", linkedPhoto:string|null=null) {
  const writes:string[]=[];
  const objects=new Map<string,Uint8Array>();
  const db={
    prepare(sql:string){
      let values:unknown[]=[];
      const statement={
        bind(...args:unknown[]){values=args;return statement;},
        async first(){
          if(sql.includes("SELECT id,life_status FROM persons"))return {id:"person-1",life_status:lifeStatus};
          if(sql.includes("SELECT id,object_key FROM media"))return null;
          if(sql.includes("SELECT id,content_type,byte_size,created_at FROM media"))return null;
          if(sql.includes("SELECT u.avatar_url"))return linkedPhoto?{avatar_url:linkedPhoto}:null;
          return null;
        },
        async run(){writes.push(sql);return {meta:{changes:1}};}
      };
      return statement;
    }
  } as unknown as D1Database;
  const bucket={
    async put(key:string,value:ArrayBuffer|ArrayBufferView){objects.set(key,new Uint8Array(value instanceof ArrayBuffer?value:value.buffer.slice(value.byteOffset,value.byteOffset+value.byteLength)));},
    async get(key:string){const value=objects.get(key);return value?{body:new Blob([value]).stream()}:null;},
    async delete(key:string){objects.delete(key);}
  } as unknown as R2Bucket;
  const env={DB:db,PERSON_PHOTOS:bucket};
  const call=(method:string,path="/photo",body?:BodyInit,headers?:HeadersInit)=>handlePersonPhoto(
    new Request("https://api.test/v1/families/family-1/people/person-1"+path,{method,body,headers}),
    env,"family-1","person-1","user-1",role
  );
  return {call,objects,writes};
}

const jpeg=new Uint8Array([0xff,0xd8,0xff,0xe0,0,0,0,0,0xff,0xd9]);

describe("private person portraits",()=>{
  it("allows family members to read metadata and uses only an approved linked identity photo",async()=>{
    const {call}=setup("viewer","alive","https://lh3.googleusercontent.com/avatar");
    const result=await call("GET");
    const payload=await result.json() as {data:{displaySource:string;googlePhotoUrl:string}};
    expect(result.status).toBe(200);
    expect(payload.data.displaySource).toBe("google");
    expect(payload.data.googlePhotoUrl).toBe("https://lh3.googleusercontent.com/avatar");
  });

  it.each(["owner","admin","editor"])("%s can upload a validated family portrait",async(role)=>{
    const {call,objects}=setup(role);
    const form=new FormData();form.set("photo",new File([jpeg],"my-private-filename.jpg",{type:"image/jpeg"}));
    const result=await call("POST","/photo",form);
    expect(result.status).toBe(201);
    expect(objects.size).toBe(1);
    const [objectKey]=[...objects.keys()];
    expect(objectKey).toMatch(/^families\/family-1\/persons\/person-1\/portraits\/[0-9a-f-]{36}$/);
    expect(objectKey).not.toContain("my-private-filename");
  });

  it("does not expose a Google photo when there is no approved identity link",async()=>{
    const {call}=setup("viewer","alive",null);
    const result=await call("GET");
    const payload=await result.json() as {data:{displaySource:string;googlePhotoUrl:string|null}};
    expect(result.status).toBe(200);
    expect(payload.data.displaySource).toBe("initials");
    expect(payload.data.googlePhotoUrl).toBeNull();
  });

  it("rejects cross-family person identifiers",async()=>{
    const db={prepare(sql:string){const statement={bind(){return statement;},async first(){return null;}};return statement;}} as unknown as D1Database;
    const env={DB:db,PERSON_PHOTOS:{} as R2Bucket};
    const result=await handlePersonPhoto(new Request("https://api.test/v1/families/family-1/people/foreign-person/photo",{method:"GET"}),env,"family-1","foreign-person","user-1","viewer");
    expect(result.status).toBe(404);
  });

  it("fails closed when the environment has no private photo bucket",async()=>{
    const {call}=setup();
    const result=await handlePersonPhoto(new Request("https://api.test/v1/families/family-1/people/person-1/photo",{method:"GET"}),{DB:(null as unknown as D1Database)},"family-1","person-1","user-1","owner");
    expect(result.status).toBe(500);
  });

  it("blocks viewer mutations",async()=>{
    const {call}=setup("viewer");
    const form=new FormData();form.set("photo",new File([jpeg],"portrait.jpg",{type:"image/jpeg"}));
    expect((await call("POST","/photo",form)).status).toBe(403);
  });

  it("keeps deceased portraits immutable for every role",async()=>{
    const {call}=setup("owner","deceased");
    const form=new FormData();form.set("photo",new File([jpeg],"portrait.jpg",{type:"image/jpeg"}));
    expect((await call("POST","/photo",form)).status).toBe(409);
    expect((await call("DELETE")).status).toBe(409);
  });

  it("rejects spoofed MIME types and invalid image signatures",async()=>{
    const {call}=setup();
    const form=new FormData();form.set("photo",new File(["not an image"],"portrait.jpg",{type:"image/jpeg"}));
    expect((await call("POST","/photo",form)).status).toBe(415);
  });

  it("rejects uploads larger than five MiB",async()=>{
    const {call}=setup();
    const form=new FormData();form.set("photo",new File([new Uint8Array(5*1024*1024+1)],"large.jpg",{type:"image/jpeg"}));
    expect((await call("POST","/photo",form)).status).toBe(413);
  });


  it("rejects animated WebP and truncated VP8X headers",async()=>{
    const animated=new Uint8Array(24);
    animated.set(new TextEncoder().encode("RIFF"),0);
    animated.set(new TextEncoder().encode("WEBP"),8);
    animated.set(new TextEncoder().encode("VP8X"),12);
    animated[20]=0x02;
    const {call}=setup();
    const animatedForm=new FormData();
    animatedForm.set("photo",new File([animated],"animated.webp",{type:"image/webp"}));
    expect((await call("POST","/photo",animatedForm)).status).toBe(415);

    const truncated=animated.slice(0,20);
    truncated[20-1]=0;
    const truncatedForm=new FormData();
    truncatedForm.set("photo",new File([truncated],"truncated.webp",{type:"image/webp"}));
    expect((await call("POST","/photo",truncatedForm)).status).toBe(415);
  });

  it("does not disclose photos to non-members",async()=>{
    const {call}=setup(null as unknown as string);
    expect((await call("GET","/photo/content")).status).toBe(404);
  });
});


describe("portrait object cleanup retries",()=>{
  it("retains failed R2 deletions and removes the queue row after a successful retry",async()=>{
    const pending=[{object_key:"families/f1/persons/p1/portraits/object-1"}];
    let shouldFail=true;
    let attempts=0;
    const db={
      prepare(sql:string){
        let values:unknown[]=[];
        const statement={
          bind(...args:unknown[]){values=args;return statement;},
          async all(){return {results:pending.map(item=>({...item}))};},
          async run(){
            if(sql.startsWith("UPDATE person_photo_cleanup")){attempts++;return {meta:{changes:1}};}
            if(sql.startsWith("DELETE FROM person_photo_cleanup")){
              const index=pending.findIndex(item=>item.object_key===values[0]);
              if(index>=0)pending.splice(index,1);
              return {meta:{changes:index>=0?1:0}};
            }
            return {meta:{changes:1}};
          }
        };
        return statement;
      }
    } as unknown as D1Database;
    const bucket={async delete(){if(shouldFail)throw new Error("simulated R2 outage");}} as unknown as R2Bucket;

    expect(await cleanupQueuedPersonPhotoObjects(db,bucket,10)).toBe(0);
    expect(pending).toHaveLength(1);
    expect(attempts).toBe(1);

    shouldFail=false;
    expect(await cleanupQueuedPersonPhotoObjects(db,bucket,10)).toBe(1);
    expect(pending).toHaveLength(0);
    expect(attempts).toBe(1);
  });
});
