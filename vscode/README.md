# PlantUML Live Editor

PlantUML Live Editor renders PlantUML documents entirely inside VS Code. The
PlantUML TeaVM engine and Graphviz WebAssembly are bundled with the extension,
so previews require no PlantUML server, Java runtime, CDN, or network access.

The extension currently supports the desktop edition of VS Code. It is not a
web extension and does not run in browser-hosted editors such as `vscode.dev`
or `github.dev`.

## Autofac pre-release channel

The Autofac preview is published as numeric version **0.8.0**, marked as a
Marketplace **pre-release**. Stable-channel users do not receive it as an
automatic update. To opt in, open this extension in VS Code's Extensions view
and choose **Switch to Pre-Release Version**. Choose **Switch to Release Version**
to return to the stable channel.

Maintainers publish only through the explicitly enabled, verified feature-branch
workflow described in the
[pre-release publishing guide](https://github.com/peterder72/plantuml-live-editor/tree/feature/autofac#opt-in-autofac-pre-release-publishing).
The ordinary version-tag publishing path remains stable-only.

This prerelease bundles `@peterder72/plantuml-core@1.2026.7-autofac.1` and is
distributed under **GPL-3.0-or-later**. The original editor's MIT copyright and
license notice are retained in `THIRD_PARTY_NOTICES.md`; the complete GPL is
packaged in `LICENSE`. Corresponding source and build instructions are linked
in those notices. Generated diagram images are not covered by the engine's GPL.

## Usage

1. Open a `.puml`, `.plantuml`, `.pu`, `.iuml`, or `.wsd` document.
2. Use the automatically revealed **PlantUML Controls** view below the File
   Explorer to manage live flags, named views, and wrapping selected source.
3. Choose **Open Preview** in that view, run **PlantUML: Open Preview to the
   Side**, or use the preview button in the editor title.
4. Keep editing in VS Code's native editor. The preview updates automatically.

The extension keeps one reusable preview panel and one controls view following
the most recently active PlantUML document. Invalid edits show an error without
discarding the last valid diagram.

## Features

- Built-in PlantUML syntax highlighting and native comment, bracket, and
  auto-closing behavior for every supported file extension.
- Offline class, component, sequence, activity, and other diagrams supported by
  the bundled PlantUML Autofac browser engine.
- Autofac lifetime diagrams with `@startautofac`: construction and active scopes,
  module provenance, authored resolve outcomes, cycles, and disposal. The engine
  draws declared facts; it does not simulate an Autofac container.
- Pointer-centered wheel zoom, touch pinch zoom, drag-to-pan, zoom, fit, and
  reset directly in the preview.
- Persistent viewport position across ordinary rerenders.
- SVG and PNG export from the preview canvas.
- Click a rendered class to add or remove its `hide <name> members` directive.
- Live boolean flags declared as `!$_live_NAME = %false()` or `%true()`.
- Create and rename named flag views, with independent values stored safely in
  a PlantUML comment block.
- Select source lines in the native editor and use **Wrap selection** to place
  them inside the chosen live flag condition.
- Render initialization, progress, duration, and error feedback.
- Native syntax error squiggles and Problems entries for engine-reported source
  lines while the preview is open. Diagnostics clear on edits, document changes,
  and preview disposal; errors without a source location appear in render status.

## Privacy and Security

Rendering happens locally. A restrictive webview Content Security Policy and
runtime network lockdown prevent the renderer from making network requests.
Generated SVG is sanitized before insertion into the preview.

Remote includes, imports, external themes, and remote image resources are
rejected. The extension does not collect telemetry.

## Known Limitations

- Browser-rendered diagrams are limited to 8192 × 8192 pixels.
- Sudoku is not included in the bundled browser build.
- Remote `!include` files and network resources are intentionally unsupported.
- The initial render can take a moment while the embedded engine initializes.

## Support and Source

See the [source repository](https://github.com/peterder72/plantuml-live-editor)
or [report an issue](https://github.com/peterder72/plantuml-live-editor/issues).

## Copilot tools and automation

In VS Code Copilot Chat, enable the extension's tools in the tool picker. You can
ask Copilot to check a diagram, export an image, inspect flags/views, or open a
preview. You can also explicitly reference `#plantumlValidate`,
`#plantumlExport`, `#plantumlInspect`, and `#plantumlPreview`.

| Tool | Inputs | Result |
| --- | --- | --- |
| `plantumlLive_validate` | `documentUri`, optional `view` | Validity, checked document version, and diagnostics with one-based lines (or `null` when unavailable) |
| `plantumlLive_export` | `documentUri`, `outputUri`, optional `format`, `background`, `view`, `overwrite` | Saved artifact URI or render errors |
| `plantumlLive_inspect` | `documentUri` | Flags and current values, named views, and active view |
| `plantumlLive_preview` | `documentUri` | Opens the document in the preview |

URIs must be absolute, for example `file:///Users/me/project/diagram.puml`.
Validation/export read current editor contents, including unsaved changes. They
use an isolated local renderer in a temporary panel that closes when finished;
they do not require or replace the interactive preview. A source change during
rendering fails the operation, so retry against the new version. Cancellation,
closing the temporary panel, or the 60-second timeout ends the operation.

Exports default to SVG with a transparent background. Set `format` to `png` or
`background` to `white` when needed. The destination extension must match the
format. Existing destinations require `overwrite: true`; source files cannot be
export destinations. Export requires a trusted workspace. A named `view` renders
that saved flag configuration without editing the source. Named-view checks
return their diagnostics directly rather than changing Problems for the current
source. Failed renders never export the last valid preview image.

The Command Palette also offers **PlantUML: Check for Errors**, **PlantUML:
Export Diagram**, and **PlantUML: Inspect Flags and Views**. Checking publishes
Problems; inspection displays JSON in the **PlantUML Actions** output channel.
Export prompts for format and destination. Saving source remains VS Code's
normal **Save** operation.

Other extensions can call `plantumlLive.validate`, `plantumlLive.export`, and
`plantumlLive.inspect` with the same input object and receive the JSON result.
`plantumlLive.openPreview` accepts an optional VS Code `Uri`.

### VS Code tasks

**Tasks: Run Task** discovers **PlantUML: validate workspace** for each workspace
folder. It checks supported PlantUML files, excluding `node_modules` and `.git`.
For repeatable file validation or export, add entries to `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Check architecture",
      "type": "plantumlLive",
      "action": "validate",
      "file": "docs/architecture.puml",
      "problemMatcher": []
    },
    {
      "label": "Export architecture",
      "type": "plantumlLive",
      "action": "export",
      "file": "docs/architecture.puml",
      "output": "docs/architecture.svg",
      "format": "svg",
      "background": "white",
      "overwrite": true,
      "problemMatcher": []
    }
  ]
}
```

Task paths are relative to their workspace folder. Omit `file` on a validation
task to check the workspace. Export tasks require both `file` and `output` and
never prompt for a destination. Tasks print JSON results, update Problems for
current-source checks, and exit with code 1 if any diagram fails (0 on success).
The output directory must already exist. Tasks, commands, and tools all use the
same local actions; no Java, PlantUML server, or runtime network access is added.
