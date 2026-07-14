const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const vscode = require("vscode");

const PREVIEW_COMMAND = "plantumlLive.openPreview";

async function waitFor(predicate, description) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(`Timed out waiting for ${description}.`);
}

async function run() {
  const sourceUri = vscode.Uri.file(
    path.join(os.tmpdir(), `plantuml-live-editor-${Date.now()}.puml`),
  );
  await vscode.workspace.fs.writeFile(
    sourceUri,
    new TextEncoder().encode("@startuml\nAlice -> Bob: Hello\n@enduml\n"),
  );
  const document = await vscode.workspace.openTextDocument(sourceUri);
  const editor = await vscode.window.showTextDocument(document);
  assert.equal(vscode.window.activeTextEditor?.document, document);

  const extension = vscode.extensions.getExtension(
    "peterder72.plantuml-live-editor",
  );
  assert.ok(extension, "development extension is discoverable");
  const extensionApi = await extension.activate();
  assert.equal(typeof extensionApi.getPreviewCount, "function");
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

  const editApplied = await editor.edit((builder) => {
    builder.insert(new vscode.Position(2, 0), "Bob --> Alice: Hi\n");
  });
  assert.equal(editApplied, true, "source edit is applied");
  assert.match(document.getText(), /Bob --> Alice: Hi/);
  assert.equal(extensionApi.getPreviewCount(), 1, "source edits reuse the preview panel");

  await vscode.commands.executeCommand(PREVIEW_COMMAND);
  assert.equal(extensionApi.getPreviewCount(), 1, "reopening reuses the preview panel");

  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  await vscode.workspace.fs.delete(sourceUri);
}

module.exports = { run };
