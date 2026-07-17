import { useRef, useState } from "react";
import { AppHeader } from "./components/AppHeader";
import { EditorPanel } from "./editor/EditorPanel";
import { PreviewPanel } from "./preview/PreviewPanel";
import { useDiagramRenderer } from "./rendering/useDiagramRenderer";
import { toggleHiddenMembers } from "./rendering/classMemberVisibility";
import { useEditorState } from "./state/useEditorState";

export default function App() {
  const { source, setSource } = useEditorState();
  const { svg, renderRevision, status } = useDiagramRenderer(source);
  const [splitPercent, setSplitPercent] = useState(50);
  const shellRef = useRef<HTMLDivElement>(null);

  const beginResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const shell = shellRef.current;
    if (!shell || window.matchMedia("(max-width: 800px)").matches) return;
    event.currentTarget.setPointerCapture(event.pointerId);

    const onMove = (moveEvent: PointerEvent) => {
      const rect = shell.getBoundingClientRect();
      const next = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      setSplitPercent(Math.min(75, Math.max(25, next)));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <main className="app">
      <AppHeader status={status} />

      <div
        ref={shellRef}
        className="workspace"
        style={{ "--editor-width": `${splitPercent}%` } as React.CSSProperties}
      >
        <EditorPanel source={source} onChange={setSource} />

        <div
          className="split-handle"
          role="separator"
          aria-label="Resize editor and preview"
          aria-orientation="vertical"
          aria-valuenow={Math.round(splitPercent)}
          tabIndex={0}
          onPointerDown={beginResize}
        >
          <span />
        </div>

        <PreviewPanel
          svg={svg}
          renderRevision={renderRevision}
          status={status}
          onToggleMembers={(entity) =>
            setSource((current) => toggleHiddenMembers(current, entity))
          }
        />
      </div>
    </main>
  );
}
