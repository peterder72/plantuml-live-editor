import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  HighlightStyle,
  StreamLanguage,
  syntaxHighlighting,
} from "@codemirror/language";
import { EditorSelection, EditorState } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { useEffect, useRef } from "react";
import type { SourceSelection } from "../liveToggles/liveToggleWrap";

interface PlantUmlEditorProps {
  value: string;
  onChange: (value: string) => void;
  selection: SourceSelection;
  onSelectionChange: (selection: SourceSelection) => void;
}

const keywords = new Set([
  "actor",
  "participant",
  "boundary",
  "control",
  "entity",
  "database",
  "collections",
  "class",
  "interface",
  "enum",
  "abstract",
  "component",
  "node",
  "cloud",
  "package",
  "frame",
  "folder",
  "rectangle",
  "state",
  "start",
  "stop",
  "if",
  "then",
  "else",
  "elseif",
  "endif",
  "while",
  "endwhile",
  "repeat",
  "fork",
  "end",
  "note",
  "title",
  "legend",
  "header",
  "footer",
  "skinparam",
  "hide",
  "show",
  "left",
  "right",
  "top",
  "bottom",
  "as",
]);

interface PlantUmlState {
  inViewsBlock: boolean;
}

const plantUmlLanguage = StreamLanguage.define<PlantUmlState>({
  startState: () => ({ inViewsBlock: false }),
  token(stream, state) {
    if (state.inViewsBlock) {
      if (stream.match(/^@end-plantuml-live-editor views '\//)) {
        state.inViewsBlock = false;
        return "comment";
      }
      if (stream.match(/^\s+/)) return null;
      if (stream.match(/^"(?:[^"\\]|\\.)*"(?=\s*:)/)) return "propertyName";
      if (stream.match(/^"(?:[^"\\]|\\.)*"/)) return "string";
      if (stream.match(/^(?:true|false)\b/)) return "bool";
      if (stream.match(/^[{}[\],:]/)) return "punctuation";
      stream.next();
      return null;
    }

    if (stream.match(/^\/' @plantuml-live-editor views v\d+$/)) {
      state.inViewsBlock = true;
      return "comment";
    }
    if (stream.match(/^'.*/)) return "comment";
    if (stream.match(/^\/'.*?'\/$/)) return "comment";
    if (stream.match(/^@(start|end)\w+/i)) return "keyword";
    if (stream.match(/^![a-z_]+/i)) return "meta";
    if (stream.match(/^#[0-9a-f]{3,8}\b/i)) return "color";
    if (stream.match(/^"(?:[^"\\]|\\.)*"/)) return "string";
    if (stream.match(/^(?:--?>|<--?|-\[#.*?\]->|\.\.?>|<\.\.?)/)) {
      return "operator";
    }
    if (stream.match(/^[A-Za-z_][\w.]*/)) {
      return keywords.has(stream.current().toLowerCase()) ? "keyword" : "variableName";
    }
    stream.next();
    return null;
  },
});

const highlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "#c792ea", fontWeight: "600" },
  { tag: tags.string, color: "#c3e88d" },
  { tag: tags.comment, color: "#637777", fontStyle: "italic" },
  { tag: tags.operator, color: "#89ddff" },
  { tag: tags.meta, color: "#ffcb6b" },
  { tag: tags.color, color: "#f78c6c" },
  { tag: tags.variableName, color: "#d6deeb" },
  { tag: tags.propertyName, color: "#82aaff" },
  { tag: tags.bool, color: "#f78c6c" },
  { tag: tags.punctuation, color: "#89ddff" },
]);

const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "#10151d",
    color: "#d6deeb",
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily:
      '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
    fontSize: "14px",
    lineHeight: "1.65",
  },
  ".cm-content": {
    padding: "18px 0 48px",
    caretColor: "#82aaff",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "#82aaff",
    borderLeftWidth: "2px",
  },
  ".cm-line": {
    padding: "0 18px 0 10px",
  },
  ".cm-gutters": {
    backgroundColor: "#10151d",
    border: "none",
    color: "#52606f",
    paddingLeft: "6px",
  },
  ".cm-activeLine, .cm-activeLineGutter": {
    // The selection layer is behind line decorations. Keep this translucent so
    // a selection on the active line remains visible.
    backgroundColor: "#17202b80",
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "#29466b !important",
  },
  "&.cm-focused": { outline: "none" },
});

export function PlantUmlEditor({
  value,
  onChange,
  selection,
  onSelectionChange,
}: PlantUmlEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const changeHandlerRef = useRef(onChange);
  const selectionHandlerRef = useRef(onSelectionChange);
  const initialValueRef = useRef(value);
  changeHandlerRef.current = onChange;
  selectionHandlerRef.current = onSelectionChange;

  useEffect(() => {
    if (!hostRef.current) return;

    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: initialValueRef.current,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          history(),
          drawSelection(),
          highlightActiveLine(),
          closeBrackets(),
          plantUmlLanguage,
          syntaxHighlighting(highlightStyle),
          editorTheme,
          keymap.of([
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap,
            indentWithTab,
          ]),
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              changeHandlerRef.current(update.state.doc.toString());
            }
            if (update.docChanged || update.selectionSet) {
              const main = update.state.selection.main;
              selectionHandlerRef.current({ from: main.from, to: main.to });
            }
          }),
        ],
      }),
    });

    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === value) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    });
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const main = view.state.selection.main;
    if (main.from === selection.from && main.to === selection.to) return;
    view.dispatch({ selection: EditorSelection.range(selection.from, selection.to) });
    view.focus();
  }, [selection]);

  return (
    <div
      ref={hostRef}
      className="editor-host"
      data-testid="plantuml-editor"
      aria-label="PlantUML source editor"
    />
  );
}
