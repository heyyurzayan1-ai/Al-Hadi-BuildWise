# Al Hadi BuildWise

A Pakistan-first, mobile-friendly architecture and construction planning prototype.

## Current features
- Project dimensions and floor-area calculator (square feet and square meters).
- Interactive 2D concept floor-plan editor.
- Add common room types, select rooms, and edit room names, dimensions and positions.
- Door/window markers, grid toggle and basic overlap warning.
- Export the current drawing as SVG.
- Local-device save using browser storage.
- Progressive Web App metadata and a service worker for offline caching after the first successful load.

## Run locally
Open `index.html` through a local static web server. The service worker requires HTTPS or localhost. GitHub Pages provides HTTPS.

## Important limitations
This is a concept-planning prototype, not professional CAD/BIM software. It does not generate structural calculations, building-code approvals, verified bills of quantities, live supplier rates, or construction-ready drawings. Site conditions, structure, fire safety, electrical and plumbing designs must be reviewed by appropriately qualified local professionals.

## Roadmap
1. Improve 2D geometry: wall thickness, openings with dimensions, snapping and drag-to-move.
2. Add print/PDF export, dimension lines and room schedules.
3. Add a 3D preview and model export.
4. Add versioned projects and secure cloud storage.
5. Add sourced, date-stamped Pakistan material-rate data and transparent quantity estimation.
6. Add AI assistance only with clear input provenance, uncertainty and professional review gates.


## Detailed room documentation (v11)
- Per-room ceiling height, floor finish, wall finish, ceiling finish and notes.
- Door and window widths, wall side, swing and door position controls.
- Per-room indicative lighting, socket and switch point counts.
- Ventilation and sanitary/plumbing provision fields.
- Live room schedule with area, finishes, openings and service placeholders.
- PDF room schedule includes the same room specification fields.
- Project JSON format version 3 retains room specification data.

These are design-intent fields and coordination placeholders. They do not calculate electrical loads, circuit sizing, pipe gradients, ventilation rates, fire egress or structural capacity.
