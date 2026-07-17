import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { describe, expect, it, vi } from "vitest";
import { clipboardHtml, copyEditorSelection } from "./editorClipboard";

function clipboardEvent() {
  const values = new Map<string, string>();
  const event = {
    clipboardData: {
      setData: vi.fn((type: string, value: string) => values.set(type, value)),
    },
    preventDefault: vi.fn(),
  } as unknown as ClipboardEvent;

  return { event, values };
}

describe("clipboardHtml", () => {
  it("uses explicit HTML breaks for Office rich-text paste targets", () => {
    expect(clipboardHtml("@startuml\nAlice -> Bob\r\n@enduml")).toContain(
      "@startuml<br>Alice -&gt; Bob<br>@enduml",
    );
  });

  it("escapes source that resembles HTML", () => {
    const html = clipboardHtml("<script>alert('x')</script> & text");

    expect(html).toContain(
      "&lt;script&gt;alert('x')&lt;/script&gt; &amp; text",
    );
    expect(html).not.toContain("<script>");
  });
});

describe("copyEditorSelection", () => {
  it("writes plain text and PowerPoint-compatible HTML", () => {
    const source = "@startuml\nAlice -> Bob\n@enduml";
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: source,
        selection: EditorSelection.single(0, source.length),
      }),
    });
    const { event, values } = clipboardEvent();

    expect(copyEditorSelection(event, view)).toBe(true);
    expect(values.get("text/plain")).toBe(source);
    expect(values.get("text/html")).toContain(
      "@startuml<br>Alice -&gt; Bob<br>@enduml",
    );
    expect(event.preventDefault).toHaveBeenCalledOnce();

    view.destroy();
    parent.remove();
  });

  it("leaves an empty selection to the editor default", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({
      parent,
      state: EditorState.create({ doc: "@startuml\n@enduml" }),
    });
    const { event, values } = clipboardEvent();

    expect(copyEditorSelection(event, view)).toBe(false);
    expect(values.size).toBe(0);
    expect(event.preventDefault).not.toHaveBeenCalled();

    view.destroy();
    parent.remove();
  });
});
