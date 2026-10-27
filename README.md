# PlantUML Live Editor

A private, fully client-side PlantUML editor inspired by Mermaid Live Editor.
Source is edited with CodeMirror and rendered as SVG by PlantUML's official
TeaVM browser engine. Graphviz WASM is embedded in the final HTML.

A public instance is available at
[peterder72.github.io/plantuml-live-editor](https://peterder72.github.io/plantuml-live-editor/).

## Release 0.7.0

Adds VS Code Copilot tools, validation/export commands, and workspace tasks.
See the [automation guide](vscode/README.md#copilot-tools-and-automation) for usage
and [CHANGELOG.json](CHANGELOG.json) for the full release history.

## Syntax diagnostics

The editor highlights syntax errors on the reported source line in the web
editor, with a gutter marker and a hover tooltip. VS Code shows native error
squiggles and Problems entries while the preview is open. Diagnostics clear on
edits and document changes; stale render results cannot mark a newer snapshot.
Failed renders preserve the last valid diagram and its pan and zoom position.
Errors without a valid source location appear in the render status only.

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

VS Code tests provision the version pinned in `.vscode-test-version` in a
separate Node process before starting the Bun test runner. Keep that provisioning
boundary intact: a recovered archive-download failure must not affect the test
process's exit status.

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
every pull request, push to `main`, `v*` version tag, and manual workflow run.
Only the `main` branch path deploys GitHub Pages, after all three jobs pass.
Version tags retain the stable VS Code Marketplace publication and GitHub
release jobs, with the release reusing artifacts built by the tested web and
VS Code jobs. Failure diagnostics are retained as workflow artifacts.

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

The root `package.json` is the release-version source of truth, and
`CHANGELOG.json` is the release-history source of truth. VS Code builds
synchronize the version into the extension manifest and generate
`vscode/CHANGELOG.md` from the JSON before verification and packaging. Tagged
GitHub releases use the matching JSON entry as their release notes.

### Opt-in Autofac pre-release publishing

Autofac is released as VS Code version **0.9.0** on the Marketplace's
**pre-release channel**, not as a stable update. VS Code requires a numeric
`major.minor.patch` extension version; `--pre-release` marks the channel rather
than adding a SemVer suffix. Existing stable-channel users are not automatically
updated to this pre-release. To try it, select **Switch to Pre-Release Version**
on the extension's Marketplace page in VS Code; switch back to the release
version to leave that channel.

This prerelease distribution uses **GPL-3.0-or-later**, matching the bundled
Autofac engine. The extension includes the full GPL and retains the editor's
original MIT notice and third-party attributions. See
[`vscode/THIRD_PARTY_NOTICES.md`](vscode/THIRD_PARTY_NOTICES.md) for corresponding
source links. This does not change the licensing or engine of existing stable Marketplace versions.

Version 0.9.0 is a breaking language update: the old `composition`, `resolve`,
`expect` and `invoke` statements are removed. Declare lifetimes and objects,
author `create`/`destroy` transitions, and use marker events plus native PlantUML
arrows, groups and notes. Outcomes are ordinary labels, not engine predictions.
See [`examples/autofac.puml`](examples/autofac.puml) and the
[engine examples](https://github.com/peterder72/plantuml-extended/tree/feature/autofac/autofac-examples)
for the current grammar. Sources written for extension 0.8.0 require migration.

After pushing `feature/autofac`, a maintainer can explicitly dispatch the
existing default-branch workflow at that feature ref:

```sh
gh workflow run deploy-pages.yml \
  --repo peterder72/plantuml-live-editor \
  --ref feature/autofac \
  --field publish_prerelease=true
```

The boolean `publish_prerelease` input defaults to `false`. Publication requires
`feature/autofac`, extension/root version `0.9.0`, and the exact bundled engine
dependency `@peterder72/plantuml-core@1.2026.7-autofac.2`. Quality/unit, web-browser,
and VS Code integration/scenario jobs must all pass. The VS Code job packages
its verified build with `vsce package --pre-release`; the publisher downloads
that run's `autofac-prerelease-vsix` artifact, checks its checksum, identity,
version, and pre-release metadata, and publishes that exact VSIX with
`--packagePath` without rebuilding.

Authentication reuses the `vscode-marketplace` environment and Azure OIDC
configuration used by stable publishing. Any environment branch restrictions
must permit `feature/autofac`. A feature-branch dispatch does not deploy Pages,
create a GitHub release, or create/push a tag. Feature pushes do not automatically
publish anything. Keep `bun run publish:vscode` and `v*` tags for stable releases;
neither is the opt-in pre-release entry point.

After installing the VSIX, open a PlantUML document. The lightweight
**PlantUML Controls** view opens below the File Explorer for live toggles,
named views, and wrapping selected source. Use **Open Preview** there, the
editor-title button, or **PlantUML: Open Preview to the Side** to open the
diagram. Viewport actions, export, render status, and interaction guidance sit
directly on the preview canvas. Both webviews remain fully offline.

### Copilot tools and automation

VS Code now provides Copilot tools to validate PlantUML, export SVG/PNG images,
inspect live flags and named views, and open previews. The Command Palette also
includes **PlantUML: Check for Errors**, **PlantUML: Export Diagram**, and
**PlantUML: Inspect Flags and Views**.

Validation and export use current unsaved source and an isolated offline renderer,
preserving the interactive preview and viewport. Named views can be rendered
without editing source. Workspace validation and configurable validation/export
tasks support repeatable checks and image generation.

See the [extension automation guide](vscode/README.md#copilot-tools-and-automation)
for tool inputs, export options, and task configuration.

## Architecture

- `src/rendering/` initializes Viz.js before PlantUML, serializes renders,
  rejects stale results, and sanitizes SVG.
- `src/editor/` owns the CodeMirror integration and lightweight PlantUML
  highlighting.
- `src/preview/` owns pan, pointer-centered zoom, fit, reset, and persistent
  transform state.
- `src/state/` persists source locally without making storage availability a
  requirement.
- `src/vscode/` contains the separate preview and Explorer-controls webview
  shells plus their extension-host message contract.
- `vscode/` contains the VS Code extension host, manifest, and build targets.

## Known Limitations

- Browser-rendered diagrams are limited to 8192 × 8192 pixels.
- Remote `!include` files and network resources are intentionally unsupported.
- A restrictive Content Security Policy, startup network lockdown, source
  validation, and inert-SVG allowlist prevent the application and renderer from
  initiating network requests. This assumes an uncompromised browser and OS.
- Autocomplete, diagnostics beyond engine-reported syntax errors, and sharing
  are outside the MVP.

## Nix development

With Nix flakes enabled, run these commands from the repository root:

```sh
nix develop
bun install --frozen-lockfile
bun run dev
```

Launch a clean VS Code with a freshly built and packaged extension:

```sh
nix run .#vscode
# Or open a particular diagram:
nix run .#vscode -- examples/components.puml
```

The launcher builds the current working checkout, including uncommitted edits,
installs the VSIX into a new temporary extensions directory, and opens a fresh
user profile. Your normal VS Code settings and extensions are untouched. Close
its window to remove the temporary profile. From `nix develop`, the same command
is available as `plantuml-vscode` (or `bun run dev:vscode`).

`flake.lock` pins Nix tools for Apple Silicon macOS and aarch64/x86_64 Linux; `bun.lock` pins JavaScript
dependencies. The first invocation needs network access to fetch tools and
packages. The extension itself renders offline. This is a development launcher:
the extension build runs in the writable checkout, outside the Nix sandbox.
VS Code is supplied by Nixpkgs under its unfree license.

Try `examples/shop.puml` for classes and member visibility, or
`examples/components.puml` for components. Both declare live flags you can toggle
in **PlantUML Controls**. Use **Open Preview** to render, and create named views
to save different flag combinations.
