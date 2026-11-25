import { useEffect, useMemo, useRef, useState } from "react";

type TreePerson = { id:string; display_name:string; gender?:string; life_status:string; birth_date_kind:string; birth_exact_date:string|null; birth_year:number|null; birth_range_start_year:number|null; birth_range_end_year:number|null; birth_original_text:string|null; family_photo_url?:string|null; google_photo_url?:string|null };
type TreeRelationship = { id:string; from_person_id:string; to_person_id:string; relationship_type:string };
type Node = { person:TreePerson; generation:number; x:number; y:number };
type ViewMode = "generation" | "focus" | "ancestors" | "descendants";
const parentTypes=["biological_parent","adoptive_parent","step_parent"];
function parentConnectorPath(a:Node,b:Node,nodes:Node[]):string {
  const sx=a.x+80, sy=a.y+104, tx=b.x+80, ty=b.y;
  if(ty<=sy) return `M ${sx} ${sy} C ${sx} ${sy+18}, ${tx} ${ty-18}, ${tx} ${ty}`;
  const blockers=nodes.filter(n=>n.person.id!==a.person.id&&n.person.id!==b.person.id&&n.y+104>sy+8&&n.y<ty-8&&n.x<Math.max(sx,tx)+80&&n.x+160>Math.min(sx,tx)-80);
  if(!blockers.length) {
    const bend=Math.min(48,(ty-sy)*0.62);
    return `M ${sx} ${sy} C ${sx} ${sy+bend}, ${tx} ${ty-bend}, ${tx} ${ty}`;
  }
  // Take the connector outside the intervening cards, then return above the child.
  const left=Math.min(...blockers.map(n=>n.x))-18;
  const right=Math.max(...blockers.map(n=>n.x+160))+18;
  const gutter=Math.abs(sx-left)+Math.abs(tx-left)<=Math.abs(sx-right)+Math.abs(tx-right)?left:right;
  const top=Math.min(...blockers.map(n=>n.y))-14;
  const bottom=Math.max(...blockers.map(n=>n.y+104))+14;
  const approach=Math.max(sy+14,top);
  const depart=Math.min(ty-14,bottom);
  return `M ${sx} ${sy} C ${sx} ${sy+14}, ${gutter} ${sy+14}, ${gutter} ${approach} L ${gutter} ${depart} C ${gutter} ${ty-14}, ${tx} ${ty-14}, ${tx} ${ty}`;
}
function birthLabel(p:TreePerson){if(p.birth_date_kind==="exact"&&p.birth_exact_date){const [y,m,d]=p.birth_exact_date.split("-").map(Number);return new Date(Date.UTC(y,m-1,d)).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"});}if(p.birth_date_kind==="year"&&p.birth_year)return String(p.birth_year);if(p.birth_date_kind==="approximate_year"&&p.birth_year)return `c. ${p.birth_year}`;if(p.birth_date_kind==="range"&&p.birth_range_start_year&&p.birth_range_end_year)return `${p.birth_range_start_year}–${p.birth_range_end_year}`;return p.birth_original_text||"Birth date unknown";}

export default function FamilyTree({people,relationships,onSelectPerson}:{people:TreePerson[];relationships:TreeRelationship[];onSelectPerson?:(personId:string|null)=>void}) {
  const [zoom,setZoom]=useState(100);
  const [fitPending,setFitPending]=useState(false);
  const [selected,setSelected]=useState<string|null>(null);
  const [mode,setMode]=useState<ViewMode>("generation");
  const [search,setSearch]=useState("");
  const viewportRef=useRef<HTMLDivElement|null>(null);
  const matches=people.filter(p=>search.trim()&&p.display_name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).slice(0,6);
  const layout=useMemo(()=>{
    const parents=relationships.filter(r=>parentTypes.includes(r.relationship_type));
    const spouses=relationships.filter(r=>["spouse","partner"].includes(r.relationship_type));
    const siblings=relationships.filter(r=>r.relationship_type==="sibling");
    let visible=new Set(people.map(p=>p.id));
    let generations=new Map<string,number>();
    if(mode==="focus"){
      visible=new Set(selected?[selected]:[]);
      if(selected){
        generations.set(selected,0);
        for(const edge of parents){
          if(edge.to_person_id===selected){visible.add(edge.from_person_id);generations.set(edge.from_person_id,-1);}
          if(edge.from_person_id===selected){visible.add(edge.to_person_id);generations.set(edge.to_person_id,1);}
        }
        for(const edge of [...spouses,...siblings]){
          if(edge.from_person_id===selected){visible.add(edge.to_person_id);generations.set(edge.to_person_id,0);}
          if(edge.to_person_id===selected){visible.add(edge.from_person_id);generations.set(edge.from_person_id,0);}
        }
      }
    }else if(mode!=="generation"){
      if(selected){
        visible=new Set([selected]);generations.set(selected,0);
        for(let pass=0;pass<people.length;pass++){
          let changed=false;
          for(const edge of parents){
            const from=mode==="ancestors"?edge.to_person_id:edge.from_person_id;
            const to=mode==="ancestors"?edge.from_person_id:edge.to_person_id;
            if(visible.has(from)&&!visible.has(to)){visible.add(to);generations.set(to,(generations.get(from)??0)+(mode==="ancestors"?-1:1));changed=true;}
          }
          if(!changed)break;
        }
      }else visible=new Set();
    }else{
      for(const p of people)generations.set(p.id,0);
      for(let pass=0;pass<people.length;pass++){
        let changed=false;
        for(const edge of parents){const next=(generations.get(edge.from_person_id)??0)+1;if(next>(generations.get(edge.to_person_id)??0)){generations.set(edge.to_person_id,next);changed=true;}}
        if(!changed)break;
      }
    }
    // Ancestor view contains only the selected person and their recorded ancestors.
    // Generation is a shared horizontal band: spouses/partners and siblings
    // must sit at the same height. Parent-child edges then propagate the
    // resulting generation levels through the visible family.
    const generationParent=new Map<string,string>();
    const findGenerationRoot=(id:string):string=>{
      const parent=generationParent.get(id);
      if(!parent){generationParent.set(id,id);return id;}
      if(parent===id)return id;
      const root=findGenerationRoot(parent);generationParent.set(id,root);return root;
    };
    const unionGeneration=(a:string,b:string)=>{
      if(!visible.has(a)||!visible.has(b))return;
      const ra=findGenerationRoot(a),rb=findGenerationRoot(b);
      if(ra!==rb)generationParent.set(rb,ra);
    };
    for(const p of people)if(visible.has(p.id))findGenerationRoot(p.id);
    for(const edge of [...spouses,...siblings])unionGeneration(edge.from_person_id,edge.to_person_id);
    let aligned=false;
    for(let pass=0;pass<people.length*2;pass++){
      aligned=false;
      const bandLevels=new Map<string,number>();
      for(const p of people){if(!visible.has(p.id))continue;const root=findGenerationRoot(p.id);bandLevels.set(root,Math.max(bandLevels.get(root)??Number.MIN_SAFE_INTEGER,generations.get(p.id)??0));}
      for(const p of people){if(!visible.has(p.id))continue;const level=bandLevels.get(findGenerationRoot(p.id))??0;if((generations.get(p.id)??0)!==level){generations.set(p.id,level);aligned=true;}}
      for(const edge of parents){
        if(!visible.has(edge.from_person_id)||!visible.has(edge.to_person_id))continue;
        const next=(generations.get(edge.from_person_id)??0)+1;
        if(next>(generations.get(edge.to_person_id)??0)){generations.set(edge.to_person_id,next);aligned=true;}
      }
      if(!aligned)break;
    }
    const groups=new Map<number,TreePerson[]>();
    for(const p of people){if(!visible.has(p.id))continue;const g=generations.get(p.id)??0;groups.set(g,[...(groups.get(g)??[]),p]);}
    const result:Node[]=[];const xById=new Map<string,number>();
    const minGeneration=Math.min(0,...groups.keys()),maxGeneration=Math.max(0,...groups.keys());
    const order=mode==="ancestors"?Array.from({length:maxGeneration-minGeneration+1},(_,i)=>maxGeneration-i):Array.from({length:maxGeneration-minGeneration+1},(_,i)=>minGeneration+i);
    const rowSpecs:Array<{generation:number;units:TreePerson[][];width:number}>=[];
    let maxRowWidth=160;
    for(const g of order){
      const list=groups.get(g)??[];
      const score=(person:TreePerson)=>{
        const related=mode==="ancestors"?parents.filter(e=>e.from_person_id===person.id):parents.filter(e=>e.to_person_id===person.id);
        const xs=related.map(e=>xById.get(mode==="ancestors"?e.to_person_id:e.from_person_id)).filter((x):x is number=>x!==undefined);
        return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:Number.MAX_SAFE_INTEGER;
      };
      list.sort((a,b)=>score(a)-score(b)||a.display_name.localeCompare(b.display_name));
      // Keep every spouse/partner component together as one compact visual unit.
      const remaining=new Set(list.map(p=>p.id));
      const units:TreePerson[][]=[];
      while(remaining.size){
        const seedId=remaining.values().next().value as string;
        const component=new Set<string>([seedId]);
        const queue=[seedId];
        remaining.delete(seedId);
        while(queue.length){
          const current=queue.shift()!;
          for(const edge of spouses){
            const other=edge.from_person_id===current?edge.to_person_id:edge.to_person_id===current?edge.from_person_id:null;
            if(other&&remaining.has(other)&&list.some(p=>p.id===other)){
              remaining.delete(other);component.add(other);queue.push(other);
            }
          }
        }
        units.push(list.filter(p=>component.has(p.id)));
      }
      const groupScore=(unit:TreePerson[])=>{
        const scores=unit.map(score).filter(v=>v!==Number.MAX_SAFE_INTEGER);
        return scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:Number.MAX_SAFE_INTEGER;
      };
      units.forEach(unit=>unit.sort((a,b)=>a.display_name.localeCompare(b.display_name)));
      units.sort((a,b)=>groupScore(a)-groupScore(b)||a.map(p=>p.display_name).sort()[0].localeCompare(b.map(p=>p.display_name).sort()[0]));
      // Centre the whole spouse group when focusing either partner; never split a couple.
      if(selected){
        const focusIndex=units.findIndex(unit=>unit.some(person=>person.id===selected));
        if(focusIndex>=0){
          const [focusUnit]=units.splice(focusIndex,1);
          units.splice(Math.floor(units.length/2),0,focusUnit);
        }
      }
      const width=units.reduce((sum,unit,index)=>sum+160+Math.max(0,unit.length-1)*174+(index?58:0),0);
      maxRowWidth=Math.max(maxRowWidth,width);
      rowSpecs.push({generation:g,units,width});
    }
    for(const row of rowSpecs){
      let cursor=42+(maxRowWidth-row.width)/2;
      const y=42+(row.generation-minGeneration)*174;
      for(const unit of row.units){
        unit.forEach((person,index)=>{
          const x=cursor+index*174;
          xById.set(person.id,x+80);
          result.push({person,generation:row.generation,x,y});
        });
        cursor+=160+Math.max(0,unit.length-1)*174+58;
      }
    }
    const maxY=Math.max(0,...result.map(n=>n.y));
    return {nodes:result,width:Math.max(350,maxRowWidth+84),height:Math.max(210,maxY+145),parents:parents.filter(e=>visible.has(e.from_person_id)&&visible.has(e.to_person_id)),spouses:mode==="ancestors"?[]:spouses.filter(e=>visible.has(e.from_person_id)&&visible.has(e.to_person_id)),siblings:mode==="ancestors"?[]:siblings.filter(e=>visible.has(e.from_person_id)&&visible.has(e.to_person_id)),visibleCount:visible.size};
  },[people,relationships,mode,selected]);
  const byId=new Map(layout.nodes.map(n=>[n.person.id,n]));
  const firstDegree=new Set<string>();
  if(selected&&mode==="generation"){
    firstDegree.add(selected);
    for(const edge of layout.parents){
      if(edge.from_person_id===selected)firstDegree.add(edge.to_person_id);
      if(edge.to_person_id===selected)firstDegree.add(edge.from_person_id);
    }
    for(const edge of layout.spouses){
      if(edge.from_person_id===selected)firstDegree.add(edge.to_person_id);
      if(edge.to_person_id===selected)firstDegree.add(edge.from_person_id);
    }
    for(const edge of layout.siblings){
      if(edge.from_person_id===selected)firstDegree.add(edge.to_person_id);
      if(edge.to_person_id===selected)firstDegree.add(edge.from_person_id);
    }
  }
  const highlightActive=Boolean(selected&&mode==="generation");
  const isDirectParentEdge=(from:string,to:string)=>!highlightActive||from===selected||to===selected;
  const isDirectSpouseEdge=(from:string,to:string)=>!highlightActive||from===selected||to===selected;
  const isDirectSiblingEdge=(from:string,to:string)=>!highlightActive||from===selected||to===selected;
  const focused=people.find(p=>p.id===selected);
  useEffect(()=>{
    const viewport=viewportRef.current;
    if(!viewport)return;
    if(fitPending){viewport.scrollTo({left:0,top:0,behavior:"smooth"});setFitPending(false);return;}
    if(!selected)return;
    const node=layout.nodes.find(item=>item.person.id===selected);
    if(!node)return;
    const left=(node.x+80)*zoom/100-viewport.clientWidth/2;
    const top=(node.y+52)*zoom/100-viewport.clientHeight/2;
    viewport.scrollTo({left:Math.max(0,left),top:Math.max(0,top),behavior:"smooth"});
  },[selected,layout.nodes,zoom,fitPending]);
  const fitTree=()=>{
    const viewport=viewportRef.current;
    if(!viewport)return;
    const availableWidth=Math.max(1,viewport.clientWidth-36);
    const availableHeight=Math.max(1,viewport.clientHeight-36);
    const scale=Math.min(availableWidth/layout.width,availableHeight/layout.height)*100;
    setFitPending(true);
    setZoom(Math.max(20,Math.min(150,Math.floor(scale))));
  };
  // Apply the initial fit once the viewport has measurable dimensions.
  // Disconnect immediately so later zoom/scrollbar changes cannot overwrite
  // the user's manual zoom level.
  useEffect(()=>{
    const viewport=viewportRef.current;
    if(!viewport||!people.length)return;
    let frame=0;
    const observer=new ResizeObserver(()=>{
      if(frame)cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{
        frame=0;
        if(viewport.clientWidth>0&&viewport.clientHeight>0){
          fitTree();
          observer.disconnect();
        }
      });
    });
    observer.observe(viewport);
    return ()=>{observer.disconnect();if(frame)cancelAnimationFrame(frame);};
  },[people.length]);
  const choosePerson=(id:string)=>{if(selected===id){setSelected(null);setMode("generation");setSearch("");setZoom(100);onSelectPerson?.(null);return;}setSelected(id);setSearch(people.find(p=>p.id===id)?.display_name??"");onSelectPerson?.(id);};
  if(!people.length)return <div className="tree-empty">Add family members and connect their parent-child relationships to see the generations take shape.</div>;
  return <section className="tree-explorer">
    <div className="tree-toolbar"><div><p className="eyebrow">EXPLORE YOUR HERITAGE</p><h3>Family tree</h3><p className="tree-help">Explore generations, spouses and sibling connections. Select a person to focus a branch.</p></div>
      <div className="tree-controls"><button className="button-secondary" onClick={()=>{setMode("generation");setSelected(null);setSearch("");setZoom(100);onSelectPerson?.(null);}}>Reset view</button><button className="button-secondary" onClick={fitTree}>Fit</button><button className="button-secondary" aria-label="Zoom out" onClick={()=>setZoom(v=>Math.max(60,v-10))}>−</button><span aria-live="polite">{zoom}%</span><button className="button-secondary" aria-label="Zoom in" onClick={()=>setZoom(v=>Math.min(150,v+10))}>+</button></div>
    </div>
    <div className="tree-view-options"><div className="tree-modes"><button className={mode==="generation"?"tree-mode active":"tree-mode"} onClick={()=>{setMode("generation");setZoom(100);}}>All generations</button>{selected&&<>{(["focus","ancestors","descendants"] as ViewMode[]).map(v=><button key={v} className={mode===v?"tree-mode active":"tree-mode"} onClick={()=>{setMode(v);setZoom(100);}}>{v==="focus"?"Focus":v==="ancestors"?"Ancestors":"Descendants"}</button>)}<button className="tree-mode tree-clear-focus" onClick={()=>{setSelected(null);setMode("generation");setSearch("");setZoom(100);onSelectPerson?.(null);}} aria-label="Clear focused person">Clear focus</button></>}</div>
      <div className="tree-search"><input aria-label="Search family members" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search a person…"/>{matches.length>0&&<div className="tree-search-results">{matches.map(p=><button key={p.id} onClick={()=>choosePerson(p.id)}>{p.display_name}</button>)}</div>}</div>
    </div>
    {mode!=="generation"&&!selected&&<p className="tree-hint">Search for a person and select them to view their {mode}.</p>}
    <div className="tree-legend"><span><i className="legend-parent"/>Parent / child</span><span><i className="legend-spouse"/>Spouse / partner</span><span><i className="legend-sibling"/>Sibling</span><span><i className="legend-male"/>Male</span><span><i className="legend-female"/>Female</span><span><i className="legend-deceased"/>Deceased · floral memorial</span></div>
    <div ref={viewportRef} className="tree-viewport" role="region" aria-label="Scrollable family tree canvas" tabIndex={0}><svg width={Math.max(1,layout.width*zoom/100)} height={Math.max(1,layout.height*zoom/100)} viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label="Interactive family tree"><defs><radialGradient id="atlas-node-glow"><stop offset="0%" stopColor="#9ef8f4" stopOpacity=".65"/><stop offset="100%" stopColor="#63b9e8" stopOpacity="0"/></radialGradient></defs>
      {layout.parents.map(e=>{const a=byId.get(e.from_person_id),b=byId.get(e.to_person_id);if(!a||!b)return null;return <path key={e.id} d={parentConnectorPath(a,b,layout.nodes)} fill="none" stroke={isDirectParentEdge(e.from_person_id,e.to_person_id)?"#a99863":"#8a9075"} strokeWidth={isDirectParentEdge(e.from_person_id,e.to_person_id)?3:2} opacity={!selected||isDirectParentEdge(e.from_person_id,e.to_person_id)?1:0.12}/>;})}
      {layout.spouses.map(e=>{const a=byId.get(e.from_person_id),b=byId.get(e.to_person_id);if(!a||!b)return null;const left=a.x<=b.x?a:b,right=a.x<=b.x?b:a;const cy=left.y+31;return <path key={e.id} d={`M ${left.x+109} ${cy} C ${left.x+132} ${cy-34}, ${right.x+28} ${cy-34}, ${right.x+51} ${cy}`} fill="none" stroke={isDirectSpouseEdge(e.from_person_id,e.to_person_id)?"#e0bd70":"#a88b4f"} strokeWidth={isDirectSpouseEdge(e.from_person_id,e.to_person_id)?4.5:3} strokeLinecap="round" opacity={!selected||isDirectSpouseEdge(e.from_person_id,e.to_person_id)?1:0.36}/>;})}
      {layout.siblings.map(e=>{const a=byId.get(e.from_person_id),b=byId.get(e.to_person_id);if(!a||!b)return null;const leftNode=a.x<=b.x?a:b,rightNode=a.x<=b.x?b:a;const startY=leftNode.y+108,busY=leftNode.y+126;return <path key={e.id} d={`M ${leftNode.x+80} ${startY} V ${busY} H ${rightNode.x+80} V ${rightNode.y+108}`} fill="none" stroke={isDirectSiblingEdge(e.from_person_id,e.to_person_id)?"#9b9a70":"#888c75"} strokeWidth={isDirectSiblingEdge(e.from_person_id,e.to_person_id)?2.5:2} strokeDasharray="4 4" strokeLinecap="round" opacity={!selected||isDirectSiblingEdge(e.from_person_id,e.to_person_id)?1:0.3}/>;})}
      {layout.nodes.map(node=><g key={node.person.id} transform={`translate(${node.x},${node.y})`} onClick={()=>choosePerson(node.person.id)} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();choosePerson(node.person.id);}}} tabIndex={0} role="button" aria-label={`Select ${node.person.display_name}, ${node.person.life_status}, ${birthLabel(node.person)}`} aria-pressed={selected===node.person.id} style={{cursor:"pointer",opacity:!highlightActive||firstDegree.has(node.person.id)?1:0.24}}>
        <circle cx="80" cy="31" r={selected===node.person.id?36:29} fill="none" stroke={selected===node.person.id?"#d7bd79":node.person.life_status==="deceased"?(node.person.gender==="female"?"#c58da5":node.person.gender==="male"?"#83a9c2":"#a4a5a1"):highlightActive&&firstDegree.has(node.person.id)?"#b59a5c":"#8b9274"} strokeWidth={node.person.life_status==="deceased"?2.2:selected===node.person.id?2.5:1} opacity={selected===node.person.id?1:node.person.life_status==="deceased"?.9:.52}/>
        <circle cx="80" cy="31" r={selected===node.person.id?25:23} fill={node.person.life_status==="deceased"?(node.person.gender==="female"?"#75616d":node.person.gender==="male"?"#5b7180":"#666a6d"):node.person.gender==="female"?"#86566c":node.person.gender==="male"?"#315f80":"#68704e"} stroke={selected===node.person.id?"#f0d99b":"#b8ad7d"} strokeOpacity={selected===node.person.id?1:.35} strokeWidth="1.2"/>
        <circle cx="80" cy="31" r="18" fill="url(#atlas-node-glow)" opacity=".72"/>
         { (node.person.family_photo_url||node.person.google_photo_url) && <defs><clipPath id={`portrait-${node.person.id}`}><circle cx="80" cy="31" r="22"/></clipPath></defs> }
         { (node.person.family_photo_url||node.person.google_photo_url) && <image href={node.person.family_photo_url||node.person.google_photo_url||""} x="58" y="9" width="44" height="44" preserveAspectRatio="xMidYMid slice" clipPath={`url(#portrait-${node.person.id})`} crossOrigin="use-credentials"/> }
        <text x="80" y="36" textAnchor="middle" fontSize="17" fill={node.person.life_status==="deceased"?(node.person.gender==="female"?"#f0dce5":node.person.gender==="male"?"#d8e8f0":"#e0e0dc"):node.person.gender==="female"?"#f5d5e1":node.person.gender==="male"?"#c9e4f3":"#e4d5ad"} fontWeight="700">{(node.person.family_photo_url||node.person.google_photo_url)?"":node.person.gender==="female"?"♀":node.person.gender==="male"?"♂":node.person.display_name.charAt(0).toUpperCase()}</text>
        {node.person.life_status==="deceased"&&<g aria-hidden="true">
          <circle cx="80" cy="31" r="35" fill="none" stroke="#b99a60" strokeWidth="1.15" opacity=".82"/>
          {[[80,-4,"#e8dfc5"],[55,6,"#d4b76f"],[45,31,"#e8dfc5"],[55,56,"#bd8580"],[80,66,"#e8dfc5"],[105,56,"#d4b76f"],[115,31,"#e8dfc5"]].map(([x,y,color],index)=><g key={index} transform={`translate(${x} ${y})`} opacity=".94">
            <circle cx="0" cy="-2.2" r="1.55" fill={color as string}/><circle cx="2.1" cy="0" r="1.55" fill={color as string}/><circle cx="0" cy="2.2" r="1.55" fill={color as string}/><circle cx="-2.1" cy="0" r="1.55" fill={color as string}/><circle r="1" fill="#a77d48"/>
          </g>)}
        </g>}
        {node.person.life_status==="deceased"&&<g><circle cx="101" cy="13" r="8" fill="#73777a" stroke="#d3d4d1" strokeWidth="1"/><text x="101" y="17" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">†</text></g>}
        <text x="80" y="75" textAnchor="middle" fontSize="12" fontWeight="650" fill={selected===node.person.id?"#e4c77e":"#c7ad70"}>{node.person.display_name.length>21?node.person.display_name.slice(0,19)+"…":node.person.display_name}</text>
        <text x="80" y="91" textAnchor="middle" fontSize="10" fill="#7c8069">{birthLabel(node.person)}</text>
        <circle cx="80" cy="101" r="2.4" fill={node.person.life_status==="deceased"?"#a79b7a":"#a9a06a"}/>
      </g>)}
    </svg>{layout.nodes.length===0&&<p className="tree-hint">No people in this view yet. Search for a person to focus the branch.</p>}</div>
  </section>;
}
