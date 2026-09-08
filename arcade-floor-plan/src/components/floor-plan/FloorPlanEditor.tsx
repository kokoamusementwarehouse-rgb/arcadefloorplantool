"use client";

import { Export } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { formatMetres, millimetresToMetres } from "../../lib/floor-plan/scale";
import { useFloorPlanStore } from "../../store/floorPlanStore";
import { FloorPlanCanvas } from "./FloorPlanCanvas";
import { FloorPlanToolbar } from "./FloorPlanToolbar";
import { FullStoreView } from "./FullStoreView";
import { MachineCardPanel } from "./MachineCardPanel";
import { MachineConnection } from "./MachineConnection";
import { MachineLibrary } from "./MachineLibrary";
import { ProjectSidebar } from "./ProjectSidebar";
import { AuthBoundary } from "../auth/AuthBoundary";
import { isSupabaseConfigured } from "../../lib/supabase/client";

export function FloorPlanEditor() {
  const { venue, layout, floorPlan, fullStoreView, setFullStoreView, layoutMachines, projects, hasHydrated, setVenue, persistenceStatus, lastSavedAt } = useFloorPlanStore();
  const editorRef = useRef<HTMLDivElement>(null); const [showAllConnections, setShowAllConnections] = useState(false); const [panelsHidden, setPanelsHidden] = useState(false); const restoredVenue = useRef(false);
  useEffect(() => { const toggle = () => setPanelsHidden((value) => !value); window.addEventListener("floorplan:toggle-panels", toggle); return () => window.removeEventListener("floorplan:toggle-panels", toggle); }, []);
  useEffect(() => { if (!hasHydrated || restoredVenue.current) return; restoredVenue.current = true; const savedId = localStorage.getItem("floorplan-active-venue"); const savedVenue = projects.find((item) => item.id === savedId); if (savedVenue && savedVenue.id !== venue.id) setVenue(savedVenue); }, [hasHydrated, projects, setVenue, venue.id]);
  const cloudMode = isSupabaseConfigured();
  const persistenceLabel = persistenceStatus === "saving" ? "Saving…" : persistenceStatus === "failed" ? "Save failed" : lastSavedAt ? (cloudMode ? "Saved to cloud" : "Saved locally") : (cloudMode ? "Cloud ready" : "Auto-saved locally");
  const canExport = Boolean(floorPlan.imageDataUrl || floorPlan.imageUrl) && !fullStoreView;
  const exportTitle = canExport ? "Export floor plan PNG" : fullStoreView ? "Return to the editor to export the floor plan" : "Upload a floor plan before exporting";
  return <main className="app-frame"><header className="app-header"><div className="brand"><div className="brand-mark">K</div><span>KOKO <b>Arcade</b></span></div><nav><button className="nav-active">Floor Plans</button></nav><div className="header-actions"><div className="layout-context" title="This MVP has one current layout per venue">{venue.name} <span>·</span> {layout.name}</div><span className={persistenceStatus === "failed" ? "saved-state saved-state--failed" : "saved-state"}>{persistenceLabel}</span><button className="header-button" onClick={() => setFullStoreView(!fullStoreView)}>{fullStoreView ? "Editor View" : "Full Store"}</button><button className="header-button" disabled={!canExport} title={exportTitle} onClick={() => window.dispatchEvent(new Event("floorplan:export"))}><Export size={15} />Export PNG</button></div></header>
    <div className="desktop-only-message"><b>Desktop editor</b><span>Use a screen at least 900 px wide to edit floor plans.</span></div>{fullStoreView ? <FullStoreView /> : <div className={panelsHidden ? "editor-body editor-body--panels-hidden" : "editor-body"} ref={editorRef}><ProjectSidebar /><MachineLibrary /><section className="workspace"><FloorPlanToolbar /><FloorPlanCanvas /><footer className="status-bar"><span>{floorPlan.imageDataUrl || floorPlan.imageUrl ? `${floorPlan.imageWidthPx} × ${floorPlan.imageHeightPx} px` : "Floor Plan not uploaded"}</span><span>·</span><span>{floorPlan.scaleMmPerPx ? `Map scale: 1 px = ${formatMetres(millimetresToMetres(floorPlan.scaleMmPerPx))}` : "Map scale: not set"}</span><span>·</span><span>{layoutMachines.length} machines placed</span><span className="status-version">v0.1 · MVP</span></footer></section><MachineCardPanel showAllConnections={showAllConnections} setShowAllConnections={setShowAllConnections} />
      <MachineConnection rootRef={editorRef} showAll={showAllConnections} />
    </div>}</main>;
}
