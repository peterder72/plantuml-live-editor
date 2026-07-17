import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import {
  chromium,
  firefox,
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

export class WebScenarioDriver implements ScenarioDriver {
  private browser: Browser | undefined;
  private context: BrowserContext | undefined;
  private page: Page | undefined;

  constructor(private readonly browserName: "chromium" | "firefox") {}

  async openApplication(source: string) {
    const browserType = this.browserName === "firefox" ? firefox : chromium;
    this.browser = await browserType.launch();
    this.context = await this.browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    this.page = await this.context.newPage();
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
