import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const artifactUrl = pathToFileURL(resolve("dist/index.html")).href;

async function installEgressMonitor(context: BrowserContext, page: Page) {
  const attempts: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (!/^(?:file|data|blob):/.test(url)) attempts.push(`request:${url}`);
  });
  page.on("websocket", (socket) => attempts.push(`websocket:${socket.url()}`));
  page.on("popup", (popup) => attempts.push(`popup:${popup.url()}`));

  await context.addInitScript(() => {
    const attempts: string[] = [];
    Object.defineProperty(globalThis, "__egressAttempts", {
      configurable: false,
      value: attempts,
    });
    const block = (name: string) =>
      function (this: unknown, ...args: unknown[]) {
        attempts.push(`${name}:${String(args[0] ?? "")}`);
        throw new Error(`Blocked test egress through ${name}`);
      };
    globalThis.fetch = block("fetch") as typeof fetch;
    globalThis.XMLHttpRequest = block(
      "XMLHttpRequest",
    ) as unknown as typeof XMLHttpRequest;
    globalThis.WebSocket = block("WebSocket") as unknown as typeof WebSocket;
    globalThis.EventSource = block(
      "EventSource",
    ) as unknown as typeof EventSource;
    navigator.sendBeacon = block("sendBeacon") as typeof navigator.sendBeacon;
    window.open = block("window.open") as typeof window.open;
  });

  return attempts;
}

async function expectNoEgress(page: Page, attempts: string[]) {
  const apiAttempts = await page.evaluate(
    () =>
      (
        globalThis as typeof globalThis & { __egressAttempts?: string[] }
      ).__egressAttempts ?? [],
  );
  expect([...attempts, ...apiAttempts]).toEqual([]);
}

test("renders offline and preserves zoom while editing", async ({ page }) => {
  await page.goto(artifactUrl);
  await expect(page.locator(".diagram-content svg")).toBeVisible({
    timeout: 30_000,
  });

  const viewport = page.getByTestId("diagram-viewport");
  const box = await viewport.boundingBox();
  if (!box) throw new Error("Preview viewport is not visible.");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -600);
  const transform = page.getByTestId("diagram-transform");
  await expect(transform).not.toHaveAttribute("data-scale", "1");
  const before = await transform.getAttribute("style");

  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type("\n' rerender");
  await expect(page.getByText(/Rendered in/)).toBeVisible({ timeout: 30_000 });

  await expect(transform).toHaveAttribute("style", before ?? "");
});

test("renders beyond 4096 and preserves it when the 8192 limit is exceeded", async ({
  page,
}) => {
  await page.goto(artifactUrl);
  await expect(page.locator(".diagram-content svg")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Max 8192 × 8192", { exact: true })).toBeVisible();

  const editor = page.locator(".cm-content");
  const withinLimit = [
    "@startuml",
    "left to right direction",
    "skinparam ranksep 5000",
    "class A",
    "class B",
    "A -- B",
    "@enduml",
  ].join("\n");
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(withinLimit);

  const svg = page.locator(".diagram-content svg");
  await expect(page.getByText(/Rendered in/)).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(async () => Number(await svg.getAttribute("width")))
    .toBeGreaterThan(4096);
  const validWidth = await svg.getAttribute("width");

  const overLimit = withinLimit.replace("ranksep 5000", "ranksep 8200");
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(overLimit);

  await expect(
    page.getByText(
      /Diagram too large for browser rendering: \d+x\d+ \(max 8192\)/,
    ).first(),
  ).toBeVisible({ timeout: 30_000 });
  await expect(svg).toHaveAttribute("width", validWidth ?? "");
});

test("rewrites live boolean toggles and rerenders offline", async ({ page }) => {
  await page.goto(artifactUrl);
  await expect(page.locator(".diagram-content svg")).toBeVisible({
    timeout: 30_000,
  });

  const source = [
    "@startuml",
    "!$_live_SHOW_DETAILS = %false()",
    "class Always",
    "!if $_live_SHOW_DETAILS",
    "class Details",
    "!endif",
    "@enduml",
  ].join("\n");

  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(source);

  const toggle = page.getByLabel("SHOW_DETAILS");
  await expect(toggle).toBeVisible();
  await expect(toggle).not.toBeChecked();
  await expect(page.locator(".diagram-content svg")).not.toContainText("Details", {
    timeout: 30_000,
  });

  const viewport = page.getByTestId("diagram-viewport");
  const box = await viewport.boundingBox();
  if (!box) throw new Error("Preview viewport is not visible.");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -600);

  const transform = page.getByTestId("diagram-transform");
  await expect(transform).not.toHaveAttribute("data-scale", "1");
  const before = await transform.getAttribute("style");
  await toggle.check();

  await expect(page.locator(".cm-content")).toContainText(
    "!$_live_SHOW_DETAILS = %true()",
  );
  await expect(page.locator(".diagram-content svg")).toContainText("Details", {
    timeout: 30_000,
  });
  await expect(transform).toHaveAttribute("style", before ?? "");
});

test("wraps selected source lines with a live flag", async ({ page }) => {
  await page.goto(artifactUrl);
  const source = [
    "@startuml",
    "!$_live_DETAILS = %false()",
    "class Always",
    "class Details",
    "@enduml",
  ].join("\n");

  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(source);
  await page.locator(".cm-content").getByText("class Details").selectText();

  const wrap = page.getByRole("button", { name: "Wrap selection" });
  await expect(wrap).toBeEnabled();
  await wrap.click();
  await page.getByRole("menuitem", { name: "DETAILS Off" }).click();
  await expect(page.locator(".cm-content")).toBeFocused();
  await expect(page.locator(".cm-content")).toContainText("!if $_live_DETAILS");
  await expect(page.locator(".cm-content")).toContainText("!endif");
  await expect(page.locator(".diagram-content svg")).not.toContainText("Details", {
    timeout: 30_000,
  });

  await page.getByLabel("DETAILS").check();
  await expect(page.locator(".diagram-content svg")).toContainText("Details", {
    timeout: 30_000,
  });
});

test("persists independent live toggle values in named views", async ({
  page,
}) => {
  await page.goto(artifactUrl);
  const source = [
    "@startuml",
    "!$_live_DETAILS = %false()",
    "class Always",
    "!if $_live_DETAILS",
    "class Details",
    "!endif",
    "@enduml",
  ].join("\n");

  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(source);

  await expect(page.getByLabel("Active view")).toHaveValue("Default");
  await page.getByLabel("Create view").click();
  await page.getByLabel("New view name").fill("Detailed");
  await page.getByLabel("Save view").click();
  await expect(page.getByLabel("Active view")).toHaveValue("Detailed");

  await page.getByLabel("DETAILS").check();
  await expect(page.locator(".cm-content")).toContainText(
    "!$_live_DETAILS = %true()",
  );
  await expect(page.locator(".diagram-content svg")).toContainText("Details", {
    timeout: 30_000,
  });

  await page.getByLabel("Active view").selectOption("Default");
  await expect(page.getByLabel("DETAILS")).not.toBeChecked();
  await expect(page.locator(".cm-content")).toContainText(
    "!$_live_DETAILS = %false()",
  );

  await page.getByLabel("Active view").selectOption("Detailed");
  await expect(page.getByLabel("DETAILS")).toBeChecked();
  await expect(page.locator(".cm-content")).toContainText(
    "!$_live_DETAILS = %true()",
  );
  await expect(page.locator(".cm-content")).toContainText(
    "/' @plantuml-live-editor views v2",
  );
  await expect(page.locator(".cm-content")).toContainText(
    '"activeView": "Detailed"',
  );

  await page.getByLabel("Rename view").click();
  await page.getByLabel("Rename view").fill("Expanded");
  await page.getByLabel("Save renamed view").click();
  await expect(page.getByLabel("Active view")).toHaveValue("Expanded");
  await expect(page.locator(".cm-content")).toContainText(
    '"activeView": "Expanded"',
  );
  await expect(page.locator(".cm-content")).not.toContainText('"Detailed":');
});

test("clicking a class toggles its members in the source", async ({ page }) => {
  await page.goto(artifactUrl);
  const source = [
    "@startuml",
    "class User {",
    "  +name: String",
    "  +login(): void",
    "}",
    "@enduml",
  ].join("\n");

  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(source);

  await expect(page.locator(".diagram-content svg")).toContainText(
    "login(): void",
    { timeout: 30_000 },
  );
  const entity = page.locator(
    '.diagram-content g.entity[data-qualified-name="User"], .diagram-content g.entity[data-entity="User"], .diagram-content g.entity#entity_User',
  );
  await expect(entity).toBeVisible({ timeout: 30_000 });
  await entity.click();

  await expect(page.locator(".cm-content")).toContainText("hide User members");
  await expect(entity).not.toContainText("login", { timeout: 30_000 });

  await entity.click();
  await expect(page.locator(".cm-content")).not.toContainText(
    "hide User members",
  );
  await expect(entity).toContainText("login", { timeout: 30_000 });
});

test("blocks remote PlantUML without any egress attempt", async ({
  context,
  page,
}) => {
  const attempts = await installEgressMonitor(context, page);
  await page.goto(artifactUrl);
  await expect(page.locator(".diagram-content svg")).toBeVisible({
    timeout: 30_000,
  });

  const hostileSource = [
    "@startuml",
    "!includeurl https://example.invalid/private-diagram.puml",
    "Alice -> Bob",
    "@enduml",
  ].join("\n");
  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(hostileSource);

  await expect(page.getByRole("alert")).toContainText(
    "disabled for privacy",
    { timeout: 5_000 },
  );
  await expectNoEgress(page, attempts);
});

test("CSP and runtime lockdown reject browser network APIs", async ({
  page,
}) => {
  await page.goto(artifactUrl);

  const results = await page.evaluate(async () => {
    const calls = [
      () => fetch("https://example.invalid/"),
      () => new XMLHttpRequest(),
      () => new WebSocket("wss://example.invalid/"),
      () => navigator.sendBeacon("https://example.invalid/", "secret"),
      () => window.open("https://example.invalid/"),
    ];
    return Promise.all(
      calls.map(async (call) => {
        try {
          await call();
          return false;
        } catch {
          return true;
        }
      }),
    );
  });

  expect(results).toEqual([true, true, true, true, true]);
});
