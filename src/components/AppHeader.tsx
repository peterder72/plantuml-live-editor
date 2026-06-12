import { SiGithub } from "@icons-pack/react-simple-icons";
import { Sparkles } from "lucide-react";
import packageJson from "../../package.json";

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
          <span>v{packageJson.version}</span>
        </div>
      </div>
      <div className="header-actions">
        <div className={`status status-${status.kind}`} role="status">
          <span className="status-dot" />
          <span className="status-label">{status.label}</span>
        </div>
        <a
          className="github-link"
          href="https://github.com/peterder72/plantuml-live-editor"
          target="_blank"
          rel="noreferrer"
          aria-label="View PlantUML Live on GitHub"
          title="View on GitHub"
        >
          <SiGithub size={19} aria-hidden="true" />
        </a>
      </div>
    </header>
  );
}
