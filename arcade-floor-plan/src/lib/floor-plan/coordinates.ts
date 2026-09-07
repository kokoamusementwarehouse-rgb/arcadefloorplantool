/** Converts real-world layout coordinates only at the rendering boundary. */
export const mmToPx = (millimetres: number, scaleMmPerPx: number) => millimetres / scaleMmPerPx;
export const pxToMm = (pixels: number, scaleMmPerPx: number) => pixels * scaleMmPerPx;

export interface ViewportTransform { zoom: number; pan: { x: number; y: number }; }
export interface FloorPlanTransform { offset: Point; }
export const screenToWorld = (point: Point, transform: ViewportTransform): Point => ({
  x: (point.x - transform.pan.x) / transform.zoom,
  y: (point.y - transform.pan.y) / transform.zoom,
});
export const worldToScreen = (point: Point, transform: ViewportTransform): Point => ({
  x: point.x * transform.zoom + transform.pan.x,
  y: point.y * transform.zoom + transform.pan.y,
});
export interface Point { x: number; y: number; }

export const worldToFloorLocal = (point: Point, transform: FloorPlanTransform): Point => ({ x: point.x - transform.offset.x, y: point.y - transform.offset.y });
export const floorLocalToWorld = (point: Point, transform: FloorPlanTransform): Point => ({ x: point.x + transform.offset.x, y: point.y + transform.offset.y });
export const screenToFloorLocal = (point: Point, viewport: ViewportTransform, floorPlan: FloorPlanTransform) => worldToFloorLocal(screenToWorld(point, viewport), floorPlan);
export const floorLocalToScreen = (point: Point, floorPlan: FloorPlanTransform, viewport: ViewportTransform) => worldToScreen(floorLocalToWorld(point, floorPlan), viewport);
export const floorPxToMm = pxToMm;
export const mmToFloorPx = mmToPx;

export function clampFootprintCenterPx(point: Point, footprint: { widthPx: number; heightPx: number }, floorPlan: { widthPx: number; heightPx: number }): Point {
  const clampAxis = (value: number, footprintSize: number, planSize: number) => footprintSize >= planSize ? planSize / 2 : Math.max(footprintSize / 2, Math.min(planSize - footprintSize / 2, value));
  return { x: clampAxis(point.x, footprint.widthPx, floorPlan.widthPx), y: clampAxis(point.y, footprint.heightPx, floorPlan.heightPx) };
}
export function rotatedFootprintSize(widthPx: number, heightPx: number, rotationDeg: number) { const radians = rotationDeg * Math.PI / 180; return { widthPx: Math.abs(widthPx * Math.cos(radians)) + Math.abs(heightPx * Math.sin(radians)), heightPx: Math.abs(widthPx * Math.sin(radians)) + Math.abs(heightPx * Math.cos(radians)) }; }
