import { useMemo, useState } from "react";

type TreePerson = { id:string; display_name:string; life_status:string; birth_date_kind:string; birth_exact_date:string|null; birth_year:number|null; birth_range_start_year:number|null; birth_range_end_year:number|null; birth_original_text:string|null };
type TreeRelationship = { id:string; from_person_id:string; to_person_id:string; relationship_type:string };
type Node = { person:TreePerson; generation:number; x:number; y:number };
type ViewMode = "generation" | "ancestors" | "descendants";
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

export default function FamilyTree({people,relationships}:{people:TreePerson[];relationships:TreeRelationship[]}) {
  const [zoom,setZoom]=useState(100);
  const [selected,setSelected]=useState<string|null>(null);
  const [mode,setMode]=useState<ViewMode>("generation");
  const [search,setSearch]=useState("");
  const matches=people.filter(p=>search.trim()&&p.display_name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).slice(0,6);
  const layout=useMemo(()=>{
    const parents=relationships.filter(r=>parentTypes.includes(r.relationship_type));
    const spouses=relationships.filter(r=>["spouse","partner"].includes(r.relationship_type));
    const siblings=relationships.filter(r=>r.relationship_type==="sibling");
    let visible=new Set(people.map(p=>p.id));
    let generations=new Map<string,number>();
    if(mode!=="generation"){
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
    const result:Node[]=[];const xById=new Map<string,number>();let maxCount=1;
    const minGeneration=Math.min(0,...groups.keys()),maxGeneration=Math.max(0,...groups.keys());
    const order=mode==="ancestors"?Array.from({length:maxGeneration-minGeneration+1},(_,i)=>maxGeneration-i):Array.from({length:maxGeneration-minGeneration+1},(_,i)=>minGeneration+i);
    for(const g of order){
      const list=groups.get(g)??[];
      const score=(person:TreePerson)=>{
        const related=mode==="ancestors"?parents.filter(e=>e.from_person_id===person.id):parents.filter(e=>e.to_person_id===person.id);
        const xs=related.map(e=>xById.get(mode==="ancestors"?e.to_person_id:e.from_person_id)).filter((x):x is number=>x!==undefined);
        return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:Number.MAX_SAFE_INTEGER;
      };
      list.sort((a,b)=>score(a)-score(b)||a.display_name.localeCompare(b.display_name));
      // Build spouse/partner groups as indivisible visual units. Parent alignment
      // influences where a group sits, never the distance between partners.
      const remaining=new Set(list.map(p=>p.id));
      const groupsOfPartners:Array<TreePerson[]>=[];
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
        groupsOfPartners.push(list.filter(p=>component.has(p.id)));
      }
      const groupScore=(unit:TreePerson[])=>{
        const scores=unit.map(score).filter(v=>v!==Number.MAX_SAFE_INTEGER);
        return scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:Number.MAX_SAFE_INTEGER;
      };
      groupsOfPartners.sort((a,b)=>groupScore(a)-groupScore(b)||a.map(p=>p.display_name).sort()[0].localeCompare(b.map(p=>p.display_name).sort()[0]));
      const orderedList=groupsOfPartners.flatMap(unit=>unit.sort((a,b)=>a.display_name.localeCompare(b.display_name)));
      maxCount=Math.max(maxCount,list.length);
      orderedList.forEach((person,i)=>{const x=42+i*218,y=42+(g-minGeneration)*174;xById.set(person.id,x+80);result.push({person,generation:g,x,y});});
    }
    const maxY=Math.max(0,...result.map(n=>n.y));
    return {nodes:result,width:Math.max(350,maxCount*218+20),height:Math.max(210,maxY+145),parents:parents.filter(e=>visible.has(e.from_person_id)&&visible.has(e.to_person_id)),spouses:mode==="ancestors"?[]:spouses.filter(e=>visible.has(e.from_person_id)&&visible.has(e.to_person_id)),siblings:mode==="ancestors"?[]:siblings.filter(e=>visible.has(e.from_person_id)&&visible.has(e.to_person_id)),visibleCount:visible.size};
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
  const choosePerson=(id:string)=>{setSelected(id);setSearch(people.find(p=>p.id===id)?.display_name??"");};
  if(!people.length)return <div className="tree-empty">Add family members and connect their parent-child relationships to see the generations take shape.</div>;
  return <section className="tree-explorer">
    <div className="tree-toolbar"><div><p className="eyebrow">EXPLORE YOUR HERITAGE</p><h3>Family tree</h3><p className="tree-help">Explore generations, spouses and sibling connections. Select a person to focus a branch.</p></div>
      <div className="tree-controls"><button className="button-secondary" onClick={()=>setZoom(100)}>Fit</button><button className="button-secondary" onClick={()=>setZoom(v=>Math.max(60,v-10))}>−</button><span>{zoom}%</span><button className="button-secondary" onClick={()=>setZoom(v=>Math.min(150,v+10))}>+</button></div>
    </div>
    <div className="tree-view-options"><div className="tree-modes">{(["generation","ancestors","descendants"] as ViewMode[]).map(v=><button key={v} className={mode===v?"tree-mode active":"tree-mode"} onClick={()=>{setMode(v);setZoom(100);}}>{v==="generation"?"All generations":v==="ancestors"?"Ancestors":"Descendants"}</button>)}</div>
      <div className="tree-search"><input aria-label="Search family members" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search a person…"/>{matches.length>0&&<div className="tree-search-results">{matches.map(p=><button key={p.id} onClick={()=>choosePerson(p.id)}>{p.display_name}</button>)}</div>}</div>
    </div>
    {mode!=="generation"&&!selected&&<p className="tree-hint">Search for a person and select them to view their {mode}.</p>}
    <div className="tree-legend"><span><i className="legend-parent"/>Parent / child</span><span><i className="legend-spouse"/>Spouse / partner</span><span><i className="legend-sibling"/>Sibling</span></div>
    <div className="tree-viewport"><svg width={Math.max(1,layout.width*zoom/100)} height={Math.max(1,layout.height*zoom/100)} viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label="Interactive family tree">
      {layout.parents.map(e=>{const a=byId.get(e.from_person_id),b=byId.get(e.to_person_id);if(!a||!b)return null;return <path key={e.id} d={parentConnectorPath(a,b,layout.nodes)} fill="none" stroke={isDirectParentEdge(e.from_person_id,e.to_person_id)?"#477b54":"#91a98d"} strokeWidth={isDirectParentEdge(e.from_person_id,e.to_person_id)?3:2} opacity={!selected||isDirectParentEdge(e.from_person_id,e.to_person_id)?1:0.12}/>;})}
      {layout.spouses.map(e=>{const a=byId.get(e.from_person_id),b=byId.get(e.to_person_id);if(!a||!b)return null;const left=Math.min(a.x,b.x)+80,right=Math.max(a.x,b.x)+80,top=Math.min(a.y,b.y)-12;return <path key={e.id} d={`M ${left} ${Math.min(a.y,b.y)} C ${left} ${top}, ${right} ${top}, ${right} ${Math.min(a.y,b.y)}`} fill="none" stroke={isDirectSpouseEdge(e.from_person_id,e.to_person_id)?"#b87935":"#b58d62"} strokeWidth={isDirectSpouseEdge(e.from_person_id,e.to_person_id)?3.5:2.5} opacity={!selected||isDirectSpouseEdge(e.from_person_id,e.to_person_id)?1:0.12}/>;})}
      {layout.siblings.map(e=>{const a=byId.get(e.from_person_id),b=byId.get(e.to_person_id);if(!a||!b)return null;const leftNode=a.x<=b.x?a:b,rightNode=a.x<=b.x?b:a,top=Math.min(a.y,b.y)+72;return <path key={e.id} d={`M ${leftNode.x+160} ${leftNode.y+94} C ${leftNode.x+178} ${top}, ${rightNode.x-18} ${top}, ${rightNode.x} ${rightNode.y+94}`} fill="none" stroke={isDirectSiblingEdge(e.from_person_id,e.to_person_id)?"#7777a8":"#9b9bba"} strokeWidth={isDirectSiblingEdge(e.from_person_id,e.to_person_id)?3:2} strokeDasharray="5 4" opacity={!selected||isDirectSiblingEdge(e.from_person_id,e.to_person_id)?1:0.12}/>;})}
      {layout.nodes.map(node=><g key={node.person.id} transform={`translate(${node.x},${node.y})`} onClick={()=>choosePerson(node.person.id)} style={{cursor:"pointer",opacity:!highlightActive||firstDegree.has(node.person.id)?1:0.24}}>
        <rect width="160" height="104" rx="9" fill={node.person.life_status==="deceased"?"#f0eee8":"#fffefa"} stroke={selected===node.person.id?"#315b45":highlightActive&&firstDegree.has(node.person.id)?"#6d9b72":"#d9dfd3"} strokeWidth={selected===node.person.id?3.5:highlightActive&&firstDegree.has(node.person.id)?2.5:1.5}/>
        <circle cx="22" cy="24" r="14" fill={node.person.life_status==="deceased"?"#e1ded4":"#e5eee2"}/>
        <text x="22" y="29" textAnchor="middle" fontSize="13" fill="#315b45" fontWeight="600">{node.person.display_name.charAt(0).toUpperCase()}</text>
        <text x="12" y="57" fontSize="12" fontWeight="600" fill="#29382f">{node.person.display_name.length>19?node.person.display_name.slice(0,17)+"…":node.person.display_name}</text>
        <text x="12" y="77" fontSize="10" fill="#747c72">{birthLabel(node.person)}</text>
        <text x="12" y="93" fontSize="9" fill={node.person.life_status==="deceased"?"#77776e":"#477454"}>{node.person.life_status==="deceased"?"DECEASED":"LIVING"}</text>
      </g>)}
    </svg>{layout.nodes.length===0&&<p className="tree-hint">No people in this view yet. Search for a person to focus the branch.</p>}</div>
    {focused&&<div className="tree-person-detail"><strong>{focused.display_name}</strong><span>{focused.life_status==="deceased"?"Deceased":"Living"} · {birthLabel(focused)}</span><button className="button-secondary" onClick={()=>{setSelected(null);setSearch("");}}>Clear focus</button></div>}
  </section>;
}
