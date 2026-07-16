import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertOfflineSource,
  createEmbeddedVizScript,
  getPlantUmlDiagnostic,
  renderToSvg,
} from "./plantumlRenderer";

afterEach(() => {
  vi.useRealTimers();
  document.head.replaceChildren();
});

describe("createEmbeddedVizScript", () => {
  it("inherits the nonce from the VS Code webview entry script", () => {
    const entryScript = document.createElement("script");
    entryScript.nonce = "webview-nonce";
    document.head.appendChild(entryScript);

    const vizScript = createEmbeddedVizScript("globalThis.Viz = {};");

    expect(vizScript.nonce).toBe("webview-nonce");
    expect(vizScript.dataset.plantumlViz).toBe("embedded");
    expect(vizScript.textContent).toBe("globalThis.Viz = {};");
  });

  it("does not add a nonce in the standalone web app", () => {
    expect(createEmbeddedVizScript("globalThis.Viz = {};").nonce).toBe("");
  });
});

describe("renderToSvg", () => {
  it("rejects when the TeaVM renderer never invokes either callback", async () => {
    vi.useFakeTimers();
    const renderToString = vi.fn();
    const result = renderToSvg(renderToString, "@startuml\n@enduml", 100);
    const rejection = expect(result).rejects.toThrow(
      "PlantUML rendering timed out.",
    );

    await vi.advanceTimersByTimeAsync(100);

    await rejection;
  });

  it("clears the timeout after a successful callback", async () => {
    vi.useFakeTimers();
    const renderToString = vi.fn((_lines, onSuccess) => {
      onSuccess('<svg xmlns="http://www.w3.org/2000/svg" />');
    });

    await expect(
      renderToSvg(renderToString, "@startuml\n@enduml", 100),
    ).resolves.toContain("<svg");
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("getPlantUmlDiagnostic", () => {
  it("recognizes PlantUML syntax-error SVG output", () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><text>[From textarea (line 2)] Syntax Error?</text></svg>';

    expect(getPlantUmlDiagnostic(svg)).toBe("Syntax error near line 2.");
  });

  it("accepts normal diagram SVG output", () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><text>User</text></svg>';

    expect(getPlantUmlDiagnostic(svg)).toBeNull();
  });
});

describe("assertOfflineSource", () => {
  it.each([
    "!include https://example.test/private.puml",
    "!includeurl http://127.0.0.1/private",
    "!theme spacelab from https://example.test",
    "Alice -> Bob : javascript:alert(1)",
    "rectangle R << //example.test/secret >>",
  ])("rejects network-capable source: %s", (source) => {
    expect(() => assertOfflineSource(source)).toThrow(/disabled for privacy/);
  });

  it("accepts an ordinary offline diagram", () => {
    expect(() =>
      assertOfflineSource("@startuml\nAlice -> Bob : Hello\n@enduml"),
    ).not.toThrow();
  });
});
