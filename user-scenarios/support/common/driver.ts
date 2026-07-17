export interface RenderSnapshot {
  fingerprint: string;
}

export interface ScenarioDriver {
  openApplication(source: string): Promise<void>;
  replaceSource(source: string): Promise<void>;
  replaceSourceRapidly(sources: string[]): Promise<void>;
  expectSource(source: string): Promise<void>;
  captureRender(): Promise<RenderSnapshot>;
  expectRenderChanged(previous: RenderSnapshot): Promise<void>;
  expectRenderUnchanged(previous: RenderSnapshot): Promise<void>;
  expectDiagramContains(text: string, visible?: boolean): Promise<void>;
  expectSourceContains(text: string, present?: boolean): Promise<void>;
  expectError(pattern: RegExp): Promise<void>;
  panAndZoom(): Promise<void>;
  expectTransformPreserved(): Promise<void>;
  fitAndResetView(): Promise<void>;
  exportWhiteSvg(): Promise<void>;
  expectExportChoicesRemembered(): Promise<void>;
  toggleLiveFlag(name: string, enabled: boolean): Promise<void>;
  expectLiveFlag(name: string, enabled: boolean): Promise<void>;
  selectSourceText(text: string): Promise<void>;
  wrapSelectionWith(flag: string): Promise<void>;
  createView(name: string): Promise<void>;
  switchView(name: string): Promise<void>;
  renameView(name: string): Promise<void>;
  clickClass(name: string): Promise<void>;
  rememberDiagramWidth(): Promise<void>;
  expectDiagramWidthPreserved(): Promise<void>;
  expectNetworkApisBlocked(): Promise<void>;
  dispose(): Promise<void>;
}
