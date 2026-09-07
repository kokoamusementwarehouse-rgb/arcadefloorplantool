"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CONNECTION_LAYOUT_EVENT, nearestEdgeAnchors } from "../../lib/floor-plan/connection";
import { footprintScreenBounds } from "../../lib/floor-plan/navigation";
import { getEffectiveMachineDimensions } from "../../lib/floor-plan/machineDimensions";
import { useFloorPlanStore } from "../../store/floorPlanStore";

type Segment = { id: string; x1: number; y1: number; x2: number; y2: number; selected: boolean; hovered: boolean };

export function MachineConnection({ rootRef, showAll }: { rootRef: React.RefObject<HTMLDivElement | null>; showAll: boolean }) {
  const store = useFloorPlanStore(); const [segments, setSegments] = useState<Segment[]>([]); const frame = useRef<number | null>(null); const live = useRef<{ venueMachineId: string; xMm: number; yMm: number } | null>(null);
  const calculate = useCallback(() => {
    const root = rootRef.current; const canvas = root?.querySelector<HTMLElement>(".canvas-shell"); const visualViewport = root?.querySelector<HTMLElement>("[data-testid='machine-visual-viewport']");
    if (!root || !canvas || !store.floorPlan.scaleMmPerPx) { setSegments([]); return; }
    const rootRect = root.getBoundingClientRect(); const canvasRect = canvas.getBoundingClientRect(); const viewportRect = visualViewport?.getBoundingClientRect();
    const ids = showAll ? store.layoutMachines.map((item) => item.venueMachineId) : [...new Set([store.selectedMachineId, store.hoveredVenueMachineId, store.draggingVenueMachineId].filter(Boolean) as string[])];
    const next = ids.flatMap((id): Segment[] => {
      const card = root.querySelector<HTMLElement>(`[data-venue-machine-id="${CSS.escape(id)}"]`); const layout = store.layoutMachines.find((item) => item.venueMachineId === id); const vm = store.venueMachines.find((item) => item.id === id); const machine = vm && store.machines.find((item) => item.id === vm.machineId);
      if (!card || !layout || !vm || !machine) return [];
      const cardRect = card.getBoundingClientRect();
      if (viewportRect && (cardRect.bottom < viewportRect.top || cardRect.top > viewportRect.bottom)) return [];
      const preview = live.current?.venueMachineId === id ? live.current : layout; const dimensions = getEffectiveMachineDimensions(machine, vm);
      const local = footprintScreenBounds({ ...layout, xMm: preview.xMm, yMm: preview.yMm, ...dimensions, scaleMmPerPx: store.floorPlan.scaleMmPerPx!, zoom: store.zoom, pan: store.pan, floorOffset: { x: store.floorPlan.backgroundOffsetX ?? 0, y: store.floorPlan.backgroundOffsetY ?? 0 } });
      const footprint = { left: canvasRect.left + local.left, top: canvasRect.top + local.top, right: canvasRect.left + local.right, bottom: canvasRect.top + local.bottom };
      const anchors = nearestEdgeAnchors(footprint, cardRect);
      return [{ id, x1: anchors.from.x - rootRect.left, y1: anchors.from.y - rootRect.top, x2: anchors.to.x - rootRect.left, y2: anchors.to.y - rootRect.top, selected: id === store.selectedMachineId, hovered: id === store.hoveredVenueMachineId || id === store.draggingVenueMachineId }];
    });
    setSegments(next);
  }, [rootRef, showAll, store.draggingVenueMachineId, store.floorPlan, store.hoveredVenueMachineId, store.layoutMachines, store.machines, store.pan, store.selectedMachineId, store.venueMachines, store.zoom]);
  const schedule = useCallback(() => { if (frame.current !== null) return; frame.current = requestAnimationFrame(() => { frame.current = null; calculate(); }); }, [calculate]);
  useEffect(() => { schedule(); }, [schedule]);
  useEffect(() => {
    const root = rootRef.current; if (!root) return;
    const onLayout = (event: Event) => { live.current = (event as CustomEvent<typeof live.current>).detail ?? null; schedule(); };
    const observer = new ResizeObserver(schedule); observer.observe(root); root.querySelectorAll(".canvas-shell,.details-panel,.visual-card").forEach((node) => observer.observe(node));
    const mutations = new MutationObserver(schedule); const panel = root.querySelector(".details-panel"); if (panel) mutations.observe(panel, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    root.addEventListener("scroll", schedule, true); window.addEventListener("resize", schedule); window.addEventListener(CONNECTION_LAYOUT_EVENT, onLayout);
    return () => { observer.disconnect(); mutations.disconnect(); root.removeEventListener("scroll", schedule, true); window.removeEventListener("resize", schedule); window.removeEventListener(CONNECTION_LAYOUT_EVENT, onLayout); if (frame.current !== null) { cancelAnimationFrame(frame.current); frame.current = null; } };
  }, [rootRef, schedule]);
  return <svg className="connection-overlay" aria-hidden="true"><g>{segments.filter((line) => !line.selected && !line.hovered).map(({id,x1,y1,x2,y2}) => <line key={id} x1={x1} y1={y1} x2={x2} y2={y2} className="connection-line connection-line--muted" />)}{segments.filter((line) => !line.selected && line.hovered).map(({id,x1,y1,x2,y2}) => <line key={id} x1={x1} y1={y1} x2={x2} y2={y2} className="connection-line connection-line--hovered" />)}{segments.filter((line) => line.selected).map(({id,x1,y1,x2,y2}) => <line key={id} x1={x1} y1={y1} x2={x2} y2={y2} className="connection-line connection-line--selected" />)}</g></svg>;
}
