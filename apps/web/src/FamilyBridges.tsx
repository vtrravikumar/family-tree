import { useEffect, useState } from "react";

type Family = { id: string; name: string; role: string; accessSource?: "direct" | "bridge" };
type Person = { id: string; display_name: string };
type Bridge = {
  id: string;
  family_a_id: string;
  family_b_id: string;
  initiating_family_id: string;
  anchor_a_person_id: string;
  anchor_b_person_id: string;
  connector_a_person_id: string;
  connector_b_person_id: string;
  status: "pending" | "active" | "rejected" | "revoked";
  family_a_name: string;
  family_b_name: string;
  anchor_a_name: string;
  anchor_b_name: string;
  connector_a_name: string;
  connector_b_name: string;
  initiated_by_user_id: string;
};
type RequestFn = (path: string, method?: string, payload?: unknown) => Promise<unknown>;
type Props = {
  familyId: string;
  role: string;
  accessSource?: "direct" | "bridge";
  families: Family[];
  people: Person[];
  selectedPersonId?: string | null;
  request: RequestFn;
  run: (fn: () => Promise<void>) => void;
  onNavigate: (familyId: string) => void;
  onChanged: () => Promise<void>;
};

export default function FamilyBridges({ familyId, role, accessSource = "direct", families, people, selectedPersonId, request, run, onNavigate, onChanged }: Props) {
  const [bridges, setBridges] = useState<Bridge[]>([]);
  const [destinationFamilyId, setDestinationFamilyId] = useState("");
  const [anchorPersonId, setAnchorPersonId] = useState("");
  const [connectorPersonId, setConnectorPersonId] = useState("");
  const [destinationAnchorPersonId, setDestinationAnchorPersonId] = useState("");
  const [destinationConnectorPersonId, setDestinationConnectorPersonId] = useState("");
  const [destinationPeople, setDestinationPeople] = useState<Person[]>([]);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [loadingDestination, setLoadingDestination] = useState(false);

  const refresh = async () => {
    const result = await request("/v1/families/" + familyId + "/bridges") as { data: Bridge[] };
    setBridges(result.data ?? []);
  };
  useEffect(() => {
    let active = true;
    request("/v1/families/" + familyId + "/bridges").then((result: unknown) => {
      if (active) setBridges((result as { data: Bridge[] }).data ?? []);
    }).catch(() => { if (active) setBridges([]); });
    return () => { active = false; };
  }, [familyId, request]);

  useEffect(() => {
    if (!destinationFamilyId) { setDestinationPeople([]); return; }
    let active = true;
    setLoadingDestination(true);
    request("/v1/families/" + destinationFamilyId + "/people").then((result: unknown) => {
      if (active) setDestinationPeople((result as { data: Person[] }).data ?? []);
    }).catch(() => { if (active) setDestinationPeople([]); }).finally(() => {
      if (active) setLoadingDestination(false);
    });
    return () => { active = false; };
  }, [destinationFamilyId, request]);

  const directFamilies = families.filter(family => family.id !== familyId && family.accessSource !== "bridge");
  const selectedBridges = selectedPersonId ? bridges.filter(bridge => bridge.status === "active" && (
    (bridge.family_a_id === familyId && bridge.anchor_a_person_id === selectedPersonId) ||
    (bridge.family_b_id === familyId && bridge.anchor_b_person_id === selectedPersonId)
  )) : [];
  const canManage = role === "owner" && accessSource !== "bridge";

  return <section className="family-bridges-panel" aria-label="Connected families">
    <div className="family-bridges-heading">
      <div><p className="eyebrow">FAMILY BRIDGES</p><h3>Connected families</h3><p>Visit another family tree without merging the two family workspaces.</p></div>
      {canManage && <button type="button" className="button-secondary" onClick={() => setShowRequestForm(value => !value)}>{showRequestForm ? "Close request" : "＋ Connect a family"}</button>}
    </div>
    {selectedBridges.map(bridge => {
      const isA = bridge.family_a_id === familyId;
      const destinationId = isA ? bridge.family_b_id : bridge.family_a_id;
      const destinationName = isA ? bridge.family_b_name : bridge.family_a_name;
      return <div className="profile-family-bridge" key={bridge.id}>
        <span className="profile-bridge-label">CONNECTED FAMILY</span>
        <button type="button" onClick={() => onNavigate(destinationId)}>{destinationName} ↗</button>
        <small>Open this family's tree in a separate workspace</small>
      </div>;
    })}
    {showRequestForm && canManage && <form className="family-bridge-request" onSubmit={event => {
      event.preventDefault();
      run(async () => {
        await request("/v1/families/" + familyId + "/bridges", "POST", {
          destinationFamilyId, anchorPersonId, connectorPersonId, destinationAnchorPersonId, destinationConnectorPersonId
        });
        setShowRequestForm(false);
        setDestinationFamilyId("");
        setAnchorPersonId("");
        setConnectorPersonId("");
        setDestinationAnchorPersonId("");
        setDestinationConnectorPersonId("");
        await refresh();
        await onChanged();
      });
    }}>
      <p className="helper-text">The destination Owner will approve this connection once. After approval, eligible members can visit without further approval.</p>
      <label>Connect to family</label>
      <select required value={destinationFamilyId} onChange={event => { setDestinationFamilyId(event.target.value); setDestinationAnchorPersonId(""); setDestinationConnectorPersonId(""); }}>
        <option value="">Choose a family you belong to</option>
        {directFamilies.map(family => <option key={family.id} value={family.id}>{family.name} · {family.role}</option>)}
      </select>
      <div className="form-grid two">
        <div><label>Anchor person in this family</label><select required value={anchorPersonId} onChange={event => setAnchorPersonId(event.target.value)}><option value="">Choose person</option>{people.map(person => <option key={person.id} value={person.id}>{person.display_name}</option>)}</select></div>
        <div><label>Marriage connector in this family</label><select required value={connectorPersonId} onChange={event => setConnectorPersonId(event.target.value)}><option value="">Choose person</option>{people.map(person => <option key={person.id} value={person.id}>{person.display_name}</option>)}</select></div>
      </div>
      <div className="form-grid two">
        <div><label>Anchor person in destination family</label><select required disabled={!destinationFamilyId || loadingDestination} value={destinationAnchorPersonId} onChange={event => setDestinationAnchorPersonId(event.target.value)}><option value="">Choose person</option>{destinationPeople.map(person => <option key={person.id} value={person.id}>{person.display_name}</option>)}</select></div>
        <div><label>Marriage connector in destination family</label><select required disabled={!destinationFamilyId || loadingDestination} value={destinationConnectorPersonId} onChange={event => setDestinationConnectorPersonId(event.target.value)}><option value="">Choose person</option>{destinationPeople.map(person => <option key={person.id} value={person.id}>{person.display_name}</option>)}</select></div>
      </div>
      <button type="submit" disabled={!destinationFamilyId || !anchorPersonId || !connectorPersonId || !destinationAnchorPersonId || !destinationConnectorPersonId}>Send connection request</button>
    </form>}
    {bridges.filter(bridge => bridge.status === "pending").map(bridge => {
      const destination = bridge.initiating_family_id !== familyId;
      const familyName = bridge.family_a_id === familyId ? bridge.family_b_name : bridge.family_a_name;
      return <article className="family-bridge-row pending" key={bridge.id}>
        <div><strong>{familyName}</strong><small>{destination ? "Incoming connection request" : "Awaiting destination Owner approval"} · {bridge.anchor_a_name} ↔ {bridge.anchor_b_name}</small></div>
        {destination && canManage && <div className="family-bridge-actions">
          <button type="button" disabled={false} onClick={() => run(async () => { await request("/v1/bridges/" + bridge.id + "/approve", "POST", {}); await refresh(); await onChanged(); })}>Approve</button>
          <button type="button" className="button-secondary" onClick={() => run(async () => { await request("/v1/bridges/" + bridge.id + "/reject", "POST", {}); await refresh(); await onChanged(); })}>Reject</button>
        </div>}
      </article>;
    })}
    {bridges.filter(bridge => bridge.status === "active").map(bridge => {
      const isA = bridge.family_a_id === familyId;
      const destinationId = isA ? bridge.family_b_id : bridge.family_a_id;
      const destinationName = isA ? bridge.family_b_name : bridge.family_a_name;
      const anchorName = isA ? bridge.anchor_a_name : bridge.anchor_b_name;
      return <article className="family-bridge-row" key={bridge.id}>
        <div><strong>{destinationName}</strong><small>Via {anchorName} · Marriage: {bridge.connector_a_name} ↔ {bridge.connector_b_name}</small></div>
        <div className="family-bridge-actions">
          <button type="button" className="button-secondary" onClick={() => onNavigate(destinationId)}>Open family ↗</button>
          {canManage && <button type="button" className="button-secondary" onClick={() => run(async () => {
            if (!window.confirm("Revoke the connection to " + destinationName + "? Members relying only on this bridge will lose access.")) return;
            await request("/v1/bridges/" + bridge.id, "DELETE", { reason: "Revoked by family Owner" });
            await refresh();
            await onChanged();
          })}>Revoke</button>}
        </div>
      </article>;
    })}
    {!bridges.some(bridge => bridge.status === "active" || bridge.status === "pending") && !showRequestForm && <p className="empty-hint">No family bridges yet.</p>}
  </section>;
}
