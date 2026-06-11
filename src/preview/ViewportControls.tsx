import { Maximize, Minus, Plus, RotateCcw } from "lucide-react";

interface ViewportControlsProps {
  scale: number;
  canFit: boolean;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onFit: () => void;
  onReset: () => void;
}

export function ViewportControls({
  scale,
  canFit,
  onZoomOut,
  onZoomIn,
  onFit,
  onReset,
}: ViewportControlsProps) {
  return (
    <div className="viewport-controls" aria-label="Diagram view controls">
      <button type="button" title="Zoom out" aria-label="Zoom out" onClick={onZoomOut}>
        <Minus size={16} />
      </button>
      <output aria-label="Zoom level">{Math.round(scale * 100)}%</output>
      <button type="button" title="Zoom in" aria-label="Zoom in" onClick={onZoomIn}>
        <Plus size={16} />
      </button>
      <span className="control-divider" />
      <button
        type="button"
        title="Fit diagram"
        aria-label="Fit diagram"
        onClick={onFit}
        disabled={!canFit}
      >
        <Maximize size={15} />
      </button>
      <button type="button" title="Reset view" aria-label="Reset view" onClick={onReset}>
        <RotateCcw size={15} />
      </button>
    </div>
  );
}
