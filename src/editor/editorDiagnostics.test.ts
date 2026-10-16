import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { history, undo } from "@codemirror/commands";
import { describe, expect, it } from "vitest";
import {
  diagnosticExtension,
  editorDiagnostics,
  setEditorDiagnostics,
} from "./editorDiagnostics";

describe("editor diagnostics", () => {
  it("decorates the reported line and empty lines without changing selection or undo history", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: "first\ninvalid\n",
        selection: { anchor: 2 },
        extensions: [history(), diagnosticExtension],
      }),
    });
    try {
      view.dispatch({ changes: { from: 0, insert: "x" } });
      const selection = view.state.selection;
      const scroll = view.scrollDOM.scrollTop;
      view.dispatch({
        effects: setEditorDiagnostics.of([
          { line: 2, message: "Syntax error" },
          { line: 3, message: "Empty error" },
        ]),
      });
      expect(view.state.selection).toEqual(selection);
      expect(view.scrollDOM.scrollTop).toBe(scroll);
      expect(parent.querySelectorAll(".cm-plantuml-error-line")).toHaveLength(
        2,
      );
      expect(parent.querySelector(".cm-plantuml-error")?.textContent).toBe(
        "invalid",
      );
      expect(parent.querySelector('[title="Empty error"]')).not.toBeNull();
      expect(
        parent.querySelector(
          '.cm-plantuml-error-gutter [aria-label="Syntax error"]',
        ),
      ).not.toBeNull();
      expect(undo(view)).toBe(true);
      expect(view.state.doc.toString()).toBe("first\ninvalid\n");
      expect(view.state.field(editorDiagnostics)).toEqual([]);
      view.dispatch({
        effects: setEditorDiagnostics.of([{ line: 2, message: "Error" }]),
      });
      view.dispatch({ effects: setEditorDiagnostics.of([]) });
      expect(parent.querySelector(".cm-plantuml-error-line")).toBeNull();
    } finally {
      view.destroy();
      parent.remove();
    }
  });
});
