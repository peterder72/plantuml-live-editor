import {
  codeFolding,
  foldEffect,
  foldable,
  foldedRanges,
} from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { minimalDocumentChange } from "./editorDocumentChange";
import { plantUmlFolding } from "./plantUmlFolding";

function createState(doc: string, tabSize = 4) {
  return EditorState.create({
    doc,
    extensions: [EditorState.tabSize.of(tabSize), plantUmlFolding],
  });
}

function rangeForLine(state: EditorState, lineNumber: number) {
  const line = state.doc.line(lineNumber);
  return foldable(state, line.from, line.to);
}

describe("PlantUML folding", () => {
  it("folds case-insensitive nested !if regions through their !endif marker", () => {
    const state = createState(
      [
        "!IF outer",
        "class A",
        "!if inner",
        "class B",
        "!EnDiF /' inner '/",
        "!ENDIF trailing text",
        "class C",
      ].join("\n"),
    );

    expect(rangeForLine(state, 1)).toEqual({
      from: state.doc.line(1).to,
      to: state.doc.line(6).to,
    });
    expect(rangeForLine(state, 3)).toEqual({
      from: state.doc.line(3).to,
      to: state.doc.line(5).to,
    });
  });

  it("does not fold an unmatched !if even when its content is indented", () => {
    const state = createState("!if condition\n  class A\nclass B");

    expect(rangeForLine(state, 1)).toBeNull();
  });

  it("folds consecutive non-empty lines with deeper indentation", () => {
    const state = createState(
      ["root", "  child", "", "    grandchild", "   ", "sibling"].join("\n"),
    );

    expect(rangeForLine(state, 1)).toEqual({
      from: state.doc.line(1).to,
      to: state.doc.line(5).to,
    });
    expect(rangeForLine(state, 2)).toEqual({
      from: state.doc.line(2).to,
      to: state.doc.line(5).to,
    });
  });

  it("expands tabs using the configured tab size", () => {
    const state = createState("root\n\tchild\n    sibling\ntail", 4);

    expect(rangeForLine(state, 1)).toEqual({
      from: state.doc.line(1).to,
      to: state.doc.line(3).to,
    });
    expect(rangeForLine(state, 2)).toBeNull();
  });

  it("does not fold without a following more-indented line", () => {
    const state = createState("root\nsibling\n  child");

    expect(rangeForLine(state, 1)).toBeNull();
  });
});

describe("minimalDocumentChange", () => {
  it("returns only the changed portion of a controlled value", () => {
    expect(minimalDocumentChange("before value after", "before new after")).toEqual(
      {
        from: 7,
        to: 12,
        insert: "new",
      },
    );
    expect(minimalDocumentChange("same", "same")).toBeNull();
  });

  it("preserves a folded range across an external edit inside it", () => {
    const source = ["root", "  first", "  second", "tail"].join("\n");
    let state = EditorState.create({
      doc: source,
      extensions: [plantUmlFolding, codeFolding()],
    });
    const range = rangeForLine(state, 1);
    if (!range) throw new Error("Expected the root line to be foldable.");

    state = state.update({ effects: foldEffect.of(range) }).state;
    const nextSource = source.replace("first", "renamed");
    const change = minimalDocumentChange(source, nextSource);
    if (!change) throw new Error("Expected an external document change.");
    state = state.update({ changes: change }).state;

    const ranges: Array<{ from: number; to: number }> = [];
    foldedRanges(state).between(0, state.doc.length, (from, to) => {
      ranges.push({ from, to });
    });
    expect(ranges).toEqual([
      {
        from: state.doc.line(1).to,
        to: state.doc.line(3).to,
      },
    ]);
  });
});
