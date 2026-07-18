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
  const editor = await vscode.window.showTextDocument(document);
  assert.equal(vscode.window.activeTextEditor?.document, document);
  assert.equal(document.languageId, "plantuml", ".puml is recognized as PlantUML");

  await vscode.window.showTextDocument(document);
  assert.equal(vscode.window.activeTextEditor?.document, document);

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

  editor.selection = new vscode.Selection(
    new vscode.Position(1, 0),
    new vscode.Position(1, 5),
  );
  await waitFor(() => {
    const state = extensionApi.getPreviewState(sourceUri.toString());
    return state?.lastSelectionSent.from === 10 && state.lastSelectionSent.to === 15;
  }, "the native editor selection to reach the webview");

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

  await extensionApi.disposePreview();
  assert.equal(extensionApi.getPreviewCount(), 0, "the followed preview panel disposes");
  assert.equal(
    vscode.window.activeTextEditor?.document.uri.toString(),
    secondSourceUri.toString(),
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
