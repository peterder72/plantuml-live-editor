import { sanitizeSvg } from "./svgSanitizer";
import vizSource from "@plantuml/core/viz-global.js?raw";

export type RenderResult =
  | { ok: true; svg: string; renderId: number; durationMs: number }
  | { ok: false; error: string; renderId: number; durationMs: number };

export interface PlantUmlRenderer {
  initialize(): Promise<void>;
  render(source: string, renderId: number): Promise<RenderResult>;
}

type RenderToString = typeof import("@plantuml/core").renderToString;

class BrowserPlantUmlRenderer implements PlantUmlRenderer {
  private initializePromise: Promise<void> | null = null;
  private renderToString: RenderToString | null = null;
  private queue = Promise.resolve();

  initialize(): Promise<void> {
    if (!this.initializePromise) {
      this.initializePromise = (async () => {
        if (!("Viz" in window)) {
          const script = document.createElement("script");
          script.dataset.plantumlViz = "embedded";
          script.textContent = vizSource;
          document.head.appendChild(script);
        }
        const core = await import("@plantuml/core");
        this.renderToString = core.renderToString;
      })();
    }
    return this.initializePromise;
  }

  render(source: string, renderId: number): Promise<RenderResult> {
    const operation = this.queue.then(async () => {
      const startedAt = performance.now();

      try {
        await this.initialize();
        const renderToString = this.renderToString;
        if (!renderToString) {
          throw new Error("PlantUML renderer did not initialize.");
        }

        const svg = await new Promise<string>((resolve, reject) => {
          renderToString(
            source.split(/\r\n|\r|\n/),
            resolve,
            (message) => reject(new Error(normalizeError(message))),
          );
        });

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
