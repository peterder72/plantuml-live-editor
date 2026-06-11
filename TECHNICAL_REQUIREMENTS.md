# Technical Requirements

## Runtime And Packaging

- React, TypeScript, Vite, and Bun.
- Pin `@plantuml/core` to `1.2026.6`.
- Produce a single `dist/index.html` with no runtime file or network dependency.
- Support current desktop Chrome, Edge, and Firefox.
- The built file must run from `file://`.

## Rendering Lifecycle

1. Load embedded `viz-global.js` before importing PlantUML.
2. Debounce subsequent source changes by 300 ms.
3. Serialize render requests because the TeaVM engine has shared state.
4. Assign every request a monotonically increasing ID.
5. Accept a result only when its ID is still current.
6. Sanitize successful SVG output and replace only the diagram content.
7. Keep the previous valid SVG and surface an error when rendering fails.

## Viewport Invariants

- Transform is `{ scale, translateX, translateY }`.
- Transform state is owned by the persistent viewport, not by SVG content.
- SVG replacement must not modify the transform.
- Fit runs only for the first successful diagram or an explicit user action.
- Zoom range is `0.1` through `8`.
- Wheel and pinch zoom preserve the point under the cursor or gesture midpoint.

## Security

- Generated SVG is untrusted markup and must be sanitized.
- Scripts, event handlers, foreign objects, iframes, objects, and embeds are
  forbidden in preview SVG.
- No server rendering or remote includes.

## Performance Targets

- Keep editing responsive for representative diagrams under the 4096-pixel
  engine limit.
- Display render duration after each successful render.
- Retain only the latest pending user intent.
- Reassess a dedicated worker only if measurements show unacceptable blocking.

## Acceptance

- Valid edits update a sharp SVG preview.
- Invalid edits preserve the last valid preview.
- Pan and zoom do not move during live rerender.
- Production output is exactly one offline HTML file.
