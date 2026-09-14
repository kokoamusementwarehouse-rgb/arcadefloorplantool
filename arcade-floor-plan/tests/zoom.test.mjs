import assert from "node:assert/strict";
import test from "node:test";
import { calculateFitRenderZoom, FIT_VIEW_ZOOM, viewZoomToRenderZoom } from "../src/lib/floor-plan/zoom.ts";

test("large plans fit at the 50% view baseline without a raw 25% floor", () => {
  const fitted = calculateFitRenderZoom({ imageWidthPx: 4000, imageHeightPx: 2500, viewportWidth: 1000, viewportHeight: 700, padding: 42 });
  assert.ok(fitted < 0.25);
  assert.equal(viewZoomToRenderZoom(FIT_VIEW_ZOOM, fitted), fitted);
  assert.ok(4000 * fitted <= 1000 - 84);
  assert.ok(2500 * fitted <= 700 - 84);
});

test("view zoom is relative to the fitted 50% baseline", () => {
  assert.equal(viewZoomToRenderZoom(0.5, 0.18), 0.18);
  assert.equal(viewZoomToRenderZoom(1, 0.18), 0.36);
});
