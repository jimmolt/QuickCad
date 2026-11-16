# QuickCad

Pencil-first parametric sheet metal CAD for iPad. Single-file HTML app: sketch, dimension, face, cut, flange, and export a flat pattern as DXF.

Live: https://jimmolt.github.io/QuickCad/

## Source
`src/` (app.js, part.js, app.html) builds to the single-file `index.html` with `npm install && node build.mjs` (writes `dist/index.html`; copy it over `index.html` to publish). Tests are Playwright scripts in `tests/` (run from the repo root with Chrome).
