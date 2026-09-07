import { Group, Rect, Text } from "react-konva";
import type Konva from "konva";
import { useRef } from "react";
import type { LayoutMachine } from "../../types/layout";
import type { Machine, VenueMachine } from "../../types/machine";
import { getEffectiveMachineDimensions } from "../../lib/floor-plan/machineDimensions";
import { clampFootprintCenterPx, mmToPx, pxToMm, rotatedFootprintSize } from "../../lib/floor-plan/coordinates";
import { getMachineAppearance } from "../../lib/floor-plan/appearance";

type Props = { layoutMachine: LayoutMachine; machine: Machine; venueMachine: VenueMachine; scaleMmPerPx: number; floorPlanWidthPx: number; floorPlanHeightPx: number; pan: { x: number; y: number }; zoom: number; floorOffset: { x: number; y: number }; selected: boolean; hovered: boolean; dragging: boolean; draggable: boolean; rotation?: number; onSelect: (event?: any) => void; onHover: (value: boolean) => void; onDragStart: () => void; onDragEnd: () => void; onMove: (xMm: number, yMm: number) => void; onLiveMove?: (xMm: number, yMm: number) => void; onContextMenu?: (point: { x: number; y: number }) => void; onDropToBuffer?: (point: { x: number; y: number }) => boolean };

export function MachineObject({ layoutMachine, machine, venueMachine, scaleMmPerPx, floorPlanWidthPx, floorPlanHeightPx, pan, zoom, floorOffset, selected, hovered, dragging, draggable, rotation: transientRotation, onSelect, onHover, onDragStart, onDragEnd, onMove, onLiveMove, onContextMenu, onDropToBuffer }: Props) {
  const { widthMm, depthMm } = getEffectiveMachineDimensions(machine, venueMachine); const appearance = getMachineAppearance(machine); const width = mmToPx(widthMm, scaleMmPerPx); const depth = mmToPx(depthMm, scaleMmPerPx); const centerX = mmToPx(layoutMachine.xMm, scaleMmPerPx); const centerY = mmToPx(layoutMachine.yMm, scaleMmPerPx); const rotation = transientRotation ?? layoutMachine.rotation; const footprint = rotatedFootprintSize(width, depth, rotation); const active = selected || hovered || dragging;
  const nodeRef = useRef<Konva.Group>(null);
  // The draggable node is already positioned in the floor-plan parent's local
  // coordinate space. Converting through the Stage transform here would apply
  // pan/zoom a second time and make the footprint jump on release.
  const floorPointFromNode = (node: { x(): number; y(): number }) => ({ x: node.x(), y: node.y() });
  const clampCenter = (node: { x(): number; y(): number }) => clampFootprintCenterPx(floorPointFromNode(node), footprint, { widthPx: floorPlanWidthPx, heightPx: floorPlanHeightPx });
  const localFromAbsolute = (position: { x: number; y: number }) => {
    const parent = nodeRef.current?.getParent();
    return parent ? parent.getAbsoluteTransform().copy().invert().point(position) : position;
  };
  const absoluteFromLocal = (position: { x: number; y: number }) => {
    const parent = nodeRef.current?.getParent();
    return parent ? parent.getAbsoluteTransform().point(position) : position;
  };
  return <Group ref={nodeRef} x={centerX} y={centerY} draggable={draggable} dragBoundFunc={(position) => absoluteFromLocal(clampFootprintCenterPx(localFromAbsolute(position), footprint, { widthPx: floorPlanWidthPx, heightPx: floorPlanHeightPx }))} onMouseEnter={() => onHover(true)} onMouseLeave={() => !dragging && onHover(false)} onClick={(event) => onSelect(event)} onTap={(event) => onSelect(event)} onContextMenu={(event) => { event.evt?.preventDefault?.(); event.cancelBubble = true; onContextMenu?.({ x: event.evt?.clientX ?? 0, y: event.evt?.clientY ?? 0 }); }} onDragStart={(event) => { event.cancelBubble = true; onDragStart(); }} onDragMove={(event) => { event.cancelBubble = true; const point = { x: event.evt?.clientX ?? 0, y: event.evt?.clientY ?? 0 }; document.querySelectorAll<HTMLElement>("[data-buffer-id]").forEach((node) => node.classList.toggle("drop-target--active", Boolean(document.elementFromPoint(point.x, point.y)?.closest("[data-buffer-id]")))); const next = clampCenter(event.target); onLiveMove?.(pxToMm(next.x, scaleMmPerPx), pxToMm(next.y, scaleMmPerPx)); }} onDragEnd={(event) => { event.cancelBubble = true; document.querySelectorAll<HTMLElement>("[data-buffer-id]").forEach((node) => node.classList.remove("drop-target--active")); const point = { x: event.evt?.clientX ?? 0, y: event.evt?.clientY ?? 0 }; if (onDropToBuffer?.(point)) { onDragEnd(); return; } const next = clampCenter(event.target); onLiveMove?.(pxToMm(next.x, scaleMmPerPx), pxToMm(next.y, scaleMmPerPx)); onMove(pxToMm(next.x, scaleMmPerPx), pxToMm(next.y, scaleMmPerPx)); onDragEnd(); }}>
    <Group rotation={rotation} offsetX={width / 2} offsetY={depth / 2}><Rect width={width} height={depth} fill={appearance.footprintColor} opacity={selected ? 0.82 : active ? 0.72 : 0.58} stroke={selected ? "#5149ed" : active ? "#716af0" : appearance.borderColor} strokeWidth={selected ? 3 : active ? 2 : 1.5} cornerRadius={3} /><Text width={width} height={depth} align="center" verticalAlign="middle" text={`${venueMachine.machineCode}\n${machine.name}`} fontStyle="bold" fontSize={Math.max(9, Math.min(16, Math.min(width, depth) / 5))} fill={appearance.textColor} listening={false} /></Group>
  </Group>;
}
