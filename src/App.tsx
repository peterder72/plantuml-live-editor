import { useRef, useState } from "react";
import { AppHeader } from "./components/AppHeader";
import { EditorPanel } from "./editor/EditorPanel";
import { PreviewPanel } from "./preview/PreviewPanel";
import { useDiagramRenderer } from "./rendering/useDiagramRenderer";
import { toggleHiddenMembers } from "./rendering/classMemberVisibility";
import { useEditorState } from "./state/useEditorState";

const MIN_SPLIT_PERCENT = 25;
const MAX_SPLIT_PERCENT = 75;

function clampSplitPercent(value: number) {
  return Math.min(MAX_SPLIT_PERCENT, Math.max(MIN_SPLIT_PERCENT, value));
}

export default function App() {
  const { source, setSource } = useEditorState();
  const { svg, renderRevision, status } = useDiagramRenderer(source);
  const [splitPercent, setSplitPercent] = useState(50);
  const shellRef = useRef<HTMLDivElement>(null);

  const resizeTo = (clientX: number) => {
    const shell = shellRef.current;
    if (!shell || window.matchMedia("(max-width: 800px)").matches) return;
    const rect = shell.getBoundingClientRect();
    const next = ((clientX - rect.left) / rect.width) * 100;
    setSplitPercent(clampSplitPercent(next));
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
          onPointerDown={(event) => {
            if (window.matchMedia("(max-width: 800px)").matches) return;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              resizeTo(event.clientX);
            }
          }}
          onKeyDown={(event) => {
            const nextValues: Record<string, number> = {
              ArrowLeft: splitPercent - 5,
              ArrowRight: splitPercent + 5,
              Home: MIN_SPLIT_PERCENT,
              End: MAX_SPLIT_PERCENT,
            };
            const next = nextValues[event.key];
            if (next === undefined) return;
            event.preventDefault();
            setSplitPercent(clampSplitPercent(next));
          }}
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
