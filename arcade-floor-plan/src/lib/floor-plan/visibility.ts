/** Conservative screen-space culling. A margin keeps edge tooltips and rotated
 * footprints visible before they enter the viewport. This never changes data. */
export function isFootprintNearViewport(
  bounds: { left: number; top: number; right: number; bottom: number },
  viewport: { width: number; height: number },
  margin = 180,
): boolean {
  // Incomplete measurements must not hide a machine while a viewport or
  // legacy record is being resolved.
  if (![bounds.left, bounds.top, bounds.right, bounds.bottom, viewport.width, viewport.height, margin].every(Number.isFinite) || viewport.width <= 0 || viewport.height <= 0) return true;
  return bounds.right >= -margin && bounds.left <= viewport.width + margin
    && bounds.bottom >= -margin && bounds.top <= viewport.height + margin;
}
