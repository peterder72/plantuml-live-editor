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

Install the browser binaries once, then run every quality check, verified
build, browser test, Extension Host test, and Cucumber scenario with:

```sh
bunx playwright install chromium firefox
bun run test:all
```

On headless Linux, provide a virtual display for the VS Code Extension Host:

```sh
bunx playwright install --with-deps chromium firefox
xvfb-run -a bun run test:all
```

## Offline Build

```sh
bun run build
```

The build verifier requires `dist/index.html` to be the only output and checks
that the embedded Graphviz WASM payload and zero-egress security controls are
present. Open that file directly in a current Chrome, Edge, or Firefox browser;
no server or network is required.

Install the Playwright browsers used by the Cucumber web drivers:

```sh
bunx playwright install chromium firefox
bun run test:e2e
```

`test:e2e` is the aggregate end-to-end entry point. It runs the Cucumber
scenarios through Playwright on Chromium and Firefox, then in the VS Code
Extension Host. The same scenarios can be run together or by surface:

```sh
bun run test:scenarios
bun run test:scenarios:web
bun run test:scenarios:vscode
```

GitHub Actions uses Bun 1.3.14 and runs the quality, web, and VS Code suites on
every pull request and push to `main`. A `main` build is deployed to GitHub
Pages only after all three jobs pass. Failure diagnostics are retained as
workflow artifacts.

Unit tests continue to own sanitizer details, transform math, stale-render
algorithms, and source-rewrite edge cases. Common Gherkin scenarios and the
rules for platform-only coverage are described in `user-scenarios/README.md`.

## VS Code Extension

Build the extension host and offline preview webview:

```sh
bun run build:vscode
```

Create an installable VSIX:

```sh
bun run package:vscode
```

The root `package.json` is the release-version source of truth. VS Code builds
synchronize that version into the extension manifest before verification and
packaging.

After installing the VSIX, open a PlantUML document and run
**PlantUML: Open Preview to the Side**. The extension uses VS Code's native text
editor with bundled PlantUML syntax highlighting and keeps rendering, live
toggles, pan, zoom, fit, reset, and export in an offline webview.

## Architecture

- `src/rendering/` initializes Viz.js before PlantUML, serializes renders,
  rejects stale results, and sanitizes SVG.
- `src/editor/` owns the CodeMirror integration and lightweight PlantUML
  highlighting.
- `src/preview/` owns pan, pointer-centered zoom, fit, reset, and persistent
  transform state.
- `src/state/` persists source locally without making storage availability a
  requirement.
- `src/vscode/` is the shared preview webview shell and message contract.
- `vscode/` contains the VS Code extension host, manifest, and build targets.

## Known Limitations

- Browser-rendered diagrams are limited to 8192 × 8192 pixels.
- Sudoku is excluded from PlantUML's MIT browser package.
- Remote `!include` files and network resources are intentionally unsupported.
- A restrictive Content Security Policy, startup network lockdown, source
  validation, and inert-SVG allowlist prevent the application and renderer from
  initiating network requests. This assumes an uncompromised browser and OS.
- Autocomplete, rich diagnostics, and sharing are outside the MVP.
