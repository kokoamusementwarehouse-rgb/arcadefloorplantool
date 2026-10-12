import { GridFour, GridNine, List, Plus, X } from "@phosphor-icons/react";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFloorPlanStore } from "../../store/floorPlanStore";
import { MachineCard } from "./MachineCard";
import { getEffectiveMachineDimensions } from "../../lib/floor-plan/machineDimensions";
import { REVEAL_VISUAL_CARD_EVENT, revealMachineOnFloorPlan, revealMachineVisualCard, scrollCardIntoPanel } from "../../lib/floor-plan/navigation";
import { SubjectThumbnail } from "./SubjectThumbnail";
import { useShallow } from "zustand/react/shallow";
import type { Machine, VenueMachine } from "../../types/machine";

type Tab = "properties" | "visuals";

export function MachineCardPanel({ showAllConnections, setShowAllConnections }: { showAllConnections: boolean; setShowAllConnections: (value: boolean) => void }) {
  const [tab, setTab] = useState<Tab>("properties");
  const [columns, setColumns] = useState(3);
  const visualViewportRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  const store = useFloorPlanStore(useShallow((state) => ({
    selectedMachineId: state.selectedMachineId, hoveredVenueMachineId: state.hoveredVenueMachineId, venueMachines: state.venueMachines, machines: state.machines,
    venue: state.venue, floorPlan: state.floorPlan, layoutMachines: state.layoutMachines, setSelectedMachineId: state.setSelectedMachineId, setHoveredVenueMachineId: state.setHoveredVenueMachineId,
    updateDimensions: state.updateDimensions, resetDimensions: state.resetDimensions, setCustomDimensions: state.setCustomDimensions, setFeedback: state.setFeedback,
    rotateLayoutMachine: state.rotateLayoutMachine, removeLayoutMachine: state.removeLayoutMachine, placeMachine: state.placeMachine,
  })));
  const { selectedMachineId, hoveredVenueMachineId, venueMachines, machines, venue, floorPlan, layoutMachines, setSelectedMachineId, setHoveredVenueMachineId, updateDimensions, resetDimensions, setCustomDimensions, setFeedback, rotateLayoutMachine, removeLayoutMachine, placeMachine } = store;
  useEffect(() => { const saved = Number(localStorage.getItem("machine-visual-columns")); if ([1, 2, 3].includes(saved)) setColumns(saved); }, []);
  useEffect(() => { const reveal = () => setTab("visuals"); window.addEventListener(REVEAL_VISUAL_CARD_EVENT, reveal); return () => window.removeEventListener(REVEAL_VISUAL_CARD_EVENT, reveal); }, []);
  const setGrid = (value: number) => { setColumns(value); localStorage.setItem("machine-visual-columns", String(value)); };
  const machineById = useMemo(() => new Map(machines.map((item) => [item.id, item])), [machines]);
  const venueMachineById = useMemo(() => new Map(venueMachines.map((item) => [item.id, item])), [venueMachines]);
  const layoutByVenueMachineId = useMemo(() => new Map(layoutMachines.map((item) => [item.venueMachineId, item])), [layoutMachines]);
  const venueMachine = venueMachineById.get(selectedMachineId ?? "");
  const machine = venueMachine ? machineById.get(venueMachine.machineId) : undefined;
  const selectedLayout = layoutByVenueMachineId.get(selectedMachineId ?? "");
  const visible = useMemo(() => {
    if (tab !== "visuals") return [];
    const placedIds = new Set(layoutMachines.map((item) => item.venueMachineId));
    return venueMachines.flatMap((item) => {
      if (item.venueId !== venue.id || !placedIds.has(item.id)) return [];
      const catalog = machineById.get(item.machineId);
      return catalog ? [{ venueMachine: item, machine: catalog, dimensions: getEffectiveMachineDimensions(catalog, item) }] : [];
    }).sort((a, b) => a.venueMachine.machineCode.localeCompare(b.venueMachine.machineCode, undefined, { numeric: true }));
  }, [layoutMachines, machineById, tab, venue.id, venueMachines]);
  const registerCard = useCallback((id: string, node: HTMLButtonElement | null) => { if (node) cardRefs.current.set(id, node); else cardRefs.current.delete(id); }, []);
  const hoverCard = useCallback((id: string, hovered: boolean) => store.setHoveredVenueMachineId(hovered ? id : null), [store.setHoveredVenueMachineId]);
  const selectCard = useCallback((id: string) => { store.setSelectedMachineId(id); revealMachineOnFloorPlan(id); }, [store.setSelectedMachineId]);
  useLayoutEffect(() => { if (tab !== "visuals" || !selectedMachineId) return; const panel = visualViewportRef.current; const card = cardRefs.current.get(selectedMachineId); if (panel && card) scrollCardIntoPanel(panel, card); }, [columns, selectedMachineId, tab, visible.length]);

  return <aside className="side-panel details-panel"><div className="right-tabs"><button className={tab === "properties" ? "right-tab right-tab--active" : "right-tab"} onClick={() => setTab("properties")}>Properties</button><button className={tab === "visuals" ? "right-tab right-tab--active" : "right-tab"} onClick={() => setTab("visuals")}>Visuals</button><label className="show-all-control" title="Show all connections"><input type="checkbox" checked={showAllConnections} onChange={(event) => setShowAllConnections(event.target.checked)} /><span>Lines</span></label></div>
    {tab === "visuals" ? <section className="machine-visual-panel"><div className="visual-heading"><div><b>Machine Visual Panel</b><small>{visible.length} placed machines</small></div><div className="grid-choice" aria-label="Visual panel columns"><button className={columns === 1 ? "active" : ""} onClick={() => setGrid(1)} aria-label="1 column"><List size={14}/></button><button className={columns === 2 ? "active" : ""} onClick={() => setGrid(2)} aria-label="2 columns"><GridFour size={14}/></button><button className={columns === 3 ? "active" : ""} onClick={() => setGrid(3)} aria-label="3 columns"><GridNine size={14}/></button></div></div>{visible.length ? <div ref={visualViewportRef} data-testid="machine-visual-viewport" className={`visual-grid visual-grid--${columns}`}>{visible.map((entry) => <MachineVisualCard key={entry.venueMachine.id} entry={entry} selected={selectedMachineId === entry.venueMachine.id} hovered={hoveredVenueMachineId === entry.venueMachine.id} onHover={hoverCard} onSelect={selectCard} onRegister={registerCard} />)}</div> : <div className="visual-empty">Placed machine cards will appear here as a visual index.</div>}</section> : machine && venueMachine ? <div className="detail-drawer"><button className="close-drawer" onClick={() => setSelectedMachineId(null)} aria-label="Close"><X size={18} /></button><p className="detail-code">{venueMachine.machineCode}</p><MachineCard venueMachine={venueMachine} machine={machine} /><DimensionEditor machine={machine} venueMachine={venueMachine} updateDimensions={updateDimensions} resetDimensions={resetDimensions} setCustomDimensions={setCustomDimensions} setFeedback={setFeedback} />{selectedLayout ? <div className="layout-actions"><small>Rotation {selectedLayout.rotation}° · X {Math.round(selectedLayout.xMm)} mm · Y {Math.round(selectedLayout.yMm)} mm</small><button onClick={() => revealMachineOnFloorPlan(venueMachine.id)}>Locate on Plan</button><button onClick={() => rotateLayoutMachine(selectedLayout.id)}>Rotate 90°</button><button className="danger" onClick={() => removeLayoutMachine(selectedLayout.id)}>Remove from Layout</button></div> : floorPlan.scaleMmPerPx ? <div className="layout-actions"><small>Unplaced · calibrated Floor Plan</small><button onClick={() => { placeMachine(venueMachine.id, floorPlan.imageWidthPx * floorPlan.scaleMmPerPx! / 2, floorPlan.imageHeightPx * floorPlan.scaleMmPerPx! / 2); revealMachineVisualCard(venueMachine.id); }}>Place at Plan Center</button></div> : <p className="phase-note">Drag this unplaced machine onto a calibrated floor plan.</p>}<p className="phase-note">Standard sizes are shared through the Machine Catalog.</p></div> : <div className="details-empty"><div className="empty-icon"><Plus size={22} /></div><h2>Select a venue machine</h2><p>Open Visuals to adjust the machine-card grid.</p></div>}
  </aside>;
}

type MachineVisualEntry = { venueMachine: VenueMachine; machine: Machine; dimensions: ReturnType<typeof getEffectiveMachineDimensions> };

const MachineVisualCard = memo(function MachineVisualCard({ entry, selected, hovered, onHover, onSelect, onRegister }: { entry: MachineVisualEntry; selected: boolean; hovered: boolean; onHover: (id: string, hovered: boolean) => void; onSelect: (id: string) => void; onRegister: (id: string, node: HTMLButtonElement | null) => void }) {
  const { venueMachine, machine, dimensions } = entry;
  const cardClass = selected ? "visual-card visual-card--selected" : hovered ? "visual-card visual-card--hovered" : "visual-card";
  return <button ref={(node) => onRegister(venueMachine.id, node)} data-venue-machine-id={venueMachine.id} className={cardClass} onMouseEnter={() => onHover(venueMachine.id, true)} onMouseLeave={() => onHover(venueMachine.id, false)} onClick={() => onSelect(venueMachine.id)}>{machine.imageUrl ? <SubjectThumbnail src={machine.imageUrl} /> : <span className="visual-image-fallback" aria-label="No machine image">No image</span>}<span><b>{venueMachine.machineCode}</b><small>{machine.name}</small><em>{dimensions.widthMm} × {dimensions.depthMm} mm</em></span></button>;
});

function DimensionEditor({ machine, venueMachine, updateDimensions, resetDimensions, setCustomDimensions, setFeedback }: { machine: NonNullable<ReturnType<typeof useFloorPlanStore.getState>["machines"][number]>; venueMachine: NonNullable<ReturnType<typeof useFloorPlanStore.getState>["venueMachines"][number]>; updateDimensions: (id:string,w:number,d:number)=>void; resetDimensions:(id:string)=>void; setCustomDimensions:(id:string,on:boolean)=>void; setFeedback:(m:string)=>void }) {
  const { widthMm, depthMm } = getEffectiveMachineDimensions(machine, venueMachine); const layoutMachines = useFloorPlanStore((state) => state.layoutMachines); const setLayoutRotation = useFloorPlanStore((state) => state.setLayoutRotation); const layout = layoutMachines.find((item) => item.venueMachineId === venueMachine.id); const [rotation, setRotation] = useState(String(layout?.rotation ?? 0)); useEffect(() => setRotation(String(layout?.rotation ?? 0)), [layout?.rotation]); const commit=(kind:"w"|"d", raw:string)=>{const value=Number(raw);if(value<=0||!Number.isFinite(value)){setFeedback("Dimensions must be positive millimetres.");return;}updateDimensions(venueMachine.id,kind==="w"?value:widthMm,kind==="d"?value:depthMm);}; const commitRotation=()=>{const value=Number(rotation.trim());if(!layout||!rotation.trim()||!Number.isFinite(value)){setRotation(String(layout?.rotation ?? 0));return;}setLayoutRotation(layout.id,value);}; const custom=venueMachine.useCustomDimensions; return <div className="dimension-editor"><b>Dimensions</b><label>Width <input aria-label="Width mm" defaultValue={widthMm} onBlur={(e)=>commit("w",e.target.value)} /><span>mm</span></label><label>Depth <input aria-label="Depth mm" defaultValue={depthMm} onBlur={(e)=>commit("d",e.target.value)} /><span>mm</span></label>{layout?<label>Rotation <input aria-label="Rotation degrees" value={rotation} inputMode="decimal" onChange={(e)=>setRotation(e.target.value)} onBlur={commitRotation} onKeyDown={(e)=>{if(e.key==="Enter"){e.currentTarget.blur();}}} /><span>°</span></label>:null}<small>{custom?"Custom size for this unit":"Standard machine size"}</small><button onClick={()=>setCustomDimensions(venueMachine.id,!custom)}>{custom?"Use Standard Size":"Custom Size for This Unit"}</button>{custom?<button onClick={()=>resetDimensions(venueMachine.id)}>Reset to Catalog Size</button>:null}</div>;
}
