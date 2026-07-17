import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import * as vscode from "vscode";
import type {
  RenderSnapshot,
  ScenarioDriver,
} from "../common/driver";

const extensionId = "peterder72.plantuml-live-editor";
const previewCommand = "plantumlLive.openPreview";
const renderTimeout = 30_000;

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
}

interface ExtensionTestApi {
  getPreviewCount(): number;
  getPreviewState(uri: string): PreviewState | undefined;
}

export class VsCodeScenarioDriver implements ScenarioDriver {
  private sourceUri: vscode.Uri | undefined;
  private document: vscode.TextDocument | undefined;
  private editor: vscode.TextEditor | undefined;
  private extensionApi: ExtensionTestApi | undefined;

  async openApplication(source: string) {
    const extension = vscode.extensions.getExtension(extensionId);
    assert.ok(extension, "development extension is discoverable");
    this.extensionApi = (await extension.activate()) as ExtensionTestApi;

    this.sourceUri = vscode.Uri.file(
      path.join(os.tmpdir(), `plantuml-user-scenario-${Date.now()}.puml`),
    );
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

  async dispose() {
    if (this.document || this.extensionApi?.getPreviewCount()) {
      await vscode.commands.executeCommand("workbench.action.closeAllEditors");
      if (this.extensionApi) {
        await waitFor(
          () => this.extensionApi?.getPreviewCount() === 0,
          "the VS Code preview to dispose",
        );
      }
    }

    if (this.sourceUri) {
      try {
        await vscode.workspace.fs.delete(this.sourceUri);
      } catch (error) {
        if (
          !(error instanceof vscode.FileSystemError) ||
          error.code !== "FileNotFound"
        ) {
          throw error;
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
  predicate: () => boolean,
  description: string,
  timeout = 10_000,
) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
  }
  assert.fail(`Timed out waiting for ${description}.`);
}
