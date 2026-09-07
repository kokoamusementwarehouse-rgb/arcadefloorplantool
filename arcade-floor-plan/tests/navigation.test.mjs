import test from "node:test";
import assert from "node:assert/strict";
import { footprintScreenBounds, panToRevealBounds } from "../src/lib/floor-plan/navigation.ts";

test("does not pan a fully visible footprint", () => {
  assert.equal(panToRevealBounds({ left: 100, top: 100, right: 200, bottom: 200 }, { width: 800, height: 600 }, { x: 12, y: 24 }), null);
});

test("minimally pans a rotated or large footprint into the viewport margin", () => {
  assert.deepEqual(panToRevealBounds({ left: 760, top: -10, right: 960, bottom: 90 }, { width: 800, height: 600 }, { x: 100, y: 50 }), { x: -116, y: 116 });
});

test("keeps pan unchanged on the axis that is already visible", () => {
  assert.deepEqual(panToRevealBounds({ left: -20, top: 120, right: 80, bottom: 220 }, { width: 800, height: 600 }, { x: 0, y: 0 }), { x: 76, y: 0 });
});

test("uses rotated physical footprint bounds without changing stored dimensions", () => {
  assert.deepEqual(footprintScreenBounds({ xMm: 5000, yMm: 3000, widthMm: 1000, depthMm: 2000, rotation: 90, scaleMmPerPx: 10, zoom: 2, pan: { x: 10, y: 20 } }), { left: 810, top: 520, right: 1210, bottom: 720 });
});

test("locate bounds include the Floor Plan background offset", () => {
  assert.deepEqual(footprintScreenBounds({ xMm: 1000, yMm: 2000, widthMm: 1000, depthMm: 1000, rotation: 0, scaleMmPerPx: 10, zoom: 2, pan: { x: 10, y: 20 }, floorOffset: { x: 50, y: -25 } }), { left: 210, top: 270, right: 410, bottom: 470 });
});
