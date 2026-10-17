import * as vscode from "vscode";
import type { AutomationRequest, AutomationResult } from "../../src/rendering/automationRenderer";
import { findLiveToggles } from "../../src/liveToggles/liveToggleSource";
import { readLiveToggleViews, switchLiveToggleView } from "../../src/liveToggles/liveToggleViews";

export interface ActionInput {
  documentUri?: string;
  outputUri?: string;
  format?: "svg" | "png";
  background?: "transparent" | "white";
  view?: string;
  overwrite?: boolean;
}
type Action = "validate" | "export" | "inspect" | "preview";
interface ActionResult {
  ok: boolean;
  documentUri: string;
  documentVersion: number;
  diagnostics?: Array<{ line: number | null; message: string }>;
  outputUri?: string;
  [key: string]: unknown;
}
const extensions = /\.(?:puml|plantuml|pu|iuml|wsd)$/i;
const noCancellation: vscode.CancellationToken = {
  isCancellationRequested: false,
  onCancellationRequested: () => new vscode.Disposable(() => {}),
};
function checkCancellation(token: vscode.CancellationToken) {
  if (token.isCancellationRequested) throw new vscode.CancellationError();
}

export class PlantUmlActions implements vscode.Disposable {
  private readonly panels = new Set<vscode.WebviewPanel>();
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly html: (webview: vscode.Webview) => string,
    private readonly diagnostics: vscode.DiagnosticCollection,
    private readonly preview: (document: vscode.TextDocument) => void,
    private readonly currentDocument: () => vscode.TextDocument | undefined,
  ) {}

  async document(input: ActionInput) {
    const document = input.documentUri
      ? await vscode.workspace.openTextDocument(vscode.Uri.parse(input.documentUri, true))
      : vscode.window.activeTextEditor?.document ?? this.currentDocument();
    if (!document || (document.languageId !== "plantuml" && !extensions.test(document.uri.path))) {
      throw new Error("Specify a PlantUML document URI or open a PlantUML document.");
    }
    return document;
  }

  async run(action: Action, input: ActionInput = {}, token = noCancellation): Promise<ActionResult> {
    checkCancellation(token);
    const document = await this.document(input);
    const documentUri = document.uri.toString();
    const documentVersion = document.version;
    const base = { documentUri, documentVersion };
    if (action === "preview") {
      this.preview(document);
      return { ...base, ok: true };
    }
    let source = document.getText();
    const views = readLiveToggleViews(source);
    if (action === "inspect") {
      return { ...base, ok: true, flags: findLiveToggles(source), ...views };
    }
    if (input.view) {
      if (!views.views.some((view) => view.name === input.view)) throw new Error(`Unknown named view: ${input.view}`);
      source = switchLiveToggleView(source, input.view);
    }
    const format = input.format ?? "svg";
    const background = input.background ?? "transparent";
    if (!["svg", "png"].includes(format) || !["transparent", "white"].includes(background)) {
      throw new Error("Export format must be svg/png and background transparent/white.");
    }
    let output: vscode.Uri | undefined;
    if (action === "export") {
      if (!vscode.workspace.isTrusted) throw new Error("Trust the workspace before exporting files.");
      if (!input.outputUri) throw new Error("Export requires an explicit outputUri.");
      output = vscode.Uri.parse(input.outputUri, true);
      if (output.toString() === documentUri || extensions.test(output.path)) throw new Error("Export cannot replace a PlantUML source file.");
      if (!output.path.toLowerCase().endsWith(`.${format}`)) throw new Error(`Output URI must end in .${format}.`);
      await this.checkOutput(output, input.overwrite);
    }
    const result = await this.render({ type: "automationRequest", source, exportOptions: action === "export" ? { format, background } : undefined }, token);
    checkCancellation(token);
    if (document.isClosed || document.version !== documentVersion) {
      throw new Error("The document changed during rendering. Retry against its current version.");
    }
    if (!result.ok) {
      const diagnostics = [result.diagnostic ?? { line: null, message: result.error }];
      if (!input.view) this.publishDiagnostics(document, diagnostics);
      return { ...base, ok: false, diagnostics, view: input.view };
    }
    if (!input.view) this.publishDiagnostics(document, []);
    if (output) {
      if (!result.data) throw new Error("Renderer returned no export data.");
      await this.checkOutput(output, input.overwrite);
      checkCancellation(token);
      if (document.isClosed || document.version !== documentVersion) {
        throw new Error("The document changed before export. Retry against its current version.");
      }
      await vscode.workspace.fs.writeFile(output, Buffer.from(result.data, "base64"));
    }
    return { ...base, ok: true, diagnostics: [], outputUri: output?.toString(), view: input.view };
  }

  private async checkOutput(uri: vscode.Uri, overwrite = false) {
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      if (stat.type & vscode.FileType.Directory) throw new Error("Export destination is a directory.");
      if (!overwrite) throw new Error("Export destination exists. Set overwrite: true to replace it.");
    } catch (error) {
      if (!(error instanceof vscode.FileSystemError) || error.code !== "FileNotFound") throw error;
    }
  }

  private publishDiagnostics(document: vscode.TextDocument, entries: Array<{ line: number | null; message: string }>) {
    this.diagnostics.set(document.uri, entries.map((entry) => {
      const line = entry.line && entry.line > 0 && entry.line <= document.lineCount ? entry.line - 1 : 0;
      const diagnostic = new vscode.Diagnostic(document.lineAt(line).range, entry.message, vscode.DiagnosticSeverity.Error);
      diagnostic.source = "PlantUML";
      return diagnostic;
    }));
  }

  private render(request: AutomationRequest, token: vscode.CancellationToken): Promise<AutomationResult> {
    checkCancellation(token);
    const panel = vscode.window.createWebviewPanel("plantumlLive.automation", "PlantUML: Checking diagram", { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true }, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview")],
    });
    this.panels.add(panel);
    return new Promise((resolve, reject) => {
      const disposables: vscode.Disposable[] = [];
      let settled = false;
      const finish = (result?: AutomationResult, error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        for (const disposable of disposables) disposable.dispose();
        this.panels.delete(panel);
        panel.dispose();
        if (result) resolve(result);
        else reject(error);
      };
      const timeout = setTimeout(() => finish(undefined, new Error("PlantUML automation timed out. Retry the action.")), 60_000);
      disposables.push(
        panel.onDidDispose(() => finish(undefined, new Error("PlantUML automation was closed."))),
        token.onCancellationRequested(() => finish(undefined, new vscode.CancellationError())),
        panel.webview.onDidReceiveMessage((message) => {
          if (message.type === "automationReady") {
            void panel.webview.postMessage(request).then((posted) => {
              if (!posted) finish(undefined, new Error("PlantUML renderer is unavailable."));
            }, (error: Error) => finish(undefined, error));
          } else if (message.type === "automationResult") finish(message);
        }),
      );
      if (token.isCancellationRequested) finish(undefined, new vscode.CancellationError());
      else panel.webview.html = this.html(panel.webview).replace("<body>", '<body data-automation="true"><p>Checking PlantUML locally…</p>');
    });
  }

  dispose() {
    for (const panel of this.panels) panel.dispose();
    this.panels.clear();
  }
}

export function registerAutomation(context: vscode.ExtensionContext, actions: PlantUmlActions) {
  const output = vscode.window.createOutputChannel("PlantUML Actions");
  context.subscriptions.push(actions, output);
  for (const action of ["validate", "export", "inspect"] as const) {
    context.subscriptions.push(vscode.commands.registerCommand(`plantumlLive.${action}`, async (input?: ActionInput) => {
      try {
        const options = { ...input };
        if (action === "export" && !options.outputUri) {
          const document = await actions.document(options);
          options.documentUri = document.uri.toString();
          const format = await vscode.window.showQuickPick(["svg", "png"], { title: "Export diagram format" }) as "svg" | "png" | undefined;
          if (!format) return;
          const destination = await vscode.window.showSaveDialog({ defaultUri: document.uri.with({ path: document.uri.path.replace(/\.[^./]+$/, `.${format}`) }), filters: { [format.toUpperCase()]: [format] } });
          if (!destination) return;
          Object.assign(options, { outputUri: destination.toString(), format, overwrite: true });
        }
        const result = await actions.run(action, options);
        output.appendLine(JSON.stringify(result, null, 2));
        if (!input) {
          if (action === "inspect") output.show(true);
          else void vscode.window.showInformationMessage(result.ok ? `PlantUML: ${action === "validate" ? "Diagram is valid" : "Diagram exported"}.` : "PlantUML: Check failed. See Problems and PlantUML Actions output.");
        }
        return result;
      } catch (error) {
        if (input) throw error;
        void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
      }
    }));
  }
  for (const action of ["validate", "export", "inspect", "preview"] as const) {
    context.subscriptions.push(vscode.lm.registerTool<ActionInput>(`plantumlLive_${action}`, {
      prepareInvocation: ({ input }) => ({
        invocationMessage: `PlantUML: ${action}`,
        confirmationMessages: {
          title: `PlantUML: ${action}`,
          message: new vscode.MarkdownString(action === "export"
            ? `Export ${input.documentUri} to ${input.outputUri}${input.overwrite ? " (replace existing destination)" : ""}?`
            : `${action} ${input.documentUri}?`),
        },
      }),
      invoke: async ({ input }, token) => new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify(await actions.run(action, input, token))),
      ]),
    }));
  }
  registerTasks(context, actions);
}

interface PlantUmlTask extends vscode.TaskDefinition {
  action: "validate" | "export";
  file?: string;
  output?: string;
  format?: "svg" | "png";
  background?: "transparent" | "white";
  view?: string;
  overwrite?: boolean;
}

function registerTasks(context: vscode.ExtensionContext, actions: PlantUmlActions) {
  const makeTask = (definition: PlantUmlTask, folder: vscode.WorkspaceFolder) => new vscode.Task(
    definition, folder, `PlantUML: ${definition.action}${definition.file ? ` ${definition.file}` : " workspace"}`, "PlantUML",
    new vscode.CustomExecution(async () => {
      const write = new vscode.EventEmitter<string>();
      const close = new vscode.EventEmitter<number>();
      const cancellation = new vscode.CancellationTokenSource();
      const execute = async () => {
        try {
          if (!["validate", "export"].includes(definition.action)) throw new Error("Unknown PlantUML task action.");
          if (definition.action === "export" && (!definition.file || !definition.output)) throw new Error("Export tasks require file and output paths.");
          const files = definition.file ? [vscode.Uri.joinPath(folder.uri, definition.file)] : await vscode.workspace.findFiles(new vscode.RelativePattern(folder, "**/*.{puml,plantuml,pu,iuml,wsd}"), "**/{node_modules,.git}/**");
          let ok = true;
          for (const file of files) {
            checkCancellation(cancellation.token);
            const result = await actions.run(definition.action, { documentUri: file.toString(), outputUri: definition.output ? vscode.Uri.joinPath(folder.uri, definition.output).toString() : undefined, format: definition.format, background: definition.background, view: definition.view, overwrite: definition.overwrite }, cancellation.token);
            ok &&= result.ok;
            write.fire(`${JSON.stringify(result)}\r\n`);
          }
          if (!files.length) write.fire("No PlantUML files found.\r\n");
          close.fire(ok ? 0 : 1);
        } catch (error) {
          write.fire(`${error instanceof Error ? error.message : String(error)}\r\n`);
          close.fire(1);
        } finally {
          cancellation.dispose();
          write.dispose();
          close.dispose();
        }
      };
      return { onDidWrite: write.event, onDidClose: close.event, open: () => { void execute(); }, close: () => cancellation.cancel() };
    }),
  );
  context.subscriptions.push(vscode.tasks.registerTaskProvider("plantumlLive", {
    provideTasks: () => (vscode.workspace.workspaceFolders ?? []).map((folder) => makeTask({ type: "plantumlLive", action: "validate" }, folder)),
    resolveTask: (task) => {
      const folder = task.scope;
      if (!folder || typeof folder === "number") return undefined;
      return makeTask(task.definition as PlantUmlTask, folder);
    },
  }));
}
