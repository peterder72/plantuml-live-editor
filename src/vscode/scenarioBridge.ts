import type {
  ScenarioCommand,
  ScenarioCommandResult,
} from "./messages";
import { fingerprint } from "../shared/fingerprint";

export async function runScenarioCommand(
  command: ScenarioCommand,
): Promise<ScenarioCommandResult> {
  switch (command.action) {
    case "inspect":
      break;
    case "panAndZoom":
      await panAndZoom();
      break;
    case "fitAndReset":
      await fitAndReset();
      break;
    case "toggleLiveFlag":
      toggleLiveFlag(command.name, command.enabled);
      break;
    case "wrapSelection":
      await wrapSelection(command.name);
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
    case "clickClass":
      await clickClass(command.name);
      break;
    case "exportWhiteSvg":
      return exportWhiteSvg();
    case "checkNetworkApis":
      return { ...inspect(), networkApisBlocked: await networkApisBlocked() };
  }
  await nextFrame();
  return inspect();
}

function inspect(): ScenarioCommandResult {
  const svg = document.querySelector<SVGSVGElement>(".diagram-content svg");
  const transform = required<HTMLElement>("[data-testid='diagram-transform']");
  return {
    svgFingerprint: fingerprint(svg?.outerHTML ?? ""),
    svgText: svg?.textContent ?? "",
    svgWidth: svg?.getAttribute("width") ?? "",
    transformStyle: transform.getAttribute("style") ?? "",
    scale: transform.dataset.scale ?? "",
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
    exportFileName: document.querySelector<HTMLElement>(".export-file-name")?.textContent ?? "",
    exportFeedback: document.querySelector<HTMLElement>(".export-feedback")?.textContent ?? "",
    exportFormat:
      document.querySelector<HTMLInputElement>("input[value='svg']:checked")?.value ??
      document.querySelector<HTMLInputElement>("input[value='png']:checked")?.value ??
      "",
    exportBackground:
      document.querySelector<HTMLInputElement>("input[value='white']:checked")?.value ??
      document.querySelector<HTMLInputElement>("input[value='transparent']:checked")?.value ??
      "",
  };
}

async function panAndZoom() {
  const transform = required<HTMLElement>("[data-testid='diagram-transform']");
  const beforeZoom = transform.dataset.scale;
  button("Zoom in").click();
  await waitFor(
    () => transform.dataset.scale !== beforeZoom,
    "zoom scale to change",
  );

  const viewport = required<HTMLElement>("[data-testid='diagram-viewport']");
  const beforePan = transform.getAttribute("style");
  const originalCapture = viewport.setPointerCapture;
  viewport.setPointerCapture = () => undefined;
  try {
    viewport.dispatchEvent(pointer("pointerdown", 100, 100));
    viewport.dispatchEvent(pointer("pointermove", 170, 145));
    viewport.dispatchEvent(pointer("pointerup", 170, 145));
  } finally {
    viewport.setPointerCapture = originalCapture;
  }
  await waitFor(() => transform.getAttribute("style") !== beforePan, "pan transform");
}

async function fitAndReset() {
  const transform = required<HTMLElement>("[data-testid='diagram-transform']");
  const beforeFit = transform.getAttribute("style");
  button("Fit diagram").click();
  await waitFor(() => transform.getAttribute("style") !== beforeFit, "fit transform");
  button("Reset view").click();
  await waitFor(
    () =>
      transform.dataset.scale === "1" &&
      /translate\(0px(?:, 0px)?\) scale\(1\)/.test(
        transform.getAttribute("style") ?? "",
      ),
    "reset transform",
  );
}

function toggleLiveFlag(name: string, enabled: boolean) {
  const input = [...document.querySelectorAll<HTMLLabelElement>(".live-toggle-control")]
    .find((label) => label.textContent?.trim() === name)
    ?.querySelector<HTMLInputElement>("input[type='checkbox']");
  if (!input) throw new Error(`Live flag ${name} was not found.`);
  if (input.checked !== enabled) input.click();
}

async function wrapSelection(name: string) {
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
  const input = required<HTMLInputElement>(`[aria-label='${inputLabel}']`);
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

async function clickClass(name: string) {
  const escaped = CSS.escape(name);
  const entity = document.querySelector<SVGGElement>(
    `.diagram-content g.entity[data-qualified-name='${escaped}'], ` +
      `.diagram-content g.entity[data-entity='${escaped}'], ` +
      `.diagram-content g.entity#entity_${escaped}`,
  );
  if (!entity) throw new Error(`Diagram class ${name} was not found.`);
  const viewport = required<HTMLElement>("[data-testid='diagram-viewport']");
  const originalCapture = viewport.setPointerCapture;
  viewport.setPointerCapture = () => undefined;
  try {
    entity.dispatchEvent(pointer("pointerdown", 100, 100));
    entity.dispatchEvent(pointer("pointerup", 100, 100));
  } finally {
    viewport.setPointerCapture = originalCapture;
  }
  await nextFrame();
}

async function exportWhiteSvg() {
  button("Export diagram").click();
  await nextFrame();
  required<HTMLInputElement>("input[value='svg']").click();
  required<HTMLInputElement>("input[value='white']").click();
  await nextFrame();
  const fileName = required<HTMLElement>(".export-file-name").textContent ?? "";
  const save = [...document.querySelectorAll<HTMLButtonElement>("button")]
    .find((candidate) => candidate.textContent?.trim() === "Save");
  if (!save) throw new Error("Export Save button was not found.");
  save.click();
  await waitFor(
    () => Boolean(document.querySelector(".export-feedback")?.textContent?.trim()),
    "export feedback",
  );
  const feedback = document.querySelector(".export-feedback")?.textContent ?? "";
  button("Export diagram").click();
  await nextFrame();
  return {
    ...inspect(),
    exportFileName: fileName,
    exportFeedback: feedback,
  };
}

async function networkApisBlocked() {
  const calls = [
    () => fetch("https://example.invalid/"),
    () => new XMLHttpRequest(),
    () => new WebSocket("wss://example.invalid/"),
    () => navigator.sendBeacon("https://example.invalid/", "secret"),
    () => window.open("https://example.invalid/"),
  ];
  const results = await Promise.all(
    calls.map(async (call) => {
      try {
        await call();
        return false;
      } catch {
        return true;
      }
    }),
  );
  return results.every(Boolean);
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

function pointer(type: string, clientX: number, clientY: number) {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    clientX,
    clientY,
  });
}

function nextFrame() {
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(fallback);
      resolve();
    };
    const fallback = window.setTimeout(finish, 100);
    requestAnimationFrame(finish);
  });
}

async function waitFor(predicate: () => boolean, description: string) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await nextFrame();
  }
  throw new Error(`Timed out waiting for ${description}.`);
}
