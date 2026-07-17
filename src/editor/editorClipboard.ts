import type { EditorView } from "@codemirror/view";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function clipboardHtml(text: string): string {
  const content = escapeHtml(text).replace(/\r\n|\r|\n/g, "<br>");
  return `<div style="white-space: pre-wrap; font-family: Consolas, monospace;">${content}</div>`;
}

export function copyEditorSelection(
  event: ClipboardEvent,
  view: EditorView,
): boolean {
  if (!event.clipboardData || view.state.selection.ranges.every((range) => range.empty)) {
    return false;
  }

  const text = view.state.selection.ranges
    .filter((range) => !range.empty)
    .map((range) => view.state.sliceDoc(range.from, range.to))
    .join(view.state.lineBreak);

  event.clipboardData.setData("text/plain", text);
  event.clipboardData.setData("text/html", clipboardHtml(text));
  event.preventDefault();
  return true;
}
