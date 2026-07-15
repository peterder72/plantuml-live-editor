import { useEffect, useState } from "react";
import type { RenderStatus } from "../components/AppHeader";
import { LiveToggleCard } from "../liveToggles/LiveToggleCard";
import type { SourceSelection } from "../liveToggles/liveToggleWrap";
import { PreviewPanel } from "../preview/PreviewPanel";
import { useDiagramRenderer } from "../rendering/useDiagramRenderer";
import { toggleHiddenMembers } from "../rendering/classMemberVisibility";
import type {
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage,
} from "./messages";

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
  const [hasDocumentState, setHasDocumentState] = useState(false);
  const [version, setVersion] = useState(0);
  const [fileName, setFileName] = useState("PlantUML");
  const [selection, setSelection] = useState<SourceSelection>({ from: 0, to: 0 });
  const [hostError, setHostError] = useState<string | null>(null);
  const { svg, renderRevision, acceptedRender, status, exportPng } =
    useDiagramRenderer(hasDocumentState ? source : null);

  useEffect(() => {
    const receiveMessage = (event: MessageEvent<ExtensionToWebviewMessage>) => {
      const message = event.data;
      if (message.type === "documentState") {
        setSource(message.source);
        setHasDocumentState(true);
        setVersion(message.version);
        setFileName(message.fileName);
        setSelection(message.selection);
        setHostError(null);
      } else if (message.type === "showError") {
        setHostError(message.message);
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
      documentVersion: version,
      renderRevision,
      svgFingerprint: fingerprint(svg),
    });
  }, [
    acceptedRender,
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
      source: nextSource,
      expectedVersion: version,
      selectionAfter,
    });
  };

  const visibleStatus: RenderStatus = hostError
    ? { kind: "error", label: hostError }
    : status;

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
        onExportPng={exportPng}
        onToggleMembers={(entity) =>
          updateSource(toggleHiddenMembers(source, entity))
        }
        title={fileName}
        showStatusInFooter
      />
    </main>
  );
}

function fingerprint(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
