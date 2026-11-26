import { useEffect,useRef,useState } from "react";

const API=import.meta.env.VITE_API_URL||"https://api-dev.vtrrk.in";
const OUTPUT_SIZE=960;
const MAX_UPLOAD_BYTES=5*1024*1024;
type Props={familyId:string;personId:string;displayName:string;role:string;lifeStatus:string;familyPhotoUrl?:string|null;googlePhotoUrl?:string|null;onChanged:()=>void};

function drawCrop(canvas:HTMLCanvasElement,bitmap:ImageBitmap,zoom:number,pan:{x:number;y:number}){
  const context=canvas.getContext("2d");
  if(!context)return;
  const side=Math.min(bitmap.width,bitmap.height)/zoom;
  const left=(bitmap.width-side)/2+pan.x*(bitmap.width-side)/2;
  const top=(bitmap.height-side)/2+pan.y*(bitmap.height-side)/2;
  canvas.width=OUTPUT_SIZE;canvas.height=OUTPUT_SIZE;
  context.clearRect(0,0,OUTPUT_SIZE,OUTPUT_SIZE);
  context.drawImage(bitmap,Math.max(0,Math.min(bitmap.width-side,left)),Math.max(0,Math.min(bitmap.height-side,top)),side,side,0,0,OUTPUT_SIZE,OUTPUT_SIZE);
}

export default function PersonPhotoManager(props:Props){
  const {familyId,personId,displayName,role,lifeStatus,familyPhotoUrl,googlePhotoUrl,onChanged}=props;
  const [file,setFile]=useState<File|null>(null),[bitmap,setBitmap]=useState<ImageBitmap|null>(null);
  const [zoom,setZoom]=useState(1),[pan,setPan]=useState({x:0,y:0});
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const dragRef=useRef<{pointerId:number;x:number;y:number;panX:number;panY:number}|null>(null);
  const canManage=["owner","admin","editor"].includes(role)&&lifeStatus!=="deceased";
  const current=familyPhotoUrl?(API+familyPhotoUrl):(googlePhotoUrl||"");

  useEffect(()=>{
    if(!file){setBitmap(null);return;}
    let active=true;let created:ImageBitmap|null=null;
    createImageBitmap(file).then(value=>{created=value;if(active){setBitmap(value);setZoom(1);setPan({x:0,y:0});}}).catch(()=>setError("This image could not be opened. Try another JPEG, PNG or WebP photo."));
    return()=>{active=false;created?.close();};
  },[file]);

  useEffect(()=>{if(bitmap&&canvasRef.current)drawCrop(canvasRef.current,bitmap,zoom,pan);},[bitmap,zoom,pan]);

  function choosePhoto(selected:File|null){
    setError("");setNotice("");
    if(!selected)return;
    if(!["image/jpeg","image/png","image/webp"].includes(selected.type)){setError("Choose a JPEG, PNG or WebP photograph.");return;}
    if(selected.size>20*1024*1024){setError("Choose a photograph smaller than 20 MiB. It will be optimized before upload.");return;}
    setFile(selected);
  }

  function moveCrop(event:React.PointerEvent<HTMLCanvasElement>){
    const drag=dragRef.current;if(!drag||!bitmap)return;
    const rect=event.currentTarget.getBoundingClientRect();
    const side=Math.min(bitmap.width,bitmap.height)/zoom;
    const nextX=Math.max(-1,Math.min(1,drag.panX+(event.clientX-drag.x)/rect.width*2*bitmap.width/side));
    const nextY=Math.max(-1,Math.min(1,drag.panY+(event.clientY-drag.y)/rect.height*2*bitmap.height/side));
    setPan({x:nextX,y:nextY});
  }

  async function upload(){
    const canvas=canvasRef.current;if(!file||!bitmap||!canvas)return;
    setBusy(true);setError("");setNotice("");
    try{
      const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error("The cropped image could not be prepared.")),"image/jpeg",.88));
      if(blob.size>MAX_UPLOAD_BYTES)throw new Error("The optimized portrait is larger than 5 MiB. Reduce the zoom or choose another image.");
      const optimized=new File([blob],"family-portrait.jpg",{type:"image/jpeg"});
      const form=new FormData();form.set("photo",optimized);
      const result=await fetch(API+"/v1/families/"+familyId+"/people/"+personId+"/photo",{method:"POST",credentials:"include",body:form});
      const payload=await result.json();
      if(!result.ok)throw new Error(payload?.error?.message||"Portrait upload failed.");
      setFile(null);setNotice("Portrait saved. It is now visible in the People directory, profile and family tree.");onChanged();
    }catch(e){setError(e instanceof Error?e.message:"Portrait upload failed.");}
    finally{setBusy(false);}
  }

  async function remove(){
    if(!window.confirm("Remove the family portrait for "+displayName+"? The linked Google photo or initials will be shown instead."))return;
    setBusy(true);setError("");setNotice("");
    try{
      const result=await fetch(API+"/v1/families/"+familyId+"/people/"+personId+"/photo",{method:"DELETE",credentials:"include"});
      const payload=await result.json();if(!result.ok)throw new Error(payload?.error?.message||"Portrait removal failed.");
      setNotice("Family portrait removed.");onChanged();
    }catch(e){setError(e instanceof Error?e.message:"Portrait removal failed.");}
    finally{setBusy(false);}
  }

  return <section className="person-photo-manager" aria-label={"Portrait for "+displayName}>
    <div className="person-photo-heading"><div><p className="eyebrow">FAMILY ARCHIVE</p><h4>Portrait</h4><p>Preserve a photograph in your family story</p></div><span className="person-photo-lock">Private family photo</span></div>
    <div className="person-photo-current">
      <div className="person-photo-preview">{current?<img src={current} alt={displayName+" portrait"} crossOrigin="use-credentials" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.style.display="none";}}/>:<span>{displayName.trim().charAt(0).toUpperCase()}</span>}</div>
      <div className="person-photo-current-copy"><strong>{displayName}</strong><small>{familyPhotoUrl?"Family portrait":googlePhotoUrl?"Linked Google profile photo":"Initials avatar"}</small>{familyPhotoUrl&&googlePhotoUrl&&<small>Google photo remains linked as a fallback</small>}</div>
    </div>
    {lifeStatus==="deceased"?<p className="person-photo-locked">This portrait is preserved and cannot be changed because this person is marked deceased.</p>:canManage?<div className="person-photo-editor">
      {!file?<label className="person-photo-drop"><span className="person-photo-drop-icon">✧</span><strong>{familyPhotoUrl?"Choose a replacement photograph":"Choose a family photograph"}</strong><small>JPEG, PNG or WebP · Up to 20 MiB before optimization</small><span className="person-photo-browse">Browse photographs<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{choosePhoto(e.currentTarget.files?.[0]??null);e.currentTarget.value="";}}/></span></label>:<div className="person-photo-crop">
        <div className="person-photo-crop-top"><div><strong>Adjust your portrait</strong><small>Drag to position · Zoom to frame the face</small></div><button type="button" className="person-photo-text-action" disabled={busy} onClick={()=>{setZoom(1);setPan({x:0,y:0});}}>Reset</button></div>
        <div className="person-photo-crop-stage"><canvas ref={canvasRef} aria-label="Square portrait crop preview" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);dragRef.current={pointerId:e.pointerId,x:e.clientX,y:e.clientY,panX:pan.x,panY:pan.y};}} onPointerMove={moveCrop} onPointerUp={()=>{dragRef.current=null;}} onPointerCancel={()=>{dragRef.current=null;}}/></div>
        <label className="person-photo-zoom"><span>Zoom</span><input type="range" min="1" max="3" step=".01" value={zoom} disabled={busy} onChange={e=>setZoom(Number(e.target.value))}/><output>{zoom.toFixed(1)}×</output></label>
        <div className="person-photo-crop-actions"><button type="button" className="button-secondary" disabled={busy} onClick={()=>setFile(null)}>Choose another</button><button type="button" disabled={busy||!bitmap} onClick={()=>void upload()}>{busy?"Saving portrait…":"Save portrait"}</button></div>
        <small className="person-photo-optimization">Saved as a 960 × 960 optimized JPEG, up to 5 MiB.</small>
      </div>}
      {familyPhotoUrl&&<button type="button" className="person-photo-remove" disabled={busy} onClick={()=>void remove()}>Remove family portrait</button>}
    </div>:<p className="person-photo-locked">You can view this portrait, but only an Owner, Admin or Editor can change it.</p>}
    {error&&<p className="message error" role="alert">{error}</p>}{notice&&<p className="message success" role="status">{notice}</p>}
  </section>;
}
