import type Konva from "konva";

export type DragLayerOrigin = { parent: Konva.Container; dragGroup: Konva.Group; index: number };

/** Both groups must have identical floor-plan transforms. */
export function moveToDragLayer(node: Konva.Group | null, dragGroup: Konva.Group | null): DragLayerOrigin | null {
  const parent = node?.getParent();
  if (!node || !dragGroup || !parent || parent === dragGroup) return null;
  const origin = { parent, dragGroup, index: node.getZIndex() };
  const oldLayer = node.getLayer();
  node.moveTo(dragGroup);
  oldLayer?.batchDraw();
  return origin;
}

/** Restore React's original parent/order before a move or buffer drop commits. */
export function restoreDragLayer(node: Konva.Group | null, origin: DragLayerOrigin | null): void {
  if (!origin || !node || node.getParent() !== origin.dragGroup || !origin.parent.getStage()) return;
  const dragLayer = node.getLayer();
  node.moveTo(origin.parent);
  node.zIndex(Math.min(origin.index, origin.parent.getChildren().length - 1));
  dragLayer?.batchDraw();
}
