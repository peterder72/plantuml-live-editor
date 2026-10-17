import { createDiagramBlob, type DiagramExportOptions } from "./diagramExporter";
import { plantUmlRenderer, type PlantUmlDiagnostic, type PlantUmlRenderer } from "./plantumlRenderer";

export interface AutomationRequest {
  type: "automationRequest";
  source: string;
  exportOptions?: DiagramExportOptions;
}

export type AutomationResult =
  | { type: "automationResult"; ok: true; data?: string }
  | { type: "automationResult"; ok: false; error: string; diagnostic?: PlantUmlDiagnostic };

/** Render the supplied snapshot, never the preview's last successful SVG. */
export async function renderAutomation(
  request: AutomationRequest,
  renderer: PlantUmlRenderer = plantUmlRenderer,
): Promise<AutomationResult> {
  try {
    const result = await renderer.render(request.source, 1);
    if (!result.ok) return { type: "automationResult", ok: false, error: result.error, diagnostic: result.diagnostic };
    if (!request.exportOptions) return { type: "automationResult", ok: true };
    const blob = await createDiagramBlob(result.svg, request.exportOptions);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    }
    return { type: "automationResult", ok: true, data: btoa(binary) };
  } catch (error) {
    return { type: "automationResult", ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function startAutomationRenderer() {
  const api = (window as unknown as { acquireVsCodeApi(): { postMessage(message: unknown): void } }).acquireVsCodeApi();
  let started = false;
  window.addEventListener("message", (event: MessageEvent<AutomationRequest>) => {
    if (event.data.type !== "automationRequest" || started) return;
    started = true;
    void renderAutomation(event.data).then((result) => api.postMessage(result));
  });
  api.postMessage({ type: "automationReady" });
}
