import { CircleAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { RenderStatus } from "../components/AppHeader";
import type { SourceSelection } from "../liveToggles/liveToggleWrap";
import { DiagramExportMenu } from "../preview/DiagramExportMenu";
import { DiagramViewport } from "../preview/DiagramViewport";
import { useDiagramRenderer } from "../rendering/useDiagramRenderer";
import { toggleHiddenMembers } from "../rendering/classMemberVisibility";
import { fingerprint } from "../shared/fingerprint";
import type {
  ExtensionToPreviewMessage,
  PreviewToExtensionMessage,
} from "./messages";
import { runScenarioCommand } from "./scenarioBridge";

export interface VsCodeApi {
  postMessage(message: PreviewToExtensionMessage): void;
  getState?(): PersistedPreviewState | undefined;
  setState?(state: PersistedPreviewState): void;
}

interface PersistedPreviewState {
  exportFormat?: "png" | "svg";
  exportBackground?: "transparent" | "white";
}

declare function acquireVsCodeApi(): VsCodeApi;

interface VsCodePreviewAppProps {
  api?: VsCodeApi;
}

export function VsCodePreviewApp({ api }: VsCodePreviewAppProps = {}) {
  const [vscode] = useState(() => api ?? acquireVsCodeApi());
  const [source, setSource] = useState("");
  const [documentUri, setDocumentUri] = useState("");
  const [hasDocumentState, setHasDocumentState] = useState(false);
  const [version, setVersion] = useState(0);
  const [fileName, setFileName] = useState("diagram.puml");
  const [hostError, setHostError] = useState<string | null>(null);
  const persisted = useMemo(() => vscode.getState?.() ?? {}, [vscode]);
  const { svg, renderRevision, acceptedRender, status } =
    useDiagramRenderer(hasDocumentState ? source : null);

  useEffect(() => {
    const receiveMessage = (event: MessageEvent<ExtensionToPreviewMessage>) => {
      const message = event.data;
      if (message.type === "documentState") {
        setDocumentUri(message.documentUri);
        setSource(message.source);
        setHasDocumentState(true);
        setVersion(message.version);
        setFileName(message.fileName);
        setHostError(null);
      } else if (message.type === "showError") {
        setHostError(message.message);
      } else if (message.type === "scenarioCommand") {
        void runScenarioCommand(message.command).then(
          (result) =>
            vscode.postMessage({
              type: "scenarioResult",
              requestId: message.requestId,
              ok: true,
              result,
            }),
          (error: unknown) =>
            vscode.postMessage({
              type: "scenarioResult",
              requestId: message.requestId,
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            }),
        );
      }
    };

    window.addEventListener("message", receiveMessage);
    vscode.postMessage({ type: "ready", surface: "preview" });
    return () => window.removeEventListener("message", receiveMessage);
  }, [vscode]);

  useEffect(() => {
    if (
      !hasDocumentState ||
      !acceptedRender ||
      acceptedRender.source !== source ||
      status.kind !== "success"
    ) {
      return;
    }
    vscode.postMessage({
      type: "rendered",
      documentUri,
      documentVersion: version,
      renderRevision,
      svgFingerprint: fingerprint(svg),
    });
  }, [
    acceptedRender,
    documentUri,
    hasDocumentState,
    renderRevision,
    source,
    status.kind,
    svg,
    version,
    vscode,
  ]);

  const updateSource = (
    nextSource: string,
    selectionAfter?: SourceSelection,
  ) => {
    setSource(nextSource);
    vscode.postMessage({
      type: "replaceSource",
      documentUri,
      source: nextSource,
      expectedVersion: version,
      selectionAfter,
    });
  };

  const visibleStatus: RenderStatus = useMemo(
    () => (hostError ? { kind: "error", label: hostError } : status),
    [hostError, status],
  );

  useEffect(() => {
    if (!hasDocumentState) return;
    vscode.postMessage({
      type: "renderStatus",
      documentUri,
      documentVersion: version,
      kind: visibleStatus.kind,
      label: visibleStatus.label,
      svgFingerprint: fingerprint(svg),
    });
  }, [documentUri, hasDocumentState, svg, version, visibleStatus, vscode]);

  const persistExportOptions = useCallback(
    (options: {
      format: "png" | "svg";
      background: "transparent" | "white";
    }) =>
      vscode.setState?.({
        exportFormat: options.format,
        exportBackground: options.background,
      }),
    [vscode],
  );

  return (
    <main className="vscode-preview">
      <div className="preview-body">
        <DiagramViewport
          svg={svg}
          renderRevision={renderRevision}
          onToggleMembers={(entity) =>
            updateSource(toggleHiddenMembers(source, entity))
          }
        />
        <div
          className="preview-export-toolbar"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <DiagramExportMenu
            svg={svg}
            sourceFileName={fileName}
            initialFormat={persisted.exportFormat}
            initialBackground={persisted.exportBackground}
            onOptionsChange={persistExportOptions}
          />
        </div>
        <div className="preview-hud">
          <span
            className={`preview-render-status status-${visibleStatus.kind}`}
            aria-live="polite"
          >
            {visibleStatus.label}
          </span>
          <span className="preview-hud-secondary">
            Scroll to zoom · Drag to pan · Click a class to hide members · Max
            8192 × 8192
          </span>
        </div>
        {visibleStatus.kind === "error" && (
          <div className="error-toast" role="alert">
            <CircleAlert size={17} />
            <div>
              <strong>Diagram error</strong>
              <span>{visibleStatus.label}</span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
