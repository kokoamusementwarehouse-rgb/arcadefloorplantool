# Floor Plan performance review — 12 October 2026

Baseline: `ff2180a1` on main. Production Rhodes Warehouse was observed with
123 placed machines and the all-connections checkbox unchecked.

## Findings and fixes

Whole-store Zustand subscriptions caused pointer-state changes to rerender the
editor shell, sidebar, inventory rows, card panel and all Konva machine objects.
Repeated array searches also ran while constructing the machine lists.

The changes scope subscriptions to the state each component uses, memoize
unchanged footprints and visual cards, use in-memory ID lookup maps, and keep
interaction callbacks stable. Layout arrays still determine placement order.

Review identified an additional hot path in MachineConnection: changing pan or
hover recreated its ResizeObserver, MutationObserver and event listeners. The
review fix keeps their scheduling callback stable and reads the latest calculation
through a ref. Observer targets are reconciled when cards mount/unmount. When no
connection is active, geometry measurements are skipped.

No store mutation, database command, schema, machine-code or persistence logic
was changed. IDs used for lookups are existing record IDs, not displayed codes.

## Comparative browser verification

A temporary browser harness rendered baseline and updated source with identical
123-machine fixtures, the same production-built stylesheet, dimensions,
background offset and scale. Supabase was disabled; persistence used temporary
test adapters. No production records were created or modified.

| Work during 60 pan updates | Baseline | Updated |
| --- | ---: | ---: |
| MachineObject renders | 7,380 | 0 |
| MachineLibraryItem renders | 7,380 | 0 |
| Sidebar/editor/card-panel renders | 60 each | 0 each |
| ResizeObserver observe calls | 7,560 | 0 |
| Observer disconnects | 60 | 0 |
| Business/cache writes caused by pan | 0 | 0 |

The hover comparison also confirmed only the affected machine footprints and
memoized visual cards update; unrelated inventory rows and the editor shell do
not. Continuous updates were driven independently of background-tab rAF
throttling. These are render-work counts, not production FPS measurements.
Timing measurements were not used as an acceptance threshold because other tabs,
development instrumentation and background scheduling make them noisy.

## Interaction regression

- Visual card selection and Locate on Plan: passed.
- Zoom 50% → 60%: machine center matched the expected transformed coordinates;
  numerical error below `1e-12` pixels.
- Drag after zoom: a 45-pixel movement updated physical coordinates correctly;
  rendered-coordinate error was zero; connection endpoint followed the footprint.
- Undo: original machine position restored.
- Fit to screen: returned to 50%, position unchanged, coordinate error zero.
- Pan and hover: zero fixture persistence writes. Drag/undo wrote only to test
  adapters. No external business mutations were enabled.
- Coordinate, zoom, navigation and cloud-write safety suite: 21/21 core tests passed.
- TypeScript, production build and git diff checks: passed.

The changes remove confirmed sources of redundant work at the observed machine
count. Actual production FPS on the user's device still depends on browser,
display and image rendering; it is not represented by the synthetic benchmark.
