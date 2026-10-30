import test from "node:test";
import assert from "node:assert/strict";
import { isFootprintNearViewport } from "../src/lib/floor-plan/visibility.ts";
import { footprintScreenBounds } from "../src/lib/floor-plan/navigation.ts";

const viewport = { width: 800, height: 600 };

test("keeps visible and near-edge machine footprints for drawing and interaction", () => {
  assert.equal(isFootprintNearViewport({ left: 20, top: 20, right: 70, bottom: 70 }, viewport), true);
  assert.equal(isFootprintNearViewport({ left: -220, top: 20, right: -179, bottom: 70 }, viewport), true);
  assert.equal(isFootprintNearViewport({ left: 979, top: 20, right: 1010, bottom: 70 }, viewport), true);
});

test("omits only footprints outside the conservative margin on any axis", () => {
  assert.equal(isFootprintNearViewport({ left: -240, top: 20, right: -181, bottom: 70 }, viewport), false);
  assert.equal(isFootprintNearViewport({ left: 981, top: 20, right: 1030, bottom: 70 }, viewport), false);
  assert.equal(isFootprintNearViewport({ left: 20, top: -250, right: 70, bottom: -181 }, viewport), false);
  assert.equal(isFootprintNearViewport({ left: 20, top: 781, right: 70, bottom: 850 }, viewport), false);
});

test("culling uses rotated screen bounds including zoom, pan and background offset", () => {
  const input = { xMm: 1000, yMm: 1000, widthMm: 2000, depthMm: 1000, rotation: 90, scaleMmPerPx: 10, zoom: 2, pan: { x: 0, y: 0 }, floorOffset: { x: 50, y: 0 } };
  assert.equal(isFootprintNearViewport(footprintScreenBounds(input), viewport), true);
  assert.equal(isFootprintNearViewport(footprintScreenBounds({ ...input, pan: { x: -1000, y: 0 } }), viewport), false);
});

test("unknown geometry or viewport size fails open instead of hiding machines", () => {
  assert.equal(isFootprintNearViewport({ left: NaN, top: 0, right: 10, bottom: 10 }, viewport), true);
  assert.equal(isFootprintNearViewport({ left: 900, top: 0, right: 950, bottom: 10 }, { width: 0, height: 0 }), true);
});
