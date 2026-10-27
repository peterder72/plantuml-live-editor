# Changelog

## 0.9.0

- Breaking Autofac pre-release: replaced the scenario-specific composition/resolve/expect/invoke language with generic lifetime and object declarations, explicit create/destroy transitions, marker events, and native PlantUML arrows, groups, activations, and notes. Previous Autofac sources must be migrated.
- Show selection and object relationships with explicit static references; outcomes, recursion, deferred calls, and disposal failures are authored labels and markers, never inferred container behavior.
- Bundled exact @peterder72/plantuml-core 1.2026.7-autofac.2. The prerelease remains GPL-3.0-or-later with retained MIT component notices and corresponding-source links.
- Updated the Autofac sample and located-error fixture for the new language; Marketplace publication remains opt-in and pre-release-only.

## 0.8.0

- Pre-release: added Autofac lifetime diagrams with module provenance, declared resolve outcomes, scope ownership, cycles, and disposal diagnostics.
- Bundled @peterder72/plantuml-core 1.2026.7-autofac.1. This prerelease distribution is GPL-3.0-or-later; existing MIT component notices are retained.
- Recognize native PlantUML error diagrams, including Autofac reference errors, in validation, Problems, and export commands.
- Preserve generated TeaVM control flow by avoiding re-minification in offline web and VS Code preview builds.
- Added a guarded opt-in Marketplace prerelease path without changing stable-channel publishing or GitHub Pages deployment.

## 0.7.0

- Added VS Code Copilot tools and commands to validate diagrams, export SVG/PNG images, inspect live flags and named views, and open previews.
- Added workspace validation and configurable validation/export tasks with JSON results and Problems integration.
- Automation renders current unsaved source in an isolated offline renderer, supports named views, rejects stale results, and preserves the interactive preview.

## 0.6.0

- Added source-line syntax error highlights, gutter markers, and diagnostic tooltips to the web editor.
- Added native PlantUML error diagnostics in VS Code for the current document snapshot.
- Clear source diagnostics on edits and document changes, ignore stale render errors, and preserve the last valid diagram and viewport after syntax errors.

## 0.5.0

- Added a compact, scrollable PlantUML Controls view that follows VS Code's sidebar styling for live toggles and named views.
- Moved viewport actions, export, render status, and interaction guidance onto the diagram preview canvas.
- The Controls view now hides Open Preview while a preview is open and restores it when the preview closes.

## 0.4.0

- Centralized release history in CHANGELOG.json for the web app, VS Code extension, and GitHub releases.
- Added a Changelog dialog next to the web app version number.

## 0.3.6

- Allowed URL-like text and comments while continuing to block PlantUML directives that can load external resources.

## 0.3.5

- Persisted the editor and preview split position across browser sessions.
- Added automated GitHub release creation while keeping Pages deployments scoped to the main branch.

## 0.3.4

- Improved VS Code test runtime provisioning and CI reliability.

## 0.3.3

- Improved the export menu.

## 0.3.2

- Corrected live-flag wrapper comments to use valid PlantUML block comment syntax.

## 0.3.1

- Added the live variable name as a PlantUML block comment after !endif when wrapping a selection with a live flag.

## 0.3.0

- Reused a single preview panel that follows the active PlantUML document.
- Fixed Graphviz-based diagrams failing in VS Code after switching documents because the embedded Viz.js script was blocked by the webview security policy.
- Increased the browser-rendering limit from 4096 × 4096 to 8192 × 8192 pixels.
- Improved recovery from unexpected renderer errors while preserving the last valid diagram.

## 0.2.1

- Added preprocessor if-statement collapsing in the editor.

## 0.2.0

- Added native-editor selection wrapping for live flags.
- Added named live-toggle views and class-member visibility toggling.
- Added visible render progress, duration, and error feedback.
- Completed Marketplace metadata and made the root package version canonical.

## 0.1.0

- Added the offline PlantUML preview with pan, zoom, fit, reset, live boolean toggles, and SVG/PNG export.
