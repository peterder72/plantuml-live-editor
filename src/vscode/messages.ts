import type { SourceSelection } from "../liveToggles/liveToggleWrap";

export interface DocumentStateMessage {
  type: "documentState";
  documentUri: string;
  source: string;
  version: number;
  fileName: string;
  selection: SourceSelection;
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
  | ShowErrorMessage;

export type WebviewToExtensionMessage =
  | ReadyMessage
  | ReplaceSourceMessage
  | RenderedMessage;
