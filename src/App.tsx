import { useCallback, useEffect, useRef, useState } from "react";
import { AppHeader, type RenderStatus } from "./components/AppHeader";
import { EditorPanel } from "./editor/EditorPanel";
import { PreviewPanel } from "./preview/PreviewPanel";
import {
  plantUmlRenderer,
  type RenderResult,
} from "./rendering/plantumlRenderer";
import { downloadPng } from "./rendering/diagramExporter";
import { useEditorState } from "./state/useEditorState";

export default function App() {
  const { source, setSource } = useEditorState();
  const [svg, setSvg] = useState("");
  const [renderRevision, setRenderRevision] = useState(0);
  const [status, setStatus] = useState<RenderStatus>({
    kind: "initializing",
    label: "Loading engine",
  });
  const [splitPercent, setSplitPercent] = useState(50);
  const shellRef = useRef<HTMLDivElement>(null);
  const hasSvgRef = useRef(false);
  const renderIdRef = useRef(0);
  const latestAcceptedRef = useRef(0);

  const acceptResult = useCallback((result: RenderResult) => {
    if (
      result.renderId !== renderIdRef.current ||
      result.renderId < latestAcceptedRef.current
    ) {
      return;
    }
    latestAcceptedRef.current = result.renderId;

    if (result.ok) {
      hasSvgRef.current = true;
      setSvg(result.svg);
      setRenderRevision((revision) => revision + 1);
      setStatus({
        kind: "success",
        label: `Rendered in ${Math.round(result.durationMs)} ms`,
      });
    } else {
      setStatus({
        kind: "error",
        label: result.error || "Unable to render this diagram.",
      });
    }
  }, []);

  useEffect(() => {
    const renderId = ++renderIdRef.current;
    const hasSvg = hasSvgRef.current;
    setStatus((current) =>
      hasSvg
        ? { kind: "rendering", label: "Rendering changes" }
        : current.kind === "initializing"
          ? current
          : { kind: "rendering", label: "Rendering diagram" },
    );

    const timeout = window.setTimeout(() => {
      setStatus({ kind: "rendering", label: "Rendering diagram" });
      void plantUmlRenderer.render(source, renderId).then(acceptResult);
    }, hasSvg ? 300 : 0);

    return () => window.clearTimeout(timeout);
  }, [acceptResult, source]);

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

  const exportPng = () => {
    void downloadPng(svg).catch((error: unknown) => {
      setStatus({
        kind: "error",
        label: error instanceof Error ? error.message : "Unable to export PNG.",
      });
    });
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
          onExportPng={exportPng}
        />
      </div>
    </main>
  );
}
