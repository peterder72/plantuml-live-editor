import DOMPurify from "dompurify";

const FORBIDDEN_SVG_TAGS = [
  "a",
  "script",
  "style",
  "image",
  "use",
  "foreignObject",
  "iframe",
  "object",
  "embed",
  "audio",
  "video",
];

const URL_ATTRIBUTE_NAMES = new Set(["href", "xlink:href", "src"]);
const URL_FUNCTION_PATTERN = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;

export function sanitizeSvg(svg: string): string {
  const sanitized = DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: FORBIDDEN_SVG_TAGS,
    FORBID_ATTR: [
      "href",
      "xlink:href",
      "src",
      "onload",
      "onerror",
      "onclick",
      "onmouseover",
      "onfocus",
      "onbegin",
      "onend",
    ],
  });

  const document = new DOMParser().parseFromString(sanitized, "image/svg+xml");
  if (document.querySelector("parsererror")) {
    throw new Error("PlantUML produced invalid SVG.");
  }

  for (const element of document.querySelectorAll("*")) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith("on") || URL_ATTRIBUTE_NAMES.has(name)) {
        element.removeAttribute(attribute.name);
        continue;
      }
      if (
        (name === "style" || value.toLowerCase().includes("url(")) &&
        hasExternalUrlFunction(value)
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  }

  const result = new XMLSerializer().serializeToString(document.documentElement);
  assertInertSvg(result);
  return result;
}

export function assertInertSvg(svg: string): void {
  const lower = svg.toLowerCase();
  if (
    /<(?:a|script|style|image|use|foreignobject|iframe|object|embed|audio|video)\b/.test(
      lower,
    ) ||
    /\b(?:href|xlink:href|src)\s*=/.test(lower) ||
    /\bon[a-z]+\s*=/.test(lower) ||
    hasExternalUrlFunction(svg)
  ) {
    throw new Error("The diagram contains an unsafe external SVG resource.");
  }
}

function hasExternalUrlFunction(value: string): boolean {
  URL_FUNCTION_PATTERN.lastIndex = 0;
  for (const match of value.matchAll(URL_FUNCTION_PATTERN)) {
    if (!match[2].trim().startsWith("#")) return true;
  }
  return false;
}
