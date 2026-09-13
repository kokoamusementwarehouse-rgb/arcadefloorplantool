import { MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { DragEvent, useEffect, useMemo, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { MachineLibraryItem } from "./MachineLibraryItem";
import { useFloorPlanStore } from "../../store/floorPlanStore";
import { cacheGlobalState, loadGlobalState } from "../../lib/floor-plan/persistence";
import { revealMachineVisualCard } from "../../lib/floor-plan/navigation";
import { getSupabaseClient } from "../../lib/supabase/client";

type CatalogDraft = {
  name: string;
  category: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  imageUrl: string | null;
  model?: string;
  notes?: string;
  machineCode?: string;
};

const normalizedModelName = (value: string) => value.trim().toLocaleLowerCase();

export function MachineLibrary() {
  const [query, setQuery] = useState(""); const [filter, setFilter] = useState("All"); const [category, setCategory] = useState("All types"); const [libraryWidth, setLibraryWidth] = useState(280);
  const [addOpen, setAddOpen] = useState(false); const [createOpen, setCreateOpen] = useState(false); const [catalogMachineId, setCatalogMachineId] = useState("");
  const [duplicateDraft, setDuplicateDraft] = useState<{ input: CatalogDraft; addToVenue: boolean } | null>(null);
  const { venueMachines, machines, layoutMachines, selectedMachineId, setSelectedMachineId, venue, selectedVenueMachineIds, toggleVenueMachineSelection, transferBuffers, moveSelectedToBuffer, moveBufferItemsToVenue, hydrateGlobal, hasHydrated, setHasHydrated, addVenueMachine, createCatalogMachine, updateMachineCode, updateMachineCategory, setFeedback, feedback, deleteVenueMachines } = useFloorPlanStore();
  const [bufferDropCount, setBufferDropCount] = useState(0);
  useEffect(() => { const saved = Number(localStorage.getItem("machine-library-width")); const width = Number.isFinite(saved) ? Math.min(420, Math.max(220, saved)) : 280; setLibraryWidth(width); document.documentElement.style.setProperty("--library-width", `${width}px`); }, []);
  const resizeLibrary = (event: ReactPointerEvent<HTMLDivElement>) => { event.preventDefault(); const startX = event.clientX; const startWidth = libraryWidth; let currentWidth = startWidth; const move = (moveEvent: PointerEvent) => { currentWidth = Math.min(420, Math.max(220, startWidth + moveEvent.clientX - startX)); setLibraryWidth(currentWidth); document.documentElement.style.setProperty("--library-width", `${currentWidth}px`); }; const stop = () => { localStorage.setItem("machine-library-width", String(currentWidth)); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", stop); }; window.addEventListener("pointermove", move); window.addEventListener("pointerup", stop); };
  /** Cloud snapshot (or offline cache fallback) is read-only hydration. It never writes back. */
  useEffect(() => { let cancelled = false; void (async () => {
    try {
      const loaded = await loadGlobalState();
      if (cancelled || !loaded) return;
      hydrateGlobal(loaded.value, loaded.source === "cloud" ? "CLOUD_HYDRATION" : "CACHE_RESTORE");
      if (loaded.source === "cloud") await cacheGlobalState(loaded.value);
      else setFeedback("Cloud workspace is unavailable. Showing cached data only.");
    } catch (error) {
      console.error("[cloud-hydration] workspace load failed", error);
      if (!cancelled) setFeedback("Cloud workspace could not be loaded.");
    } finally {
      if (!cancelled) setHasHydrated(true);
    }
  })(); return () => { cancelled = true; }; }, [hydrateGlobal, setFeedback, setHasHydrated]);
  useEffect(() => {
    const client = getSupabaseClient(); if (!client || !hasHydrated) return;
    let refreshing = false;
    const refreshFromCloud = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const loaded = await loadGlobalState();
        // A realtime event must never promote an offline cache into state.
        if (!loaded || loaded.source !== "cloud") return;
        hydrateGlobal(loaded.value, "REALTIME_REMOTE");
        await cacheGlobalState(loaded.value);
      } catch (error) { console.warn("[cloud-realtime] workspace refresh failed", error); }
      finally { refreshing = false; }
    };
    const channel = client.channel("workspace-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "venues" }, () => { void refreshFromCloud(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "venue_machines" }, () => { void refreshFromCloud(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "catalog_machines" }, () => { void refreshFromCloud(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "transfer_buffers" }, () => { void refreshFromCloud(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "transfer_buffer_items" }, () => { void refreshFromCloud(); })
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [hasHydrated, hydrateGlobal]);
  const categories = useMemo(() => [...new Set(machines.map((machine) => machine.category).filter(Boolean))].sort(), [machines]);
  const selectedCatalogMachine = machines.find((machine) => machine.id === catalogMachineId);
  const entries = useMemo(() => venueMachines.filter((item) => item.venueId === venue.id).map((venueMachine) => ({ venueMachine, machine: machines.find((machine) => machine.id === venueMachine.machineId)! })).filter(({ venueMachine, machine }) => {
    const placed = layoutMachines.some((layoutMachine) => layoutMachine.venueMachineId === venueMachine.id);
    return machine.name.toLowerCase().includes(query.toLowerCase()) && (category === "All types" || machine.category === category) && (filter === "All" || (filter === "Placed" ? placed : !placed));
  }), [venueMachines, machines, layoutMachines, query, filter, category, venue.id]);
  const recentlyReceived = useMemo(() => entries.filter(({ venueMachine }) => Boolean(venueMachine.receivedAt) && !layoutMachines.some((layoutMachine) => layoutMachine.venueMachineId === venueMachine.id)), [entries, layoutMachines]);
  const recentlyTransferred = useMemo(() => entries.filter(({ venueMachine }) => Boolean(venueMachine.transferredAt) && !layoutMachines.some((layoutMachine) => layoutMachine.venueMachineId === venueMachine.id) && !recentlyReceived.some((item) => item.venueMachine.id === venueMachine.id)), [entries, layoutMachines, recentlyReceived]);
  const unplaced = useMemo(() => entries.filter(({ venueMachine }) => !layoutMachines.some((item) => item.venueMachineId === venueMachine.id) && !recentlyTransferred.some((item) => item.venueMachine.id === venueMachine.id) && !recentlyReceived.some((item) => item.venueMachine.id === venueMachine.id)), [entries, layoutMachines, recentlyTransferred, recentlyReceived]);
  const placed = useMemo(() => entries.filter(({ venueMachine }) => layoutMachines.some((item) => item.venueMachineId === venueMachine.id)), [entries, layoutMachines]);
  const renderEntry = ({ venueMachine, machine }: (typeof entries)[number]) => { const isPlaced = layoutMachines.some((item) => item.venueMachineId === venueMachine.id); return <div className="selectable-machine" key={venueMachine.id}><input aria-label={`Select ${venueMachine.machineCode}`} type="checkbox" checked={selectedVenueMachineIds.includes(venueMachine.id)} onChange={() => toggleVenueMachineSelection(venueMachine.id)} /><MachineLibraryItem venueMachine={venueMachine} machine={machine} selected={selectedMachineId === venueMachine.id} placed={isPlaced} onClick={() => { setSelectedMachineId(venueMachine.id); if (isPlaced) revealMachineVisualCard(venueMachine.id); }} />{selectedMachineId === venueMachine.id ? <MachineTypeEditor code={venueMachine.machineCode} category={machine.category} onCommit={(value) => updateMachineCategory(venueMachine.id, value)} /> : null}</div>; };
  const readBufferIds = (event: DragEvent) => (event.dataTransfer.getData("application/x-buffer-machine") || event.dataTransfer.getData("application/x-buffer-group")).split(",").map((id) => id.trim()).filter(Boolean);
  const handleBufferDrop = (event: DragEvent) => { event.preventDefault(); const ids = readBufferIds(event); setBufferDropCount(0); if (ids.length) moveBufferItemsToVenue(ids, venue.id); else setFeedback("Add this machine to the venue first."); };
  return <aside className="side-panel library-panel" style={{ "--library-width": `${libraryWidth}px` } as CSSProperties}><div className="library-resizer" role="separator" aria-label="Resize machine library" aria-orientation="vertical" onPointerDown={resizeLibrary} /><div className="panel-heading"><p className="eyebrow">{venue.name}</p><h2>Venue Machines</h2><span>{venueMachines.filter((item) => item.venueId === venue.id).length} available</span><button className="icon-button" title="Create new machine" aria-label="Create new machine" onClick={() => { setCreateOpen(true); setAddOpen(false); }}><Plus size={16} /></button></div>
    <label className="search-field"><MagnifyingGlass size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by machine name..." /></label>
    <div className="machine-filters"><label>Machine type<select aria-label="Machine type filter" value={category} onChange={(event) => setCategory(event.target.value)}><option>All types</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><div className="filter-tabs">{["All", "Unplaced", "Placed"].map((item) => <button key={item} className={filter === item ? "filter-tab filter-tab--active" : "filter-tab"} onClick={() => setFilter(item)}>{item}</button>)}</div></div>
    {selectedVenueMachineIds.length ? <div className="buffer-action"><span>{selectedVenueMachineIds.length} selected</span><select aria-label="Transfer buffer" onChange={(event) => { if (event.target.value) moveSelectedToBuffer(event.target.value); }} defaultValue=""><option value="">Move to buffer…</option>{transferBuffers.map((buffer) => <option key={buffer.id} value={buffer.id}>{buffer.name}</option>)}</select></div> : null}<div className="machine-list">{filter !== "Placed" && recentlyReceived.length ? <section><h3 className="machine-group-heading">Recently Received · {recentlyReceived.length}</h3>{recentlyReceived.map(renderEntry)}</section> : null}{filter !== "Placed" && recentlyTransferred.length ? <section><h3 className="machine-group-heading">Recently Transferred · {recentlyTransferred.length}</h3>{recentlyTransferred.map(renderEntry)}</section> : null}{filter !== "Placed" && unplaced.length ? <section><h3 className="machine-group-heading">Unplaced</h3>{unplaced.map(renderEntry)}</section> : null}{filter !== "Unplaced" && placed.length ? <section><h3 className="machine-group-heading">Placed</h3>{placed.map(renderEntry)}</section> : null}{!entries.length ? <div className="library-empty">No machines match these filters.</div> : null}</div><datalist id="machine-type-options">{categories.map((item) => <option key={item} value={item} />)}</datalist>
    {addOpen ? <div className="venue-dialog" role="dialog" aria-label="Add machine"><h3>Add machine</h3><p>Add a catalog machine to {venue.name}.</p><select aria-label="Catalog machine" value={catalogMachineId} onChange={(event) => setCatalogMachineId(event.target.value)}>{machines.map((machine) => <option key={machine.id} value={machine.id}>{machine.name} · {machine.category} · {machine.widthMm} × {machine.depthMm} mm{machine.model ? ` · ${machine.model}` : ""}</option>)}</select>{selectedCatalogMachine ? <div className="catalog-picker-preview">{selectedCatalogMachine.imageUrl ? <img src={selectedCatalogMachine.imageUrl} alt="" /> : null}<span><strong>{selectedCatalogMachine.name}</strong><small>{selectedCatalogMachine.category} · {selectedCatalogMachine.widthMm} × {selectedCatalogMachine.depthMm} mm{selectedCatalogMachine.model ? ` · ${selectedCatalogMachine.model}` : ""}</small></span></div> : null}<div className="venue-dialog-actions"><button onClick={() => { setAddOpen(false); setCreateOpen(true); }}>Create new</button><button onClick={() => setAddOpen(false)}>Cancel</button><button className="primary-action" disabled={!catalogMachineId} onClick={() => { addVenueMachine(catalogMachineId); setAddOpen(false); }}>Add machine</button></div></div> : null}{createOpen ? <CatalogCreateDialog categories={categories} onCancel={() => setCreateOpen(false)} onSave={(input, addToVenue) => { const matches = machines.filter((machine) => normalizedModelName(machine.name) === normalizedModelName(input.name)); if (matches.length) { setDuplicateDraft({ input, addToVenue }); return; } createCatalogMachine(input, addToVenue, input.machineCode); setCreateOpen(false); }} /> : null}{duplicateDraft ? <ExistingModelDialog matches={machines.filter((machine) => normalizedModelName(machine.name) === normalizedModelName(duplicateDraft.input.name))} addToVenue={duplicateDraft.addToVenue} onCancel={() => setDuplicateDraft(null)} onUseExisting={(machine) => { if (duplicateDraft.addToVenue) addVenueMachine(machine.id, duplicateDraft.input.machineCode); else setFeedback(`${machine.name} is already available in Machine Catalog.`); setDuplicateDraft(null); setCreateOpen(false); }} onCreateDifferent={() => { createCatalogMachine(duplicateDraft.input, duplicateDraft.addToVenue, duplicateDraft.input.machineCode); setDuplicateDraft(null); setCreateOpen(false); }} /> : null}
    <div className={`machine-drop-target ${bufferDropCount ? "machine-drop-target--active" : ""} ${feedback?.startsWith("Transfer cancelled") ? "machine-drop-target--invalid" : ""}`} onDragOver={(event) => { if (event.dataTransfer.types.includes("application/x-buffer-machine") || event.dataTransfer.types.includes("application/x-buffer-group")) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setBufferDropCount(1); } }} onDragLeave={() => setBufferDropCount(0)} onDrop={handleBufferDrop}>{bufferDropCount ? <span>Drop machines here — They will be added as Unplaced</span> : feedback?.startsWith("Transfer cancelled") ? <span>Transfer unavailable — resolve the conflict before dropping</span> : null}</div>
    {selectedVenueMachineIds.length ? <div className="machine-delete-actions"><span>{selectedVenueMachineIds.length} selected</span><button className="destructive-action" onClick={() => { if (window.confirm(`Delete ${selectedVenueMachineIds.length} machines?\n\nPlaced machines will also be removed from the Floor Plan.`)) deleteVenueMachines(selectedVenueMachineIds); }}>Delete Selected</button></div> : null}
  </aside>;
}
function MachineTypeEditor({ code, category, onCommit }: { code: string; category: string; onCommit: (value: string) => void }) { const [value, setValue] = useState(category); useEffect(() => setValue(category), [category]); return <label className="machine-type-editor">Type<input aria-label={`${code} machine type`} value={value} list="machine-type-options" onChange={(event) => setValue(event.target.value)} onBlur={() => onCommit(value)} /></label>; }
function CatalogCreateDialog({ categories, onCancel, onSave }: { categories: string[]; onCancel: () => void; onSave: (input: { name: string; category: string; widthMm: number; depthMm: number; heightMm: number; imageUrl: string | null; model?: string; notes?: string; machineCode?: string }, addToVenue: boolean) => void }) { const [name,setName]=useState(""); const [type,setType]=useState(""); const [width,setWidth]=useState(""); const [depth,setDepth]=useState(""); const [height,setHeight]=useState(""); const [code,setCode]=useState(""); const [image,setImage]=useState<string | null>(null); const [error,setError]=useState(""); const upload=(file?:File)=>{if(!file)return;if(!["image/png","image/jpeg","image/webp"].includes(file.type)){setError("Use PNG, JPG, JPEG or WebP.");return;}const reader=new FileReader();reader.onerror=()=>setError("This image could not be read.");reader.onload=()=>{setImage(String(reader.result));setError("");};reader.readAsDataURL(file);}; const save=(add:boolean)=>{const w=Number(width),d=Number(depth),h=Number(height);if(!name.trim()||!type.trim()||!Number.isFinite(w)||w<=0||!Number.isFinite(d)||d<=0||!Number.isFinite(h)||h<=0){setError("Name, Type, Width, Depth and Height are required.");return;}onSave({name:name.trim(),category:type.trim(),widthMm:w,depthMm:d,heightMm:h,imageUrl:image,machineCode:code.trim()||undefined},add);}; return <div className="venue-dialog catalog-dialog" role="dialog" aria-label="Create catalog machine"><h3>Create catalog machine</h3><input aria-label="Machine name" placeholder="Machine Name" value={name} onChange={e=>setName(e.target.value)} maxLength={80}/><input aria-label="Machine type" placeholder="Machine Type" list="catalog-types" value={type} onChange={e=>setType(e.target.value)}/><datalist id="catalog-types">{categories.map(item=><option key={item} value={item}/>)}</datalist><input aria-label="Machine width" placeholder="Width mm" type="number" value={width} onChange={e=>setWidth(e.target.value)}/><input aria-label="Machine depth" placeholder="Depth mm" type="number" value={depth} onChange={e=>setDepth(e.target.value)}/><input aria-label="Machine height" placeholder="Height mm" type="number" value={height} onChange={e=>setHeight(e.target.value)}/><input aria-label="Machine code" placeholder="Machine Code (optional)" value={code} onChange={e=>setCode(e.target.value)}/><input aria-label="Machine image" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>upload(e.target.files?.[0])}/>{image?<img className="catalog-image-preview" src={image} alt="Machine preview"/>:null}{error?<p>{error}</p>:null}<div><button onClick={onCancel}>Cancel</button><button onClick={()=>save(false)}>Save to Catalog</button><button className="primary-action" onClick={()=>save(true)}>Save & Add</button></div></div>; }

function ExistingModelDialog({ matches, addToVenue, onCancel, onUseExisting, onCreateDifferent }: { matches: { id: string; name: string; category: string; widthMm: number; depthMm: number; imageUrl: string | null; model?: string }[]; addToVenue: boolean; onCancel: () => void; onUseExisting: (machine: { id: string; name: string; category: string; widthMm: number; depthMm: number; imageUrl: string | null; model?: string }) => void; onCreateDifferent: () => void }) {
  const [selectedId, setSelectedId] = useState(matches[0]?.id ?? "");
  const selected = matches.find((machine) => machine.id === selectedId) ?? matches[0];
  const contextLabel = addToVenue ? "Add Another Unit of This Model" : "Use Existing Catalog Model";
  return <div className="venue-dialog catalog-dialog existing-model-dialog" role="dialog" aria-label="Existing catalog model"><h3>Same model already exists</h3><p>Choose the matching catalog model, or create this as a different model. Your draft is kept until you decide.</p><div className="existing-model-list" role="listbox" aria-label="Matching catalog models">{matches.map((machine) => <button key={machine.id} type="button" role="option" aria-selected={selected?.id === machine.id} className={selected?.id === machine.id ? "existing-model-card existing-model-card--selected" : "existing-model-card"} onClick={() => setSelectedId(machine.id)}>{machine.imageUrl ? <img src={machine.imageUrl} alt="" /> : null}<span><strong>{machine.name}</strong><small>{machine.category} · {machine.widthMm} × {machine.depthMm} mm{machine.model ? ` · ${machine.model}` : ""}</small></span></button>)}</div><div><button onClick={onCancel}>Cancel</button><button onClick={onCreateDifferent}>Create as a Different Model</button><button className="primary-action" disabled={!selected} onClick={() => selected && onUseExisting(selected)}>{contextLabel}</button></div></div>;
}
