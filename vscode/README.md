# PlantUML Live Editor

PlantUML Live Editor renders PlantUML documents entirely inside VS Code. The
PlantUML TeaVM engine and Graphviz WebAssembly are bundled with the extension,
so previews require no PlantUML server, Java runtime, CDN, or network access.

The extension currently supports the desktop edition of VS Code. It is not a
web extension and does not run in browser-hosted editors such as `vscode.dev`
or `github.dev`.

## Usage

1. Open a `.puml`, `.plantuml`, `.pu`, `.iuml`, or `.wsd` document.
2. Run **PlantUML: Open Preview to the Side** from the Command Palette, or use
   the preview button in the editor title.
3. Keep editing in VS Code's native editor. The preview updates automatically.

Each document gets one reusable preview panel. Invalid edits show an error
without discarding the last valid diagram.

## Features

- Built-in PlantUML syntax highlighting and native comment, bracket, and
  auto-closing behavior for every supported file extension.
- Offline class, component, sequence, activity, and other diagrams supported by
  PlantUML's MIT browser engine.
- Pointer-centered wheel zoom, touch pinch zoom, drag-to-pan, fit, and reset.
- Persistent viewport position across ordinary rerenders.
- SVG and PNG export.
- Click a rendered class to add or remove its `hide <name> members` directive.
- Live boolean flags declared as `!$_live_NAME = %false()` or `%true()`.
- Create and rename named flag views, with independent values stored safely in
  a PlantUML comment block.
- Select source lines in the native editor and use **Wrap selection** to place
  them inside the chosen live flag condition.
- Render initialization, progress, duration, and error feedback.

## Privacy and Security

Rendering happens locally. A restrictive webview Content Security Policy and
runtime network lockdown prevent the renderer from making network requests.
Generated SVG is sanitized before insertion into the preview.

Remote includes, imports, external themes, and remote image resources are
rejected. The extension does not collect telemetry.

## Known Limitations

- Browser-rendered diagrams are limited to 4096 × 4096 pixels.
- Sudoku is not included in PlantUML's MIT browser engine.
- Remote `!include` files and network resources are intentionally unsupported.
- The initial render can take a moment while the embedded engine initializes.

## Support and Source

See the [source repository](https://github.com/peterder72/plantuml-live-editor)
or [report an issue](https://github.com/peterder72/plantuml-live-editor/issues).
