import { Maximize, Minus, Plus, RotateCcw } from "lucide-react";
import {
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  fitTransform,
  useViewportTransform,
  zoomAtPoint,
} from "./useViewportTransform";

interface DiagramViewportProps {
  svg: string;
  renderRevision: number;
}

interface DiagramSize {
  width: number;
  height: number;
}

export function DiagramViewport({
  svg,
  renderRevision,
}: DiagramViewportProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{
    distance: number;
    scale: number;
    midpoint: { x: number; y: number };
  } | null>(null);
  const hasFitInitialRef = useRef(false);
  const [diagramSize, setDiagramSize] = useState<DiagramSize | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const { transform, setTransform, reset, zoomAt } = useViewportTransform();

  const readDiagramSize = useCallback(() => {
    const svgElement = contentRef.current?.querySelector("svg");
    if (!svgElement) return null;
    const viewBox = svgElement.viewBox.baseVal;
    const width =
      viewBox?.width ||
      Number.parseFloat(svgElement.getAttribute("width") ?? "") ||
      svgElement.getBBox().width;
    const height =
      viewBox?.height ||
      Number.parseFloat(svgElement.getAttribute("height") ?? "") ||
      svgElement.getBBox().height;
    if (!width || !height) return null;
    return { width, height };
  }, []);

  const fit = useCallback(() => {
    const viewport = viewportRef.current;
    const size = readDiagramSize();
    if (!viewport || !size) return;
    const rect = viewport.getBoundingClientRect();
    setDiagramSize(size);
    setTransform(
      fitTransform({ width: rect.width, height: rect.height }, size),
    );
  }, [readDiagramSize, setTransform]);

  useEffect(() => {
    const size = readDiagramSize();
    if (size) setDiagramSize(size);
    if (svg && !hasFitInitialRef.current) {
      hasFitInitialRef.current = true;
      requestAnimationFrame(fit);
    }
  }, [fit, readDiagramSize, renderRevision, svg]);

  const relativePoint = useCallback((clientX: number, clientY: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    return {
      x: clientX - (rect?.left ?? 0),
      y: clientY - (rect?.top ?? 0),
    };
  }, []);

  const onWheel = (event: ReactWheelEvent) => {
    event.preventDefault();
    const point = relativePoint(event.clientX, event.clientY);
    const factor = Math.exp(-event.deltaY * 0.0015);
    zoomAt(transform.scale * factor, point);
  };

  const onPointerDown = (event: ReactPointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(
      event.pointerId,
      relativePoint(event.clientX, event.clientY),
    );
    setIsPanning(true);
  };

  const onPointerMove = (event: ReactPointerEvent) => {
    const previous = pointersRef.current.get(event.pointerId);
    if (!previous) return;
    const current = relativePoint(event.clientX, event.clientY);
    pointersRef.current.set(event.pointerId, current);

    const points = [...pointersRef.current.values()];
    if (points.length === 1) {
      setTransform((value) => ({
        ...value,
        translateX: value.translateX + current.x - previous.x,
        translateY: value.translateY + current.y - previous.y,
      }));
      return;
    }

    if (points.length === 2) {
      const distance = Math.hypot(
        points[1].x - points[0].x,
        points[1].y - points[0].y,
      );
      const midpoint = {
        x: (points[0].x + points[1].x) / 2,
        y: (points[0].y + points[1].y) / 2,
      };
      if (!pinchRef.current) {
        pinchRef.current = {
          distance,
          scale: transform.scale,
          midpoint,
        };
      } else {
        const pinch = pinchRef.current;
        setTransform((value) =>
          zoomAtPoint(
            {
              ...value,
              translateX: value.translateX + midpoint.x - pinch.midpoint.x,
              translateY: value.translateY + midpoint.y - pinch.midpoint.y,
            },
            pinch.scale * (distance / Math.max(1, pinch.distance)),
            midpoint,
          ),
        );
        pinch.midpoint = midpoint;
      }
    }
  };

  const releasePointer = (event: ReactPointerEvent) => {
    pointersRef.current.delete(event.pointerId);
    pinchRef.current = null;
    if (pointersRef.current.size === 0) setIsPanning(false);
  };

  const zoomFromCenter = (factor: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    zoomAt(transform.scale * factor, {
      x: rect.width / 2,
      y: rect.height / 2,
    });
  };

  return (
    <div
      ref={viewportRef}
      className={`diagram-viewport${isPanning ? " is-panning" : ""}`}
      data-testid="diagram-viewport"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={releasePointer}
      onPointerCancel={releasePointer}
    >
      <div className="viewport-grid" />
      <div
        className="diagram-transform"
        data-testid="diagram-transform"
        data-scale={transform.scale}
        style={{
          transform: `translate3d(${transform.translateX}px, ${transform.translateY}px, 0) scale(${transform.scale})`,
        }}
      >
        <div
          ref={contentRef}
          className="diagram-content"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>

      {!svg && (
        <div className="preview-placeholder">
          <div className="placeholder-mark">PUML</div>
          <strong>Preparing the renderer</strong>
          <span>The first diagram can take a moment to compile.</span>
        </div>
      )}

      <div className="viewport-controls" aria-label="Diagram view controls">
        <button
          type="button"
          title="Zoom out"
          aria-label="Zoom out"
          onClick={() => zoomFromCenter(0.8)}
        >
          <Minus size={16} />
        </button>
        <output aria-label="Zoom level">
          {Math.round(transform.scale * 100)}%
        </output>
        <button
          type="button"
          title="Zoom in"
          aria-label="Zoom in"
          onClick={() => zoomFromCenter(1.25)}
        >
          <Plus size={16} />
        </button>
        <span className="control-divider" />
        <button
          type="button"
          title="Fit diagram"
          aria-label="Fit diagram"
          onClick={fit}
          disabled={!diagramSize}
        >
          <Maximize size={15} />
        </button>
        <button
          type="button"
          title="Reset view"
          aria-label="Reset view"
          onClick={reset}
        >
          <RotateCcw size={15} />
        </button>
      </div>
    </div>
  );
}
