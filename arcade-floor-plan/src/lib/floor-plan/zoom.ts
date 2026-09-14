export const FIT_VIEW_ZOOM = 0.5;
export const MIN_VIEW_ZOOM = FIT_VIEW_ZOOM;
export const MAX_VIEW_ZOOM = 1.5;

/**
 * The toolbar percentage is relative to the fitted view, rather than the
 * image's raw pixel size. This lets a large uploaded plan be fully visible at
 * 50% on every workspace size.
 */
export function calculateFitRenderZoom(input: { imageWidthPx: number; imageHeightPx: number; viewportWidth: number; viewportHeight: number; padding: number }) {
  const availableWidth = Math.max(1, input.viewportWidth - input.padding * 2);
  const availableHeight = Math.max(1, input.viewportHeight - input.padding * 2);
  const raw = Math.min(availableWidth / Math.max(1, input.imageWidthPx), availableHeight / Math.max(1, input.imageHeightPx));
  return Math.max(0.001, Math.min(4, raw));
}

export function viewZoomToRenderZoom(viewZoom: number, fitRenderZoom: number) {
  return fitRenderZoom * (viewZoom / FIT_VIEW_ZOOM);
}
