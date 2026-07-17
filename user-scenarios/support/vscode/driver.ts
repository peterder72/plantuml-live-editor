import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import * as vscode from "vscode";
import type {
  ScenarioCommand,
  ScenarioCommandResult,
} from "../../../src/vscode/messages";
import type {
  RenderSnapshot,
  ScenarioDriver,
} from "../common/driver";

const extensionId = "peterder72.plantuml-live-editor";
const previewCommand = "plantumlLive.openPreview";
const renderTimeout = 30_000;
const isolatedWorkspace = process.env.PLANTUML_TEST_WORKSPACE;
const temporaryRoot = isolatedWorkspace ?? os.tmpdir();

interface PreviewState {
  ready: boolean;
  documentUri: string;
  lastDocumentVersionSent: number;
  lastSelectionSent: { from: number; to: number };
  lastRendered?: {
    documentVersion: number;
    renderRevision: number;
    svgFingerprint: string;
  };
  lastStatus?: {
    documentVersion: number;
    kind: "initializing" | "rendering" | "success" | "error";
    label: string;
    svgFingerprint: string;
  };
}

interface ExtensionTestApi {
  getPreviewCount(): number;
  getPreviewState(uri: string): PreviewState | undefined;
  runPreviewScenario(command: ScenarioCommand): Promise<ScenarioCommandResult>;
  disposePreview(): void;
}

export class VsCodeScenarioDriver implements ScenarioDriver {
  private sourceUri: vscode.Uri | undefined;
  private readonly temporaryUris: vscode.Uri[] = [];
  private document: vscode.TextDocument | undefined;
  private editor: vscode.TextEditor | undefined;
  private extensionApi: ExtensionTestApi | undefined;
  private rememberedTransform: string | undefined;
  private rememberedWidth: string | undefined;
  private lastExport: ScenarioCommandResult | undefined;

  async openApplication(source: string) {
    const extension = vscode.extensions.getExtension(extensionId);
    assert.ok(extension, "development extension is discoverable");
    this.extensionApi = (await extension.activate()) as ExtensionTestApi;

    this.sourceUri = vscode.Uri.file(
      path.join(temporaryRoot, `plantuml-user-scenario-${randomUUID()}.puml`),
    );
    this.temporaryUris.push(this.sourceUri);
    await vscode.workspace.fs.writeFile(
      this.sourceUri,
      new TextEncoder().encode(source),
    );
    this.document = await vscode.workspace.openTextDocument(this.sourceUri);
    this.editor = await vscode.window.showTextDocument(this.document);

    await vscode.commands.executeCommand(previewCommand);
    await this.waitForCurrentRender();
  }

  async replaceSource(source: string) {
    const document = this.requireDocument();
    const editor = this.requireEditor();
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(document.getText().length),
    );
    const applied = await editor.edit((builder) => builder.replace(fullRange, source));
    assert.equal(applied, true, "VS Code applies the scenario source edit");
  }

  async replaceSourceRapidly(sources: string[]) {
    for (const source of sources) await this.replaceSource(source);
  }

  async expectSource(source: string) {
    assert.equal(this.requireDocument().getText(), source);
  }

  async captureRender(): Promise<RenderSnapshot> {
    const state = this.requireRenderedState();
    return { fingerprint: state.lastRendered.svgFingerprint };
  }

  async expectRenderChanged(previous: RenderSnapshot) {
    await waitFor(
      () => {
        const state = this.getPreviewState();
        const document = this.document;
        return Boolean(
          document &&
            state?.lastRendered?.documentVersion === document.version &&
            state.lastRendered.svgFingerprint !== previous.fingerprint,
        );
      },
      "the VS Code preview to render a changed SVG",
      renderTimeout,
    );
    assert.notEqual(
      this.requireRenderedState().lastRendered.svgFingerprint,
      previous.fingerprint,
    );
  }

  async expectRenderUnchanged(previous: RenderSnapshot) {
    assert.equal(
      this.requireRenderedState().lastRendered.svgFingerprint,
      previous.fingerprint,
    );
  }

  async expectDiagramContains(text: string, visible = true) {
    await this.waitForCurrentRender();
    await waitFor(
      async () => {
        const result = await this.runScenario({ action: "inspect" });
        return result.svgText.includes(text) === visible;
      },
      `the VS Code diagram ${visible ? "to contain" : "not to contain"} ${text}`,
      renderTimeout,
    );
  }

  async expectSourceContains(text: string, present = true) {
    await waitFor(
      () => this.requireDocument().getText().includes(text) === present,
      `the VS Code source ${present ? "to contain" : "not to contain"} ${text}`,
    );
  }

  async expectError(pattern: RegExp) {
    await waitFor(
      () => {
        const document = this.document;
        const status = this.getPreviewState()?.lastStatus;
        return Boolean(
          document &&
            status?.documentVersion === document.version &&
            status.kind === "error" &&
            pattern.test(status.label),
        );
      },
      `the VS Code preview error ${pattern}`,
      renderTimeout,
    );
  }

  async panAndZoom() {
    const result = await this.runScenario({ action: "panAndZoom" });
    assert.notEqual(result.scale, "1");
    this.rememberedTransform = result.transformStyle;
  }

  async expectTransformPreserved() {
    assert.ok(this.rememberedTransform, "No VS Code viewport transform remembered.");
    await this.waitForCurrentRender();
    const result = await this.runScenario({ action: "inspect" });
    assert.equal(result.transformStyle, this.rememberedTransform);
  }

  async fitAndResetView() {
    const result = await this.runScenario({ action: "fitAndReset" });
    assert.equal(result.scale, "1");
    assert.match(result.transformStyle, /translate\(0px(?:, 0px)?\) scale\(1\)/);
  }

  async exportWhiteSvg() {
    this.lastExport = await this.runScenario({ action: "exportWhiteSvg" });
    assert.match(this.lastExport.exportFileName, /\.svg$/);
    assert.match(this.lastExport.exportFeedback, /^Saved .+\.svg$/);
  }

  async expectExportChoicesRemembered() {
    assert.equal(this.lastExport?.exportFormat, "svg");
    assert.equal(this.lastExport?.exportBackground, "white");
  }

  async toggleLiveFlag(name: string, enabled: boolean) {
    const previousVersion = this.requireDocument().version;
    await this.runScenario({ action: "toggleLiveFlag", name, enabled });
    const expected = `!$_live_${name} = %${enabled ? "true" : "false"}()`;
    await waitFor(
      () =>
        this.requireDocument().version > previousVersion &&
        this.requireDocument().getText().includes(expected),
      `the VS Code live flag ${name} to update`,
    );
    await this.waitForCurrentRender();
  }

  async expectLiveFlag(name: string, enabled: boolean) {
    await waitFor(
      async () => (await this.runScenario({ action: "inspect" })).liveFlags[name] === enabled,
      `the VS Code live flag ${name} to be ${enabled ? "enabled" : "disabled"}`,
    );
  }

  async selectSourceText(text: string) {
    const document = this.requireDocument();
    const editor = this.requireEditor();
    const from = document.getText().indexOf(text);
    assert.notEqual(from, -1, `Source text was not found: ${text}`);
    const to = from + text.length;
    editor.selection = new vscode.Selection(document.positionAt(from), document.positionAt(to));
    await waitFor(
      () => {
        const selection = this.getPreviewState()?.lastSelectionSent;
        return selection?.from === from && selection.to === to;
      },
      "the VS Code selection to reach the preview",
    );
  }

  async wrapSelectionWith(name: string) {
    const previousVersion = this.requireDocument().version;
    await this.runScenario({ action: "wrapSelection", name });
    await waitFor(
      () =>
        this.requireDocument().version > previousVersion &&
        this.requireDocument().getText().includes(`!if $_live_${name}`),
      `the VS Code selection to be wrapped with ${name}`,
    );
    await this.waitForCurrentRender();
  }

  async createView(name: string) {
    await this.runSourceChangingScenario(
      { action: "createView", name },
      (source) => source.includes(`"activeView": "${name}"`),
      `create view ${name}`,
    );
  }

  async switchView(name: string) {
    await this.runSourceChangingScenario(
      { action: "switchView", name },
      (source) => source.includes(`"activeView": "${name}"`),
      `switch to view ${name}`,
    );
  }

  async renameView(name: string) {
    await this.runSourceChangingScenario(
      { action: "renameView", name },
      (source) => source.includes(`"activeView": "${name}"`),
      `rename view to ${name}`,
    );
  }

  async clickClass(name: string) {
    const directive = `hide ${name} members`;
    const wasHidden = this.requireDocument().getText().includes(directive);
    await this.runSourceChangingScenario(
      { action: "clickClass", name },
      (source) => source.includes(directive) !== wasHidden,
      `toggle members for ${name}`,
    );
  }

  async rememberDiagramWidth() {
    await this.waitForCurrentRender();
    const result = await this.runScenario({ action: "inspect" });
    assert.ok(Number(result.svgWidth) > 4096, "VS Code diagram is not wider than 4096 pixels.");
    this.rememberedWidth = result.svgWidth;
  }

  async expectDiagramWidthPreserved() {
    assert.ok(this.rememberedWidth, "No VS Code diagram width remembered.");
    const result = await this.runScenario({ action: "inspect" });
    assert.equal(result.svgWidth, this.rememberedWidth);
  }

  async expectNetworkApisBlocked() {
    const result = await this.runScenario({ action: "checkNetworkApis" });
    assert.equal(result.networkApisBlocked, true);
  }

  async openAnotherDocument(source: string) {
    const uri = vscode.Uri.file(
      path.join(temporaryRoot, `plantuml-user-scenario-follow-${randomUUID()}.puml`),
    );
    this.temporaryUris.push(uri);
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(source));
    this.sourceUri = uri;
    this.document = await vscode.workspace.openTextDocument(uri);
    this.editor = await vscode.window.showTextDocument(this.document);
    await this.waitForCurrentRender();
  }

  expectSinglePreviewForCurrentDocument() {
    assert.equal(this.extensionApi?.getPreviewCount(), 1);
    const state = this.getPreviewState();
    assert.equal(state?.documentUri, this.sourceUri?.toString());
    assert.equal(state?.lastRendered?.documentVersion, this.document?.version);
  }

  async dispose() {
    if (this.extensionApi?.getPreviewCount()) {
      this.extensionApi.disposePreview();
      await waitFor(
        () => this.extensionApi?.getPreviewCount() === 0,
        "the VS Code preview to dispose",
      );
    }

    if (this.document) {
      await Promise.all(
        this.temporaryUris.map(async (uri) => {
          const document = vscode.workspace.textDocuments.find(
            (candidate) => candidate.uri.toString() === uri.toString(),
          );
          if (document?.isDirty) await document.save();
        }),
      );
      await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    }

    const temporaryUris = this.temporaryUris.splice(0);
    if (!isolatedWorkspace) {
      for (const uri of temporaryUris) {
        try {
          await vscode.workspace.fs.delete(uri);
        } catch (error) {
          if (
            !(error instanceof vscode.FileSystemError) ||
            error.code !== "FileNotFound"
          ) {
            throw error;
          }
        }
      }
    }

    this.editor = undefined;
    this.document = undefined;
    this.sourceUri = undefined;
    this.extensionApi = undefined;
  }

  private async waitForCurrentRender() {
    await waitFor(
      () => {
        const document = this.document;
        const state = this.getPreviewState();
        return Boolean(
          document &&
            state?.ready &&
            state.lastRendered?.documentVersion === document.version,
        );
      },
      "the VS Code preview to render the current document",
      renderTimeout,
    );
  }

  private async runSourceChangingScenario(
    command: ScenarioCommand,
    predicate: (source: string) => boolean,
    description: string,
  ) {
    const previousVersion = this.requireDocument().version;
    await this.runScenario(command);
    await waitFor(
      () =>
        this.requireDocument().version > previousVersion &&
        predicate(this.requireDocument().getText()),
      `the VS Code preview to ${description}`,
    );
    await this.waitForCurrentRender();
  }

  private runScenario(command: ScenarioCommand) {
    if (!this.extensionApi) throw new Error("The VS Code extension test API is unavailable.");
    return this.extensionApi.runPreviewScenario(command);
  }

  private getPreviewState() {
    const sourceUri = this.sourceUri;
    if (!sourceUri) return undefined;
    return this.extensionApi?.getPreviewState(sourceUri.toString());
  }

  private requireRenderedState() {
    const state = this.getPreviewState();
    if (!state?.lastRendered) {
      throw new Error("The VS Code preview has not completed a render.");
    }
    return state as PreviewState & {
      lastRendered: NonNullable<PreviewState["lastRendered"]>;
    };
  }

  private requireDocument() {
    if (!this.document) throw new Error("No VS Code scenario document is open.");
    return this.document;
  }

  private requireEditor() {
    if (!this.editor) throw new Error("No VS Code scenario editor is open.");
    return this.editor;
  }
}

async function waitFor(
  predicate: () => boolean | Promise<boolean>,
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
