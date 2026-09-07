export const REVEAL_VISUAL_CARD_EVENT = "floorplan:reveal-visual-card";
export const REVEAL_FOOTPRINT_EVENT = "floorplan:reveal-footprint";

export const revealMachineVisualCard = (venueMachineId: string) => {
  window.dispatchEvent(new CustomEvent<string>(REVEAL_VISUAL_CARD_EVENT, { detail: venueMachineId }));
};

export const revealMachineOnFloorPlan = (venueMachineId: string) => {
  window.dispatchEvent(new CustomEvent<string>(REVEAL_FOOTPRINT_EVENT, { detail: venueMachineId }));
};

export function scrollCardIntoPanel(panel: HTMLElement, card: HTMLElement, margin = 8) {
  const panelBounds = panel.getBoundingClientRect();
  const cardBounds = card.getBoundingClientRect();
  let delta = 0;
  if (cardBounds.top < panelBounds.top + margin) delta = cardBounds.top - panelBounds.top - margin;
  else if (cardBounds.bottom > panelBounds.bottom - margin) delta = cardBounds.bottom - panelBounds.bottom + margin;
  if (delta) panel.scrollTo({ top: panel.scrollTop + delta, behavior: "smooth" });
  return delta;
}

export interface ScreenBounds { left: number; top: number; right: number; bottom: number }
export function footprintScreenBounds(input: { xMm: number; yMm: number; widthMm: number; depthMm: number; rotation: number; scaleMmPerPx: number; zoom: number; pan: { x: number; y: number }; floorOffset?: { x: number; y: number } }): ScreenBounds {
  const radians = input.rotation * Math.PI / 180; const rawWidth = input.widthMm / input.scaleMmPerPx * input.zoom; const rawHeight = input.depthMm / input.scaleMmPerPx * input.zoom;
  const width = Math.abs(rawWidth * Math.cos(radians)) + Math.abs(rawHeight * Math.sin(radians));
  const height = Math.abs(rawWidth * Math.sin(radians)) + Math.abs(rawHeight * Math.cos(radians));
  const centreX = input.pan.x + ((input.floorOffset?.x ?? 0) + input.xMm / input.scaleMmPerPx) * input.zoom;
  const centreY = input.pan.y + ((input.floorOffset?.y ?? 0) + input.yMm / input.scaleMmPerPx) * input.zoom;
  return { left: centreX - width / 2, top: centreY - height / 2, right: centreX + width / 2, bottom: centreY + height / 2 };
}
export function panToRevealBounds(bounds: ScreenBounds, viewport: { width: number; height: number }, pan: { x: number; y: number }, margin = 56) {
  let dx = 0; let dy = 0;
  if (bounds.left < margin) dx = margin - bounds.left;
  else if (bounds.right > viewport.width - margin) dx = viewport.width - margin - bounds.right;
  if (bounds.top < margin) dy = margin - bounds.top;
  else if (bounds.bottom > viewport.height - margin) dy = viewport.height - margin - bounds.bottom;
  return dx || dy ? { x: pan.x + dx, y: pan.y + dy } : null;
}
