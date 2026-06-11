import { describe, expect, it } from "vitest";
import { getPlantUmlDiagnostic } from "./plantumlRenderer";

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
