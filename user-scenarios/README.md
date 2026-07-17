# User scenarios

Cucumber feature files are the authoritative high-level user scenarios for the
standalone web application and VS Code extension.

## Where scenarios belong

- Start in `features/common`. Common scenarios run unchanged against both apps.
- Use `features/web` only for behavior that the VS Code extension does not offer.
- Use `features/vscode` only for behavior that the web app does not offer.

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

Run all user scenarios with:

```sh
bun run test:scenarios
```

Individual surfaces can be run with `bun run test:scenarios:web` or
`bun run test:scenarios:vscode`. Reports are written to
`test-results/cucumber/`.

The workspace configures the official Cucumber VS Code extension to index
`features/**/*.feature` and the TypeScript glue under `support/**/*.ts`. This
enables step navigation, autocomplete, and undefined-step diagnostics without
depending on generated `.scenario-dist` bundles.

## Adding behavior

Prefer a small vocabulary of user-level steps. Add a shared driver operation
when the outcome is common but the interaction differs by app. Add a
platform-specific step and capability only when the product functionality is
actually unique to that surface.
