import { Sparkles } from "lucide-react";

export type RenderStatus =
  | { kind: "initializing"; label: string }
  | { kind: "rendering"; label: string }
  | { kind: "success"; label: string }
  | { kind: "error"; label: string };

interface AppHeaderProps {
  status: RenderStatus;
}

export function AppHeader({ status }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="brand">
        <div className="brand-mark">
          <Sparkles size={17} />
        </div>
        <div>
          <h1>PlantUML Live</h1>
          <span>Private, local, offline</span>
        </div>
      </div>
      <div className={`status status-${status.kind}`} role="status">
        <span className="status-dot" />
        <span className="status-label">{status.label}</span>
      </div>
    </header>
  );
}
