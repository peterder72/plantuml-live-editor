import * as vscode from "vscode";
import { PlantUmlActions, registerAutomation } from "./automation";
import { currentSourceDiagnostics } from "../../src/vscode/sourceDiagnostics";
import type {
  DocumentStateMessage,
  ExtensionToWebviewMessage,
  ScenarioCommand,
  ScenarioCommandResult,
  ScenarioResultMessage,
  WebviewSurface,
  WebviewToExtensionMessage,
} from "../../src/vscode/messages";

const VIEW_TYPE = "plantumlLive.preview";
const CONTROLS_VIEW_ID = "plantumlLive.controls";
const PREVIEW_COMMAND = "plantumlLive.openPreview";
const PLANTUML_LANGUAGE_IDS = new Set(["plantuml"]);
const PLANTUML_EXTENSIONS = /\.(?:puml|plantuml|pu|iuml|wsd)$/i;

interface WebviewTarget {
  readonly ready: boolean;
  postMessage(message: ExtensionToWebviewMessage): PromiseLike<boolean>;
}

class ScenarioRequests {
  private nextRequestId = 1;
  private readonly pending = new Map<
    number,
    {
      resolve: (result: ScenarioCommandResult) => void;
      reject: (error: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();

  constructor(private readonly label: string) {}

  run(
    command: ScenarioCommand,
    post: (message: ExtensionToWebviewMessage) => PromiseLike<boolean>,
  ) {
    const requestId = this.nextRequestId++;
    return new Promise<ScenarioCommandResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`Timed out running ${this.label} scenario ${command.action}.`));
      }, 35_000);
      this.pending.set(requestId, { resolve, reject, timeout });
      void Promise.resolve(
        post({ type: "scenarioCommand", requestId, command }),
      ).then(
        (posted) => {
          if (posted) return;
          clearTimeout(timeout);
          this.pending.delete(requestId);
          reject(new Error(`The ${this.label} webview is not ready.`));
        },
        (error: unknown) => {
          clearTimeout(timeout);
          this.pending.delete(requestId);
          reject(error instanceof Error ? error : new Error(String(error)));
        },
      );
    });
  }

  resolve(message: ScenarioResultMessage) {
    const pending = this.pending.get(message.requestId);
    if (!pending) return false;
    clearTimeout(pending.timeout);
    this.pending.delete(message.requestId);
    if (message.ok && message.result) pending.resolve(message.result);
    else pending.reject(new Error(message.error ?? `${this.label} scenario failed.`));
    return true;
  }

  dispose(reason: string) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(reason));
    }
    this.pending.clear();
  }
}

class PreviewPanel implements WebviewTarget {
  private disposed = false;
  private resolveDisposed: (() => void) | undefined;
  private readonly disposedPromise = new Promise<void>((resolve) => {
    this.resolveDisposed = resolve;
  });
  private isReady = false;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly scenarios = new ScenarioRequests("preview");

  constructor(
    private readonly context: vscode.ExtensionContext,
    document: vscode.TextDocument,
    private readonly panel: vscode.WebviewPanel,
    private readonly onMessage: (message: WebviewToExtensionMessage) => void,
    private readonly onDispose: () => void,
  ) {
    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, "dist", "webview"),
      ],
    };
    panel.title = getPreviewTitle(document);
    this.disposables.push(
      panel.onDidDispose(() => this.dispose()),
      panel.webview.onDidReceiveMessage((message: WebviewToExtensionMessage) => {
        if (message.type === "scenarioResult" && this.scenarios.resolve(message)) {
          return;
        }
        if (message.type === "ready" && message.surface === "preview") {
          this.isReady = true;
        }
        this.onMessage(message);
      }),
    );
    panel.webview.html = getWebviewHtml(
      context,
      panel.webview,
      "webview",
      "webview.js",
      true,
      "PlantUML Preview",
    );
  }

  get ready() {
    return this.isReady && !this.disposed;
  }

  setDocument(document: vscode.TextDocument) {
    this.panel.title = getPreviewTitle(document);
  }

  reveal(column: vscode.ViewColumn) {
    this.panel.reveal(column);
  }

  async close() {
    if (!this.disposed) this.panel.dispose();
    await this.disposedPromise;
  }

  postMessage(message: ExtensionToWebviewMessage) {
    if (!this.ready) return Promise.resolve(false);
    return this.panel.webview.postMessage(message);
  }

  runScenario(command: ScenarioCommand) {
    if (this.context.extensionMode !== vscode.ExtensionMode.Test) {
      throw new Error("Preview scenario commands are only available in tests.");
    }
    return this.scenarios.run(command, (message) => this.postMessage(message));
  }

  private dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.scenarios.dispose("The preview was disposed during a scenario command.");
    for (const disposable of this.disposables.splice(0)) disposable.dispose();
    this.onDispose();
    this.resolveDisposed?.();
    this.resolveDisposed = undefined;
  }
}

class ControlsViewProvider implements vscode.WebviewViewProvider, WebviewTarget {
  private view: vscode.WebviewView | undefined;
  private isReady = false;
  private revealPending: Promise<void> | undefined;
  private readonly scenarios = new ScenarioRequests("controls");

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly onMessage: (message: WebviewToExtensionMessage) => void,
  ) {}

  get ready() {
    return this.isReady && Boolean(this.view);
  }

  get visible() {
    return this.view?.visible ?? false;
  }

  resolveWebviewView(view: vscode.WebviewView) {
    this.view = view;
    this.isReady = false;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "dist", "controls"),
      ],
    };
    view.webview.html = getWebviewHtml(
      this.context,
      view.webview,
      "controls",
      "controls.js",
      false,
      "PlantUML Controls",
    );
    view.onDidDispose(() => {
      this.view = undefined;
      this.isReady = false;
      this.scenarios.dispose("The controls view was disposed during a scenario command.");
    });
    view.webview.onDidReceiveMessage((message: WebviewToExtensionMessage) => {
      if (message.type === "scenarioResult" && this.scenarios.resolve(message)) {
        return;
      }
      if (message.type === "ready" && message.surface === "controls") {
        this.isReady = true;
      }
      this.onMessage(message);
    });
    view.show(true);
  }

  reveal() {
    if (this.view) {
      this.view.show(true);
      return;
    }
    if (this.revealPending) return;
    this.revealPending = Promise.resolve(
      vscode.commands.executeCommand(`${CONTROLS_VIEW_ID}.focus`),
    )
      .then(() => {
        this.view?.show(true);
        return vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
      })
      .then(() => undefined)
      .finally(() => {
        this.revealPending = undefined;
      });
  }

  postMessage(message: ExtensionToWebviewMessage) {
    if (!this.ready || !this.view) return Promise.resolve(false);
    return this.view.webview.postMessage(message);
  }

  runScenario(command: ScenarioCommand) {
    if (this.context.extensionMode !== vscode.ExtensionMode.Test) {
      throw new Error("Controls scenario commands are only available in tests.");
    }
    return this.scenarios.run(command, (message) => this.postMessage(message));
  }
}

class DocumentSession {
  private document: vscode.TextDocument | undefined;
  private preview: PreviewPanel | undefined;
  private lastDocumentVersionSent = 0;
  private lastSelectionSent = { from: 0, to: 0 };
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
    private readonly controls: ControlsViewProvider,
    private readonly openPreview: () => void,
    private readonly diagnostics: vscode.DiagnosticCollection,
  ) {}

  followDocument(document: vscode.TextDocument) {
    if (!isPlantUmlDocument(document)) return;
    const changed = this.document?.uri.toString() !== document.uri.toString();
    if ((changed || this.document?.version !== document.version) && this.document)
      this.diagnostics.delete(this.document.uri);
    this.document = document;
    if (changed) {
      this.lastRendered = undefined;
      this.lastStatus = undefined;
      this.preview?.setDocument(document);
    }
    if (changed) this.controls.reveal();
    void this.postDocumentState();
  }

  attachPreview(preview: PreviewPanel) {
    this.preview = preview;
    if (this.document) preview.setDocument(this.document);
    void this.controls.postMessage({ type: "previewAvailability", available: false });
  }

  detachPreview(preview: PreviewPanel) {
    if (this.preview !== preview) return;
    this.preview = undefined;
    if (this.document) this.diagnostics.delete(this.document.uri);
    void this.controls.postMessage({
      type: "previewAvailability",
      available: false,
    });
  }

  getDocument() {
    return this.document;
  }

  getPreview() {
    return this.preview;
  }

  getPreviewState(uri: string) {
    if (!this.preview || this.document?.uri.toString() !== uri) return undefined;
    return {
      ready: this.preview.ready,
      documentUri: uri,
      lastDocumentVersionSent: this.lastDocumentVersionSent,
      lastSelectionSent: this.lastSelectionSent,
      lastRendered: this.lastRendered,
      lastStatus: this.lastStatus,
    };
  }

  getControlsState() {
    return {
      ready: this.controls.ready,
      visible: this.controls.visible,
      documentUri: this.document?.uri.toString(),
      previewAvailable: this.preview?.ready ?? false,
    };
  }

  async handleMessage(
    surface: WebviewSurface,
    message: WebviewToExtensionMessage,
  ) {
    if (message.type === "ready") {
      await this.postDocumentState(surface);
      if (surface === "controls") {
        await this.controls.postMessage({
          type: "previewAvailability",
          available: this.preview?.ready ?? false,
        });
      } else {
        await this.controls.postMessage({ type: "previewAvailability", available: true });
      }
      return;
    }

    if (message.type === "openPreview" && surface === "controls") {
      this.openPreview();
      return;
    }

    if (message.type === "replaceSource") {
      await this.replaceSource(message);
      return;
    }

    if (message.type === "rendered" && surface === "preview") {
      if (message.documentUri !== this.document?.uri.toString()) return;
      if (
        this.lastRendered &&
        (this.lastRendered.documentVersion > message.documentVersion ||
          (this.lastRendered.documentVersion === message.documentVersion &&
            this.lastRendered.renderRevision >= message.renderRevision))
      ) {
        return;
      }
      this.lastRendered = {
        documentVersion: message.documentVersion,
        renderRevision: message.renderRevision,
        svgFingerprint: message.svgFingerprint,
      };
      return;
    }

    if (message.type === "diagnostics" && surface === "preview") {
      const document = this.document;
      if (!this.preview || !document || document.isClosed) return;
      const entries = currentSourceDiagnostics(message, {
        uri: document.uri.toString(),
        version: document.version,
        lineCount: document.lineCount,
      });
      if (entries === null) return;
      const diagnostics = entries.map((entry) => {
        const diagnostic = new vscode.Diagnostic(
          document.lineAt(entry.line - 1).range,
          entry.message,
          vscode.DiagnosticSeverity.Error,
        );
        diagnostic.source = "PlantUML";
        return diagnostic;
      });
      this.diagnostics.set(document.uri, diagnostics);
      return;
    }

    if (message.type === "renderStatus" && surface === "preview") {
      if (message.documentUri !== this.document?.uri.toString()) return;
      if (
        this.lastStatus &&
        this.lastStatus.documentVersion > message.documentVersion
      ) {
        return;
      }
      this.lastStatus = {
        documentVersion: message.documentVersion,
        kind: message.kind,
        label: message.label,
        svgFingerprint: message.svgFingerprint,
      };
      return;
    }
  }

  async runScenario(command: ScenarioCommand) {
    if (!this.preview?.ready) throw new Error("No PlantUML preview is open.");
    const controlActions = new Set([
      "toggleLiveFlag",
      "wrapSelection",
      "createView",
      "switchView",
      "renameView",
    ]);
    const runControls = command.action === "inspect" || controlActions.has(command.action);
    const runPreview = command.action === "inspect" || !controlActions.has(command.action);
    const controlsResult = runControls
      ? await this.controls.runScenario(command)
      : await this.controls.runScenario({ action: "inspect" });
    const previewResult = runPreview
      ? await this.preview.runScenario(command)
      : await this.preview.runScenario({ action: "inspect" });
    return mergeScenarioResults(previewResult, controlsResult);
  }

  private async postDocumentState(surface?: WebviewSurface) {
    if (!this.document) return;
    const message = this.createDocumentState();
    const targets: WebviewTarget[] = [];
    if (!surface || surface === "preview") {
      if (this.preview) targets.push(this.preview);
    }
    if (!surface || surface === "controls") targets.push(this.controls);
    await Promise.all(targets.map((target) => target.postMessage(message)));
  }

  private createDocumentState(): DocumentStateMessage {
    const document = this.document!;
    this.lastDocumentVersionSent = document.version;
    this.lastSelectionSent = this.getDocumentSelection(document);
    return {
      type: "documentState",
      documentUri: document.uri.toString(),
      source: document.getText(),
      version: document.version,
      fileName: document.fileName.split(/[\\/]/).pop() ?? "PlantUML",
      selection: this.lastSelectionSent,
    };
  }

  private getDocumentSelection(document: vscode.TextDocument) {
    const editor = vscode.window.visibleTextEditors.find(
      (candidate) => candidate.document.uri.toString() === document.uri.toString(),
    );
    if (!editor) return { from: 0, to: 0 };
    return {
      from: document.offsetAt(editor.selection.anchor),
      to: document.offsetAt(editor.selection.active),
    };
  }

  private async replaceSource(message: Extract<WebviewToExtensionMessage, { type: "replaceSource" }>) {
    const document = this.document;
    if (
      !document ||
      message.documentUri !== document.uri.toString() ||
      document.version !== message.expectedVersion
    ) {
      await this.showHostError("The document changed before the control edit was applied.");
      await this.postDocumentState();
      return;
    }

    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(document.getText().length),
    );
    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, fullRange, message.source);
    if (!(await vscode.workspace.applyEdit(edit))) {
      await this.showHostError("VS Code could not apply the control edit.");
      return;
    }

    if (message.selectionAfter) {
      const editor = vscode.window.visibleTextEditors.find(
        (candidate) => candidate.document.uri.toString() === document.uri.toString(),
      );
      if (editor) {
        const sourceLength = message.source.length;
        const from = Math.max(0, Math.min(message.selectionAfter.from, sourceLength));
        const to = Math.max(0, Math.min(message.selectionAfter.to, sourceLength));
        const selection = new vscode.Selection(
          document.positionAt(from),
          document.positionAt(to),
        );
        editor.selection = selection;
        editor.revealRange(selection, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
      }
    }
  }

  private async showHostError(message: string) {
    const posted = await this.preview?.postMessage({ type: "showError", message });
    if (!posted) await vscode.window.showErrorMessage(message);
  }
}

export function activate(context: vscode.ExtensionContext) {
  const sessionRef: { current?: DocumentSession } = {};
  const controls = new ControlsViewProvider(context, (message) => {
    void sessionRef.current?.handleMessage("controls", message);
  });

  const openPreview = (targetDocument?: vscode.TextDocument) => {
    const activeDocument = targetDocument ?? vscode.window.activeTextEditor?.document;
    if (activeDocument && isPlantUmlDocument(activeDocument)) {
      session.followDocument(activeDocument);
    }
    const document = session.getDocument();
    if (!document) {
      void vscode.window.showErrorMessage(
        "Open a PlantUML file before opening the preview.",
      );
      return;
    }

    const existing = session.getPreview();
    if (existing) {
      existing.reveal(vscode.ViewColumn.Beside);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      VIEW_TYPE,
      getPreviewTitle(document),
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      { retainContextWhenHidden: true },
    );
    const preview = new PreviewPanel(
      context,
      document,
      panel,
      (message) => void session.handleMessage("preview", message),
      () => session.detachPreview(preview),
    );
    session.attachPreview(preview);
  };

  const diagnostics = vscode.languages.createDiagnosticCollection("plantuml");
  context.subscriptions.push(diagnostics);
  const session = new DocumentSession(controls, openPreview, diagnostics);
  sessionRef.current = session;
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(CONTROLS_VIEW_ID, controls),
    vscode.commands.registerCommand(PREVIEW_COMMAND, async (uri?: vscode.Uri) => openPreview(uri instanceof vscode.Uri ? await vscode.workspace.openTextDocument(uri) : undefined)),
    vscode.workspace.onDidCloseTextDocument((document) =>
      diagnostics.delete(document.uri),
    ),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.contentChanges.length) diagnostics.delete(event.document.uri);
      if (
        event.document.uri.toString() === session.getDocument()?.uri.toString()
      ) {
        session.followDocument(event.document);
      }
    }),
    vscode.window.onDidChangeTextEditorSelection((event) => {
      if (event.textEditor.document.uri.toString() === session.getDocument()?.uri.toString()) {
        session.followDocument(event.textEditor.document);
      }
    }),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && isPlantUmlDocument(editor.document)) {
        session.followDocument(editor.document);
      }
    }),
  );

  registerAutomation(context, new PlantUmlActions(
    context,
    (webview) => getWebviewHtml(context, webview, "webview", "webview.js", true, "PlantUML Automation"),
    diagnostics,
    openPreview,
    () => session.getDocument(),
  ));

  const activeDocument = vscode.window.activeTextEditor?.document;
  if (activeDocument && isPlantUmlDocument(activeDocument)) {
    session.followDocument(activeDocument);
  }

  return {
    getPreviewCount: () => (session.getPreview() ? 1 : 0),
    getPreviewState: (uri: string) => session.getPreviewState(uri),
    getControlsState: () => session.getControlsState(),
    runPreviewScenario: (command: ScenarioCommand) => session.runScenario(command),
    disposePreview: () => session.getPreview()?.close() ?? Promise.resolve(),
  };
}

function mergeScenarioResults(
  preview: ScenarioCommandResult,
  controls: ScenarioCommandResult,
): ScenarioCommandResult {
  return {
    ...preview,
    activeView: controls.activeView,
    liveFlags: controls.liveFlags,
    networkApisBlocked: preview.networkApisBlocked,
    controlsVisible: controls.controlsVisible,
    controlsDiagramChromeVisible: controls.controlsDiagramChromeVisible,
  };
}

function getWebviewHtml(
  context: vscode.ExtensionContext,
  webview: vscode.Webview,
  directory: "webview" | "controls",
  scriptName: string,
  allowWasm: boolean,
  title: string,
) {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, "dist", directory, scriptName),
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, "dist", directory, "style.css"),
  );
  const nonce = getNonce();
  const wasm = allowWasm ? " 'wasm-unsafe-eval'" : "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'${wasm}; connect-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none';" />
    <link rel="stylesheet" href="${styleUri}" />
    <title>${title}</title>
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
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
