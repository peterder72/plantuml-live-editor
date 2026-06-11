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

test("rewrites live boolean toggles and rerenders offline", async ({ page }) => {
  await page.goto(artifactUrl);
  await expect(page.locator(".diagram-content svg")).toBeVisible({
    timeout: 30_000,
  });

  const source = [
    "@startuml",
    "!$_live_SHOW_DETAILS = false",
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
    "!$_live_SHOW_DETAILS = true",
  );
  await expect(page.locator(".diagram-content svg")).toContainText("Details", {
    timeout: 30_000,
  });
  await expect(transform).toHaveAttribute("style", before ?? "");
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
