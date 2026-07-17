import { useEffect, useMemo, useState } from "react";
import type { RenderStatus } from "../components/AppHeader";
import { LiveToggleCard } from "../liveToggles/LiveToggleCard";
import type { SourceSelection } from "../liveToggles/liveToggleWrap";
import { PreviewPanel } from "../preview/PreviewPanel";
import { useDiagramRenderer } from "../rendering/useDiagramRenderer";
import { toggleHiddenMembers } from "../rendering/classMemberVisibility";
import { fingerprint } from "../shared/fingerprint";
import type {
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage,
} from "./messages";
import { runScenarioCommand } from "./scenarioBridge";

export interface VsCodeApi {
  postMessage(message: WebviewToExtensionMessage): void;
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
  const [fileName, setFileName] = useState("PlantUML");
  const [selection, setSelection] = useState<SourceSelection>({ from: 0, to: 0 });
  const [hostError, setHostError] = useState<string | null>(null);
  const { svg, renderRevision, acceptedRender, status } =
    useDiagramRenderer(hasDocumentState ? source : null);

  useEffect(() => {
    const receiveMessage = (event: MessageEvent<ExtensionToWebviewMessage>) => {
      const message = event.data;
      if (message.type === "documentState") {
        setDocumentUri(message.documentUri);
        setSource(message.source);
        setHasDocumentState(true);
        setVersion(message.version);
        setFileName(message.fileName);
        setSelection(message.selection);
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
    vscode.postMessage({ type: "ready" });
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

  return (
    <main className="vscode-preview">
      <div className="vscode-toggle-region">
        <LiveToggleCard
          source={source}
          selection={selection}
          onChange={updateSource}
          onWrap={(wrapped) =>
            updateSource(wrapped.source, wrapped.selection)
          }
        />
      </div>
      <PreviewPanel
        svg={svg}
        renderRevision={renderRevision}
        status={visibleStatus}
        exportFileName={fileName}
        onToggleMembers={(entity) =>
          updateSource(toggleHiddenMembers(source, entity))
        }
        title={fileName}
        showStatusInFooter
      />
    </main>
  );
}
