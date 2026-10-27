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
      '<svg xmlns="http://www.w3.org/2000/svg"><text>[From textarea (line 2) ]</text><text>@startuml</text><text>invalid</text><text>Syntax Error? (Assumed diagram type: sequence)</text></svg>';

    expect(getPlantUmlDiagnostic(svg, "@startuml\ninvalid\n@enduml")).toEqual({
      line: 2,
      message:
        "Syntax error near line 2. Syntax Error? (Assumed diagram type: sequence)",
    });
  });

  it("locates a native Autofac validation error without a Syntax Error footer", () => {
    const source = [
      "@startautofac",
      'title Unknown scope',
      "lifetime system",
      "event r on missing : Resolve IFoo",
      "@endautofac",
    ].join("\n");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <text>PlantUML version 1.2026.7</text>
      <text>[From textarea (line 4) ]</text>
      <text>@startautofac</text>
      <text>title Unknown scope</text>
      <text>lifetime system</text>
      <text>event r on missing : Resolve IFoo</text>
      <text>Unknown lifetime 'missing' (Assumed diagram type: autofac)</text>
    </svg>`;

    expect(getPlantUmlDiagnostic(svg, source)).toEqual({
      line: 4,
      message:
        "Syntax error near line 4. Unknown lifetime 'missing' (Assumed diagram type: autofac)",
    });
  });

  it.each([
    ["json", "Error in JSON format"],
    ["autofac", "Duplicate registration 'foo' (Assumed diagram type: autofac)"],
    ["uml", "No such !option unknown"],
  ])("recognizes the standard %s error envelope regardless of message wording", (type, detail) => {
    expect(
      getPlantUmlDiagnostic(
        `<svg><text>[From textarea (line 2) ]</text><text>@start${type}</text><text>invalid</text><text>${detail}</text></svg>`,
        `@start${type}\ninvalid\n@end${type}`,
      ),
    ).toEqual({
      line: 2,
      message: `Syntax error near line 2. ${detail}`,
    });
  });

  it.each([
    "Syntax Error?",
    "Unsupported diagram type",
    "Unknown lifetime 'missing' (Assumed diagram type: autofac)",
    "[From textarea (line 2)]",
  ])("accepts diagnostic phrases as ordinary labels: %s", (label) => {
    expect(
      getPlantUmlDiagnostic(
        `<svg xmlns="http://www.w3.org/2000/svg"><text fill="#FF0000">${label}</text></svg>`,
        `@startuml\nAlice -> Bob : ${label}\n@enduml`,
      ),
    ).toBeNull();
  });

  it("accepts a diagram with both a location-like label and error-like labels", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <g class="entity"><text>[From textarea (line 2)]</text></g>
      <g class="entity"><text>Syntax Error? (Assumed diagram type: sequence)</text></g>
      <g class="entity"><text>Unknown lifetime 'missing' (Assumed diagram type: autofac)</text></g>
    </svg>`;

    expect(
      getPlantUmlDiagnostic(
        svg,
        '@startuml\nrectangle "[From textarea (line 2)]" as A\nrectangle "Syntax Error? (Assumed diagram type: sequence)" as B\nrectangle "Unknown lifetime \'missing\' (Assumed diagram type: autofac)" as C\n@enduml',
      ),
    ).toBeNull();
  });

  it("does not confuse an error-like source line in the trace with the actual error", () => {
    expect(
      getPlantUmlDiagnostic(
        "<svg><text>[From textarea (line 3)]</text><text>@startautofac</text><text>Syntax Error?</text><text>Unknown lifetime 'missing' (Assumed diagram type: autofac)</text></svg>",
        "@startautofac\nSyntax Error?\ninvalid\n@endautofac",
      ),
    ).toEqual({
      line: 3,
      message:
        "Syntax error near line 3. Unknown lifetime 'missing' (Assumed diagram type: autofac)",
    });
  });

  it.each([0, -1, 4, Number.MAX_SAFE_INTEGER + 1])(
    "does not locate an invalid source line %s",
    (line) => {
      expect(
        getPlantUmlDiagnostic(
          `<svg><text>[From textarea (line ${line})]</text><text>@startuml</text><text>invalid</text><text>Syntax Error?</text></svg>`,
          "@startuml\ninvalid\n@enduml",
        ),
      ).toEqual({ line: null, message: "Syntax error. Syntax Error?" });
    },
  );

  it("counts CRLF and blank source lines without shifting the location", () => {
    expect(
      getPlantUmlDiagnostic(
        "<svg><text>[From textarea (line 3)]</text><text>@startuml</text><text>invalid</text><text>Syntax Error?</text></svg>",
        "@startuml\r\n\r\ninvalid\r\n@enduml",
      )?.line,
    ).toBe(3);
  });

  it("accepts normal diagram SVG output", () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><text>User</text></svg>';

    expect(
      getPlantUmlDiagnostic(svg, "@startuml\ninvalid\n@enduml"),
    ).toBeNull();
  });
});

describe("assertOfflineSource", () => {
  it.each([
    "!include https://example.test/private.puml",
    "!includeurl http://127.0.0.1/private",
    "!theme spacelab from https://example.test",
    "sprite $icon https://example.test/icon.svg",
    "skinparam backgroundImage file:/tmp/background.png",
  ])("rejects network-capable source: %s", (source) => {
    expect(() => assertOfflineSource(source)).toThrow(/disabled for privacy/);
  });

  it.each([
    "@startuml\nAlice -> Bob : Hello\n@enduml",
    "@startuml\n' See https://example.test/docs\nAlice -> Bob : Hello\n@enduml",
    "@startuml\nAlice -> Bob : javascript:alert(1)\n@enduml",
    "@startuml\nrectangle R << //example.test/secret >>\n@enduml",
  ])("accepts ordinary text and comments: %s", (source) => {
    expect(() => assertOfflineSource(source)).not.toThrow();
  });
});
