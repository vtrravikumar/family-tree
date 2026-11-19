import { useMemo, useState } from "react";

type TreePerson = { id:string; display_name:string; life_status:string; birth_date_kind:string; birth_exact_date:string|null; birth_year:number|null; birth_range_start_year:number|null; birth_range_end_year:number|null; birth_original_text:string|null };
type TreeRelationship = { id:string; from_person_id:string; to_person_id:string; relationship_type:string };
type Node = { person:TreePerson; generation:number; x:number; y:number };
type ViewMode = "generation" | "ancestors" | "descendants";
const parentTypes=["biological_parent","adoptive_parent","step_parent"];
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
    // In ancestor mode, include each ancestor's spouse/partner at the same generation.
    if(mode==="ancestors"&&selected){
      let expanded=true;
      while(expanded){expanded=false;for(const edge of spouses){if(visible.has(edge.from_person_id)&&!visible.has(edge.to_person_id)){visible.add(edge.to_person_id);generations.set(edge.to_person_id,generations.get(edge.from_person_id)??-1);expanded=true;}else if(visible.has(edge.to_person_id)&&!visible.has(edge.from_person_id)){visible.add(edge.from_person_id);generations.set(edge.from_person_id,generations.get(edge.to_person_id)??-1);expanded=true;}}}
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
      // Keep spouses adjacent when their relationship exists, while preserving child-centred ordering.
      if(mode==="ancestors")list.sort((a,b)=>{const delta=score(a)-score(b);if(Math.abs(delta)>0.5)return delta;const partner=spouses.find(e=>(e.from_person_id===a.id&&e.to_person_id===b.id)||(e.from_person_id===b.id&&e.to_person_id===a.id));return partner? -1:a.display_name.localeCompare(b.display_name);});
      maxCount=Math.max(maxCount,list.length);
      list.forEach((person,i)=>{const x=42+i*218,y=42+(g-minGeneration)*174;xById.set(person.id,x+80);result.push({person,generation:g,x,y});});
    }
    const maxY=Math.max(0,...result.map(n=>n.y));
    return {nodes:result,width:Math.max(350,maxCount*218+20),height:Math.max(210,maxY+145),parents:parents.filter(e=>visible.has(e.from_person_id)&&visible.has(e.to_person_id)),spouses:spouses.filter(e=>visible.has(e.from_person_id)&&visible.has(e.to_person_id)),siblings:siblings.filter(e=>visible.has(e.from_person_id)&&visible.has(e.to_person_id)),visibleCount:visible.size};
  },[people,relationships,mode,selected]);
  const byId=new Map(layout.nodes.map(n=>[n.person.id,n]));
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
      {layout.parents.map(e=>{const a=byId.get(e.from_person_id),b=byId.get(e.to_person_id);if(!a||!b)return null;return <path key={e.id} d={`M ${a.x+80} ${a.y+104} V ${a.y+126} H ${b.x+80} V ${b.y}`} fill="none" stroke="#91a98d" strokeWidth="2"/>;})}
      {layout.spouses.map(e=>{const a=byId.get(e.from_person_id),b=byId.get(e.to_person_id);if(!a||!b)return null;const left=Math.min(a.x,b.x)+80,right=Math.max(a.x,b.x)+80,top=Math.min(a.y,b.y)-12;return <path key={e.id} d={`M ${left} ${Math.min(a.y,b.y)} C ${left} ${top}, ${right} ${top}, ${right} ${Math.min(a.y,b.y)}`} fill="none" stroke="#b58d62" strokeWidth="2.5"/>;})}
      {layout.siblings.map(e=>{const a=byId.get(e.from_person_id),b=byId.get(e.to_person_id);if(!a||!b)return null;const left=Math.min(a.x,b.x)+80,right=Math.max(a.x,b.x)+80,top=Math.min(a.y,b.y)-5;return <path key={e.id} d={`M ${left} ${Math.min(a.y,b.y)+90} C ${left} ${top+80}, ${right} ${top+80}, ${right} ${Math.min(a.y,b.y)+90}`} fill="none" stroke="#9b9bba" strokeWidth="2" strokeDasharray="5 4"/>;})}
      {layout.nodes.map(node=><g key={node.person.id} transform={`translate(${node.x},${node.y})`} onClick={()=>choosePerson(node.person.id)} style={{cursor:"pointer"}}>
        <rect width="160" height="104" rx="9" fill={node.person.life_status==="deceased"?"#f0eee8":"#fffefa"} stroke={selected===node.person.id?"#315b45":"#d9dfd3"} strokeWidth={selected===node.person.id?3:1.5}/>
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
