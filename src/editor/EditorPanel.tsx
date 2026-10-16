import { useState } from "react";
import { Code2 } from "lucide-react";
import { PanelFooter, PanelHeader } from "../components/Panel";
import { LiveToggleCard } from "../liveToggles/LiveToggleCard";
import type { SourceSelection } from "../liveToggles/liveToggleWrap";
import { PlantUmlEditor } from "./PlantUmlEditor";
import type { PlantUmlDiagnostic } from "../rendering/plantumlRenderer";

interface EditorPanelProps {
  diagnostics: PlantUmlDiagnostic[];
  source: string;
  onChange: (source: string) => void;
}

export function EditorPanel({
  source,
  onChange,
  diagnostics,
}: EditorPanelProps) {
  const [selection, setSelection] = useState<SourceSelection>({
    from: 0,
    to: 0,
  });

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
        <LiveToggleCard
          source={source}
          selection={selection}
          onChange={onChange}
          onWrap={(wrapped) => {
            setSelection(wrapped.selection);
            onChange(wrapped.source);
          }}
        />
        <PlantUmlEditor
          diagnostics={diagnostics}
          value={source}
          onChange={onChange}
          selection={selection}
          onSelectionChange={setSelection}
        />
      </div>
      <PanelFooter
        start={`${source.split(/\r\n|\r|\n/).length} lines`}
        end="PlantUML"
      />
    </section>
  );
}
