import { sanitizeSvg } from "./svgSanitizer";
import vizSource from "@peterder72/plantuml-core/viz-global.js?raw";

export interface PlantUmlDiagnostic {
  message: string;
  /** One-based source line, when the engine supplies a valid location. */
  line: number | null;
}

export type RenderResult =
  | { ok: true; svg: string; renderId: number; durationMs: number }
  | {
      ok: false;
      error: string;
      diagnostic?: PlantUmlDiagnostic;
      renderId: number;
      durationMs: number;
    };

export interface PlantUmlRenderer {
  initialize(): Promise<void>;
  render(source: string, renderId: number): Promise<RenderResult>;
}

export const RENDER_TIMEOUT_MS = 30_000;

type RenderToString = typeof import("@peterder72/plantuml-core").renderToString;

export function createEmbeddedVizScript(source = vizSource): HTMLScriptElement {
  const script = document.createElement("script");
  script.dataset.plantumlViz = "embedded";
  script.textContent = source;

  const nonce = document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce;
  if (nonce) script.nonce = nonce;

  return script;
}

export function renderToSvg(
  renderToString: RenderToString,
  source: string,
  timeoutMs = RENDER_TIMEOUT_MS,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error("PlantUML rendering timed out.")),
      timeoutMs,
    );
    const settle = (callback: () => void) => {
      window.clearTimeout(timeout);
      callback();
    };

    try {
      renderToString(
        source.split(/\r\n|\r|\n/),
        (value) => settle(() => resolve(value)),
        (message) => settle(() => reject(new Error(normalizeError(message)))),
      );
    } catch (error) {
      settle(() => reject(error));
    }
  });
}

const FORBIDDEN_SOURCE_PATTERNS: Array<[RegExp, string]> = [
  [
    /^\s*!(?:include|include_once|include_many|includeurl|theme|import)\b/im,
    "Includes, imports, and external themes are disabled for privacy.",
  ],
  [
    /^\s*(?:sprite|skinparam)\b[^\n]*(?:url|https?|file:)/im,
    "External sprites and resources are disabled for privacy.",
  ],
];

class BrowserPlantUmlRenderer implements PlantUmlRenderer {
  private initializePromise: Promise<void> | null = null;
  private renderToString: RenderToString | null = null;
  private queue = Promise.resolve();

  initialize(): Promise<void> {
    if (!this.initializePromise) {
      this.initializePromise = (async () => {
        if (!("Viz" in window)) {
          document.head.appendChild(createEmbeddedVizScript());
        }
        if (!("Viz" in window)) {
          throw new Error(
            "The embedded Graphviz engine could not initialize. Its Viz script may have been blocked by the page security policy.",
          );
        }
        const core = await import("@peterder72/plantuml-core");
        this.renderToString = core.renderToString;
      })();
    }
    return this.initializePromise;
  }

  render(source: string, renderId: number): Promise<RenderResult> {
    const operation = this.queue.then(async () => {
      const startedAt = performance.now();

      try {
        assertOfflineSource(source);
        await this.initialize();
        const renderToString = this.renderToString;
        if (!renderToString) {
          throw new Error("PlantUML renderer did not initialize.");
        }

        const svg = await renderToSvg(renderToString, source);

        const diagnostic = getPlantUmlDiagnostic(svg, source);
        if (diagnostic) {
          return {
            ok: false as const,
            error: diagnostic.message,
            diagnostic,
            renderId,
            durationMs: performance.now() - startedAt,
          };
        }

        return {
          ok: true as const,
          svg: sanitizeSvg(svg),
          renderId,
          durationMs: performance.now() - startedAt,
        };
      } catch (error) {
        console.error("PlantUML rendering failed.", error);
        return {
          ok: false as const,
          error: normalizeError(error),
          renderId,
          durationMs: performance.now() - startedAt,
        };
      }
    });

    this.queue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }
}

export function assertOfflineSource(source: string): void {
  for (const [pattern, message] of FORBIDDEN_SOURCE_PATTERNS) {
    if (pattern.test(source)) {
      throw new Error(message);
    }
  }
}

export function getPlantUmlDiagnostic(
  svg: string,
  source: string,
): PlantUmlDiagnostic | null {
  const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
  const labels = Array.from(parsed.querySelectorAll("text"), (element) =>
    element.textContent?.replace(/\s+/g, " ").trim() ?? "",
  );
  const locationIndex = labels.findIndex((label) =>
    /^\[From .+?\(line\s+(-?\d+)\)\s*\]$/i.test(label),
  );
  if (locationIndex < 0) return null;
  const location = /^\[From .+?\(line\s+(-?\d+)\)\s*\]$/i.exec(
    labels[locationIndex],
  );
  if (!location) return null;
  const sourceLines = source.split(/\r\n|\r|\n/);
  const opener = sourceLines.find((line) => /^\s*@start\w+\b/i.test(line));
  if (!opener) return null;
  const traceOpener = (
    opener.length > 120 ? `${opener.slice(0, 120)} ...` : opener
  ).replace(/\s+/g, " ").trim();
  // PSystemError renders a location banner, a literal source trace (starting
  // with @start...), then its error message. The browser API supplies no typed
  // error metadata. Match this envelope, not message wording or text colors:
  // native diagrams can report specific errors instead of "Syntax Error?".
  const traceIndex = labels.findIndex(
    (label, index) => index > locationIndex && label === traceOpener,
  );
  const detail = labels[labels.length - 1];
  if (traceIndex < 0 || traceIndex >= labels.length - 1 || !detail) return null;
  const reportedLine = Number(location[1]);
  const line =
    Number.isSafeInteger(reportedLine) &&
    reportedLine > 0 &&
    reportedLine <= sourceLines.length
      ? reportedLine
      : null;
  return {
    message: `${line === null ? "Syntax error." : `Syntax error near line ${line}.`} ${detail}`,
    line,
  };
}

function normalizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/^Error:\s*/i, "")
    .replace(/^java\.lang\.\w+Exception:\s*/i, "")
    .trim();
}

export const plantUmlRenderer: PlantUmlRenderer =
  new BrowserPlantUmlRenderer();
