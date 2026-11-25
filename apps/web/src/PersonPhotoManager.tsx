import { useEffect,useState } from "react";
const API=import.meta.env.VITE_API_URL||"https://api-dev.vtrrk.in";
type Props={familyId:string;personId:string;displayName:string;role:string;lifeStatus:string;familyPhotoUrl?:string|null;googlePhotoUrl?:string|null;onChanged:()=>void};
async function resizePortrait(file:File):Promise<File>{
  const bitmap=await createImageBitmap(file);
  const scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement("canvas");
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));
  canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const context=canvas.getContext("2d");
  if(!context)throw new Error("Your browser could not prepare this image.");
  context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  const type=file.type==="image/png"?"image/png":file.type==="image/webp"?"image/webp":"image/jpeg";
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error("Image resize failed.")),type,.86));
  return new File([blob],type==="image/png"?"portrait.png":type==="image/webp"?"portrait.webp":"portrait.jpg",{type});
}
export default function PersonPhotoManager(props:Props){
  const {familyId,personId,displayName,role,lifeStatus,familyPhotoUrl,googlePhotoUrl,onChanged}=props;
  const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const canManage=["owner","admin","editor"].includes(role)&&lifeStatus!=="deceased";
  useEffect(()=>{if(!file){setPreview("");return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
  const current=familyPhotoUrl?(API+familyPhotoUrl):(googlePhotoUrl||"");
  async function upload(){
    if(!file)return;
    setBusy(true);setError("");setNotice("");
    try{
      const resized=await resizePortrait(file);
      if(resized.size>5*1024*1024)throw new Error("The resized portrait must be 5 MiB or smaller.");
      const form=new FormData();form.set("photo",resized);
      const result=await fetch(API+"/v1/families/"+familyId+"/people/"+personId+"/photo",{method:"POST",credentials:"include",body:form});
      const payload=await result.json();
      if(!result.ok)throw new Error(payload?.error?.message||"Portrait upload failed.");
      setFile(null);setNotice("Family portrait saved.");onChanged();
    }catch(e){setError(e instanceof Error?e.message:"Portrait upload failed.");}
    finally{setBusy(false);}
  }
  async function remove(){
    if(!window.confirm("Remove the family portrait for "+displayName+"? The linked Google photo or initials will be shown instead."))return;
    setBusy(true);setError("");setNotice("");
    try{
      const result=await fetch(API+"/v1/families/"+familyId+"/people/"+personId+"/photo",{method:"DELETE",credentials:"include"});
      const payload=await result.json();if(!result.ok)throw new Error(payload?.error?.message||"Portrait removal failed.");
      setFile(null);setNotice("Family portrait removed.");onChanged();
    }catch(e){setError(e instanceof Error?e.message:"Portrait removal failed.");}
    finally{setBusy(false);}
  }
  return <section className="person-photo-manager" aria-label={"Portrait for "+displayName}>
    <div className="person-photo-preview">{(preview||current)?<img src={preview||current} alt={displayName+" portrait"} crossOrigin="use-credentials" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.style.display="none";}}/>:<span>{displayName.trim().charAt(0).toUpperCase()}</span>}</div>
    <div className="person-photo-controls"><strong>Portrait</strong><small>{familyPhotoUrl?"Family portrait":googlePhotoUrl?"Google profile photo":"Initials avatar"}{familyPhotoUrl&&googlePhotoUrl?" · Google photo linked":""}</small>
      {lifeStatus==="deceased"?<small>This portrait is locked because this person is marked deceased.</small>:canManage?<><label className="button-secondary person-photo-choose"> {familyPhotoUrl?"Choose replacement":"Upload family portrait"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{const selected=e.currentTarget.files?.[0]??null;e.currentTarget.value="";setError("");setFile(selected);}}/></label>{file&&<><small>Preview selected · {Math.ceil(file.size/1024)} KiB</small><button type="button" disabled={busy} onClick={()=>void upload()}>{busy?"Saving…":"Save portrait"}</button><button type="button" className="button-secondary" disabled={busy} onClick={()=>setFile(null)}>Cancel</button></>}{familyPhotoUrl&&<button type="button" className="button-secondary" disabled={busy} onClick={()=>void remove()}>Remove family portrait</button>}</>:<small>View only</small>}
      {error&&<p className="message error" role="alert">{error}</p>}{notice&&<p className="message success" role="status">{notice}</p>}
    </div>
  </section>;
}
