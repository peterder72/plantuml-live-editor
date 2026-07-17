export interface RenderSnapshot {
  fingerprint: string;
}

export interface ScenarioDriver {
  openApplication(source: string): Promise<void>;
  replaceSource(source: string): Promise<void>;
  expectSource(source: string): Promise<void>;
  captureRender(): Promise<RenderSnapshot>;
  expectRenderChanged(previous: RenderSnapshot): Promise<void>;
  dispose(): Promise<void>;
}
