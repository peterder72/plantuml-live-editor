import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  copyDiagram,
  createDiagramBlob,
  deriveExportFileName,
  saveDiagram,
  type DiagramExportOptions,
} from "./diagramExporter";

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -5 320 180" style="width:320px;height:180px;background:#123456;"><rect width="20" height="20" fill="#abcdef"/></svg>';

function readBlob(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsText(blob);
  });
}

describe("diagramExporter", () => {
  const click = vi.fn();
  const write = vi.fn().mockResolvedValue(undefined);
  const revokeObjectURL = vi.fn();
  const objectUrlBlobs: Blob[] = [];

  beforeEach(() => {
    vi.restoreAllMocks();
    click.mockClear();
    write.mockClear();
    revokeObjectURL.mockClear();
    objectUrlBlobs.length = 0;
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn((blob: Blob) => {
        objectUrlBlobs.push(blob);
        return `blob:diagram-${objectUrlBlobs.length}`;
      }),
      revokeObjectURL,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { write },
    });
    vi.stubGlobal(
      "ClipboardItem",
      class {
        static supports = vi.fn(() => true);
        constructor(public data: Record<string, Blob>) {}
      },
    );

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      if (tagName === "a") {
        return { click, href: "", download: "" } as unknown as HTMLAnchorElement;
      }
      if (tagName === "canvas") {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage: vi.fn() }),
          toBlob: (callback: BlobCallback) =>
            callback(new Blob(["png"], { type: "image/png" })),
        } as unknown as HTMLCanvasElement;
      }
      return originalCreateElement(tagName);
    });
    vi.stubGlobal(
      "Image",
      class {
        src = "";
        decode = vi.fn().mockResolvedValue(undefined);
      },
    );
  });

  it("removes only the canvas background for transparent SVG", async () => {
    const blob = await createDiagramBlob(svg, {
      format: "svg",
      background: "transparent",
    });
    const exported = await readBlob(blob);

    expect(blob.type).toBe("image/svg+xml");
    expect(exported).not.toContain("background:#123456");
    expect(exported).not.toContain("data-export-background");
    expect(exported).toContain('fill="#abcdef"');
  });

  it("adds a viewBox-sized white canvas behind the diagram", async () => {
    const blob = await createDiagramBlob(svg, {
      format: "svg",
      background: "white",
    });
    const exported = await readBlob(blob);

    expect(exported).toContain(
      '<rect x="-10" y="-5" width="320" height="180" fill="#ffffff" data-export-background="white"',
    );
    expect(exported.indexOf("data-export-background")).toBeLessThan(
      exported.indexOf('fill="#abcdef"'),
    );
  });

  it("rasterizes at the SVG viewBox dimensions", async () => {
    const drawImage = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      if (tagName === "canvas") {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage }),
          toBlob: (callback: BlobCallback) =>
            callback(new Blob(["png"], { type: "image/png" })),
        } as unknown as HTMLCanvasElement;
      }
      return originalCreateElement(tagName);
    });

    const blob = await createDiagramBlob(svg, {
      format: "png",
      background: "transparent",
    });

    expect(blob.type).toBe("image/png");
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 320, 180);
  });

  it.each([
    ["transparent", false],
    ["white", true],
  ] as const)(
    "rasterizes the %s canvas treatment into PNG",
    async (background, hasWhiteCanvas) => {
      await createDiagramBlob(svg, { format: "png", background });
      const rasterSource = await readBlob(objectUrlBlobs[0]);
      expect(rasterSource.includes('data-export-background="white"')).toBe(
        hasWhiteCanvas,
      );
      expect(rasterSource).not.toContain("background:#123456");
    },
  );

  it.each([
    ["png", "transparent", "save"],
    ["png", "white", "save"],
    ["svg", "transparent", "save"],
    ["svg", "white", "save"],
    ["png", "transparent", "copy"],
    ["png", "white", "copy"],
    ["svg", "transparent", "copy"],
    ["svg", "white", "copy"],
  ] as const)("supports %s, %s, and %s", async (format, background, action) => {
    const options: DiagramExportOptions = { format, background };
    if (action === "save") {
      await saveDiagram(svg, options, `example.${format}`);
      expect(click).toHaveBeenCalledOnce();
    } else {
      await copyDiagram(svg, options);
      expect(write).toHaveBeenCalledOnce();
      const item = write.mock.calls[0][0][0] as { data: Record<string, Blob> };
      expect(Object.keys(item.data)).toEqual([
        format === "png" ? "image/png" : "image/svg+xml",
      ]);
    }
  });

  it("fails clearly when SVG clipboard data is unsupported", async () => {
    vi.mocked(ClipboardItem.supports).mockReturnValue(false);

    await expect(
      copyDiagram(svg, { format: "svg", background: "transparent" }),
    ).rejects.toThrow("cannot copy SVG images");
    expect(write).not.toHaveBeenCalled();
  });

  it("refuses active SVG before exporting", async () => {
    await expect(
      createDiagramBlob(
        '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.test"/></svg>',
        { format: "svg", background: "transparent" },
      ),
    ).rejects.toThrow(/unsafe external SVG resource/);
  });

  it.each([
    ["architecture.puml", "png", "architecture.png"],
    ["architecture.component.puml", "svg", "architecture.component.svg"],
    ["README", "png", "README.png"],
    ["/workspace/sequence.plantuml", "svg", "sequence.svg"],
    ["", "png", "diagram.png"],
  ] as const)("derives %s as %s", (source, format, expected) => {
    expect(deriveExportFileName(source, format)).toBe(expected);
  });
});
