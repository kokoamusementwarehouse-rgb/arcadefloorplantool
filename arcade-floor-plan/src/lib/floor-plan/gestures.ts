type Point = { x: number; y: number };
export type CanvasView = { zoom: number; pan: Point };
type Limits = { min: number; max: number };
type GestureContext = CanvasView & {
  viewport: { width: number; height: number };
  enabled: boolean;
  /** Invalidates queued input if the plan or fitted scale changes. */
  identity: unknown;
  basis: number;
};
type SafariGestureEvent = Event & { scale: number; clientX: number; clientY: number };

export function zoomViewAtPoint(view: CanvasView, requestedZoom: number, point: Point, limits: Limits): CanvasView {
  const zoom = Math.min(limits.max, Math.max(limits.min, requestedZoom));
  const ratio = zoom / view.zoom;
  return { zoom, pan: { x: point.x - (point.x - view.pan.x) * ratio, y: point.y - (point.y - view.pan.y) * ratio } };
}

export function wheelView(view: CanvasView, event: Pick<WheelEvent, "deltaX" | "deltaY" | "deltaMode" | "ctrlKey">, point: Point, viewport: { width: number; height: number }, limits: Limits, coordinateScale: Point = { x: 1, y: 1 }): CanvasView {
  const unitX = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.width / coordinateScale.x : 1;
  const unitY = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.height / coordinateScale.y : 1;
  const dx = event.deltaX * unitX;
  const dy = event.deltaY * unitY;
  // Chromium/Firefox expose trackpad pinch as Ctrl+wheel. Plain wheel input
  // (including horizontal/diagonal two-finger scrolling) pans the view.
  if (event.ctrlKey) return zoomViewAtPoint(view, view.zoom * Math.exp(-Math.max(-100, Math.min(100, dy)) * 0.01), point, limits);
  return { zoom: view.zoom, pan: { x: view.pan.x - dx * coordinateScale.x, y: view.pan.y - dy * coordinateScale.y } };
}

/** Canvas-only, non-passive listeners; high-frequency input commits once per frame. */
export function bindCanvasGestures(element: HTMLElement, options: {
  read: () => GestureContext;
  apply: (view: CanvasView) => void;
  limits: Limits;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (id: number) => void;
}) {
  const requestFrame = options.requestFrame ?? requestAnimationFrame;
  const cancelFrame = options.cancelFrame ?? cancelAnimationFrame;
  let frame: number | null = null;
  let pending: { base: GestureContext; view: CanvasView } | null = null;
  let safariScale: number | null = null;
  const matches = (base: GestureContext, current: GestureContext) => current.enabled
    && base.identity === current.identity && base.basis === current.basis
    && base.viewport.width === current.viewport.width && base.viewport.height === current.viewport.height
    && base.zoom === current.zoom && base.pan === current.pan;
  const viewFor = (context: GestureContext) => pending && matches(pending.base, context) ? pending.view : context;
  const geometry = (event: { clientX: number; clientY: number }, context: GestureContext) => {
    const rect = element.getBoundingClientRect();
    const scale = { x: context.viewport.width / Math.max(1, rect.width), y: context.viewport.height / Math.max(1, rect.height) };
    return { scale, point: {
      x: Number.isFinite(event.clientX) ? (event.clientX - rect.left) * scale.x : context.viewport.width / 2,
      y: Number.isFinite(event.clientY) ? (event.clientY - rect.top) * scale.y : context.viewport.height / 2,
    } };
  };
  const queue = (context: GestureContext, view: CanvasView) => {
    pending = { base: context, view };
    if (frame !== null) return;
    frame = requestFrame(() => {
      frame = null;
      const next = pending;
      pending = null;
      // A toolbar fit, navigation or hydration may have happened meanwhile.
      if (next && matches(next.base, options.read()) && (next.view.zoom !== next.base.zoom || next.view.pan.x !== next.base.pan.x || next.view.pan.y !== next.base.pan.y)) options.apply(next.view);
    });
  };
  const onWheel = (event: WheelEvent) => {
    const context = options.read();
    if (!context.enabled || event.buttons) return;
    event.preventDefault();
    if (safariScale !== null) return; // Safari must not process both event streams.
    const { point, scale } = geometry(event, context);
    queue(context, wheelView(viewFor(context), event, point, context.viewport, options.limits, scale));
  };
  const onGestureStart = (raw: Event) => {
    if (!options.read().enabled) return;
    raw.preventDefault();
    safariScale = 1;
  };
  const onGestureChange = (raw: Event) => {
    const event = raw as SafariGestureEvent;
    const context = options.read();
    if (safariScale === null || !context.enabled || !Number.isFinite(event.scale) || event.scale <= 0) return;
    raw.preventDefault();
    const { point } = geometry(event, context);
    const view = viewFor(context);
    queue(context, zoomViewAtPoint(view, view.zoom * event.scale / safariScale, point, options.limits));
    safariScale = event.scale;
  };
  const onGestureEnd = (event: Event) => { if (safariScale !== null) event.preventDefault(); safariScale = null; };
  const listenerOptions = { passive: false };
  element.addEventListener("wheel", onWheel, listenerOptions);
  element.addEventListener("gesturestart", onGestureStart, listenerOptions);
  element.addEventListener("gesturechange", onGestureChange, listenerOptions);
  element.addEventListener("gestureend", onGestureEnd, listenerOptions);
  return () => {
    element.removeEventListener("wheel", onWheel);
    element.removeEventListener("gesturestart", onGestureStart);
    element.removeEventListener("gesturechange", onGestureChange);
    element.removeEventListener("gestureend", onGestureEnd);
    if (frame !== null) cancelFrame(frame);
    pending = null;
  };
}
