import test from "node:test";
import assert from "node:assert/strict";
import { clampFootprintCenterPx, floorLocalToScreen, screenToFloorLocal } from "../src/lib/floor-plan/coordinates.ts";
import { KOKO_RHODES_SCALE_MM_PER_PX } from "../src/lib/floor-plan/scale.ts";

test("Rhodes scale retains the exact 70 m / 2388 px ratio", () => {
  assert.equal(KOKO_RHODES_SCALE_MM_PER_PX, 70000 / 2388);
  assert.equal(KOKO_RHODES_SCALE_MM_PER_PX * 2388, 70000);
});

test("floor-local coordinates round-trip through background offset, pan and zoom", () => {
  const local = { x: 620, y: 410 }; const floor = { offset: { x: 130, y: -45 } }; const viewport = { zoom: 1.75, pan: { x: -80, y: 220 } };
  assert.deepEqual(screenToFloorLocal(floorLocalToScreen(local, floor, viewport), viewport, floor), local);
});

test("background movement does not alter floor-local calibration distance", () => {
  const viewport = { zoom: 2, pan: { x: 30, y: 40 } }; const first = { x: 100, y: 200 }; const second = { x: 700, y: 200 };
  for (const offset of [{ x: 0, y: 0 }, { x: 175, y: -80 }]) {
    const a = screenToFloorLocal(floorLocalToScreen(first, { offset }, viewport), viewport, { offset }); const b = screenToFloorLocal(floorLocalToScreen(second, { offset }, viewport), viewport, { offset });
    assert.equal(Math.hypot(b.x - a.x, b.y - a.y), 600);
  }
});

test("footprint bounds clamp the complete rotated extent", () => {
  assert.deepEqual(clampFootprintCenterPx({ x: -100, y: 990 }, { widthPx: 200, heightPx: 400 }, { widthPx: 1000, heightPx: 800 }), { x: 100, y: 600 });
});

test("oversized footprint is safely centered", () => {
  assert.deepEqual(clampFootprintCenterPx({ x: 999, y: -20 }, { widthPx: 1200, heightPx: 900 }, { widthPx: 1000, heightPx: 800 }), { x: 500, y: 400 });
});
