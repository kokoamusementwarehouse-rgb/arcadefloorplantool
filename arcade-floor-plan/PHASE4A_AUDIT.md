# Phase 4A — Feature Completeness Audit

## Summary

| Working | Partial | Disabled | Stale | Missing |
| ---: | ---: | ---: | ---: | ---: |
| 19 | 7 | 8 | 0 | 2 |

| P0 | P1 | P2 | P3 |
| ---: | ---: | ---: | ---: |
| 0 | 2 | 5 | 4 |

Phase 4A made only small completeness changes: dead header controls are now visibly disabled, the persistence label says `Auto-saved locally`, Toggle Panels works, unsupported canvas actions disable when there is no floor plan, raw Properties actions are styled, a clear desktop-only fallback is present below 900 px, and dead scaffolding was removed.

## Feature audit

| Area | Control / Feature | Status | Severity | Current Behaviour | Expected Behaviour | Recommendation | Phase |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Header | Dashboard | DISABLED | P3 | Explicitly disabled with an MVP explanation. | No dead navigation. | Keep disabled until a real dashboard exists. | 4B+ |
| Header | Floor Plans | WORKING | P3 | Correct active route. | Active route communicates current location. | None. | Complete |
| Header | Machine Catalog navigation | DISABLED | P3 | Explicitly disabled; catalogue is available through the venue panel. | Avoid duplicate dead navigation. | Add a dedicated catalogue route only with real management flows. | 4B+ |
| Header | Venue / layout selector | DISABLED | P2 | Shows context but no longer pretends to be a dropdown. | Venue and layout selection should be real when presented as a dropdown. | Build venue + multi-layout selection together. | 4B |
| Header | Settings / Help | DISABLED | P3 | Explicitly disabled. | No inert icon buttons. | Add only when scopes are defined. | Later |
| Header | Save indicator | PARTIAL | P1 | `Auto-saved locally` reflects automatic IndexedDB writes, but has no saving/error lifecycle. | State should distinguish saving, saved and failed. | Add a persistence-status state. | 4B |
| Header | Save | DISABLED | P2 | Disabled because auto-save is the current MVP behaviour. | A visible Save must perform a real explicit persistence action. | Either add immediate save confirmation or remove it. | 4B |
| Header | Export | DISABLED | P1 | Explicitly disabled; placeholder export module was removed. | Export needs a real format and scope. | Implement PNG/PDF export decisions in a separate phase. | 4B |
| Workspace | Collapse / expand | WORKING | P3 | Persists locally and reflows mapping lines. | Stable compact workspace. | None. | Complete |
| Workspace | Single workspace switch | DISABLED | P3 | Explicitly disabled. | No inert workspace selector. | Enable only with multiple workspaces. | Later |
| Workspace | Venue projects | WORKING | P2 | Venue switching loads the associated floor plan/layout. | Active venue should be retained on reload. | Persist current venue preference. | 4B |
| Workspace | Add venue | DISABLED | P2 | Clearly disabled with explanation. | No usable-looking empty action. | Build project creation with validation. | 4B |
| Transfer Buffer | Create, open, rename, empty-delete protection | WORKING | P2 | Prompt-based CRUD works; non-empty deletion is blocked. | Buffer remains globally consistent. | Replace prompts with polished dialogs later. | 4B+ |
| Transfer Buffer | Select / move / return | WORKING | P2 | Transfers remove venue ownership and footprint; return restores source venue. | A physical unit cannot be in two places. | Add explicit confirmations for bulk transfer. | 4B+ |
| Transfer Buffer | Direct drag to plan | PARTIAL | P1 | Code path creates a LayoutMachine, assigns the destination venue and removes the Buffer item. Browser harness lacks native pointer-drag support, so this exact gesture was not replayed. | Real drag must be browser-verified. | Re-run with a drag-capable browser harness before release. | 4B gate |
| Venue Machines | Search and All / Placed / Unplaced filters | WORKING | P3 | Filtered list and selection work. | Fast machine finding. | None. | Complete |
| Venue Machines | Dimensions and shared/custom rules | PARTIAL | P2 | Standard edits affect catalogue siblings; custom edits stay on one venue unit. Dimension changes do not enter canvas undo history. | Predictable edits with undo policy. | Decide whether dimension changes belong in history, then implement consistently. | 4B |
| Venue Machines | List density | PARTIAL | P3 | Wrapping was tightened; narrow widths remain information-dense. | Code, status and dimensions remain scannable. | Continue UI-density review with real production data. | 4B |
| Toolbar | Toggle Panels | WORKING | P3 | Now hides/restores side panels and preserves canvas. | Button has a real action. | None. | Complete |
| Toolbar | Select / Pan / Zoom / Fit | WORKING | P3 | Controls operate and disable without a floor plan. | No meaningless enabled controls. | Keyboard shortcuts are optional later polish. | Later |
| Toolbar | Undo / Redo | PARTIAL | P2 | Covers placement/move/rotate/remove; does not cover dimensions/background. | History scope should be explicit and consistent. | Expand or label the history scope. | 4B |
| Toolbar | Background edit / calibration | PARTIAL | P2 | Background mode protects machine movement; calibration is disabled during background edit. Background changes are not undoable. | Clear, reversible editing. | Decide on background undo behaviour. | 4B |
| Toolbar | Upload / replace | WORKING | P2 | PNG/JPEG/WebP validation, replacement and local persistence work. | Clear upload state. | Consider a confirmation before replacement. | 4B+ |
| Properties | Locate, rotate, remove, custom dimensions | WORKING | P2 | Operations work and action styling is now consistent. | Polished active-machine actions. | None beyond later refinements. | Complete |
| Visual Panel | Three-column default and saved preference | WORKING | P2 | Fresh default is 3; user column choice persists after refresh. | Dense visual identification without losing user choice. | None. | Complete |
| Connections | Selected / Show All / resize tracking | WORKING | P2 | Default stays clean; visible all-lines mode is faint and event-driven. | Correct, non-blocking mapping. | None. | Complete |
| Full Store View | Mapping / selection / exit | WORKING | P2 | 50 cards and 50 footprints were observed; selection is bidirectional and normal viewport returns. | Whole-store presentation without duplicate data. | None. | Complete |
| Responsive | Below 900 px | WORKING | P2 | Editing UI is intentionally replaced with a desktop-editor message. | Avoid unusable partially hidden mobile editor. | Add read-only/mobile browsing only if required. | Later |
| Persistence | Layout / floor plan / global machine data | PARTIAL | P1 | These persist in IndexedDB. Current venue, selected machine, active tab, zoom/pan and full-store mode do not persist. | Persist user preference where expected, not transient interaction state. | Persist current venue; document intentional transient state. | 4B |
| Empty states | No floor plan / no selection / no visual cards | WORKING | P3 | Current copy explains the next useful action and contains no development-phase messaging. | Clear, current guidance. | Add no-search-results copy when needed. | Later |
| Dead code | Empty components / placeholder export | WORKING | P3 | Removed `ScaleCalibration`, duplicate `PropertiesPanel` alias and deferred export scaffold. | No misleading unused product scaffolding. | Keep dead-code scan in CI/review. | Complete |

## Top issues before MVP release

1. **P1 — Export has no product implementation.** It is now honestly disabled; Phase 4B must choose formats and normal/full-store scope.
2. **P1 — Persistence status is only optimistic.** Auto-save writes locally but does not expose saving/failure state, and current venue is lost on refresh.
3. **P1 — Transfer Buffer direct drag needs a real pointer-drag regression test.** Data-path review is sound, but the exact gesture remains unverified in this browser harness.
4. **P2 — Layout selector and Add Venue are intentionally unavailable.** Both should become real only as one coherent project/layout feature.
5. **P2 — Undo/redo scope is incomplete.** Dimension and background edits are outside its current history.
6. **P2 — Background movement is persistent but not reversible.** Add history support or a dedicated reset action.
7. **P2 — Desktop-only fallback is clear but not a mobile workflow.** This is acceptable for MVP only if desktop editing is a stated requirement.
8. **P2 — Dense Venue Machines rows still need final production-data visual tuning.** The audit improved no-wrap behaviour, but the left column remains compact.
9. **P3 — Buffer CRUD uses browser prompts.** Functional but not visually consistent with the rest of the product.
10. **P3 — Header contains several intentionally disabled MVP affordances.** A later navigation/product shell pass should remove or implement them.

## Suggested Phase 4B

1. Implement honest persistence lifecycle (`Saving`, `Saved`, `Could not save`) plus active-venue persistence.
2. Define and implement minimal export: PNG first, then PDF only if needed; support normal editor and Full Store View intentionally.
3. Implement venue/project creation and a real multi-layout selector together.
4. Establish undo/redo policy for dimensions and background movement.
5. Add drag-capable browser regression coverage for Transfer Buffer direct drop.

## Validation

| Check | Result |
| --- | --- |
| TypeScript | PASS |
| Production build | PASS |
| Transfer Buffer direct drag | FAIL — exact pointer drag cannot be issued by the available browser harness; data path audited |
| All toolbar controls audited | PASS |
| Header controls audited | PASS |
| Persistence audited | PASS |
| Responsive states audited | PASS — CSS fallback inspected; no resize-capable browser screenshot surface |
| Stale copy searched | PASS |
| Dead components audited | PASS |
| Data integrity audited | PASS — code-path review and Buffer state browser flow |
| Rhodes browser QA | PASS |
| Dense Layout browser QA | PASS |
| Browser console | PASS — no runtime/error surface observed during interaction |
