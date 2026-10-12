# Trackpad navigation verification — 12 October 2026

## Behavior

Floor Plan canvas scrolling pans horizontally/vertically in the default Select
tool. Trackpad pinch zooms around the event location. Mouse dragging, toolbar
zoom, Fit to screen, calibration and machine placement remain available. Sidebar
scrolling is handled by its own normal scroll container.

The listener is attached only to the Konva canvas content, with `passive: false`
so the canvas can consume scrolling/pinch without browser page navigation.
Pixel, line and page wheel deltas are normalized; coordinates are converted
from the canvas bounding rectangle to its logical viewport. Chromium-style
Ctrl+wheel pinch and Safari's separate gesture scale stream are supported.

Only `zoom` and `pan` are updated, together, once per animation frame. Queued
events cannot replace a subsequent toolbar fit, plan switch or viewport change.
Unmount cancels pending work and removes the listeners. No cloud mutation,
machine coordinates, background offsets or map calibration are changed by a
navigation gesture.

## Checks

- 34/34 core tests passed, including 13 new gesture tests.
- TypeScript and the production build passed.
- Actual Konva canvas integration in an isolated 123-machine browser fixture:
  pinch and scroll default behavior was prevented; zoom-in succeeded; the
  pointer anchor, pan delta and rendered footprint had zero coordinate error.
- 100 wheel packets before a frame produced exactly one view-state commit,
  preserving all deltas.
- The same integration retained one selected-machine connector, and physical
  machine/floor-plan data stayed identical. Zero cache/cloud writes occurred
  during gestures.
- Native browser scrolling over the canvas panned it while Select remained
  active; scrolling over the machine list scrolled that list and left the map
  pan/zoom unchanged.
- Mouse drag after navigation moved the test footprint by 30 × 20 pixels with
  zero coordinate error; Undo restored it. These writes went only to temporary
  fixture adapters.

Pinch integration used generated Ctrl+wheel events on the real Konva canvas.
Safari gesture scaling was covered by unit tests, not a physical Safari/device
test. Native scrolling was exercised through the browser control interface.
The fixture had Supabase disabled and never modified real production records.

## Browser event references

- [MDN wheel event](https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event)
- [Apple GestureEvent](https://developer.apple.com/documentation/webkitjs/gestureevent)
