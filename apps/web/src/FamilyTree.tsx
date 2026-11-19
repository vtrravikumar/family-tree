import { useMemo, useState } from "react";

type TreePerson = { id:string; display_name:string; life_status:string; birth_date_kind:string; birth_year:number|null };
type TreeRelationship = { id:string; from_person_id:string; to_person_id:string; relationship_type:string };
type Node = { person:TreePerson; generation:number; x:number; y:number };

export default function FamilyTree({people,relationships}:{people:TreePerson[];relationships:TreeRelationship[]}) {
  const [zoom,setZoom]=useState(100);
  const [selected,setSelected]=useState<string|null>(null);
  const nodes=useMemo(()=>{
    const parentEdges=relationships.filter(r=>["biological_parent","adoptive_parent","step_parent"].includes(r.relationship_type));
    const generation=new Map(people.map(p=>[p.id,0]));
    for(let pass=0;pass<people.length;pass++){
      let changed=false;
      for(const edge of parentEdges){const next=(generation.get(edge.from_person_id)??0)+1;if(next>(generation.get(edge.to_person_id)??0)){generation.set(edge.to_person_id,next);changed=true;}}
      if(!changed)break;
    }
    const groups=new Map<number,TreePerson[]>();
    for(const p of people){const g=generation.get(p.id)??0;groups.set(g,[...(groups.get(g)??[]),p]);}
    const result:Node[]=[];
    const maxCount=Math.max(1,...[...groups.values()].map(g=>g.length));
    for(const [g,list] of groups){list.forEach((person,i)=>result.push({person,generation:g,x:70+i*230,y:50+g*190}));}
    return {nodes:result,width:Math.max(360,maxCount*230+40),height:Math.max(240,(Math.max(0,...groups.keys())+1)*190+30),parentEdges};
  },[people,relationships]);
  const byId=new Map(nodes.nodes.map(n=>[n.person.id,n]));
  const focused=people.find(p=>p.id===selected);
  if(!people.length)return <div className="tree-empty">Add family members and connect their parent-child relationships to see the generations take shape.</div>;
  return <section className="tree-explorer">
    <div className="tree-toolbar"><div><p className="eyebrow">EXPLORE YOUR HERITAGE</p><h3>Family tree</h3><p className="tree-help">Each generation is arranged independently of the family records.</p></div>
      <div className="tree-controls"><button className="button-secondary" onClick={()=>setZoom(100)}>Fit</button><button className="button-secondary" onClick={()=>setZoom(v=>Math.max(60,v-10))}>−</button><span>{zoom}%</span><button className="button-secondary" onClick={()=>setZoom(v=>Math.min(150,v+10))}>+</button></div>
    </div>
    <div className="tree-viewport"><svg width={nodes.width*zoom/100} height={nodes.height*zoom/100} viewBox={`0 0 ${nodes.width} ${nodes.height}`} role="img" aria-label="Interactive family generation tree">
      {nodes.parentEdges.map(edge=>{const a=byId.get(edge.from_person_id),b=byId.get(edge.to_person_id);if(!a||!b)return null;return <path key={edge.id} d={`M ${a.x+82} ${a.y+104} V ${a.y+135} H ${b.x+82} V ${b.y}`} fill="none" stroke="#9caf96" strokeWidth="2"/>;})}
      {nodes.nodes.map(node=><g key={node.person.id} transform={`translate(${node.x},${node.y})`} onClick={()=>setSelected(node.person.id)} style={{cursor:"pointer"}}>
        <rect width="164" height="104" rx="9" fill={node.person.life_status==="deceased"?"#f0eee8":"#fffefa"} stroke={selected===node.person.id?"#315b45":"#d9dfd3"} strokeWidth={selected===node.person.id?3:1.5}/>
        <circle cx="23" cy="25" r="14" fill={node.person.life_status==="deceased"?"#e1ded4":"#e5eee2"}/>
        <text x="23" y="30" textAnchor="middle" fontSize="13" fill="#315b45" fontWeight="600">{node.person.display_name.charAt(0).toUpperCase()}</text>
        <text x="13" y="58" fontSize="12" fontWeight="600" fill="#29382f">{node.person.display_name.length>20?node.person.display_name.slice(0,18)+"…":node.person.display_name}</text>
        <text x="13" y="78" fontSize="10" fill="#747c72">{node.person.birth_year?((node.person.birth_date_kind==="approximate_year"?"c. ":"")+node.person.birth_year):"Birth year unknown"}</text>
        <text x="13" y="93" fontSize="9" fill={node.person.life_status==="deceased"?"#77776e":"#477454"}>{node.person.life_status==="deceased"?"DECEASED":"LIVING"}</text>
      </g>)}
    </svg></div>
    {focused&&<div className="tree-person-detail"><strong>{focused.display_name}</strong><span>{focused.life_status==="deceased"?"Deceased":"Living"} · {focused.birth_year?focused.birth_year:"Birth date unknown"}</span><button className="button-secondary" onClick={()=>setSelected(null)}>Close details</button></div>}
  </section>;
}
