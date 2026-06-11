import { describe, expect, it } from "vitest";
import {
  assertOfflineSource,
  getPlantUmlDiagnostic,
} from "./plantumlRenderer";

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
