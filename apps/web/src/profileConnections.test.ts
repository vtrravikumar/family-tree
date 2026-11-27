import { describe, expect, it } from "vitest";
import { getProfileConnectionGroups } from "./profileConnections";
const people = [
 { id:"ravi", display_name:"Ravi", gender:"male" }, { id:"father", display_name:"Ravi's father", gender:"male" },
 { id:"mother", display_name:"Ravi's mother", gender:"female" }, { id:"adoptive", display_name:"Adoptive parent", gender:"unspecified" },
 { id:"step", display_name:"Step-mother", gender:"female" }, { id:"son", display_name:"Ravi's son", gender:"male" },
 { id:"adopted", display_name:"Adopted child", gender:"unspecified" }, { id:"stepchild", display_name:"Step-child", gender:"unspecified" },
 { id:"wife", display_name:"Ravi's wife", gender:"female" }, { id:"partner", display_name:"Ravi's partner", gender:"unspecified" },
 { id:"brother", display_name:"Ravi's brother", gender:"male" },
];
const relationships = [
 { id:"bio-father", from_person_id:"father", to_person_id:"ravi", from_name:"Ravi's father", to_name:"Ravi", relationship_type:"biological_parent" },
 { id:"bio-mother", from_person_id:"mother", to_person_id:"ravi", from_name:"Ravi's mother", to_name:"Ravi", relationship_type:"biological_parent" },
 { id:"adoptive-parent", from_person_id:"adoptive", to_person_id:"ravi", from_name:"Adoptive parent", to_name:"Ravi", relationship_type:"adoptive_parent" },
 { id:"step-parent", from_person_id:"step", to_person_id:"ravi", from_name:"Step-mother", to_name:"Ravi", relationship_type:"step_parent" },
 { id:"bio-child", from_person_id:"ravi", to_person_id:"son", from_name:"Ravi", to_name:"Ravi's son", relationship_type:"biological_parent" },
 { id:"adopted-child", from_person_id:"ravi", to_person_id:"adopted", from_name:"Ravi", to_name:"Adopted child", relationship_type:"adoptive_parent" },
 { id:"step-child", from_person_id:"ravi", to_person_id:"stepchild", from_name:"Ravi", to_name:"Step-child", relationship_type:"step_parent" },
 { id:"spouse", from_person_id:"ravi", to_person_id:"wife", from_name:"Ravi", to_name:"Ravi's wife", relationship_type:"spouse" },
 { id:"partner", from_person_id:"partner", to_person_id:"ravi", from_name:"Ravi's partner", to_name:"Ravi", relationship_type:"partner" },
 { id:"sibling", from_person_id:"brother", to_person_id:"ravi", from_name:"Ravi's brother", to_name:"Ravi", relationship_type:"sibling" },
];
describe("getProfileConnectionGroups", () => {
 it("groups all connections from the focused profile's perspective", () => {
  const groups = getProfileConnectionGroups(people[0], relationships, people);
  expect(groups.map((group) => group.title)).toEqual(["Parents","Spouse","Siblings","Children"]);
  expect(groups[0].connections.map(({label})=>label)).toEqual(["Father","Mother","Adoptive parent","Step-mother"]);
  expect(groups[1].connections.map(({label})=>label)).toEqual(["Spouse","Partner"]);
  expect(groups[2].connections.map(({label})=>label)).toEqual(["Sibling"]);
  expect(groups[3].connections.map(({label})=>label)).toEqual(["Child","Adopted child","Step-child"]);
 });
 it("reverses parent and child perspective when the other profile is opened", () => {
  expect(getProfileConnectionGroups(people[1],relationships,people)).toEqual([{title:"Children",connections:[{id:"bio-father",name:"Ravi",label:"Child"}]}]);
  expect(getProfileConnectionGroups(people[5],relationships,people)).toEqual([{title:"Parents",connections:[{id:"bio-child",name:"Ravi",label:"Father"}]}]);
 });
 it("uses generic Parent for unspecified and non-binary gender", () => {
  const child={id:"child",display_name:"Child",gender:"unspecified"}, parent={id:"parent",display_name:"Parent",gender:"non_binary"};
  const groups=getProfileConnectionGroups(child,[{id:"r",from_person_id:"parent",to_person_id:"child",from_name:"Parent",to_name:"Child",relationship_type:"biological_parent"}],[child,parent]);
  expect(groups[0].connections[0].label).toBe("Parent");
 });
 it("returns no groups when there are no connections", () => {
  expect(getProfileConnectionGroups({id:"alone",display_name:"Alone"},[],[])).toEqual([]);
 });
});
