import { foldService } from "@codemirror/language";
import type { EditorState, Extension } from "@codemirror/state";

export interface FoldRange {
  from: number;
  to: number;
}

const ifMarker = /^\s*!if\b/i;
const endifMarker = /^\s*!endif\b/i;

function indentationColumns(text: string, tabSize: number): number {
  let columns = 0;

  for (const character of text) {
    if (character === " ") {
      columns += 1;
    } else if (character === "\t") {
      columns += tabSize - (columns % tabSize);
    } else {
      break;
    }
  }

  return columns;
}

function markerFoldRange(
  state: EditorState,
  startLineNumber: number,
  lineEnd: number,
): FoldRange | null {
  let depth = 1;

  for (
    let lineNumber = startLineNumber + 1;
    lineNumber <= state.doc.lines;
    lineNumber += 1
  ) {
    const line = state.doc.line(lineNumber);
    if (ifMarker.test(line.text)) {
      depth += 1;
    } else if (endifMarker.test(line.text)) {
      depth -= 1;
      if (depth === 0) {
        return line.to > lineEnd ? { from: lineEnd, to: line.to } : null;
      }
    }
  }

  return null;
}

function indentationFoldRange(
  state: EditorState,
  startLineNumber: number,
  lineEnd: number,
): FoldRange | null {
  const startLine = state.doc.line(startLineNumber);
  if (startLine.text.trim().length === 0) return null;

  const startIndent = indentationColumns(startLine.text, state.tabSize);
  let lastIndentedLineEnd: number | null = null;

  for (
    let lineNumber = startLineNumber + 1;
    lineNumber <= state.doc.lines;
    lineNumber += 1
  ) {
    const line = state.doc.line(lineNumber);
    if (line.text.trim().length === 0) {
      if (lastIndentedLineEnd !== null) lastIndentedLineEnd = line.to;
      continue;
    }

    if (indentationColumns(line.text, state.tabSize) <= startIndent) break;
    lastIndentedLineEnd = line.to;
  }

  return lastIndentedLineEnd === null
    ? null
    : { from: lineEnd, to: lastIndentedLineEnd };
}

export function plantUmlFoldRange(
  state: EditorState,
  lineStart: number,
  lineEnd: number,
): FoldRange | null {
  const line = state.doc.lineAt(lineStart);

  if (ifMarker.test(line.text)) {
    return markerFoldRange(state, line.number, lineEnd);
  }

  return indentationFoldRange(state, line.number, lineEnd);
}

export const plantUmlFolding: Extension = foldService.of(plantUmlFoldRange);
