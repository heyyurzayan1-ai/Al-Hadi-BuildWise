# Al-Hadi BuildWise — Modular v2

This is a separate clean implementation. It does not overwrite the previous app files.

## Open
Open `app-v2.html` on the published GitHub Pages site.

## Modules
- `core/state-v2.js`: project state
- `core/app-v2.js`: UI events and app startup
- `editor/drawing-v2.js`: plan rendering
- `ai/gemini-v2.js`: Gemini layout generation
- `exports/exporters-v2.js`: JSON, SVG, DXF, BIM-style JSON and print/PDF
- `styles/app-v2.css`: styling

## Important
The BIM JSON is structured BIM-style data, not an IFC file. PDF uses the browser print dialog. Browser-based Gemini calls expose the API key to the browser environment; use a restricted key and never commit it to GitHub. This is an initial modular foundation, not yet a construction-certified CAD/BIM system.