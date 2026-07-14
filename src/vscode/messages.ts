import type { SourceSelection } from "../liveToggles/liveToggleWrap";

export interface DocumentStateMessage {
  type: "documentState";
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
  source: string;
  expectedVersion: number;
  selectionAfter?: SourceSelection;
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
  | ReplaceSourceMessage;
