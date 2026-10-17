const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const os = require("node:os");
const path = require("node:path");
const vscode = require("vscode");

const PREVIEW_COMMAND = "plantumlLive.openPreview";
const PLANTUML_EXTENSIONS = ["puml", "plantuml", "pu", "iuml", "wsd"];
const WAIT_TIMEOUT = 30_000;
const ISOLATED_WORKSPACE = process.env.PLANTUML_TEST_WORKSPACE;
const TEMPORARY_ROOT = ISOLATED_WORKSPACE || os.tmpdir();

async function deleteTemporaryFile(uri) {
  if (!ISOLATED_WORKSPACE) await vscode.workspace.fs.delete(uri);
}

async function waitFor(predicate, description) {
  const deadline = Date.now() + WAIT_TIMEOUT;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(`Timed out waiting for ${description}.`);
}

async function run() {
  const unsupportedUri = vscode.Uri.file(
    path.join(TEMPORARY_ROOT, `plantuml-live-editor-${randomUUID()}.txt`),
  );
  await vscode.workspace.fs.writeFile(
    unsupportedUri,
    new TextEncoder().encode("not a PlantUML document"),
  );
  const unsupportedDocument =
    await vscode.workspace.openTextDocument(unsupportedUri);
  await vscode.window.showTextDocument(unsupportedDocument);

  const extension = vscode.extensions.getExtension(
    "peterder72.plantuml-live-editor",
  );
  assert.ok(extension, "development extension is discoverable");
  const extensionApi = await extension.activate();
  assert.equal(typeof extensionApi.getPreviewCount, "function");
  assert.equal(typeof extensionApi.disposePreview, "function");

  await vscode.commands.executeCommand(PREVIEW_COMMAND);
  assert.equal(
    extensionApi.getPreviewCount(),
    0,
    "unsupported documents do not create previews",
  );

  const sourceUri = vscode.Uri.file(
    path.join(TEMPORARY_ROOT, `plantuml-live-editor-${randomUUID()}.puml`),
  );
  await vscode.workspace.fs.writeFile(
    sourceUri,
    new TextEncoder().encode("@startuml\nAlice -> Bob: Hello\n@enduml\n"),
  );
  const document = await vscode.workspace.openTextDocument(sourceUri);

  // Production automation works without opening or replacing the preview.
  const actionInput = { documentUri: sourceUri.toString() };
  const inspection = await vscode.commands.executeCommand("plantumlLive.inspect", actionInput);
  assert.equal(inspection.ok, true);
  assert.equal(inspection.activeView, "Default");
  assert.equal(extensionApi.getPreviewCount(), 0);
  const validation = await vscode.commands.executeCommand("plantumlLive.validate", actionInput);
  assert.equal(validation.ok, true);
  assert.equal(validation.documentVersion, document.version);
  assert.equal(extensionApi.getPreviewCount(), 0);
  for (const format of ["svg", "png"]) {
    const outputUri = sourceUri.with({ path: `${sourceUri.path}.${format}` });
    const exportInput = { ...actionInput, outputUri: outputUri.toString(), format, background: "white" };
    const exported = await vscode.commands.executeCommand("plantumlLive.export", exportInput);
    assert.equal(exported.ok, true);
    assert.equal(exported.outputUri, outputUri.toString());
    const bytes = Buffer.from(await vscode.workspace.fs.readFile(outputUri));
    if (format === "png") assert.equal(bytes.subarray(1, 4).toString(), "PNG");
    else {
      assert.match(bytes.toString(), /<svg/);
      assert.match(bytes.toString(), /data-export-background="white"/);
    }
    await assert.rejects(vscode.commands.executeCommand("plantumlLive.export", exportInput), /exists/);
    assert.equal((await vscode.commands.executeCommand("plantumlLive.export", { ...exportInput, overwrite: true })).ok, true);
    await deleteTemporaryFile(outputUri);
  }
  const originalSource = document.getText();
  const replaceAutomationSource = async (text) => {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(sourceUri, new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)), text);
    assert.equal(await vscode.workspace.applyEdit(edit), true);
  };
  await replaceAutomationSource("@startuml\nAlice -> Bob\nthis is invalid ???\n@enduml");
  const invalid = await vscode.commands.executeCommand("plantumlLive.validate", actionInput);
  assert.equal(invalid.ok, false);
  assert.equal(invalid.diagnostics[0].line, 3);
  assert.ok(vscode.languages.getDiagnostics(sourceUri).length);
  const invalidOutput = sourceUri.with({ path: `${sourceUri.path}.invalid.svg` });
  const failedExport = await vscode.commands.executeCommand("plantumlLive.export", { ...actionInput, outputUri: invalidOutput.toString() });
  assert.equal(failedExport.ok, false);
  await assert.rejects(vscode.workspace.fs.stat(invalidOutput));
  await replaceAutomationSource(originalSource);
  assert.equal(vscode.languages.getDiagnostics(sourceUri).length, 0);

  const viewSource = "@startuml\n!$_live_DETAILS = %false()\nclass Base\n!if $_live_DETAILS\nclass Detail\n!endif\n@enduml\n/' @plantuml-live-editor views v2\n" + JSON.stringify({ activeView: "Default", views: { Default: { DETAILS: false }, Detailed: { DETAILS: true } } }) + "\n@end-plantuml-live-editor views '/";
  await replaceAutomationSource(viewSource);
  const viewState = await vscode.commands.executeCommand("plantumlLive.inspect", actionInput);
  assert.equal(viewState.flags[0].value, false);
  assert.equal(viewState.views.length, 2);
  const viewOutput = sourceUri.with({ path: `${sourceUri.path}.view.svg` });
  const viewExport = await vscode.commands.executeCommand("plantumlLive.export", { ...actionInput, outputUri: viewOutput.toString(), view: "Detailed" });
  assert.equal(viewExport.ok, true);
  assert.match(Buffer.from(await vscode.workspace.fs.readFile(viewOutput)).toString(), />Detail</);
  assert.equal(document.getText(), viewSource, "named view export does not edit source");
  await deleteTemporaryFile(viewOutput);
  await replaceAutomationSource(originalSource);

  const cancellation = new vscode.CancellationTokenSource();
  cancellation.cancel();
  await assert.rejects(vscode.lm.invokeTool("plantumlLive_validate", { input: actionInput }, cancellation.token));
  cancellation.dispose();
  const runningCancellation = new vscode.CancellationTokenSource();
  const cancellationListener = vscode.window.tabGroups.onDidChangeTabs((event) => {
    if (event.opened.some((tab) => tab.label === "PlantUML: Checking diagram")) runningCancellation.cancel();
  });
  try {
    await assert.rejects(vscode.lm.invokeTool("plantumlLive_validate", { input: actionInput }, runningCancellation.token));
  } finally {
    cancellationListener.dispose();
    runningCancellation.dispose();
  }
  await assert.rejects(vscode.commands.executeCommand("plantumlLive.validate", { ...actionInput, view: "Missing" }), /Unknown named view/);

  let changeDuringRender;
  const tabsListener = vscode.window.tabGroups.onDidChangeTabs((event) => {
    if (event.opened.some((tab) => tab.label === "PlantUML: Checking diagram")) {
      changeDuringRender = replaceAutomationSource(`${originalSource}\n' edited while checking`);
    }
  });
  try {
    await assert.rejects(vscode.commands.executeCommand("plantumlLive.validate", actionInput), /changed/);
    await changeDuringRender;
  } finally { tabsListener.dispose(); }
  await replaceAutomationSource(originalSource);

  const tasks = await vscode.tasks.fetchTasks({ type: "plantumlLive" });
  assert.ok(tasks.length, "workspace validation task is discoverable");
  const runTask = async (task) => {
    let listener;
    let timeout;
    const finished = new Promise((resolve, reject) => {
      timeout = setTimeout(() => reject(new Error("Task did not finish")), WAIT_TIMEOUT);
      listener = vscode.tasks.onDidEndTaskProcess((event) => {
        if (event.execution.task.definition.type === "plantumlLive") resolve(event.exitCode);
      });
    });
    try {
      await vscode.tasks.executeTask(task);
      return await finished;
    } finally { listener.dispose(); clearTimeout(timeout); }
  };
  assert.equal(await runTask(tasks[0]), 0, "validation task exits successfully");
  await replaceAutomationSource("@startuml\nAlice -> Bob\nthis is invalid ???\n@enduml");
  assert.equal(await runTask(tasks[0]), 1, "validation task reports invalid unsaved source");
  await replaceAutomationSource(originalSource);
  const folder = vscode.workspace.workspaceFolders[0];
  const taskOutput = sourceUri.with({ path: `${sourceUri.path}.task.svg` });
  await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(folder.uri, ".vscode"));
  await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(folder.uri, ".vscode/tasks.json"), new TextEncoder().encode(JSON.stringify({ version: "2.0.0", tasks: [{ label: "Export test", type: "plantumlLive", action: "export", file: path.basename(sourceUri.fsPath), output: path.basename(taskOutput.fsPath), problemMatcher: [] }] })));
  let exportTask;
  const taskDeadline = Date.now() + WAIT_TIMEOUT;
  while (!exportTask && Date.now() < taskDeadline) {
    const configuredTasks = await vscode.tasks.fetchTasks({ type: "plantumlLive" });
    exportTask = configuredTasks.find((task) => task.definition.action === "export");
    if (!exportTask) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(exportTask, "configured export task is discoverable");
  assert.equal(await runTask(exportTask), 0, "configured export task resolves and writes output");
  assert.match(Buffer.from(await vscode.workspace.fs.readFile(taskOutput)).toString(), /<svg/);
  await deleteTemporaryFile(taskOutput);
  const tools = vscode.lm.tools.filter((tool) => tool.name.startsWith("plantumlLive_"));
  assert.equal(tools.length, 4, "four production tools are registered");
  const toolResult = await vscode.lm.invokeTool("plantumlLive_inspect", { input: actionInput });
  assert.equal(JSON.parse(toolResult.content[0].value).ok, true);
  await assert.rejects(vscode.commands.executeCommand("plantumlLive.export", { ...actionInput, outputUri: sourceUri.toString(), overwrite: true }), /source file/);

  const editor = await vscode.window.showTextDocument(document);
  assert.equal(vscode.window.activeTextEditor?.document, document);
  assert.equal(document.languageId, "plantuml", ".puml is recognized as PlantUML");

  await vscode.window.showTextDocument(document);
  assert.equal(vscode.window.activeTextEditor?.document, document);

  await waitFor(() => {
    const controls = extensionApi.getControlsState();
    return (
      controls.ready &&
      controls.visible &&
      controls.documentUri === sourceUri.toString()
    );
  }, "the Explorer controls view");
  assert.equal(
    extensionApi.getPreviewCount(),
    0,
    "opening a PlantUML document does not automatically create a preview",
  );

  const commands = await vscode.commands.getCommands(true);
  assert.ok(commands.includes(PREVIEW_COMMAND), "preview command is registered");

  assert.equal(vscode.window.activeTextEditor?.document.uri.toString(), sourceUri.toString());
  await vscode.commands.executeCommand(PREVIEW_COMMAND);
  await waitFor(
    () => extensionApi.getPreviewCount() === 1,
    "the preview webview panel",
  );

  await waitFor(() => {
    const state = extensionApi.getPreviewState(sourceUri.toString());
    return (
      state?.ready &&
      state.lastRendered?.documentVersion === document.version
    );
  }, "the initial diagram render");
  const initialState = extensionApi.getPreviewState(sourceUri.toString());
  const initialFingerprint = initialState.lastRendered.svgFingerprint;
  const surfaceState = await extensionApi.runPreviewScenario({ action: "inspect" });
  assert.equal(surfaceState.controlsVisible, true, "controls render in the Explorer view");
  assert.equal(surfaceState.controlsDiagramChromeVisible, false, "diagram chrome is absent from controls");
  assert.equal(surfaceState.previewChromeVisible, true, "diagram actions render on the preview");
  assert.equal(surfaceState.previewStatusVisible, true, "preview render status is on the canvas");
  assert.equal(extensionApi.getControlsState().previewAvailable, true);
  const movedPreview = await extensionApi.runPreviewScenario({ action: "panAndZoom" });
  assert.equal((await vscode.commands.executeCommand("plantumlLive.validate", actionInput)).ok, true);
  const afterAutomation = await extensionApi.runPreviewScenario({ action: "inspect" });
  assert.equal(afterAutomation.transformStyle, movedPreview.transformStyle, "automation preserves preview transform");
  assert.equal(afterAutomation.svgFingerprint, movedPreview.svgFingerprint, "automation preserves preview SVG");


  await vscode.commands.executeCommand("workbench.action.closeSidebar");
  await waitFor(() => !extensionApi.getControlsState().visible, "the sidebar to close");

  editor.selection = new vscode.Selection(
    new vscode.Position(1, 0),
    new vscode.Position(1, 5),
  );
  await waitFor(() => {
    const state = extensionApi.getPreviewState(sourceUri.toString());
    return (
      state?.lastSelectionSent.from === 10 && state.lastSelectionSent.to === 15
    );
  }, "the native editor selection to reach the webview");
  // Allow a queued reveal command to execute before checking visibility.
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.equal(extensionApi.getControlsState().visible, false,
    "selection changes respect a hidden sidebar");
  await vscode.commands.executeCommand("workbench.view.explorer");
  await waitFor(() => extensionApi.getControlsState().visible, "the controls to reopen");

  await vscode.commands.executeCommand(PREVIEW_COMMAND);
  assert.equal(extensionApi.getPreviewCount(), 1, "reopening reuses the preview panel");

  const secondSourceUri = vscode.Uri.file(
    path.join(TEMPORARY_ROOT, `plantuml-live-editor-second-${randomUUID()}.puml`),
  );
  await vscode.workspace.fs.writeFile(
    secondSourceUri,
    new TextEncoder().encode(
      "@startuml\nclass Customer\nclass Order\nCustomer -- Order\n@enduml\n",
    ),
  );
  const secondDocument = await vscode.workspace.openTextDocument(secondSourceUri);
  await vscode.window.showTextDocument(secondDocument, {
    viewColumn: editor.viewColumn,
  });

  await waitFor(() => {
    const state = extensionApi.getPreviewState(secondSourceUri.toString());
    return (
      state?.ready &&
      state.lastRendered?.documentVersion === secondDocument.version &&
      state.lastRendered.svgFingerprint !== initialFingerprint
    );
  }, "the existing preview to follow the second document");
  assert.equal(extensionApi.getPreviewCount(), 1, "document switches reuse one preview");
  assert.equal(
    extensionApi.getPreviewState(sourceUri.toString()),
    undefined,
    "the preview is no longer associated with the first document",
  );

  const validSecondSource = secondDocument.getText();
  async function replaceSecondSource(source) {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      secondSourceUri,
      new vscode.Range(
        secondDocument.positionAt(0),
        secondDocument.positionAt(secondDocument.getText().length),
      ),
      source,
    );
    assert.equal(await vscode.workspace.applyEdit(edit), true);
  }
  const invalidSource = "@startuml\nAlice -> Bob\nthis is invalid ???\n@enduml";
  await replaceSecondSource(invalidSource);
  await waitFor(
    () =>
      vscode.languages
        .getDiagnostics(secondSourceUri)
        .some((entry) => entry.source === "PlantUML"),
    "native PlantUML source diagnostics",
  );
  const syntaxDiagnostic = vscode.languages
    .getDiagnostics(secondSourceUri)
    .find((entry) => entry.source === "PlantUML");
  assert.equal(syntaxDiagnostic.severity, vscode.DiagnosticSeverity.Error);
  assert.equal(syntaxDiagnostic.range.start.line, 2);
  assert.equal(
    syntaxDiagnostic.range.end.character,
    "this is invalid ???".length,
  );
  await replaceSecondSource(validSecondSource);
  await waitFor(
    () => vscode.languages.getDiagnostics(secondSourceUri).length === 0,
    "diagnostics to clear after correction",
  );
  await replaceSecondSource(invalidSource);
  await waitFor(
    () => vscode.languages.getDiagnostics(secondSourceUri).length > 0,
    "syntax diagnostics before preview disposal",
  );

  await extensionApi.disposePreview();
  assert.equal(
    extensionApi.getPreviewCount(),
    0,
    "the followed preview panel disposes",
  );
  assert.equal(
    vscode.languages.getDiagnostics(secondSourceUri).length,
    0,
    "disposing the preview clears diagnostics",
  );
  await replaceSecondSource(validSecondSource);
  assert.equal(
    extensionApi.getControlsState().previewAvailable,
    false,
    "closing the preview restores the Controls open action",
  );
  // Closing a webview does not guarantee source-editor focus on every platform.
  // Reopen from a non-PlantUML editor to exercise the remembered-document fallback.
  await vscode.window.showTextDocument(unsupportedDocument);
  assert.equal(
    extensionApi.getControlsState().documentUri,
    secondSourceUri.toString(),
    "closing the preview preserves the followed document",
  );

  await vscode.commands.executeCommand(PREVIEW_COMMAND);
  await waitFor(() => {
    const state = extensionApi.getPreviewState(secondSourceUri.toString());
    return (
      extensionApi.getPreviewCount() === 1 &&
      state?.ready &&
      state.lastRendered?.documentVersion === secondDocument.version
    );
  }, "the second document preview to render after being reopened");

  await extensionApi.disposePreview();
  assert.equal(extensionApi.getPreviewCount(), 0, "the preview panel disposes");
  await vscode.window.showTextDocument(unsupportedDocument);
  assert.equal(
    extensionApi.getControlsState().documentUri,
    secondSourceUri.toString(),
    "non-PlantUML editors keep the last diagram bound to controls",
  );
  await deleteTemporaryFile(sourceUri);
  await deleteTemporaryFile(secondSourceUri);
  await deleteTemporaryFile(unsupportedUri);

  for (const extension of PLANTUML_EXTENSIONS) {
    const languageUri = vscode.Uri.file(
      path.join(
        TEMPORARY_ROOT,
        `plantuml-language-${randomUUID()}.${extension}`,
      ),
    );
    await vscode.workspace.fs.writeFile(
      languageUri,
      new TextEncoder().encode("@startuml\nAlice -> Bob\n@enduml\n"),
    );
    const languageDocument = await vscode.workspace.openTextDocument(languageUri);
    assert.equal(
      languageDocument.languageId,
      "plantuml",
      `.${extension} is recognized as PlantUML`,
    );
    await deleteTemporaryFile(languageUri);
  }
}

module.exports = { run };
