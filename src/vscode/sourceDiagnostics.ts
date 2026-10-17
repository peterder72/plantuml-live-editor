import type { PlantUmlDiagnostic } from "../rendering/plantumlRenderer";
import type { DiagnosticsMessage } from "./messages";

/** null means the snapshot must be ignored; [] clears current diagnostics. */
export function currentSourceDiagnostics(
  message: DiagnosticsMessage,
  document: { uri: string; version: number; lineCount: number },
): (PlantUmlDiagnostic & { line: number })[] | null {
  if (
    message.documentUri !== document.uri ||
    message.documentVersion !== document.version ||
    !Array.isArray(message.diagnostics)
  )
    return null;
  return message.diagnostics.filter(
    (entry): entry is PlantUmlDiagnostic & { line: number } =>
      entry !== null &&
      typeof entry === "object" &&
      Number.isInteger(entry.line) &&
      entry.line !== null &&
      entry.line >= 1 &&
      entry.line <= document.lineCount &&
      typeof entry.message === "string",
  );
}
