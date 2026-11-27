export type ProfileRelationship = {
  id: string; from_person_id: string; to_person_id: string; from_name: string; to_name: string; relationship_type: string;
};
export type ProfilePerson = { id: string; display_name: string; gender?: string | null };
export type ProfileConnectionGroup = {
  title: "Parents" | "Spouse" | "Siblings" | "Children";
  connections: Array<{ id: string; name: string; label: string }>;
};
const parentTypes = ["biological_parent", "adoptive_parent", "step_parent"] as const;
function parentLabel(type: string, gender: string | null | undefined): string {
  const genderLabel = gender === "male" ? "father" : gender === "female" ? "mother" : "parent";
  if (type === "adoptive_parent") return genderLabel === "parent" ? "Adoptive parent" : `Adoptive ${genderLabel}`;
  if (type === "step_parent") return genderLabel === "parent" ? "Step-parent" : `Step-${genderLabel}`;
  return genderLabel === "parent" ? "Parent" : genderLabel[0].toUpperCase() + genderLabel.slice(1);
}
export function getProfileConnectionGroups(profile: ProfilePerson, relationships: ProfileRelationship[], people: ProfilePerson[]): ProfileConnectionGroup[] {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const grouped: Record<ProfileConnectionGroup["title"], ProfileConnectionGroup["connections"]> = { Parents: [], Spouse: [], Siblings: [], Children: [] };
  for (const relationship of relationships) {
    if (relationship.from_person_id !== profile.id && relationship.to_person_id !== profile.id) continue;
    const isFromPerson = relationship.from_person_id === profile.id;
    const relatedId = isFromPerson ? relationship.to_person_id : relationship.from_person_id;
    const related = peopleById.get(relatedId);
    const name = related?.display_name ?? (isFromPerson ? relationship.to_name : relationship.from_name);
    if ((parentTypes as readonly string[]).includes(relationship.relationship_type)) {
      if (isFromPerson) {
        const label = relationship.relationship_type === "adoptive_parent" ? "Adopted child" : relationship.relationship_type === "step_parent" ? "Step-child" : "Child";
        grouped.Children.push({ id: relationship.id, name, label });
      } else {
        grouped.Parents.push({ id: relationship.id, name, label: parentLabel(relationship.relationship_type, related?.gender) });
      }
    } else if (relationship.relationship_type === "spouse" || relationship.relationship_type === "partner") {
      grouped.Spouse.push({ id: relationship.id, name, label: relationship.relationship_type === "partner" ? "Partner" : "Spouse" });
    } else if (relationship.relationship_type === "sibling") {
      grouped.Siblings.push({ id: relationship.id, name, label: "Sibling" });
    }
  }
  return (Object.keys(grouped) as ProfileConnectionGroup["title"][]).filter((title) => grouped[title].length > 0).map((title) => ({ title, connections: grouped[title] }));
}
