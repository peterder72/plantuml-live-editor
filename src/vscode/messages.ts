import type { SourceSelection } from "../liveToggles/liveToggleWrap";

export type WebviewSurface = "preview" | "controls";

export interface DocumentStateMessage {
  type: "documentState";
  documentUri: string;
  source: string;
  version: number;
  fileName: string;
  selection: SourceSelection;
}

export type ScenarioCommand =
  | { action: "inspect" }
  | { action: "panAndZoom" }
  | { action: "fitAndReset" }
  | { action: "toggleLiveFlag"; name: string; enabled: boolean }
  | { action: "wrapSelection"; name: string }
  | { action: "createView"; name: string }
  | { action: "switchView"; name: string }
  | { action: "renameView"; name: string }
  | { action: "clickClass"; name: string }
  | { action: "exportWhiteSvg" }
  | { action: "checkNetworkApis" };

export interface ScenarioCommandResult {
  svgFingerprint: string;
  svgText: string;
  svgWidth: string;
  transformStyle: string;
  scale: string;
  activeView: string;
  liveFlags: Record<string, boolean>;
  exportFileName: string;
  exportFeedback: string;
  exportFormat: string;
  exportBackground: string;
  networkApisBlocked?: boolean;
  previewChromeVisible?: boolean;
  previewStatusVisible?: boolean;
  controlsVisible?: boolean;
  controlsDiagramChromeVisible?: boolean;
}

export interface ScenarioCommandMessage {
  type: "scenarioCommand";
  requestId: number;
  command: ScenarioCommand;
}

export interface ScenarioResultMessage {
  type: "scenarioResult";
  requestId: number;
  ok: boolean;
  error?: string;
  result?: ScenarioCommandResult;
}

export interface RenderStatusMessage {
  type: "renderStatus";
  documentUri: string;
  documentVersion: number;
  kind: "initializing" | "rendering" | "success" | "error";
  label: string;
  svgFingerprint: string;
}

export interface ReplaceSourceMessage {
  type: "replaceSource";
  documentUri: string;
  source: string;
  expectedVersion: number;
  selectionAfter?: SourceSelection;
}

export interface RenderedMessage {
  type: "rendered";
  documentUri: string;
  documentVersion: number;
  renderRevision: number;
  svgFingerprint: string;
}

export interface ShowErrorMessage {
  type: "showError";
  message: string;
}

export interface ReadyMessage {
  type: "ready";
  surface: WebviewSurface;
}

export interface OpenPreviewMessage {
  type: "openPreview";
}

export interface PreviewAvailabilityMessage {
  type: "previewAvailability";
  available: boolean;
}

export type ExtensionToPreviewMessage =
  | DocumentStateMessage
  | ShowErrorMessage
  | ScenarioCommandMessage;

export type ExtensionToControlsMessage =
  | DocumentStateMessage
  | ScenarioCommandMessage
  | PreviewAvailabilityMessage;

export type PreviewToExtensionMessage =
  | ReadyMessage
  | ReplaceSourceMessage
  | RenderedMessage
  | RenderStatusMessage
  | ScenarioResultMessage;

export type ControlsToExtensionMessage =
  | ReadyMessage
  | ReplaceSourceMessage
  | ScenarioResultMessage
  | OpenPreviewMessage;

export type ExtensionToWebviewMessage =
  | ExtensionToPreviewMessage
  | ExtensionToControlsMessage;

export type WebviewToExtensionMessage =
  | PreviewToExtensionMessage
  | ControlsToExtensionMessage;
