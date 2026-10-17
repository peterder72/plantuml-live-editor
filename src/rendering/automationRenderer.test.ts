import { describe, expect, it, vi } from "vitest";
import { renderAutomation } from "./automationRenderer";
import { createDiagramBlob } from "./diagramExporter";
import type { PlantUmlRenderer, RenderResult } from "./plantumlRenderer";

vi.mock("./diagramExporter", () => ({ createDiagramBlob: vi.fn() }));
vi.mock("./plantumlRenderer", () => ({ plantUmlRenderer: {} }));

function renderer(result: RenderResult): PlantUmlRenderer {
  return { initialize: vi.fn(), render: vi.fn().mockResolvedValue(result) };
}
const success: RenderResult = { ok: true, svg: "<svg/>", renderId: 1, durationMs: 1 };

describe("automation rendering", () => {
  it("validates the supplied snapshot rather than any preview state", async () => {
    const engine = renderer(success);
    const result = await renderAutomation({ type: "automationRequest", source: "current unsaved source" }, engine);
    expect(engine.render).toHaveBeenCalledWith("current unsaved source", 1);
    expect(result).toEqual({ type: "automationResult", ok: true });
  });

  it("returns located errors and never exports after failed rendering", async () => {
    vi.mocked(createDiagramBlob).mockClear();
    const diagnostic = { line: 3, message: "Syntax error" };
    const result = await renderAutomation({ type: "automationRequest", source: "invalid", exportOptions: { format: "svg", background: "white" } }, renderer({ ok: false, error: diagnostic.message, diagnostic, renderId: 1, durationMs: 1 }));
    expect(result).toEqual({ type: "automationResult", ok: false, error: diagnostic.message, diagnostic });
    expect(createDiagramBlob).not.toHaveBeenCalled();
  });

  it.each(["png", "svg"] as const)("exports fresh %s bytes using the requested background", async (format) => {
    const bytes = new Uint8Array([0, 137, 255, 65]);
    vi.mocked(createDiagramBlob).mockResolvedValue({ arrayBuffer: async () => bytes.buffer } as Blob);
    const options = { format, background: "white" as const };
    expect(await renderAutomation({ type: "automationRequest", source: "fresh", exportOptions: options }, renderer(success))).toEqual({ type: "automationResult", ok: true, data: btoa(String.fromCharCode(...bytes)) });
    expect(createDiagramBlob).toHaveBeenLastCalledWith(success.svg, options);
  });

  it("returns exporter failures instead of reporting success", async () => {
    vi.mocked(createDiagramBlob).mockRejectedValue(new Error("Invalid SVG"));
    expect(await renderAutomation({ type: "automationRequest", source: "source", exportOptions: { format: "svg", background: "transparent" } }, renderer(success))).toEqual({ type: "automationResult", ok: false, error: "Invalid SVG" });
  });
});
