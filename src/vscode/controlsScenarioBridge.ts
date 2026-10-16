import type { ScenarioCommand, ScenarioCommandResult } from "./messages";

export async function runControlsScenarioCommand(
  command: ScenarioCommand,
): Promise<ScenarioCommandResult> {
  switch (command.action) {
    case "inspect":
      break;
    case "toggleLiveFlag":
      toggleLiveFlag(command.name, command.enabled);
      break;
    case "wrapSelection":
      wrapSelection(command.name);
      break;
    case "createView":
      await editView("Create view", "New view name", "Save view", command.name);
      break;
    case "switchView":
      switchView(command.name);
      break;
    case "renameView":
      await editView("Rename view", "Rename view", "Save renamed view", command.name);
      break;
    case "fitAndReset":
    case "exportWhiteSvg":
    case "panAndZoom":
    case "clickClass":
    case "checkNetworkApis":
      throw new Error(`${command.action} is not a controls scenario action.`);
  }
  await nextFrame();
  return inspectControls();
}

function inspectControls(): ScenarioCommandResult {
  return {
    svgFingerprint: "",
    svgText: "",
    svgWidth: "",
    transformStyle: "",
    scale: "",
    activeView:
      document.querySelector<HTMLSelectElement>("[aria-label='Active view']")?.value ?? "",
    liveFlags: Object.fromEntries(
      [...document.querySelectorAll<HTMLLabelElement>(".live-toggle-control")].map(
        (label) => [
          label.textContent?.trim() ?? "",
          label.querySelector<HTMLInputElement>("input[type='checkbox']")?.checked ?? false,
        ],
      ),
    ),
    exportFileName:
      document.querySelector<HTMLElement>(".export-file-name")?.textContent ?? "",
    exportFeedback:
      document.querySelector<HTMLElement>(".export-feedback")?.textContent ?? "",
    exportFormat:
      document.querySelector<HTMLInputElement>("input[value='svg']:checked")?.value ??
      document.querySelector<HTMLInputElement>("input[value='png']:checked")?.value ??
      "",
    exportBackground:
      document.querySelector<HTMLInputElement>("input[value='white']:checked")?.value ??
      document.querySelector<HTMLInputElement>("input[value='transparent']:checked")?.value ??
      "",
    controlsVisible: Boolean(document.querySelector(".vscode-controls")),
    controlsDiagramChromeVisible: Boolean(
      document.querySelector(
        ".viewport-controls, .diagram-export, .preview-hud, .controls-help",
      ),
    ),
  };
}

function toggleLiveFlag(name: string, enabled: boolean) {
  const input = [...document.querySelectorAll<HTMLLabelElement>(".live-toggle-control")]
    .find((label) => label.textContent?.trim() === name)
    ?.querySelector<HTMLInputElement>("input[type='checkbox']");
  if (!input) throw new Error(`Live flag ${name} was not found.`);
  if (input.checked !== enabled) input.click();
}

function wrapSelection(name: string) {
  const select = required<HTMLSelectElement>("[aria-label='Wrap selection']");
  const option = [...select.options].find((candidate) =>
    candidate.textContent?.trim().startsWith(name),
  );
  if (!option) throw new Error(`Wrap option ${name} was not found.`);
  select.value = option.value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

async function editView(
  triggerLabel: string,
  inputLabel: string,
  saveLabel: string,
  name: string,
) {
  button(triggerLabel).click();
  await nextFrame();
  const input = required<HTMLInputElement>(`input[aria-label='${inputLabel}']`);
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  if (!valueSetter) throw new Error("Native input value setter is unavailable.");
  valueSetter.call(input, name);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await nextFrame();
  button(saveLabel).click();
}

function switchView(name: string) {
  const select = required<HTMLSelectElement>("[aria-label='Active view']");
  select.value = name;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}


function button(label: string) {
  const labelled = document.querySelector<HTMLButtonElement>(
    `button[aria-label='${label}'], button[title='${label}']`,
  );
  if (labelled) return labelled;
  const byText = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  if (!byText) throw new Error(`Scenario button not found: ${label}`);
  return byText;
}

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Scenario element not found: ${selector}`);
  return element;
}

function nextFrame() {
  return new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}
