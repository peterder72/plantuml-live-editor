# PlantUML Live Editor Agent Guide

## Purpose

This repository builds a browser-only PlantUML editor. Its production result is
one offline HTML file containing the application, PlantUML TeaVM engine, and
Graphviz WASM.

## Architecture Boundaries

- Do not add a backend, PlantUML server, Java runtime, CDN, or runtime network
  dependency.
- Keep SVG rendering in `src/rendering/`.
- Keep viewport transform state independent from rendered SVG content.
- An ordinary render must never trigger fit, reset, recenter, or transform
  replacement.
- Preserve the last valid SVG when a render fails.
- Sanitize every SVG string before inserting it into the DOM.

## Commands

```sh
bun install
bun run dev
bun run typecheck
bun run lint
bun run test
bun run build
bun run test:e2e
```

## Verification Expectations

- `bun run build` must leave only `dist/index.html`.
- Open the artifact by `file://`; it must render class/component diagrams
  without network requests.
- Tests must cover transform math, SVG sanitization, stale render handling, and
  transform persistence across SVG replacement.
- Browser tests require a Playwright Chromium installation.

## Constraints

- PlantUML browser output is currently limited to 8192 pixels per dimension.
- The MIT browser engine does not include Sudoku diagrams.
- Remote includes and resources are unsupported in the offline MVP.
