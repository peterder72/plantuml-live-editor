import { Eye, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import type { SourceSelection } from "../liveToggles/liveToggleWrap";
import type {
  DocumentStateMessage,
  ControlsToExtensionMessage,
  ExtensionToControlsMessage,
} from "./messages";
import { runControlsScenarioCommand } from "./controlsScenarioBridge";
import { VsCodeLiveControls } from "./VsCodeLiveControls";

export interface VsCodeControlsApi {
  postMessage(message: ControlsToExtensionMessage): void;
}

declare function acquireVsCodeApi(): VsCodeControlsApi;

interface VsCodeControlsAppProps {
  api?: VsCodeControlsApi;
}

const emptySelection: SourceSelection = { from: 0, to: 0 };

export function VsCodeControlsApp({ api }: VsCodeControlsAppProps = {}) {
  const [vscode] = useState(() => api ?? acquireVsCodeApi());
  const [documentState, setDocumentState] =
    useState<DocumentStateMessage | null>(null);
  const [previewAvailable, setPreviewAvailable] = useState(false);

  useEffect(() => {
    const receiveMessage = (event: MessageEvent<ExtensionToControlsMessage>) => {
      const message = event.data;
      if (message.type === "documentState") {
        setDocumentState(message);
      } else if (message.type === "previewAvailability") {
        setPreviewAvailable(message.available);
      } else if (message.type === "scenarioCommand") {
        void runControlsScenarioCommand(message.command).then(
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
              error:
                error instanceof Error
                  ? error.stack ?? error.message
                  : String(error),
            }),
        );
      }
    };

    window.addEventListener("message", receiveMessage);
    vscode.postMessage({ type: "ready", surface: "controls" });
    return () => window.removeEventListener("message", receiveMessage);
  }, [vscode]);

  const updateSource = (source: string, selectionAfter?: SourceSelection) => {
    if (!documentState) return;
    setDocumentState({ ...documentState, source });
    vscode.postMessage({
      type: "replaceSource",
      documentUri: documentState.documentUri,
      expectedVersion: documentState.version,
      source,
      selectionAfter,
    });
  };

  if (!documentState) {
    return (
      <main className="vscode-controls is-empty">
        <SlidersHorizontal size={20} />
        <strong>Open a PlantUML file</strong>
        <span>Controls will follow the most recently active diagram.</span>
      </main>
    );
  }

  return (
    <main className="vscode-controls">
      {!previewAvailable && (
        <button
          className="controls-primary-action"
          type="button"
          onClick={() => vscode.postMessage({ type: "openPreview" })}
        >
          <Eye size={16} />
          Open Preview
        </button>
      )}

      <VsCodeLiveControls
        source={documentState.source}
        selection={documentState.selection ?? emptySelection}
        onChange={updateSource}
        onWrap={(wrapped) => updateSource(wrapped.source, wrapped.selection)}
      />
    </main>
  );
}
