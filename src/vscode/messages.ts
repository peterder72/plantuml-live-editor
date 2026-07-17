import type { SourceSelection } from "../liveToggles/liveToggleWrap";

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

export interface ReadyMessage {
  type: "ready";
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

export type ExtensionToWebviewMessage =
  | DocumentStateMessage
  | ShowErrorMessage
  | ScenarioCommandMessage;

export type WebviewToExtensionMessage =
  | ReadyMessage
  | ReplaceSourceMessage
  | RenderedMessage
  | RenderStatusMessage
  | ScenarioResultMessage;
