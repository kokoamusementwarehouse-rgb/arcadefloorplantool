import { memo, useRef } from "react";
import { Group, Rect, Text } from "react-konva";
import type Konva from "konva";
import type { LayoutMachine } from "../../types/layout";
import type { Machine, VenueMachine } from "../../types/machine";
import { getEffectiveMachineDimensions } from "../../lib/floor-plan/machineDimensions";
import { clampFootprintCenterPx, mmToPx, pxToMm, rotatedFootprintSize } from "../../lib/floor-plan/coordinates";
import { getMachineAppearance } from "../../lib/floor-plan/appearance";

type Props = { layoutMachine: LayoutMachine; machine: Machine; venueMachine: VenueMachine; scaleMmPerPx: number; floorPlanWidthPx: number; floorPlanHeightPx: number; zoom: number; selected: boolean; hovered: boolean; dragging: boolean; draggable: boolean; rotation?: number; onSelect: (venueMachineId: string) => void; onHover: (venueMachineId: string, value: boolean) => void; onDragStart: (venueMachineId: string) => void; onDragEnd: (venueMachineId: string) => void; onMove: (layoutMachineId: string, xMm: number, yMm: number) => void; onLiveMove?: (venueMachineId: string, xMm: number, yMm: number) => void; onContextMenu?: (venueMachineId: string, point: { x: number; y: number }) => void; onDropToBuffer?: (venueMachineId: string, point: { x: number; y: number }) => boolean };

function MachineObjectView({ layoutMachine, machine, venueMachine, scaleMmPerPx, floorPlanWidthPx, floorPlanHeightPx, zoom, selected, hovered, dragging, draggable, rotation: transientRotation, onSelect, onHover, onDragStart, onDragEnd, onMove, onLiveMove, onContextMenu, onDropToBuffer }: Props) {
  const { widthMm, depthMm } = getEffectiveMachineDimensions(machine, venueMachine); const appearance = getMachineAppearance(machine); const width = mmToPx(widthMm, scaleMmPerPx); const depth = mmToPx(depthMm, scaleMmPerPx); const centerX = mmToPx(layoutMachine.xMm, scaleMmPerPx); const centerY = mmToPx(layoutMachine.yMm, scaleMmPerPx); const rotation = transientRotation ?? layoutMachine.rotation; const footprint = rotatedFootprintSize(width, depth, rotation); const active = selected || hovered || dragging;
  const tooltipWidth = Math.min(300, Math.max(132, Math.ceil(machine.name.length * 7.2 + 22))); const tooltipHeight = 28; const tooltipPadding = 8 / zoom; const canShowAbove = centerY - footprint.heightPx / 2 >= (tooltipHeight + 8) / zoom; const tooltipY = canShowAbove ? -footprint.heightPx / 2 - tooltipPadding - tooltipHeight / zoom : footprint.heightPx / 2 + tooltipPadding;
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
  return <Group ref={nodeRef} x={centerX} y={centerY} draggable={draggable} dragBoundFunc={(position) => absoluteFromLocal(clampFootprintCenterPx(localFromAbsolute(position), footprint, { widthPx: floorPlanWidthPx, heightPx: floorPlanHeightPx }))} onMouseEnter={() => onHover(venueMachine.id, true)} onMouseLeave={() => !dragging && onHover(venueMachine.id, false)} onClick={() => onSelect(venueMachine.id)} onTap={() => onSelect(venueMachine.id)} onContextMenu={(event) => { event.evt?.preventDefault?.(); event.cancelBubble = true; onContextMenu?.(venueMachine.id, { x: event.evt?.clientX ?? 0, y: event.evt?.clientY ?? 0 }); }} onDragStart={(event) => { event.cancelBubble = true; onDragStart(venueMachine.id); }} onDragMove={(event) => { event.cancelBubble = true; const point = { x: event.evt?.clientX ?? 0, y: event.evt?.clientY ?? 0 }; document.querySelectorAll<HTMLElement>("[data-buffer-id]").forEach((node) => node.classList.toggle("drop-target--active", Boolean(document.elementFromPoint(point.x, point.y)?.closest("[data-buffer-id]")))); const next = clampCenter(event.target); onLiveMove?.(venueMachine.id, pxToMm(next.x, scaleMmPerPx), pxToMm(next.y, scaleMmPerPx)); }} onDragEnd={(event) => { event.cancelBubble = true; document.querySelectorAll<HTMLElement>("[data-buffer-id]").forEach((node) => node.classList.remove("drop-target--active")); const point = { x: event.evt?.clientX ?? 0, y: event.evt?.clientY ?? 0 }; if (onDropToBuffer?.(venueMachine.id, point)) { onDragEnd(venueMachine.id); return; } const next = clampCenter(event.target); onLiveMove?.(venueMachine.id, pxToMm(next.x, scaleMmPerPx), pxToMm(next.y, scaleMmPerPx)); onMove(layoutMachine.id, pxToMm(next.x, scaleMmPerPx), pxToMm(next.y, scaleMmPerPx)); onDragEnd(venueMachine.id); }}>
    <Group rotation={rotation} offsetX={width / 2} offsetY={depth / 2}><Rect width={width} height={depth} fill={appearance.footprintColor} opacity={selected ? 0.82 : active ? 0.72 : 0.58} stroke={selected ? "#5149ed" : active ? "#716af0" : appearance.borderColor} strokeWidth={selected ? 3 : active ? 2 : 1.5} cornerRadius={3} /><Text width={width} height={depth} align="center" verticalAlign="middle" text={`${venueMachine.machineCode}\n${machine.name}`} fontStyle="bold" fontSize={Math.max(9, Math.min(16, Math.min(width, depth) / 5))} fill={appearance.textColor} listening={false} /></Group>
    {hovered ? <Group y={tooltipY} scaleX={1 / zoom} scaleY={1 / zoom} listening={false}><Rect x={-tooltipWidth / 2} width={tooltipWidth} height={tooltipHeight} fill="#172756" opacity={0.97} cornerRadius={6} shadowColor="#0b1738" shadowBlur={10} shadowOpacity={0.22} shadowOffsetY={3} /><Text x={-tooltipWidth / 2 + 10} y={8} width={tooltipWidth - 20} text={machine.name} align="center" ellipsis fontSize={11} fontStyle="bold" fill="#ffffff" /></Group> : null}
  </Group>;
}

function areMachineObjectPropsEqual(previous: Props, next: Props) {
  return previous.layoutMachine === next.layoutMachine
    && previous.machine === next.machine
    && previous.venueMachine === next.venueMachine
    && previous.scaleMmPerPx === next.scaleMmPerPx
    && previous.floorPlanWidthPx === next.floorPlanWidthPx
    && previous.floorPlanHeightPx === next.floorPlanHeightPx
    && (previous.hovered === false && next.hovered === false || previous.zoom === next.zoom)
    && previous.selected === next.selected
    && previous.hovered === next.hovered
    && previous.dragging === next.dragging
    && previous.draggable === next.draggable
    && previous.rotation === next.rotation
    && previous.onSelect === next.onSelect
    && previous.onHover === next.onHover
    && previous.onDragStart === next.onDragStart
    && previous.onDragEnd === next.onDragEnd
    && previous.onMove === next.onMove
    && previous.onLiveMove === next.onLiveMove
    && previous.onContextMenu === next.onContextMenu
    && previous.onDropToBuffer === next.onDropToBuffer;
}

export const MachineObject = memo(MachineObjectView, areMachineObjectPropsEqual);
