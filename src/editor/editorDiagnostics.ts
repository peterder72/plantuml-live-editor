import { RangeSet, StateEffect, StateField } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  GutterMarker,
  gutter,
  hoverTooltip,
} from "@codemirror/view";
import type { PlantUmlDiagnostic } from "../rendering/plantumlRenderer";

export const setEditorDiagnostics = StateEffect.define<PlantUmlDiagnostic[]>();
export const editorDiagnostics = StateField.define<PlantUmlDiagnostic[]>({
  create: () => [],
  update(value, transaction) {
    if (transaction.docChanged) value = [];
    for (const effect of transaction.effects) {
      if (effect.is(setEditorDiagnostics)) value = effect.value;
    }
    return value.filter(
      ({ line }) =>
        line !== null && line > 0 && line <= transaction.state.doc.lines,
    );
  },
});

class ErrorMarker extends GutterMarker {
  constructor(readonly message: string) {
    super();
  }
  eq(other: ErrorMarker) {
    return other.message === this.message;
  }
  toDOM() {
    const marker = document.createElement("span");
    marker.textContent = "●";
    marker.title = this.message;
    marker.setAttribute("aria-label", this.message);
    return marker;
  }
}

export const diagnosticExtension = [
  editorDiagnostics,
  EditorView.decorations.compute([editorDiagnostics], (state) => {
    const ranges = state
      .field(editorDiagnostics)
      .flatMap(({ line, message }) => {
        const { from, to } = state.doc.line(line!);
        const decorations = [
          Decoration.line({
            class: "cm-plantuml-error-line",
            attributes: { title: message },
          }).range(from),
        ];
        if (to > from)
          decorations.push(
            Decoration.mark({ class: "cm-plantuml-error" }).range(from, to),
          );
        return decorations;
      });
    return Decoration.set(ranges, true);
  }),
  gutter({
    class: "cm-plantuml-error-gutter",
    markers: (view) =>
      RangeSet.of(
        view.state
          .field(editorDiagnostics)
          .map(({ line, message }) =>
            new ErrorMarker(message).range(view.state.doc.line(line!).from),
          ),
        true,
      ),
  }),
  hoverTooltip((view, position) => {
    const line = view.state.doc.lineAt(position);
    const diagnostic = view.state
      .field(editorDiagnostics)
      .find((entry) => entry.line === line.number);
    if (!diagnostic) return null;
    return {
      pos: line.from,
      end: line.to,
      above: true,
      create() {
        const dom = document.createElement("div");
        dom.className = "cm-plantuml-error-tooltip";
        dom.textContent = diagnostic.message;
        return { dom };
      },
    };
  }),
  EditorView.baseTheme({
    ".cm-plantuml-error-line": {
      backgroundColor: "#f8717118",
      boxShadow: "inset 2px 0 #f87171",
    },
    ".cm-plantuml-error": {
      textDecoration: "underline wavy #f87171",
      textUnderlineOffset: "3px",
    },
    ".cm-plantuml-error-gutter": { color: "#f87171", width: "12px" },
    ".cm-plantuml-error-tooltip": {
      padding: "6px 10px",
      maxWidth: "420px",
      backgroundColor: "#17202b",
      color: "#d6deeb",
    },
  }),
];
