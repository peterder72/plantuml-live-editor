import { assertInertSvg, sanitizeSvg } from "./svgSanitizer";

export type ExportFormat = "png" | "svg";
export type ExportBackground = "transparent" | "white";

export interface DiagramExportOptions {
  format: ExportFormat;
  background: ExportBackground;
}

const SVG_MIME_TYPE = "image/svg+xml";
const PNG_MIME_TYPE = "image/png";
const SVG_PARSER_TYPE = "image/svg+xml";

interface SvgGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function createDiagramBlob(
  svg: string,
  options: DiagramExportOptions,
): Promise<Blob> {
  const prepared = prepareSvg(svg, options.background);
  if (options.format === "svg") {
    return new Blob([prepared.svg], { type: SVG_MIME_TYPE });
  }
  return rasterizeSvg(prepared.svg, prepared.geometry);
}

export async function saveDiagram(
  svg: string,
  options: DiagramExportOptions,
  fileName: string,
) {
  const blob = await createDiagramBlob(svg, options);
  triggerDownload(blob, fileName);
}

export async function copyDiagram(
  svg: string,
  options: DiagramExportOptions,
) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Image copying is not supported by this browser.");
  }
  if (
    options.format === "svg" &&
    (typeof ClipboardItem.supports !== "function" ||
      !ClipboardItem.supports(SVG_MIME_TYPE))
  ) {
    throw new Error("This browser cannot copy SVG images. Save the SVG instead.");
  }

  const mimeType = options.format === "png" ? PNG_MIME_TYPE : SVG_MIME_TYPE;
  const blob = createDiagramBlob(svg, options);
  await navigator.clipboard.write([
    new ClipboardItem({ [mimeType]: blob }),
  ]);
}

export function deriveExportFileName(
  sourceFileName: string,
  format: ExportFormat,
) {
  const fileName = sourceFileName.split(/[\\/]/).pop()?.trim() || "diagram";
  const extensionIndex = fileName.lastIndexOf(".");
  const baseName =
    extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName;
  return `${baseName || "diagram"}.${format}`;
}

function prepareSvg(svg: string, background: ExportBackground) {
  assertInertSvg(svg);
  const sanitized = sanitizeSvg(svg);
  const document = new DOMParser().parseFromString(sanitized, SVG_PARSER_TYPE);
  if (document.querySelector("parsererror")) {
    throw new Error("The diagram SVG is invalid.");
  }

  const element = document.documentElement;
  const geometry = readSvgGeometry(element);
  removeCanvasBackground(element);

  if (background === "white") {
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", String(geometry.x));
    rect.setAttribute("y", String(geometry.y));
    rect.setAttribute("width", String(geometry.width));
    rect.setAttribute("height", String(geometry.height));
    rect.setAttribute("fill", "#ffffff");
    rect.setAttribute("data-export-background", "white");
    element.insertBefore(rect, element.firstChild);
  }

  const prepared = new XMLSerializer().serializeToString(element);
  assertInertSvg(prepared);
  return { svg: prepared, geometry };
}

function readSvgGeometry(element: Element): SvgGeometry {
  const viewBox = element.getAttribute("viewBox")?.trim().split(/[\s,]+/);
  const viewBoxValues = viewBox?.map((value) => Number.parseFloat(value));
  const width = Number.parseFloat(element.getAttribute("width") ?? "");
  const height = Number.parseFloat(element.getAttribute("height") ?? "");
  const viewBoxX = viewBoxValues?.[0] ?? 0;
  const viewBoxY = viewBoxValues?.[1] ?? 0;
  const geometry = {
    x: Number.isFinite(viewBoxX) ? viewBoxX : 0,
    y: Number.isFinite(viewBoxY) ? viewBoxY : 0,
    width: viewBoxValues?.[2] || width,
    height: viewBoxValues?.[3] || height,
  };

  if (
    !Number.isFinite(geometry.width) ||
    !Number.isFinite(geometry.height) ||
    geometry.width <= 0 ||
    geometry.height <= 0
  ) {
    throw new Error("The diagram SVG has no usable dimensions.");
  }
  return geometry;
}

function removeCanvasBackground(element: Element) {
  element.removeAttribute("background");
  element.removeAttribute("background-color");

  const style = element.getAttribute("style");
  if (!style) return;
  const remaining = style
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .filter((declaration) => {
      const property = declaration.split(":", 1)[0].trim().toLowerCase();
      return property !== "background" && property !== "background-color";
    });
  if (remaining.length) {
    element.setAttribute("style", `${remaining.join(";")};`);
  } else {
    element.removeAttribute("style");
  }
}

async function rasterizeSvg(svg: string, geometry: SvgGeometry) {
  const url = URL.createObjectURL(new Blob([svg], { type: SVG_MIME_TYPE }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(geometry.width);
    canvas.height = Math.ceil(geometry.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("PNG export is not supported by this browser.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) =>
          result ? resolve(result) : reject(new Error("Unable to create PNG.")),
        PNG_MIME_TYPE,
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
