import { beforeEach, describe, expect, it, vi } from "vitest";
import { downloadPng, downloadSvg } from "./diagramExporter";

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"></svg>';

describe("diagramExporter", () => {
  const click = vi.fn();
  const revokeObjectURL = vi.fn();
  const createObjectURL = vi.fn(() => "blob:diagram");

  beforeEach(() => {
    vi.restoreAllMocks();
    click.mockClear();
    revokeObjectURL.mockClear();
    createObjectURL.mockClear();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      if (tagName === "a") {
        return { click } as unknown as HTMLAnchorElement;
      }
      return document.createElementNS("http://www.w3.org/1999/xhtml", tagName);
    });
  });

  it("downloads the sanitized SVG", () => {
    downloadSvg(svg);

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:diagram");
  });

  it("rasterizes the SVG viewBox dimensions for PNG", async () => {
    const drawImage = vi.fn();
    const toBlob = vi.fn((callback: BlobCallback) =>
      callback(new Blob(["png"], { type: "image/png" })),
    );
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      if (tagName === "a") {
        return { click } as unknown as HTMLAnchorElement;
      }
      if (tagName === "canvas") {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage }),
          toBlob,
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

    await downloadPng(svg);

    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 320, 180);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/png");
    expect(click).toHaveBeenCalledOnce();
  });
});
