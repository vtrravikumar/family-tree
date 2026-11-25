const MAX_PERSON_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = {
  "image/jpeg": { extension: "jpg", signature: (b: Uint8Array) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": { extension: "png", signature: (b: Uint8Array) => b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a && !containsBytes(b, [0x61,0x63,0x54,0x4c]) },
  "image/webp": { extension: "webp", signature: (b: Uint8Array) => b.length >= 16 && ascii(b,0,4)==="RIFF" && ascii(b,8,4)==="WEBP" && !(ascii(b,12,4)==="VP8X" && (b[20] & 0x02) !== 0) },
} as const;

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start,start+length));
}
function containsBytes(bytes: Uint8Array, needle: number[]): boolean {
  for(let i=8;i<=bytes.length-needle.length;i++){
    if(needle.every((value,index)=>bytes[i+index]===value))return true;
  }
  return false;
}
const response = (data: unknown, status=200) => Response.json(data,{status,headers:{
  "cache-control":"no-store","x-content-type-options":"nosniff","content-type":"application/json; charset=utf-8"
}});
const error = (status:number,code:string,message:string) => response({error:{code,message}},status);
const uuid = () => crypto.randomUUID();

export interface PersonPhotoEnv {
  DB: D1Database;
  PERSON_PHOTOS?: R2Bucket;
}
export async function handlePersonPhoto(
  request: Request, env: PersonPhotoEnv, familyId: string, personId: string, actorUserId: string, role: string | null
): Promise<Response> {
  if(!role)return error(404,"family_not_found","Family not found.");
  const person=await env.DB.prepare("SELECT id,life_status FROM persons WHERE id=? AND family_id=?")
    .bind(personId,familyId).first<{id:string;life_status:string}>();
  if(!person)return error(404,"person_not_found","That person does not belong to this family.");

  const canMutate=role==="owner"||role==="admin"||role==="editor";
  if(request.method==="GET" && /\/photo\/content$/.test(new URL(request.url).pathname)){
    if(!env.PERSON_PHOTOS)return error(503,"photo_storage_unavailable","Person photo storage is not configured.");
    const media=await env.DB.prepare("SELECT id,object_key,content_type,byte_size FROM media WHERE family_id=? AND person_id=? AND media_type='person_portrait' LIMIT 1")
      .bind(familyId,personId).first<{id:string;object_key:string;content_type:string;byte_size:number}>();
    if(!media)return error(404,"photo_not_found","This person has no family portrait.");
    const object=await env.PERSON_PHOTOS.get(media.object_key);
    if(!object)return error(404,"photo_not_found","This person portrait is unavailable.");
    return new Response(object.body,{headers:{
      "content-type":media.content_type,"content-length":String(media.byte_size),
      "cache-control":"private, no-store","x-content-type-options":"nosniff",
      "content-security-policy":"default-src 'none'; sandbox"
    }});
  }

  if(request.method==="GET"){
    const [portrait,linked]=await Promise.all([
      env.DB.prepare("SELECT id,content_type,byte_size,created_at FROM media WHERE family_id=? AND person_id=? AND media_type='person_portrait' LIMIT 1")
        .bind(familyId,personId).first<{id:string;content_type:string;byte_size:number;created_at:string}>(),
      env.DB.prepare("SELECT u.avatar_url FROM person_identity_links l JOIN users u ON u.id=l.user_id WHERE l.family_id=? AND l.person_id=? LIMIT 1")
        .bind(familyId,personId).first<{avatar_url:string|null}>()
    ]);
    return response({data:{
      familyPortrait:portrait?{id:portrait.id,contentType:portrait.content_type,byteSize:portrait.byte_size,createdAt:portrait.created_at,url:`/v1/families/${familyId}/people/${personId}/photo/content`}:null,
      googlePhotoUrl:linked?.avatar_url??null,
      displaySource:portrait?"family":linked?.avatar_url?"google":"initials",
      canManage:canMutate && person.life_status!=="deceased",
      immutable:person.life_status==="deceased"
    }});
  }

  if(request.method==="POST"){
    if(!canMutate)return error(403,"forbidden","Only Owner, Admin or Editor can manage family portraits.");
    if(person.life_status==="deceased")return error(409,"deceased_portrait_immutable","A deceased person's portrait cannot be changed.");
    if(!env.PERSON_PHOTOS)return error(503,"photo_storage_unavailable","Development person photo storage is not configured.");
    const contentLength=Number(request.headers.get("content-length")??0);
    if(contentLength>MAX_PERSON_PHOTO_BYTES+65536)return error(413,"photo_too_large","Portraits must be 5 MiB or smaller.");
    let form:FormData;
    try{form=await request.formData();}catch{return error(400,"invalid_photo_upload","Upload a JPEG, PNG or WebP image.");}
    const file=form.get("photo") as unknown as File|null;
    if(!file||typeof file==="string"||typeof file.arrayBuffer!=="function")return error(400,"photo_required","Choose a JPEG, PNG or WebP image.");
    if(file.size===0||file.size>MAX_PERSON_PHOTO_BYTES)return error(413,"photo_too_large","Portraits must be between 1 byte and 5 MiB.");
    const bytes=new Uint8Array(await file.arrayBuffer());
    const detected=Object.entries(PHOTO_TYPES).find(([type,rule])=>rule.signature(bytes)&&file.type===type);
    if(!detected)return error(415,"unsupported_photo_type","Only non-animated JPEG, PNG and WebP images are accepted.");
    const [contentType,rule]=detected;
    const old=await env.DB.prepare("SELECT id,object_key FROM media WHERE family_id=? AND person_id=? AND media_type='person_portrait' LIMIT 1")
      .bind(familyId,personId).first<{id:string;object_key:string}>();
    const mediaId=uuid(),objectKey=`families/${familyId}/persons/${personId}/portraits/${uuid()}`,createdAt=new Date().toISOString();
    let dbCommitted=false;
    try{
      await env.PERSON_PHOTOS.put(objectKey,bytes,{httpMetadata:{contentType,cacheControl:"private, no-store"},customMetadata:{mediaId}});
      if(old){
        const updated=await env.DB.prepare("UPDATE media SET object_key=?,content_type=?,byte_size=?,metadata_json=?,uploaded_by_user_id=?,created_at=? WHERE id=? AND family_id=? AND person_id=? AND EXISTS (SELECT 1 FROM persons p WHERE p.id=? AND p.family_id=? AND p.life_status='alive') AND EXISTS (SELECT 1 FROM family_members fm WHERE fm.family_id=? AND fm.user_id=? AND fm.role IN ('owner','admin','editor'))")
          .bind(objectKey,contentType,bytes.byteLength,JSON.stringify({extension:rule.extension}),actorUserId,createdAt,old.id,familyId,personId,personId,familyId,familyId,actorUserId).run();
        if((updated.meta?.changes??0)!==1)throw new Error("photo_update_not_authorized");
        dbCommitted=true;
        await env.PERSON_PHOTOS.delete(old.object_key).catch(()=>undefined);
      }else{
        const inserted=await env.DB.prepare("INSERT INTO media(id,family_id,person_id,object_key,media_type,content_type,byte_size,metadata_json,uploaded_by_user_id,created_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM persons p WHERE p.id=? AND p.family_id=? AND p.life_status='alive') AND EXISTS (SELECT 1 FROM family_members fm WHERE fm.family_id=? AND fm.user_id=? AND fm.role IN ('owner','admin','editor'))")
          .bind(mediaId,familyId,personId,objectKey,"person_portrait",contentType,bytes.byteLength,JSON.stringify({extension:rule.extension}),actorUserId,createdAt,personId,familyId,familyId,actorUserId).run();
        if((inserted.meta?.changes??0)!==1)throw new Error("photo_insert_not_authorized");
        dbCommitted=true;
      }
      await env.DB.prepare("INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,change_summary,created_at) VALUES(?,?,?,?,?,?,?,?)")
        .bind(uuid(),familyId,actorUserId,"person",personId,old?"person.portrait_replaced":"person.portrait_uploaded",JSON.stringify({contentType,byteSize:bytes.byteLength}),createdAt).run().catch(()=>undefined);
      return response({data:{id:old?.id??mediaId,contentType,byteSize:bytes.byteLength,createdAt}},201);
    }catch{
      if(!dbCommitted)await env.PERSON_PHOTOS.delete(objectKey).catch(()=>undefined);
      return error(409,"photo_upload_failed","The portrait could not be saved. Please retry.");
    }
  }

  if(request.method==="DELETE"){
    if(!canMutate)return error(403,"forbidden","Only Owner, Admin or Editor can remove family portraits.");
    if(person.life_status==="deceased")return error(409,"deceased_portrait_immutable","A deceased person's portrait cannot be removed.");
    if(!env.PERSON_PHOTOS)return error(503,"photo_storage_unavailable","Person photo storage is not configured.");
    const media=await env.DB.prepare("SELECT id,object_key FROM media WHERE family_id=? AND person_id=? AND media_type='person_portrait' LIMIT 1")
      .bind(familyId,personId).first<{id:string;object_key:string}>();
    if(!media)return error(404,"photo_not_found","This person has no family portrait.");
    const deleted=await env.DB.prepare("DELETE FROM media WHERE id=? AND family_id=? AND person_id=? AND EXISTS (SELECT 1 FROM persons p WHERE p.id=? AND p.family_id=? AND p.life_status='alive') AND EXISTS (SELECT 1 FROM family_members fm WHERE fm.family_id=? AND fm.user_id=? AND fm.role IN ('owner','admin','editor'))")
      .bind(media.id,familyId,personId,personId,familyId,familyId,actorUserId).run();
    if((deleted.meta?.changes??0)!==1)return error(409,"photo_remove_unavailable","The portrait or your permissions changed. Refresh and retry.");
    await env.PERSON_PHOTOS.delete(media.object_key);
    await env.DB.prepare("INSERT INTO audit_logs(id,family_id,actor_user_id,entity_type,entity_id,action,change_summary,created_at) VALUES(?,?,?,?,?,?,?,?)")
      .bind(uuid(),familyId,actorUserId,"person",personId,"person.portrait_removed","{}",new Date().toISOString()).run();
    return response({data:{removed:true}});
  }
  return error(405,"method_not_allowed","This photo operation is not supported.");
}
