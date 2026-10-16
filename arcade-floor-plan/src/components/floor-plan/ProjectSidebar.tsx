import { Buildings, CaretDown, CheckCircle, DotsSixVertical, FolderSimple, Plus, PencilSimple, SidebarSimple, Trash } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { getEffectiveMachineDimensions } from "../../lib/floor-plan/machineDimensions";
import { useFloorPlanStore } from "../../store/floorPlanStore";
import type { VenueType } from "../../types/floorPlan";
import { useShallow } from "zustand/react/shallow";

let draggingBufferDestination: string | null = null;
const venueOrderStorageKey = "floor-plan-venue-order-v1";
const venueTypeOf = (venue: { name: string; venueType?: VenueType }): VenueType => venue.venueType ?? (/warehouse/i.test(venue.name) ? "warehouse" : "store");

function readVenueOrder() {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(venueOrderStorageKey) ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function saveVenueOrder(order: string[]) {
  try {
    localStorage.setItem(venueOrderStorageKey, JSON.stringify(order));
  } catch {
    // Venue ordering remains usable for the current session when storage is unavailable.
  }
}

export function ProjectSidebar() {
  const [collapsed, setCollapsed] = useState(false); const [sidebarWidth, setSidebarWidth] = useState(218); const [createOpen, setCreateOpen] = useState(false); const [venueName, setVenueName] = useState(""); const [newVenueType, setNewVenueType] = useState<VenueType>("store"); const [venueManage, setVenueManage] = useState<{ id: string; name: string; venueType: VenueType } | null>(null); const [batchPrompt, setBatchPrompt] = useState<{ bufferId: string; venueId: string; count: number } | null>(null); const [venueDeletePrompt, setVenueDeletePrompt] = useState<{ id: string; name: string; machineCount: number; placedCount: number; hasFloorPlan: boolean; affectedModelCount: number; orphanCount: number } | null>(null); const [deleteCatalogToo, setDeleteCatalogToo] = useState(false);
  const [venueOrder, setVenueOrder] = useState<string[]>([]);
  const [venueOrderLoaded, setVenueOrderLoaded] = useState(false);
  const [draggingVenueId, setDraggingVenueId] = useState<string | null>(null);
  const [venueDropHint, setVenueDropHint] = useState<{ id: string; edge: "before" | "after" } | null>(null);
  const venuePointerDrag = useRef<{ venueId: string; pointerId: number } | null>(null);
  useEffect(() => { setCollapsed(localStorage.getItem("workspace-sidebar-collapsed") === "true"); const saved = Number(localStorage.getItem("workspace-sidebar-width")); const width = Number.isFinite(saved) ? Math.min(360, Math.max(178, saved)) : 218; setSidebarWidth(width); document.documentElement.style.setProperty("--workspace-width", `${width}px`); }, []);
  useEffect(() => { setVenueOrder(readVenueOrder()); setVenueOrderLoaded(true); }, []);
  const resizeSidebar = (event: ReactPointerEvent<HTMLDivElement>) => { if (collapsed) return; event.preventDefault(); const startX = event.clientX; const startWidth = sidebarWidth; let currentWidth = startWidth; const move = (moveEvent: PointerEvent) => { currentWidth = Math.min(360, Math.max(178, startWidth + moveEvent.clientX - startX)); setSidebarWidth(currentWidth); document.documentElement.style.setProperty("--workspace-width", `${currentWidth}px`); }; const stop = () => { localStorage.setItem("workspace-sidebar-width", String(currentWidth)); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", stop); }; window.addEventListener("pointermove", move); window.addEventListener("pointerup", stop); };
  const store = useFloorPlanStore(useShallow((state) => ({
    activeBufferId: state.activeBufferId, addTransferBuffer: state.addTransferBuffer, addVenue: state.addVenue, deleteTransferBuffer: state.deleteTransferBuffer, deleteVenueCascade: state.deleteVenueCascade,
    floorPlan: state.floorPlan, layoutMachines: state.layoutMachines, machines: state.machines, moveBufferItemsToVenue: state.moveBufferItemsToVenue, moveVenueMachinesToBuffer: state.moveVenueMachinesToBuffer,
    projects: state.projects, renameTransferBuffer: state.renameTransferBuffer, selectedBufferItemIds: state.selectedBufferItemIds, setActiveBufferId: state.setActiveBufferId, setFeedback: state.setFeedback,
    setVenue: state.setVenue, toggleBufferItemSelection: state.toggleBufferItemSelection, transferBufferItems: state.transferBufferItems, transferBuffers: state.transferBuffers, updateVenueType: state.updateVenueType,
    hasHydrated: state.hasHydrated, venue: state.venue, venueMachines: state.venueMachines,
  })));
  useEffect(() => {
    if (!venueOrderLoaded || !store.hasHydrated) return;
    const projectIds = store.projects.map((project) => project.id);
    const projectIdSet = new Set(projectIds);
    const uniqueSavedIds = venueOrder.filter((id, index) => projectIdSet.has(id) && venueOrder.indexOf(id) === index);
    const savedIdSet = new Set(uniqueSavedIds);
    const nextOrder = [...uniqueSavedIds, ...projectIds.filter((id) => !savedIdSet.has(id))];
    if (nextOrder.length !== venueOrder.length || nextOrder.some((id, index) => id !== venueOrder[index])) setVenueOrder(nextOrder);
    saveVenueOrder(nextOrder);
  }, [store.hasHydrated, store.projects, venueOrder, venueOrderLoaded]);
  const active = store.transferBuffers.find((item) => item.id === store.activeBufferId); const items = store.transferBufferItems.filter((item) => item.transferBufferId === store.activeBufferId);
  const openVenueDelete = (project: typeof store.projects[number]) => { const owned = store.venueMachines.filter((machine) => machine.venueId === project.id); const placedIds = project.id === store.venue.id ? new Set(store.layoutMachines.map((item) => item.venueMachineId)) : new Set<string>(); const catalogIds = new Set(owned.map((machine) => machine.machineId)); const orphanCount = Array.from(catalogIds).filter((machineId) => !store.venueMachines.some((machine) => machine.venueId !== project.id && machine.machineId === machineId)).length; setDeleteCatalogToo(false); setVenueDeletePrompt({ id: project.id, name: project.name, machineCount: owned.length, placedCount: owned.filter((machine) => placedIds.has(machine.id)).length, hasFloorPlan: project.id === store.venue.id && Boolean(store.floorPlan), affectedModelCount: catalogIds.size, orphanCount }); };
  useEffect(() => { const nodes = Array.from(document.querySelectorAll<HTMLElement>(".transfer-item")); const cleanups = nodes.map((node, index) => { const buffer = store.transferBuffers[index]; if (!buffer) return () => undefined; const over = (event: DragEvent) => { if (event.dataTransfer?.types.includes("application/x-venue-machine") || event.dataTransfer?.types.includes("application/x-layout-machine")) { event.preventDefault(); node.classList.add("drop-target--active"); } }; const leave = () => node.classList.remove("drop-target--active"); const drop = (event: DragEvent) => { event.preventDefault(); leave(); const venueId = event.dataTransfer?.getData("application/x-venue-machine"); if (venueId) { store.moveVenueMachinesToBuffer(venueId.split(",").filter(Boolean), buffer.id); return; } const layoutId = event.dataTransfer?.getData("application/x-layout-machine"); const layout = store.layoutMachines.find((item) => item.id === layoutId); if (layout) store.moveVenueMachinesToBuffer([layout.venueMachineId], buffer.id); }; node.addEventListener("dragover", over); node.addEventListener("dragleave", leave); node.addEventListener("drop", drop); return () => { node.removeEventListener("dragover", over); node.removeEventListener("dragleave", leave); node.removeEventListener("drop", drop); }; }); return () => cleanups.forEach((cleanup) => cleanup()); }, [store.transferBuffers, store.transferBufferItems, store.layoutMachines, store.moveVenueMachinesToBuffer]);
  const onVenueDragOver = (event: React.DragEvent, venueId: string) => { if (event.dataTransfer.types.includes("application/x-transfer-buffer") || event.dataTransfer.types.includes("application/x-buffer-machine") || event.dataTransfer.types.includes("application/x-buffer-group")) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; const target = event.currentTarget as HTMLElement; target.classList.add("drop-target--active"); target.classList.toggle("drop-target--recommended", draggingBufferDestination === venueId); } };
  const onVenueDrop = (event: React.DragEvent, venueId: string) => { event.preventDefault(); event.currentTarget.classList.remove("drop-target--active"); const whole = event.dataTransfer.getData("application/x-transfer-buffer"); if (whole) { const count = store.transferBufferItems.filter((item) => item.transferBufferId === whole).length; if (count) setBatchPrompt({ bufferId: whole, venueId, count }); return; } const group = event.dataTransfer.getData("application/x-buffer-group"); const one = event.dataTransfer.getData("application/x-buffer-machine"); const ids = (group || one).split(",").filter(Boolean); if (ids.length) store.moveBufferItemsToVenue(ids, venueId); };
  const savedOrderIndex = new Map(venueOrder.map((id, index) => [id, index]));
  const originalOrderIndex = new Map(store.projects.map((project, index) => [project.id, index]));
  const orderedProjects = [...store.projects].sort((left, right) => (savedOrderIndex.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (savedOrderIndex.get(right.id) ?? Number.MAX_SAFE_INTEGER) || (originalOrderIndex.get(left.id) ?? 0) - (originalOrderIndex.get(right.id) ?? 0));
  const warehouses = orderedProjects.filter((project) => venueTypeOf(project) === "warehouse");
  const storeVenues = orderedProjects.filter((project) => venueTypeOf(project) === "store");
  const onProjectDragOver = (event: React.DragEvent, venueId: string) => {
    if (event.dataTransfer.types.includes("application/x-venue-project")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const rect = event.currentTarget.getBoundingClientRect();
      setVenueDropHint({ id: venueId, edge: event.clientY < rect.top + rect.height / 2 ? "before" : "after" });
      return;
    }
    onVenueDragOver(event, venueId);
  };
  const reorderVenues = (draggedId: string, targetId: string, edge: "before" | "after") => {
    const nextOrder = orderedProjects.map((project) => project.id);
    const from = nextOrder.indexOf(draggedId);
    const target = nextOrder.indexOf(targetId);
    if (from < 0 || target < 0 || draggedId === targetId) return;
    nextOrder.splice(from, 1);
    const targetAfterRemoval = nextOrder.indexOf(targetId);
    nextOrder.splice(targetAfterRemoval + (edge === "after" ? 1 : 0), 0, draggedId);
    setVenueOrder(nextOrder);
    saveVenueOrder(nextOrder);
    const draggedVenue = store.projects.find((project) => project.id === draggedId);
    const targetVenue = store.projects.find((project) => project.id === targetId);
    if (draggedVenue && targetVenue && venueTypeOf(draggedVenue) !== venueTypeOf(targetVenue)) store.updateVenueType(draggedId, venueTypeOf(targetVenue));
  };
  const moveVenueToType = (event: React.DragEvent, venueType: VenueType) => { event.preventDefault(); event.currentTarget.classList.remove("venue-section--drop-target"); const venueId = event.dataTransfer.getData("application/x-venue-project"); if (venueId && venueTypeOf(store.projects.find((project) => project.id === venueId) ?? { name: "" }) !== venueType) store.updateVenueType(venueId, venueType); };
  const updateVenuePointerDrop = (event: ReactPointerEvent<HTMLButtonElement>, venueId: string, commit: boolean) => {
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const row = target?.closest<HTMLElement>(".project-row[data-venue-id]");
    const targetId = row?.dataset.venueId;
    if (row && targetId && targetId !== venueId) {
      const rect = row.getBoundingClientRect();
      const edge = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
      setVenueDropHint({ id: targetId, edge });
      if (commit) reorderVenues(venueId, targetId, edge);
      return;
    }
    setVenueDropHint(null);
    if (commit) {
      const section = target?.closest<HTMLElement>(".venue-section[data-venue-type]");
      const type = section?.dataset.venueType as VenueType | undefined;
      const venue = store.projects.find((project) => project.id === venueId);
      if (type && venue && venueTypeOf(venue) !== type) store.updateVenueType(venueId, type);
    }
  };
  const beginVenuePointerDrag = (event: ReactPointerEvent<HTMLButtonElement>, venueId: string) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    venuePointerDrag.current = { venueId, pointerId: event.pointerId };
    setDraggingVenueId(venueId);
  };
  const finishVenuePointerDrag = (event: ReactPointerEvent<HTMLButtonElement>, cancelled = false) => {
    const drag = venuePointerDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!cancelled) updateVenuePointerDrop(event, drag.venueId, true);
    venuePointerDrag.current = null;
    setDraggingVenueId(null);
    setVenueDropHint(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const renderProject = (project: typeof store.projects[number]) => {
    const dropEdge = venueDropHint?.id === project.id ? venueDropHint.edge : null;
    const rowClass = ["project-row", "drop-target", store.venue.id === project.id && "project-row--active", draggingVenueId === project.id && "project-row--dragging", dropEdge && `project-row--drop-${dropEdge}`].filter(Boolean).join(" ");
    return <div key={project.id} data-venue-id={project.id} draggable className={rowClass} onDragStart={(event) => { setDraggingVenueId(project.id); event.dataTransfer.setData("application/x-venue-project", project.id); event.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => { setDraggingVenueId(null); setVenueDropHint(null); }} onDragOver={(event) => onProjectDragOver(event, project.id)} onDragLeave={(event) => { const next = event.relatedTarget; if (next instanceof Node && event.currentTarget.contains(next)) return; event.currentTarget.classList.remove("drop-target--active"); if (venueDropHint?.id === project.id) setVenueDropHint(null); }} onDrop={(event) => { const draggedVenueId = event.dataTransfer.getData("application/x-venue-project"); if (draggedVenueId) { event.preventDefault(); event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); const edge = venueDropHint?.id === project.id ? venueDropHint.edge : event.clientY < rect.top + rect.height / 2 ? "before" : "after"; reorderVenues(draggedVenueId, project.id, edge); setDraggingVenueId(null); setVenueDropHint(null); return; } onVenueDrop(event, project.id); }}><button type="button" className="project-drag-handle" aria-label={`Reorder ${project.name}`} aria-keyshortcuts="ArrowUp ArrowDown" title="Drag to change order; use ↑ and ↓ when focused" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return; const sameType = venueTypeOf(project) === "warehouse" ? warehouses : storeVenues; const index = sameType.findIndex((item) => item.id === project.id); const neighbor = sameType[index + (event.key === "ArrowUp" ? -1 : 1)]; if (!neighbor) return; event.preventDefault(); reorderVenues(project.id, neighbor.id, event.key === "ArrowUp" ? "before" : "after"); }} onPointerDown={(event) => beginVenuePointerDrag(event, project.id)} onPointerMove={(event) => { const drag = venuePointerDrag.current; if (drag?.pointerId === event.pointerId) updateVenuePointerDrop(event, drag.venueId, false); }} onPointerUp={(event) => finishVenuePointerDrag(event)} onPointerCancel={(event) => finishVenuePointerDrag(event, true)}><DotsSixVertical size={14} /></button><button onClick={() => store.setVenue(project)} className="project-item"><Buildings size={16} /><span><b>{project.name}</b><small>Current layout</small></span>{store.venue.id === project.id ? <CheckCircle size={14} weight="fill" /> : null}</button><button className="project-menu" aria-label={`Manage ${project.name}`} onClick={() => setVenueManage({ id: project.id, name: project.name, venueType: venueTypeOf(project) })}>⋯</button></div>;
  };
  return <aside className={collapsed ? "project-panel project-panel--collapsed" : "project-panel"} style={{ "--workspace-width": `${sidebarWidth}px` } as CSSProperties}><div className="project-top"><div className="workspace-row"><span className="workspace-label">WORKSPACE</span><button className="collapse-workspace" onClick={() => setCollapsed((value) => { localStorage.setItem("workspace-sidebar-collapsed", String(!value)); return !value; })} aria-label={collapsed ? "Expand workspace" : "Collapse workspace"} title={collapsed ? "Expand Workspace" : "Collapse Workspace"}><SidebarSimple size={16} /></button></div><button className="workspace-switch" disabled><span>Arcade Operations</span><CaretDown size={12} /></button></div><div className="workspace-resizer" role="separator" aria-label="Resize workspace sidebar" aria-orientation="vertical" onPointerDown={resizeSidebar} />
    <div className="project-title"><div><span>VENUE PROJECTS</span><b>Floor plans</b></div><button aria-label="Add venue project" onClick={() => { setVenueName(""); setNewVenueType("store"); setCreateOpen(true); }}><Plus size={15} /></button></div><div className="project-list"><section className="venue-section" data-venue-type="warehouse" onDragOver={(event) => { if (event.dataTransfer.types.includes("application/x-venue-project")) { event.preventDefault(); event.currentTarget.classList.add("venue-section--drop-target"); } }} onDragLeave={(event) => event.currentTarget.classList.remove("venue-section--drop-target")} onDrop={(event) => moveVenueToType(event, "warehouse")}><span>WAREHOUSE</span>{warehouses.map(renderProject)}{!warehouses.length ? <small>Drag a venue here</small> : null}</section><section className="venue-section" data-venue-type="store" onDragOver={(event) => { if (event.dataTransfer.types.includes("application/x-venue-project")) { event.preventDefault(); event.currentTarget.classList.add("venue-section--drop-target"); } }} onDragLeave={(event) => event.currentTarget.classList.remove("venue-section--drop-target")} onDrop={(event) => moveVenueToType(event, "store")}><span>STORE VENUES</span>{storeVenues.map(renderProject)}{!storeVenues.length ? <small>Drag a venue here</small> : null}</section></div>
    <div className="transfer-section"><div className="project-title"><div><span>TRANSFER BUFFER</span><b>Global staging</b></div><button title="Create transfer buffer" onClick={() => { const name = window.prompt("Transfer buffer name"); if (name?.trim()) store.addTransferBuffer(name.trim()); }}><Plus size={15} /></button></div>{store.transferBuffers.map((buffer) => { const bufferItems = store.transferBufferItems.filter((item) => item.transferBufferId === buffer.id); const destination = buffer.destinationVenueId && store.projects.find((item) => item.id === buffer.destinationVenueId); return <button className="transfer-item" data-buffer-id={buffer.id} key={buffer.id} draggable={bufferItems.length > 0} onDragStart={(event) => { draggingBufferDestination = buffer.destinationVenueId ?? null; event.dataTransfer.setData("application/x-transfer-buffer", buffer.id); event.dataTransfer.setData("application/x-buffer-group", bufferItems.map((item) => item.id).join(",")); event.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => { draggingBufferDestination = null; document.querySelectorAll<HTMLElement>(".drop-target--recommended").forEach((node) => node.classList.remove("drop-target--recommended")); }} onClick={() => store.setActiveBufferId(buffer.id)}><FolderSimple size={15} /><span><b>{buffer.name}</b><small>{bufferItems.length} machines{destination ? ` · Destination: ${destination.name}` : ""}</small></span></button>; })}{active ? <div className="buffer-panel"><b>{active.name}</b><button title="Rename buffer" onClick={() => { const name = window.prompt("Rename buffer", active.name); if (name?.trim()) store.renameTransferBuffer(active.id, name.trim()); }}><PencilSimple size={12} /></button><button title="Delete empty buffer" onClick={() => store.deleteTransferBuffer(active.id)}><Trash size={12} /></button>{items.map((item) => { const vm = store.venueMachines.find((entry) => entry.id === item.venueMachineId); const machine = vm && store.machines.find((entry) => entry.id === vm.machineId); if (!vm || !machine) return null; const d = getEffectiveMachineDimensions(machine, vm); return <label key={item.id} draggable onDragStart={(event) => { const selected = store.selectedBufferItemIds.includes(item.id) ? store.selectedBufferItemIds : [item.id]; event.dataTransfer.setData("application/x-buffer-machine", selected.join(",")); event.dataTransfer.effectAllowed = "move"; }}><input type="checkbox" checked={store.selectedBufferItemIds.includes(item.id)} onChange={() => store.toggleBufferItemSelection(item.id)} />{vm.machineCode} {machine.name}<small>{d.widthMm} × {d.depthMm} mm · {vm.useCustomDimensions ? "Custom" : "Standard"}</small></label>; })}</div> : null}</div><div className="project-library"><FolderSimple size={16} /><span><b>Machine Catalog</b><small>Company assets</small></span></div>
    {createOpen ? <div className="venue-dialog" role="dialog" aria-label="Create venue"><h3>Create venue</h3><input autoFocus value={venueName} onChange={(event) => setVenueName(event.target.value)} placeholder="Venue name" /><label>Venue type<select value={newVenueType} onChange={(event) => setNewVenueType(event.target.value as VenueType)}><option value="store">Store Venue</option><option value="warehouse">Warehouse</option></select></label><div><button onClick={() => setCreateOpen(false)}>Cancel</button><button className="primary-action" disabled={!venueName.trim()} onClick={() => { store.addVenue(venueName, newVenueType); setCreateOpen(false); }}>Create</button></div></div> : null}{venueManage ? <div className="venue-dialog" role="dialog" aria-label={`Manage ${venueManage.name}`}><h3>Manage venue</h3><p>{venueManage.name}</p><label>Venue type<select value={venueManage.venueType} onChange={(event) => setVenueManage({ ...venueManage, venueType: event.target.value as VenueType })}><option value="store">Store Venue</option><option value="warehouse">Warehouse</option></select></label><div><button onClick={() => setVenueManage(null)}>Cancel</button><button className="primary-action" onClick={() => { store.updateVenueType(venueManage.id, venueManage.venueType); setVenueManage(null); }}>Save</button></div><button className="venue-delete-link" onClick={() => { const venue = store.projects.find((project) => project.id === venueManage.id); if (venue) openVenueDelete(venue); setVenueManage(null); }}>Delete venue…</button></div> : null}{batchPrompt ? <div className="venue-dialog" role="dialog" aria-label="Confirm buffer transfer"><h3>Move all {batchPrompt.count} machines to {store.projects.find((project) => project.id === batchPrompt.venueId)?.name}?</h3><p>They will be added as Unplaced.</p><div><button onClick={() => setBatchPrompt(null)}>Cancel</button><button className="primary-action" onClick={() => { const ids = store.transferBufferItems.filter((item) => item.transferBufferId === batchPrompt.bufferId).map((item) => item.id); store.moveBufferItemsToVenue(ids, batchPrompt.venueId); setBatchPrompt(null); }}>{`Move ${batchPrompt.count} Machines`}</button></div></div> : null}{venueDeletePrompt ? <div className="venue-dialog destructive-dialog" role="dialog" aria-label={`Delete ${venueDeletePrompt.name}`}><h3>Delete {venueDeletePrompt.name}?</h3><p>This action permanently removes:</p><ul><li>{venueDeletePrompt.machineCount} physical machines</li><li>{venueDeletePrompt.placedCount} machine placements</li><li>{venueDeletePrompt.hasFloorPlan ? 1 : 0} Floor Plan</li><li>{venueDeletePrompt.affectedModelCount} affected Machine Models</li></ul>{venueDeletePrompt.orphanCount ? <label><input type="checkbox" checked={deleteCatalogToo} onChange={(event) => setDeleteCatalogToo(event.target.checked)} /> Also remove {venueDeletePrompt.orphanCount} unused Machine Models from Catalog</label> : null}<small>Models still used by another Venue or Transfer Buffer will be preserved.</small><div><button onClick={() => setVenueDeletePrompt(null)}>Cancel</button><button className="destructive-action" onClick={() => { const prompt = venueDeletePrompt; const ok = store.deleteVenueCascade(prompt.id, { deleteUnusedCatalogModels: deleteCatalogToo }); if (ok) store.setFeedback(`${prompt.name} deletion is being saved to cloud.`); setVenueDeletePrompt(null); }}>Delete Venue</button></div></div> : null}
  </aside>;
}
