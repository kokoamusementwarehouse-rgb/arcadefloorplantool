# Phase 1 Design QA

- Source visual truth: `/var/folders/yd/8gn91k812kvgnbk5tyzh8xn40000gn/T/codex-clipboard-21ff98bf-9b4e-4302-8c4e-6a6adec2f4c7.png`
- Implementation URL: `http://localhost:3000/floor-plan`
- Viewport: desktop browser, 1280 × 768 CSS px, device scale factor 1.

## Evidence

1. Empty venue project: `artifacts/phase-1-empty.png`
2. Uploaded plan fitted to workspace: `artifacts/phase-1-uploaded-fit.png`
3. Calibration points and known-distance dialog: `artifacts/phase-1-calibration.png`
4. Reloaded calibrated plan: `artifacts/phase-1-persisted.png`

## Findings

No actionable P0, P1, or P2 findings within Phase 1 scope.

- Typography and layout: the compact header, project list, Venue Machines list, canvas, and properties panel retain the Phase 0 desktop SaaS rhythm.
- Colors: the muted indigo, slate, white panels, and subtle editor grid stay aligned with the supplied visual direction.
- Imagery: the uploaded floor plan is rendered as an unselectable Konva background, with its native aspect ratio preserved.
- Copy: the project sidebar distinguishes venue projects from the separate Machine Catalog, while the standard machine list remains `Venue Machines`.

## Intentional scope differences

- Machine footprints, external machine cards, connections, and final Full Store View mapping remain absent by Phase 1 requirement.
- The sample uploaded plan is the supplied visual reference, used only to validate image upload, fit, pan/zoom, and calibration.

## Interaction evidence

- Uploaded PNG decoded as `1672 × 941 px`, was fitted at 32%, and restored after reload with scale `1 px = 8.10 mm`.
- A 5000 mm calibration across two world-space points created the stored scale value.
- Zoom and pan mutate only viewport state. The scale calculation uses `world = (screen - pan) / zoom`, so calibration distance is independent of zoom.
- Browser console had no error-level messages after upload, calibration, project switch, and reload.

final result: passed
