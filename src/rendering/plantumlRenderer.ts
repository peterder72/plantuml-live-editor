import { sanitizeSvg } from "./svgSanitizer";
import vizSource from "@peterder72/plantuml-core/viz-global.js?raw";

export type RenderResult =
  | { ok: true; svg: string; renderId: number; durationMs: number }
  | { ok: false; error: string; renderId: number; durationMs: number };

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
    /(?:https?|wss?|ftp|file|filesystem|javascript):|(?:^|[\s("'=])\/\//im,
    "URLs and network resources are disabled for privacy.",
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

        const diagnostic = getPlantUmlDiagnostic(svg);
        if (diagnostic) {
          throw new Error(diagnostic);
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

export function getPlantUmlDiagnostic(svg: string): string | null {
  const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
  const text = parsed.documentElement.textContent?.replace(/\s+/g, " ").trim();
  if (!text) return null;

  const syntaxErrorIndex = text.search(/Syntax Error\?/i);
  if (syntaxErrorIndex >= 0) {
    const line = text.match(/\[From [^\]]*?\(line\s+(\d+)\)/i)?.[1];
    return line ? `Syntax error near line ${line}.` : "PlantUML syntax error.";
  }

  if (/Unsupported diagram type/i.test(text)) {
    return "Unsupported diagram type.";
  }

  return null;
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
