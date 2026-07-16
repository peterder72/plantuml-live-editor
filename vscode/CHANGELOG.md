# Changelog

## 0.3.1

- Added the live variable name as a PlantUML block comment after `!endif` when
  wrapping a selection with a live flag.

## 0.3.0

- Reused a single preview panel that follows the active PlantUML document.
- Fixed Graphviz-based diagrams failing in VS Code after switching documents
  because the embedded Viz.js script was blocked by the webview security policy.
- Increased the browser-rendering limit from 4096 × 4096 to 8192 × 8192 pixels.
- Improved recovery from unexpected renderer errors while preserving the last
  valid diagram.

## 0.2.1

- Added "if" statement preprocessor collapsing in the editor

## 0.2.0

- Added native-editor selection wrapping for live flags.
- Added named live-toggle views and class-member visibility toggling.
- Added visible render progress, duration, and error feedback.
- Completed Marketplace metadata and made the root package version canonical.

## 0.1.0

- Added the offline PlantUML preview with pan, zoom, fit, reset, live boolean
  toggles, and SVG/PNG export.
