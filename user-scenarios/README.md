# User scenarios

Cucumber feature files are the authoritative and sole end-to-end user scenarios
for the standalone web application and VS Code extension. Playwright remains an
implementation detail of the web scenario driver; there is no separate
Playwright test suite.

## Where scenarios belong

- Start in `features/common`. Common scenarios run unchanged against both apps.
- Use `features/web` only for behavior that the VS Code extension does not offer.
- Use `features/vscode` only for behavior that the web app does not offer.

A missing driver capability is not a reason to classify shared behavior as
platform-only. Extend the driver or obtain explicit approval before reducing
cross-platform scenario coverage.

Editor APIs, selectors, commands, and wait strategies are implementation
details. Put those differences in the platform drivers under `support`, not in
duplicated feature files.

## How reuse works

Shared step definitions depend only on `ScenarioDriver`. Cucumber constructs a
new World and driver for every scenario. The web World provides a Playwright
driver; the VS Code World provides a native Extension Host driver. Platform
hooks always dispose browser contexts, editors, previews, and temporary files.

The profiles in `cucumber.mjs` select these suites:

- `web-chromium`: common plus web-only features.
- `web-firefox`: common plus web-only features.
- `vscode`: common plus VS Code-only features.

Run all end-to-end scenarios with:

```sh
bun run test:e2e
```

Individual surfaces can be run with `bun run test:scenarios:web` or
`bun run test:scenarios:vscode`. Reports are written to
`test-results/cucumber/`.

Vitest remains responsible for implementation-level cases such as SVG
sanitization, transform math, render serialization, and source rewriting.

The workspace configures the official Cucumber VS Code extension to index
`features/**/*.feature` and the TypeScript glue under `support/**/*.ts`. This
enables step navigation, autocomplete, and undefined-step diagnostics without
depending on generated `.scenario-dist` bundles.

## Adding behavior

Prefer a small vocabulary of user-level steps. Add a shared driver operation
when the outcome is common but the interaction differs by app. Add a
platform-specific step and capability only when the product functionality is
actually unique to that surface.
