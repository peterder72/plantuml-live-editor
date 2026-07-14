import { CircleAlert, Download } from "lucide-react";
import { PanelFooter, PanelHeader } from "../components/Panel";
import { TextButton } from "../components/TextButton";
import type { RenderStatus } from "../components/AppHeader";
import { downloadSvg } from "../rendering/diagramExporter";
import { DiagramViewport } from "./DiagramViewport";

interface PreviewPanelProps {
  svg: string;
  renderRevision: number;
  status: RenderStatus;
  onExportPng: () => void;
  onToggleMembers?: (entity: string) => void;
  title?: string;
  showStatusInFooter?: boolean;
}

export function PreviewPanel({
  svg,
  renderRevision,
  status,
  onExportPng,
  onToggleMembers,
  title = "Preview",
  showStatusInFooter = false,
}: PreviewPanelProps) {
  const actions = (
    <div className="preview-actions">
      <span className="interaction-hint">
        Scroll to zoom · Drag to pan · Click a class to hide members
      </span>
      <TextButton
        icon={<Download size={13} />}
        onClick={() => downloadSvg(svg)}
        disabled={!svg}
        title="Download SVG"
      >
        SVG
      </TextButton>
      <TextButton
        icon={<Download size={13} />}
        onClick={onExportPng}
        disabled={!svg}
        title="Download PNG"
      >
        PNG
      </TextButton>
    </div>
  );

  return (
    <section className="panel preview-panel" aria-label="Preview panel">
      <PanelHeader
        title={
          <>
            <span className="preview-icon" />
            <span>{title}</span>
            <span className="format-pill">SVG</span>
          </>
        }
        actions={actions}
      />
      <div className="preview-body">
        <DiagramViewport
          svg={svg}
          renderRevision={renderRevision}
          onToggleMembers={onToggleMembers}
        />
        {status.kind === "error" && (
          <div className="error-toast" role="alert">
            <CircleAlert size={17} />
            <div>
              <strong>Diagram error</strong>
              <span>{status.label}</span>
            </div>
          </div>
        )}
      </div>
      <PanelFooter
        start={showStatusInFooter ? status.label : "Client-side renderer"}
        end="Max 4096 × 4096"
      />
    </section>
  );
}
