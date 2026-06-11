const SVG_MIME_TYPE = "image/svg+xml;charset=utf-8";
const SVG_PARSER_TYPE = "image/svg+xml";

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function readSvgSize(svg: string) {
  const document = new DOMParser().parseFromString(svg, SVG_PARSER_TYPE);
  const element = document.documentElement;
  const viewBox = element.getAttribute("viewBox")?.trim().split(/[\s,]+/);
  const viewBoxWidth = Number.parseFloat(viewBox?.[2] ?? "");
  const viewBoxHeight = Number.parseFloat(viewBox?.[3] ?? "");
  const width = Number.parseFloat(element.getAttribute("width") ?? "");
  const height = Number.parseFloat(element.getAttribute("height") ?? "");

  return {
    width: viewBoxWidth || width,
    height: viewBoxHeight || height,
  };
}

export function downloadSvg(svg: string, fileName = "diagram.svg") {
  triggerDownload(new Blob([svg], { type: SVG_MIME_TYPE }), fileName);
}

export async function downloadPng(svg: string, fileName = "diagram.png") {
  const { width, height } = readSvgSize(svg);
  if (!width || !height) {
    throw new Error("The diagram SVG has no usable dimensions.");
  }

  const url = URL.createObjectURL(new Blob([svg], { type: SVG_MIME_TYPE }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width);
    canvas.height = Math.ceil(height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("PNG export is not supported by this browser.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) =>
          result ? resolve(result) : reject(new Error("Unable to create PNG.")),
        "image/png",
      );
    });
    triggerDownload(blob, fileName);
  } finally {
    URL.revokeObjectURL(url);
  }
}
