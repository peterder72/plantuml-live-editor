# PlantUML Live Editor

A private, fully client-side PlantUML editor inspired by Mermaid Live Editor.
Source is edited with CodeMirror and rendered as SVG by PlantUML's official
TeaVM browser engine. Graphviz WASM is embedded in the final HTML.

## Prerequisites

Install [Bun](https://bun.sh/):

```sh
curl -fsSL https://bun.sh/install | bash
```

## Development

```sh
bun install
bun run dev
```

Quality checks:

```sh
bun run typecheck
bun run lint
bun run test
```

## Offline Build

```sh
bun run build
```

The build verifier requires `dist/index.html` to be the only output and checks
that the embedded Graphviz WASM payload and zero-egress security controls are
present. Open that file directly in a current Chrome, Edge, or Firefox browser;
no server or network is required.

For the browser test:

```sh
bunx playwright install chromium
bun run test:e2e
```

## Architecture

- `src/rendering/` initializes Viz.js before PlantUML, serializes renders,
  rejects stale results, and sanitizes SVG.
- `src/editor/` owns the CodeMirror integration and lightweight PlantUML
  highlighting.
- `src/preview/` owns pan, pointer-centered zoom, fit, reset, and persistent
  transform state.
- `src/state/` persists source locally without making storage availability a
  requirement.

## Known Limitations

- Browser-rendered diagrams are limited to 4096 × 4096 pixels.
- Sudoku is excluded from PlantUML's MIT browser package.
- Remote `!include` files and network resources are intentionally unsupported.
- A restrictive Content Security Policy, startup network lockdown, source
  validation, and inert-SVG allowlist prevent the application and renderer from
  initiating network requests. This assumes an uncompromised browser and OS.
- Autocomplete, rich diagnostics, export, sharing, and multiple documents are
  outside the MVP.
