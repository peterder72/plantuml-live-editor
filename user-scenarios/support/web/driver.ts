import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import {
  chromium,
  firefox,
  expect as baseExpect,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import type {
  RenderSnapshot,
  ScenarioDriver,
} from "../common/driver";
import { fingerprint } from "../common/fingerprint";

const artifactUrl = pathToFileURL(resolve("dist/index.html")).href;
const renderTimeout = 30_000;
const expect = baseExpect.configure({ timeout: renderTimeout });

export class WebScenarioDriver implements ScenarioDriver {
  private browser: Browser | undefined;
  private context: BrowserContext | undefined;
  private page: Page | undefined;
  private monitorEgress = false;
  private readonly egressAttempts: string[] = [];
  private rememberedTransform: string | null = null;
  private rememberedWidth: string | null = null;
  private rememberedSplitPercent: string | null = null;

  constructor(private readonly browserName: "chromium" | "firefox") {}

  async openApplication(source: string) {
    const browserType = this.browserName === "firefox" ? firefox : chromium;
    this.browser = await browserType.launch();
    this.context = await this.browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    this.page = await this.context.newPage();
    if (this.monitorEgress) await this.installEgressMonitor();
    await this.page.goto(artifactUrl);

    const svg = this.page.locator(".diagram-content svg");
    await svg.waitFor({ state: "visible", timeout: renderTimeout });
    const initialSource = await this.readSource();
    if (initialSource === source) return;

    const before = await this.captureRender();
    await this.replaceSource(source);
    await this.expectSource(source);
    await this.expectRenderChanged(before);
  }

  async replaceSource(source: string) {
    const page = this.requirePage();
    await page.locator(".cm-content").click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.insertText(source);
  }

  async replaceSourceRapidly(sources: string[]) {
    for (const source of sources) await this.replaceSource(source);
  }

  async expectSource(source: string) {
    await waitFor(
      async () => (await this.readSource()) === source,
      "the web editor to contain the expected source",
    );
    assert.equal(await this.readSource(), source);
  }

  async captureRender(): Promise<RenderSnapshot> {
    const svg = this.requirePage().locator(".diagram-content svg");
    await svg.waitFor({ state: "visible", timeout: renderTimeout });
    return { fingerprint: fingerprint(await svg.evaluate((node) => node.outerHTML)) };
  }

  async expectRenderChanged(previous: RenderSnapshot) {
    await waitFor(
      async () => (await this.captureRender()).fingerprint !== previous.fingerprint,
      "the web preview to render a changed SVG",
      renderTimeout,
    );
    assert.notEqual(
      (await this.captureRender()).fingerprint,
      previous.fingerprint,
    );
  }

  async expectRenderUnchanged(previous: RenderSnapshot) {
    assert.equal((await this.captureRender()).fingerprint, previous.fingerprint);
  }

  enableEgressMonitoring() {
    this.monitorEgress = true;
  }

  async expectOfflineArtifact() {
    assert.match(this.requirePage().url(), /^file:/);
    await expect(this.requirePage().locator(".diagram-content svg")).toBeVisible();
  }

  async expectNoEgress() {
    const apiAttempts = await this.requirePage().evaluate(
      () =>
        (
          globalThis as typeof globalThis & { __egressAttempts?: string[] }
        ).__egressAttempts ?? [],
    );
    assert.deepEqual([...this.egressAttempts, ...apiAttempts], []);
  }

  async expectDiagramContains(text: string, visible = true) {
    const svg = this.requirePage().locator(".diagram-content svg");
    if (visible) await expect(svg).toContainText(text, { timeout: renderTimeout });
    else await expect(svg).not.toContainText(text, { timeout: renderTimeout });
  }

  async expectSourceContains(text: string, present = true) {
    const editor = this.requirePage().locator(".cm-content");
    if (present) await expect(editor).toContainText(text);
    else await expect(editor).not.toContainText(text);
  }

  async expectLiveFlag(name: string, enabled: boolean) {
    const toggle = this.requirePage().getByLabel(name);
    await expect(toggle).toBeVisible();
    if (enabled) await expect(toggle).toBeChecked();
    else await expect(toggle).not.toBeChecked();
  }

  async expectError(pattern: RegExp) {
    await expect(this.requirePage().getByRole("alert").first()).toContainText(pattern, {
      timeout: renderTimeout,
    });
  }

  async panAndZoom() {
    const page = this.requirePage();
    const viewport = page.getByTestId("diagram-viewport");
    const box = await viewport.boundingBox();
    if (!box) throw new Error("Preview viewport is not visible.");
    const transform = page.getByTestId("diagram-transform");
    const initialScale = await transform.getAttribute("data-scale");
    await page.getByRole("button", { name: "Zoom in" }).click();
    await expect.poll(() => transform.getAttribute("data-scale")).not.toBe(initialScale);
    const zoomed = await transform.getAttribute("style");
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(center.x + 70, center.y + 45, { steps: 4 });
    await page.mouse.up();
    await expect.poll(() => transform.getAttribute("style")).not.toBe(zoomed);
    this.rememberedTransform = await transform.getAttribute("style");
  }

  async expectTransformPreserved() {
    assert.notEqual(this.rememberedTransform, null, "No viewport transform remembered.");
    await expect(this.requirePage().getByTestId("diagram-transform")).toHaveAttribute(
      "style",
      this.rememberedTransform ?? "",
    );
  }

  async fitAndResetView() {
    const page = this.requirePage();
    const transform = page.getByTestId("diagram-transform");
    const beforeFit = await transform.getAttribute("style");
    await page.getByRole("button", { name: "Fit diagram" }).click();
    await expect.poll(() => transform.getAttribute("style")).not.toBe(beforeFit);
    await page.getByRole("button", { name: "Reset view" }).click();
    await expect(transform).toHaveAttribute("data-scale", "1");
    await expect(transform).toHaveAttribute(
      "style",
      /transform: translate\(0px(?:, 0px)?\) scale\(1\);/,
    );
  }

  async foldAndUnfoldSource() {
    const page = this.requirePage();
    const editor = page.locator(".cm-content");
    const openMarker = page
      .locator(".cm-foldGutter .cm-gutterElement")
      .filter({ hasText: "⌄" });
    await expect(openMarker).toHaveCount(1);
    await openMarker.click();
    await expect(page.locator(".cm-foldPlaceholder")).toBeVisible();
    await expect(editor).not.toContainText("Hidden while folded");
    const closedMarker = page
      .locator(".cm-foldGutter .cm-gutterElement")
      .filter({ hasText: "›" })
      .last();
    await closedMarker.click();
    await expect(page.locator(".cm-foldPlaceholder")).toHaveCount(0);
    await expect(editor).toContainText("Hidden while folded");
  }

  async exportWhiteSvg() {
    const page = this.requirePage();
    await page.getByRole("button", { name: /Export/ }).click();
    await page.getByRole("radio", { name: "SVG" }).check();
    await page.getByRole("radio", { name: "White" }).check();
    await expect(page.getByText("diagram.svg", { exact: true })).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Save" }).click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), "diagram.svg");
    const downloadPath = await download.path();
    if (!downloadPath) throw new Error("Exported SVG has no download path.");
    assert.match(await readFile(downloadPath, "utf8"), /data-export-background="white"/);
  }

  async expectExportChoicesRemembered() {
    const page = this.requirePage();
    await page.getByRole("button", { name: /Export/ }).click();
    await expect(page.getByRole("radio", { name: "SVG" })).toBeChecked();
    await expect(page.getByRole("radio", { name: "White" })).toBeChecked();
  }

  async toggleLiveFlag(name: string, enabled: boolean) {
    const toggle = this.requirePage().getByLabel(name);
    await expect(toggle).toBeVisible();
    if (enabled) await toggle.check();
    else await toggle.uncheck();
  }

  async selectSourceText(text: string) {
    await this.requirePage().locator(".cm-content").getByText(text).selectText();
  }

  async wrapSelectionWith(flag: string) {
    const page = this.requirePage();
    await page
      .getByRole("combobox", { name: "Wrap selection" })
      .selectOption(`_live_${flag}`);
  }

  async createView(name: string) {
    const page = this.requirePage();
    await page.getByLabel("Create view").click();
    await page.getByLabel("New view name").fill(name);
    await page.getByLabel("Save view").click();
    await expect(page.getByLabel("Active view")).toHaveValue(name);
  }

  async switchView(name: string) {
    await this.requirePage().getByLabel("Active view").selectOption(name);
    await expect(this.requirePage().getByLabel("Active view")).toHaveValue(name);
  }

  async renameView(name: string) {
    const page = this.requirePage();
    await page.getByLabel("Rename view").click();
    await page.getByLabel("Rename view").fill(name);
    await page.getByLabel("Save renamed view").click();
    await expect(page.getByLabel("Active view")).toHaveValue(name);
  }

  async clickClass(entityName: string) {
    const escaped = entityName.replaceAll('"', '\\"');
    const entity = this.requirePage().locator(
      `.diagram-content g.entity[data-qualified-name="${escaped}"], ` +
        `.diagram-content g.entity[data-entity="${escaped}"], ` +
        `.diagram-content g.entity#entity_${escaped}`,
    );
    await expect(entity).toBeVisible({ timeout: renderTimeout });
    await entity.click();
  }

  async rememberDiagramWidth() {
    const svg = this.requirePage().locator(".diagram-content svg");
    await expect.poll(async () => Number(await svg.getAttribute("width"))).toBeGreaterThan(4096);
    this.rememberedWidth = await svg.getAttribute("width");
  }

  async expectDiagramWidthPreserved() {
    assert.notEqual(this.rememberedWidth, null, "No diagram width remembered.");
    await expect(this.requirePage().locator(".diagram-content svg")).toHaveAttribute(
      "width",
      this.rememberedWidth ?? "",
    );
  }

  async reload() {
    await this.requirePage().reload();
    await this.requirePage()
      .locator(".diagram-content svg")
      .waitFor({ state: "visible", timeout: renderTimeout });
  }

  async resizeEditorAndPreview() {
    const separator = this.requirePage().getByRole("separator", {
      name: "Resize editor and preview",
    });
    await separator.press("End");
    await expect(separator).toHaveAttribute("aria-valuenow", "75");
    this.rememberedSplitPercent = await separator.getAttribute("aria-valuenow");
  }

  async expectEditorAndPreviewSplitRestored() {
    assert.notEqual(
      this.rememberedSplitPercent,
      null,
      "No editor and preview split position was remembered.",
    );
    await expect(
      this.requirePage().getByRole("separator", {
        name: "Resize editor and preview",
      }),
    ).toHaveAttribute("aria-valuenow", this.rememberedSplitPercent ?? "");
  }

  async expectNetworkApisBlocked() {
    const results = await this.requirePage().evaluate(async () => {
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
    assert.deepEqual(results, [true, true, true, true, true]);
  }

  async dispose() {
    await this.context?.close();
    await this.browser?.close();
    this.page = undefined;
    this.context = undefined;
    this.browser = undefined;
  }

  private async readSource() {
    return this.requirePage()
      .locator(".cm-content .cm-line")
      .evaluateAll((lines) =>
        lines.map((line) => line.textContent ?? "").join("\n"),
      );
  }

  private requirePage() {
    if (!this.page) throw new Error("The web application has not been opened.");
    return this.page;
  }

  private async installEgressMonitor() {
    const context = this.context;
    const page = this.page;
    if (!context || !page) throw new Error("Browser context is not ready.");
    page.on("request", (request) => {
      const url = request.url();
      if (!/^(?:file|data|blob):/.test(url)) this.egressAttempts.push(`request:${url}`);
    });
    page.on("websocket", (socket) => this.egressAttempts.push(`websocket:${socket.url()}`));
    page.on("popup", (popup) => this.egressAttempts.push(`popup:${popup.url()}`));
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
      globalThis.XMLHttpRequest = block("XMLHttpRequest") as unknown as typeof XMLHttpRequest;
      globalThis.WebSocket = block("WebSocket") as unknown as typeof WebSocket;
      globalThis.EventSource = block("EventSource") as unknown as typeof EventSource;
      navigator.sendBeacon = block("sendBeacon") as typeof navigator.sendBeacon;
      window.open = block("window.open") as typeof window.open;
    });
  }
}

async function waitFor(
  predicate: () => Promise<boolean>,
  description: string,
  timeout = 10_000,
) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
  }
  assert.fail(`Timed out waiting for ${description}.`);
}
