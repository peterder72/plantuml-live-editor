import {
  CircleAlert,
  Code2,
  Download,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PlantUmlEditor } from "./editor/PlantUmlEditor";
import { LiveToggleCard } from "./liveToggles/LiveToggleCard";
import { DiagramViewport } from "./preview/DiagramViewport";
import {
  plantUmlRenderer,
  type RenderResult,
} from "./rendering/plantumlRenderer";
import { downloadPng, downloadSvg } from "./rendering/diagramExporter";
import { useEditorState } from "./state/useEditorState";

type RenderStatus =
  | { kind: "initializing"; label: string }
  | { kind: "rendering"; label: string }
  | { kind: "success"; label: string }
  | { kind: "error"; label: string };

export default function App() {
  const { source, setSource, resetSource } = useEditorState();
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
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={17} />
          </div>
          <div>
            <h1>PlantUML Live</h1>
            <span>Private, local, offline</span>
          </div>
        </div>
        <div className={`status status-${status.kind}`} role="status">
          <span className="status-dot" />
          <span className="status-label">{status.label}</span>
        </div>
      </header>

      <div
        ref={shellRef}
        className="workspace"
        style={{ "--editor-width": `${splitPercent}%` } as React.CSSProperties}
      >
        <section className="panel editor-panel" aria-label="Source panel">
          <div className="panel-header">
            <div className="panel-title">
              <Code2 size={15} />
              <span>Source</span>
              <span className="file-name">diagram.puml</span>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={resetSource}
              title="Restore example"
            >
              <RotateCcw size={13} />
              Reset
            </button>
          </div>
          <div className="editor-body">
            <LiveToggleCard source={source} onChange={setSource} />
            <PlantUmlEditor value={source} onChange={setSource} />
          </div>
          <footer className="panel-footer">
            <span>{source.split(/\r\n|\r|\n/).length} lines</span>
            <span>PlantUML</span>
          </footer>
        </section>

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

        <section className="panel preview-panel" aria-label="Preview panel">
          <div className="panel-header">
            <div className="panel-title">
              <span className="preview-icon" />
              <span>Preview</span>
              <span className="format-pill">SVG</span>
            </div>
            <div className="preview-actions">
              <span className="interaction-hint">
                Scroll to zoom · Drag to pan
              </span>
              <button
                type="button"
                className="text-button"
                onClick={() => downloadSvg(svg)}
                disabled={!svg}
                title="Download SVG"
              >
                <Download size={13} />
                SVG
              </button>
              <button
                type="button"
                className="text-button"
                onClick={exportPng}
                disabled={!svg}
                title="Download PNG"
              >
                <Download size={13} />
                PNG
              </button>
            </div>
          </div>
          <div className="preview-body">
            <DiagramViewport svg={svg} renderRevision={renderRevision} />
            {status.kind === "error" && (
              <div className="error-toast" role="alert">
                <CircleAlert size={17} />
                <div>
                  <strong>Diagram error</strong>
                  <span>{status.label}</span>
                </div>
              </div>
            )}
          </div>
          <footer className="panel-footer">
            <span>Client-side renderer</span>
            <span>Max 4096 × 4096</span>
          </footer>
        </section>
      </div>
    </main>
  );
}
