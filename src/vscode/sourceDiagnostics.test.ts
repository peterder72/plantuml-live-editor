import { describe, expect, it } from "vitest";
import { currentSourceDiagnostics } from "./sourceDiagnostics";
import type { DiagnosticsMessage } from "./messages";

const document = { uri: "file:///a.puml", version: 2, lineCount: 3 };
const entry = { line: 2, message: "Syntax error" };
const message: DiagnosticsMessage = {
  type: "diagnostics",
  documentUri: document.uri,
  documentVersion: 2,
  diagnostics: [entry],
};

describe("currentSourceDiagnostics", () => {
  it("accepts only the exact URI and version", () => {
    expect(currentSourceDiagnostics(message, document)).toEqual([entry]);
    expect(
      currentSourceDiagnostics({ ...message, documentVersion: 1 }, document),
    ).toBeNull();
    expect(
      currentSourceDiagnostics({ ...message, documentVersion: 3 }, document),
    ).toBeNull();
    expect(
      currentSourceDiagnostics(
        { ...message, documentUri: "file:///b.puml" },
        document,
      ),
    ).toBeNull();
  });
  it("clears current diagnostics while excluding unusable locations", () => {
    expect(
      currentSourceDiagnostics({ ...message, diagnostics: [] }, document),
    ).toEqual([]);
    expect(
      currentSourceDiagnostics(
        {
          ...message,
          diagnostics: [
            null,
            {},
            { line: 0 },
            { line: 4 },
            { line: 1.5 },
            { line: null },
            { line: 2, message: 42 },
          ],
        } as unknown as DiagnosticsMessage,
        document,
      ),
    ).toEqual([]);
  });
});
