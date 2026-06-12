import { useEffect, useState } from "react";
import type { RenderStatus } from "../components/AppHeader";
import { LiveToggleCard } from "../liveToggles/LiveToggleCard";
import { PreviewPanel } from "../preview/PreviewPanel";
import { useDiagramRenderer } from "../rendering/useDiagramRenderer";
import { toggleHiddenMembers } from "../rendering/classMemberVisibility";
import type {
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage,
} from "./messages";

interface VsCodeApi {
  postMessage(message: WebviewToExtensionMessage): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();

export function VsCodePreviewApp() {
  const [source, setSource] = useState("");
  const [version, setVersion] = useState(0);
  const [fileName, setFileName] = useState("PlantUML");
  const [hostError, setHostError] = useState<string | null>(null);
  const { svg, renderRevision, status, exportPng } =
    useDiagramRenderer(source);

  useEffect(() => {
    const receiveMessage = (event: MessageEvent<ExtensionToWebviewMessage>) => {
      const message = event.data;
      if (message.type === "documentState") {
        setSource(message.source);
        setVersion(message.version);
        setFileName(message.fileName);
        setHostError(null);
      } else if (message.type === "showError") {
        setHostError(message.message);
      }
    };

    window.addEventListener("message", receiveMessage);
    vscode.postMessage({ type: "ready" });
    return () => window.removeEventListener("message", receiveMessage);
  }, []);

  const updateSource = (nextSource: string) => {
    setSource(nextSource);
    vscode.postMessage({
      type: "replaceSource",
      source: nextSource,
      expectedVersion: version,
    });
  };

  const visibleStatus: RenderStatus = hostError
    ? { kind: "error", label: hostError }
    : status;

  return (
    <main className="vscode-preview">
      <div className="vscode-toggle-region">
        <LiveToggleCard source={source} onChange={updateSource} />
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
      />
    </main>
  );
}
