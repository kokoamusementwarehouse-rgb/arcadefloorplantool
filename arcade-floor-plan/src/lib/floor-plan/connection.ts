export interface Point { x: number; y: number; }
export const straightConnection = (from: Point, to: Point) => [from.x, from.y, to.x, to.y];

export interface RectBounds { left: number; top: number; right: number; bottom: number }
export function nearestEdgeAnchors(from: RectBounds, to: RectBounds) {
  const a = { x: (from.left + from.right) / 2, y: (from.top + from.bottom) / 2 };
  const b = { x: (to.left + to.right) / 2, y: (to.top + to.bottom) / 2 };
  const dx = b.x - a.x; const dy = b.y - a.y;
  if (Math.abs(dx) >= Math.abs(dy)) return { from: { x: dx >= 0 ? from.right : from.left, y: a.y }, to: { x: dx >= 0 ? to.left : to.right, y: b.y } };
  return { from: { x: a.x, y: dy >= 0 ? from.bottom : from.top }, to: { x: b.x, y: dy >= 0 ? to.top : to.bottom } };
}

export type PerimeterSide = "top" | "right" | "bottom" | "left";
export function assignPerimeterSide(point: Point, center: Point): PerimeterSide {
  const dx = point.x - center.x; const dy = point.y - center.y;
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "right" : "left") : (dy >= 0 ? "bottom" : "top");
}

export const CONNECTION_LAYOUT_EVENT = "floorplan:connection-layout";
export function notifyConnectionLayout(detail?: { venueMachineId: string; xMm: number; yMm: number } | null) {
  window.dispatchEvent(new CustomEvent(CONNECTION_LAYOUT_EVENT, { detail }));
}
