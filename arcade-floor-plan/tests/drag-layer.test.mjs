import test from "node:test";
import assert from "node:assert/strict";
import { moveToDragLayer, restoreDragLayer } from "../src/lib/floor-plan/dragLayer.ts";

function group() {
  return { children: [], stage: {}, draws: 0, getStage() { return this.stage; }, getChildren() { return this.children; }, batchDraw() { this.draws++; } };
}
function node(parent, name) {
  const item = { name, parent, getParent() { return this.parent; }, getLayer() { return this.parent; }, getZIndex() { return this.parent.children.indexOf(this); }, moveTo(next) { this.parent.children.splice(this.parent.children.indexOf(this), 1); next.children.push(this); this.parent = next; }, zIndex(index) { const children = this.parent.children; children.splice(children.indexOf(this), 1); children.splice(index, 0, this); } };
  parent.children.push(item);
  return item;
}

test("a dragged machine returns to its original parent and stacking order", () => {
  const original = group(), drag = group();
  node(original, "before"); const moving = node(original, "moving"); node(original, "after");
  const origin = moveToDragLayer(moving, drag);
  assert.deepEqual(original.children.map((item) => item.name), ["before", "after"]);
  assert.equal(moving.getParent(), drag);
  assert.equal(original.draws, 1);
  restoreDragLayer(moving, origin);
  assert.deepEqual(original.children.map((item) => item.name), ["before", "moving", "after"]);
  assert.equal(drag.draws, 1);
});

test("restoration does not resurrect a node after its original stage is gone", () => {
  const original = group(), drag = group(), moving = node(original, "moving");
  const origin = moveToDragLayer(moving, drag);
  original.stage = null;
  restoreDragLayer(moving, origin);
  assert.equal(moving.getParent(), drag);
  assert.equal(original.children.length, 0);
});

test("restoration does not move a node that was already reparented elsewhere", () => {
  const original = group(), drag = group(), other = group(), moving = node(original, "moving");
  const origin = moveToDragLayer(moving, drag);
  moving.moveTo(other);
  restoreDragLayer(moving, origin);
  assert.equal(moving.getParent(), other);
});
