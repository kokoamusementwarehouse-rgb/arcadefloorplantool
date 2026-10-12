import assert from "node:assert/strict";
import test from "node:test";
import { bindCanvasGestures, wheelView, zoomViewAtPoint } from "../src/lib/floor-plan/gestures.ts";
import { MIN_VIEW_ZOOM, MAX_VIEW_ZOOM, viewZoomToRenderZoom } from "../src/lib/floor-plan/zoom.ts";
import { floorLocalToScreen, screenToFloorLocal } from "../src/lib/floor-plan/coordinates.ts";

const limits = { min: MIN_VIEW_ZOOM, max: MAX_VIEW_ZOOM };
const viewport = { width: 900, height: 650 };
const start = { zoom: 0.8, pan: { x: 80, y: -30 } };
const wheel = (input = {}) => Object.assign(new Event("wheel", { cancelable: true }), { deltaX: 0, deltaY: 0, deltaMode: 0, ctrlKey: false, buttons: 0, clientX: 350, clientY: 280, ...input });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

function harness() {
  class Canvas extends EventTarget {
    getBoundingClientRect() { return { left: 50, top: 30, width: viewport.width, height: viewport.height }; }
  }
  const element = new Canvas();
  let context = { ...start, viewport, enabled: true, identity: {}, basis: 0.31 };
  const frames = new Map();
  const applied = [];
  let sequence = 0;
  const cleanup = bindCanvasGestures(element, {
    limits, read: () => context,
    apply: (view) => { applied.push(view); context = { ...context, ...view }; },
    requestFrame: (callback) => { const id = ++sequence; frames.set(id, callback); return id; },
    cancelFrame: (id) => frames.delete(id),
  });
  const dispatch = (event) => { element.dispatchEvent(event); return event; };
  const flush = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach((callback) => callback(0)); };
  const gesture = (type, scale) => dispatch(Object.assign(new Event(type, { cancelable: true }), { scale, clientX: 350, clientY: 280 }));
  return { dispatch, flush, gesture, cleanup, frames, applied, get context() { return context; }, update: (patch) => { context = { ...context, ...patch }; } };
}

test("two-finger scroll pans both axes without changing zoom", () => {
  const next = wheelView(start, wheel({ deltaX: 12, deltaY: -34 }), { x: 300, y: 250 }, viewport, limits);
  assert.deepEqual(next, { zoom: 0.8, pan: { x: 68, y: 4 } });
});

test("pinch keeps the same floor-local point under the pointer, including fitted scale and background offset", () => {
  const point = { x: 420, y: 280 };
  const offset = { x: 35, y: -17 };
  const fit = 0.18;
  const local = screenToFloorLocal(point, { zoom: viewZoomToRenderZoom(start.zoom, fit), pan: start.pan }, { offset });
  const next = wheelView(start, wheel({ ctrlKey: true, deltaY: -20 }), point, viewport, limits);
  assert.ok(next.zoom > start.zoom);
  const screen = floorLocalToScreen(local, { offset }, { zoom: viewZoomToRenderZoom(next.zoom, fit), pan: next.pan });
  near(screen.x, point.x); near(screen.y, point.y);
});

test("pinch honors the existing zoom limits without shifting the anchor at a limit", () => {
  const point = { x: 300, y: 250 };
  assert.equal(zoomViewAtPoint(start, 10, point, limits).zoom, MAX_VIEW_ZOOM);
  assert.equal(zoomViewAtPoint(start, 0.01, point, limits).zoom, MIN_VIEW_ZOOM);
  const minView = { ...start, zoom: MIN_VIEW_ZOOM };
  assert.deepEqual(zoomViewAtPoint(minView, 0.01, point, limits), minView);
});

test("line/page wheel deltas and CSS coordinate scaling are normalized", () => {
  assert.deepEqual(wheelView(start, wheel({ deltaX: 1, deltaY: 2, deltaMode: 1 }), { x: 0, y: 0 }, viewport, limits).pan, { x: 64, y: -62 });
  assert.deepEqual(wheelView(start, wheel({ deltaX: 1, deltaY: -1, deltaMode: 2 }), { x: 0, y: 0 }, viewport, limits, { x: 2, y: 2 }).pan, { x: -820, y: 620 });
  assert.deepEqual(wheelView(start, wheel({ deltaX: 10, deltaY: 15 }), { x: 0, y: 0 }, viewport, limits, { x: 2, y: 2 }).pan, { x: 60, y: -60 });
});

test("a burst of 100 wheel packets commits once and retains every delta", () => {
  const h = harness();
  for (let i = 0; i < 100; i++) assert.equal(h.dispatch(wheel({ deltaX: 1, deltaY: 2 })).defaultPrevented, true);
  assert.equal(h.frames.size, 1); assert.equal(h.applied.length, 0);
  h.flush();
  assert.equal(h.applied.length, 1);
  assert.deepEqual(h.context.pan, { x: -20, y: -230 });
  assert.equal(h.context.zoom, start.zoom);
  h.cleanup();
});

test("consecutive pinch packets compose rather than use a stale rendered zoom", () => {
  const h = harness();
  for (let i = 0; i < 3; i++) h.dispatch(wheel({ ctrlKey: true, deltaY: -5 }));
  h.flush();
  near(h.context.zoom, start.zoom * Math.exp(0.15));
  h.dispatch(wheel({ ctrlKey: true, deltaY: 5 })); h.flush();
  near(h.context.zoom, start.zoom * Math.exp(0.10));
  h.cleanup();
});

test("empty maps and active mouse/machine dragging do not consume navigation gestures", () => {
  const h = harness();
  h.update({ enabled: false });
  assert.equal(h.dispatch(wheel({ deltaY: 20 })).defaultPrevented, false);
  h.update({ enabled: true });
  assert.equal(h.dispatch(wheel({ deltaY: 20, buttons: 1 })).defaultPrevented, false);
  h.flush(); assert.equal(h.applied.length, 0); h.cleanup();
});

for (const [name, patch] of [
  ["toolbar fit", () => ({ zoom: 0.5, pan: { x: 10, y: 20 } })],
  ["venue/plan switch", () => ({ identity: {} })],
  ["viewport resize", () => ({ viewport: { width: 1000, height: 650 } })],
  ["fitted scale change", () => ({ basis: 0.22 })],
]) test(`queued input cannot overwrite a later ${name}`, () => {
  const h = harness(); h.dispatch(wheel({ deltaY: 20 })); h.update(patch());
  h.flush(); assert.equal(h.applied.length, 0); h.cleanup();
});

test("Safari scale is relative to gesture start; its accompanying wheel stream does not double-zoom", () => {
  const h = harness();
  assert.equal(h.gesture("gesturestart", 1).defaultPrevented, true);
  h.gesture("gesturechange", 1.2);
  h.dispatch(wheel({ ctrlKey: true, deltaY: -50 }));
  h.gesture("gesturechange", 1.4); h.gesture("gestureend", 1.4); h.flush();
  near(h.context.zoom, start.zoom * 1.4); assert.equal(h.applied.length, 1);
  h.cleanup();
});

test("unmount cancels pending input and removes gesture listeners", () => {
  const h = harness(); h.dispatch(wheel({ deltaY: 20 })); h.cleanup();
  assert.equal(h.frames.size, 0);
  assert.equal(h.dispatch(wheel({ deltaY: 20 })).defaultPrevented, false);
  h.flush(); assert.equal(h.applied.length, 0);
});
