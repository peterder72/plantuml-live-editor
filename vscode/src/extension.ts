import * as vscode from "vscode";
import type {
  ExtensionToWebviewMessage,
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

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly document: vscode.TextDocument,
    private readonly panel: vscode.WebviewPanel,
    private readonly onDispose: () => void,
  ) {
    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, "dist", "webview"),
      ],
    };
    panel.webview.html = this.getHtml(panel.webview);

    this.disposables.push(
      panel.onDidDispose(() => this.dispose()),
      panel.webview.onDidReceiveMessage((message: WebviewToExtensionMessage) =>
        this.handleMessage(message),
      ),
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.uri.toString() === document.uri.toString()) {
          void this.postDocumentState();
        }
      }),
    );
  }

  reveal(column: vscode.ViewColumn) {
    this.panel.reveal(column);
  }

  private async handleMessage(message: WebviewToExtensionMessage) {
    if (message.type === "ready") {
      this.ready = true;
      await this.postDocumentState();
      return;
    }

    if (message.type !== "replaceSource") return;
    if (this.document.version !== message.expectedVersion) {
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
    }
  }

  private postDocumentState() {
    return this.postMessage({
      type: "documentState",
      source: this.document.getText(),
      version: this.document.version,
      fileName: this.document.fileName.split(/[\\/]/).pop() ?? "PlantUML",
    });
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
    for (const disposable of this.disposables.splice(0)) disposable.dispose();
    this.onDispose();
  }
}

export function activate(context: vscode.ExtensionContext) {
  const previews = new Map<string, PreviewPanel>();

  context.subscriptions.push(
    vscode.commands.registerCommand(PREVIEW_COMMAND, () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || !isPlantUmlDocument(editor.document)) {
        void vscode.window.showErrorMessage(
          "Open a PlantUML file before opening the preview.",
        );
        return;
      }

      const key = editor.document.uri.toString();
      const existing = previews.get(key);
      if (existing) {
        existing.reveal(vscode.ViewColumn.Beside);
        return;
      }

      const panel = vscode.window.createWebviewPanel(
        VIEW_TYPE,
        `Preview ${editor.document.fileName.split(/[\\/]/).pop()}`,
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
        { retainContextWhenHidden: true },
      );
      const preview = new PreviewPanel(context, editor.document, panel, () =>
        previews.delete(key),
      );
      previews.set(key, preview);
    }),
  );
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
