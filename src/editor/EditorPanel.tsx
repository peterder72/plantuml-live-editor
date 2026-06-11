import { Code2 } from "lucide-react";
import { PanelFooter, PanelHeader } from "../components/Panel";
import { LiveToggleCard } from "../liveToggles/LiveToggleCard";
import { PlantUmlEditor } from "./PlantUmlEditor";

interface EditorPanelProps {
  source: string;
  onChange: (source: string) => void;
}

export function EditorPanel({ source, onChange }: EditorPanelProps) {
  return (
    <section className="panel editor-panel" aria-label="Source panel">
      <PanelHeader
        title={
          <>
            <Code2 size={15} />
            <span>Source</span>
            <span className="file-name">diagram.puml</span>
          </>
        }
      />
      <div className="editor-body">
        <LiveToggleCard source={source} onChange={onChange} />
        <PlantUmlEditor value={source} onChange={onChange} />
      </div>
      <PanelFooter
        start={`${source.split(/\r\n|\r|\n/).length} lines`}
        end="PlantUML"
      />
    </section>
  );
}
