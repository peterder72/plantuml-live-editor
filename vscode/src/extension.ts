import * as vscode from "vscode";
import type {
  ExtensionToWebviewMessage,
  ScenarioCommand,
  ScenarioCommandResult,
  WebviewToExtensionMessage,
} from "../../src/vscode/messages";

const VIEW_TYPE = "plantumlLive.preview";
const PREVIEW_COMMAND = "plantumlLive.openPreview";
const PLANTUML_LANGUAGE_IDS = new Set(["plantuml"]);
const PLANTUML_EXTENSIONS = /\.(?:puml|plantuml|pu|iuml|wsd)$/i;

class PreviewPanel {
  private disposed = false;
  private ready = false;
  private readonly disposables: vscode.Disposable[] = [];
  private lastDocumentVersionSent = 0;
  private lastSelectionSent = { from: 0, to: 0 };
  private nextScenarioRequestId = 1;
  private readonly pendingScenarioRequests = new Map<
    number,
    {
      resolve: (result: ScenarioCommandResult) => void;
      reject: (error: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();
  private lastStatus:
    | {
        documentVersion: number;
        kind: "initializing" | "rendering" | "success" | "error";
        label: string;
        svgFingerprint: string;
      }
    | undefined;
  private lastRendered:
    | {
        documentVersion: number;
        renderRevision: number;
        svgFingerprint: string;
      }
    | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private document: vscode.TextDocument,
    private readonly panel: vscode.WebviewPanel,
    private readonly onDispose: () => void,
  ) {
    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, "dist", "webview"),
      ],
    };

    this.disposables.push(
      panel.onDidDispose(() => this.dispose()),
      panel.webview.onDidReceiveMessage((message: WebviewToExtensionMessage) =>
        this.handleMessage(message),
      ),
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (
          event.document.uri.toString() === this.document.uri.toString()
        ) {
          void this.postDocumentState();
        }
      }),
      vscode.window.onDidChangeTextEditorSelection((event) => {
        if (
          event.textEditor.document.uri.toString() ===
          this.document.uri.toString()
        ) {
          void this.postDocumentState();
        }
      }),
    );

    panel.webview.html = this.getHtml(panel.webview);
  }

  reveal(column: vscode.ViewColumn) {
    this.panel.reveal(column);
  }

  followDocument(document: vscode.TextDocument) {
    if (this.disposed) return;
    const nextUri = document.uri.toString();
    if (nextUri === this.document.uri.toString()) return;
    this.document = document;
    this.lastRendered = undefined;
    this.lastStatus = undefined;
    this.panel.title = getPreviewTitle(document);
    void this.postDocumentState();
  }

  getState() {
    return {
      ready: this.ready,
      documentUri: this.document.uri.toString(),
      lastDocumentVersionSent: this.lastDocumentVersionSent,
      lastSelectionSent: this.lastSelectionSent,
      lastRendered: this.lastRendered,
      lastStatus: this.lastStatus,
    };
  }

  async runScenarioCommand(command: ScenarioCommand) {
    if (this.context.extensionMode !== vscode.ExtensionMode.Test) {
      throw new Error("Preview scenario commands are only available in extension tests.");
    }
    const requestId = this.nextScenarioRequestId++;
    return new Promise<ScenarioCommandResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingScenarioRequests.delete(requestId);
        reject(new Error(`Timed out running preview scenario command ${command.action}.`));
      }, 10_000);
      this.pendingScenarioRequests.set(requestId, { resolve, reject, timeout });
      void this.postMessage({ type: "scenarioCommand", requestId, command }).then(
        (posted) => {
          if (posted) return;
          clearTimeout(timeout);
          this.pendingScenarioRequests.delete(requestId);
          reject(new Error("The preview webview was not ready for a scenario command."));
        },
        (error: unknown) => {
          clearTimeout(timeout);
          this.pendingScenarioRequests.delete(requestId);
          reject(error instanceof Error ? error : new Error(String(error)));
        },
      );
    });
  }

  private async handleMessage(message: WebviewToExtensionMessage) {
    if (message.type === "ready") {
      this.ready = true;
      await this.postDocumentState();
      return;
    }

    if (message.type === "rendered") {
      if (message.documentUri !== this.document.uri.toString()) return;
      this.lastRendered = {
        documentVersion: message.documentVersion,
        renderRevision: message.renderRevision,
        svgFingerprint: message.svgFingerprint,
      };
      return;
    }

    if (message.type === "renderStatus") {
      if (message.documentUri !== this.document.uri.toString()) return;
      this.lastStatus = {
        documentVersion: message.documentVersion,
        kind: message.kind,
        label: message.label,
        svgFingerprint: message.svgFingerprint,
      };
      return;
    }

    if (message.type === "scenarioResult") {
      const pending = this.pendingScenarioRequests.get(message.requestId);
      if (!pending) return;
      clearTimeout(pending.timeout);
      this.pendingScenarioRequests.delete(message.requestId);
      if (message.ok && message.result) pending.resolve(message.result);
      else pending.reject(new Error(message.error ?? "Preview scenario command failed."));
      return;
    }

    if (message.type !== "replaceSource") return;
    if (
      message.documentUri !== this.document.uri.toString() ||
      this.document.version !== message.expectedVersion
    ) {
      await this.postMessage({
        type: "showError",
        message: "The document changed before the toggle edit was applied.",
      });
      await this.postDocumentState();
      return;
    }

    const fullRange = new vscode.Range(
      this.document.positionAt(0),
      this.document.positionAt(this.document.getText().length),
    );
    const edit = new vscode.WorkspaceEdit();
    edit.replace(this.document.uri, fullRange, message.source);
    if (!(await vscode.workspace.applyEdit(edit))) {
      await this.postMessage({
        type: "showError",
        message: "VS Code could not apply the toggle edit.",
      });
      return;
    }

    if (message.selectionAfter) {
      const editor = vscode.window.visibleTextEditors.find(
        (candidate) =>
          candidate.document.uri.toString() === this.document.uri.toString(),
      );
      if (editor) {
        const sourceLength = this.document.getText().length;
        const from = Math.max(
          0,
          Math.min(message.selectionAfter.from, sourceLength),
        );
        const to = Math.max(
          0,
          Math.min(message.selectionAfter.to, sourceLength),
        );
        const selection = new vscode.Selection(
          this.document.positionAt(from),
          this.document.positionAt(to),
        );
        editor.selection = selection;
        editor.revealRange(selection, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
      }
    }
  }

  private postDocumentState() {
    this.lastDocumentVersionSent = this.document.version;
    this.lastSelectionSent = this.getDocumentSelection();
    return this.postMessage({
      type: "documentState",
      documentUri: this.document.uri.toString(),
      source: this.document.getText(),
      version: this.document.version,
      fileName: this.document.fileName.split(/[\\/]/).pop() ?? "PlantUML",
      selection: this.lastSelectionSent,
    });
  }

  private getDocumentSelection() {
    const editor = vscode.window.visibleTextEditors.find(
      (candidate) =>
        candidate.document.uri.toString() === this.document.uri.toString(),
    );
    if (!editor) return { from: 0, to: 0 };
    return {
      from: this.document.offsetAt(editor.selection.anchor),
      to: this.document.offsetAt(editor.selection.active),
    };
  }

  private postMessage(message: ExtensionToWebviewMessage) {
    if (!this.ready || this.disposed) return Promise.resolve(false);
    return this.panel.webview.postMessage(message);
  }

  private getHtml(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "dist",
        "webview",
        "webview.js",
      ),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "dist",
        "webview",
        "style.css",
      ),
    );
    const nonce = getNonce();

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}' 'wasm-unsafe-eval'; connect-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none';" />
    <link rel="stylesheet" href="${styleUri}" />
    <title>PlantUML Preview</title>
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
  }

  private dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const pending of this.pendingScenarioRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("The preview was disposed during a scenario command."));
    }
    this.pendingScenarioRequests.clear();
    for (const disposable of this.disposables.splice(0)) disposable.dispose();
    this.onDispose();
  }
}

export function activate(context: vscode.ExtensionContext) {
  let preview: PreviewPanel | undefined;
  const openPreview = () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !isPlantUmlDocument(editor.document)) {
      void vscode.window.showErrorMessage(
        "Open a PlantUML file before opening the preview.",
      );
      return;
    }

    if (preview) {
      preview.followDocument(editor.document);
      preview.reveal(vscode.ViewColumn.Beside);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      VIEW_TYPE,
      getPreviewTitle(editor.document),
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      { retainContextWhenHidden: true },
    );
    preview = new PreviewPanel(context, editor.document, panel, () => {
      preview = undefined;
    });
  };

  context.subscriptions.push(
    vscode.commands.registerCommand(PREVIEW_COMMAND, openPreview),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (preview && editor && isPlantUmlDocument(editor.document)) {
        preview.followDocument(editor.document);
      }
    }),
  );

  return {
    getPreviewCount: () => (preview ? 1 : 0),
    getPreviewState: (uri: string) => {
      const state = preview?.getState();
      return state?.documentUri === uri ? state : undefined;
    },
    runPreviewScenario: (command: ScenarioCommand) => {
      if (!preview) throw new Error("No PlantUML preview is open.");
      return preview.runScenarioCommand(command);
    },
  };
}

function getPreviewTitle(document: vscode.TextDocument) {
  return `Preview ${document.fileName.split(/[\\/]/).pop() ?? "PlantUML"}`;
}

function isPlantUmlDocument(document: vscode.TextDocument) {
  return (
    PLANTUML_LANGUAGE_IDS.has(document.languageId) ||
    PLANTUML_EXTENSIONS.test(document.fileName)
  );
}

function getNonce() {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";
  for (let index = 0; index < 32; index += 1) {
    value += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return value;
}

export function deactivate() {}
