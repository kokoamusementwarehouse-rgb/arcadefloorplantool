import test from "node:test";
import assert from "node:assert/strict";
import { assignPerimeterSide, nearestEdgeAnchors, straightConnection } from "../src/lib/floor-plan/connection.ts";

test("anchors connect the nearest horizontal edges", () => {
  const result = nearestEdgeAnchors({ left: 0, top: 0, right: 20, bottom: 20 }, { left: 100, top: 10, right: 140, bottom: 50 });
  assert.deepEqual(result, { from: { x: 20, y: 10 }, to: { x: 100, y: 30 } });
  assert.deepEqual(straightConnection(result.from, result.to), [20, 10, 100, 30]);
});

test("anchors connect the nearest vertical edges", () => {
  assert.deepEqual(nearestEdgeAnchors({ left: 20, top: 10, right: 40, bottom: 30 }, { left: 15, top: 100, right: 45, bottom: 130 }), { from: { x: 30, y: 30 }, to: { x: 30, y: 100 } });
});

test("perimeter assignment uses the dominant center delta", () => {
  const center = { x: 50, y: 50 };
  assert.equal(assignPerimeterSide({ x: 90, y: 55 }, center), "right");
  assert.equal(assignPerimeterSide({ x: 10, y: 55 }, center), "left");
  assert.equal(assignPerimeterSide({ x: 55, y: 5 }, center), "top");
  assert.equal(assignPerimeterSide({ x: 55, y: 95 }, center), "bottom");
});
