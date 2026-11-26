import { describe, expect, it } from "vitest";
import { handlePersonPhoto } from "./person-photos";

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
