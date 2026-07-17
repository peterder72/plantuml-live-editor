import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  fitTransform,
  useViewportTransform,
  zoomAtPoint,
} from "./useViewportTransform";
import { ViewportControls } from "./ViewportControls";

interface DiagramViewportProps {
  svg: string;
  renderRevision: number;
  onToggleMembers?: (entity: string) => void;
}

interface DiagramSize {
  width: number;
  height: number;
}

export function DiagramViewport({
  svg,
  renderRevision,
  onToggleMembers,
}: DiagramViewportProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{
    distance: number;
    scale: number;
    midpoint: { x: number; y: number };
  } | null>(null);
  const pointerStartRef = useRef(
    new Map<number, { x: number; y: number; target: EventTarget | null }>(),
  );
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

  useLayoutEffect(() => {
    const size = readDiagramSize();
    if (size) setDiagramSize(size);
    if (svg && !hasFitInitialRef.current) {
      hasFitInitialRef.current = true;
      fit();
    }
  }, [fit, readDiagramSize, renderRevision, svg]);

  const relativePoint = useCallback((clientX: number, clientY: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    return {
      x: clientX - (rect?.left ?? 0),
      y: clientY - (rect?.top ?? 0),
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const point = relativePoint(event.clientX, event.clientY);
      const factor = Math.exp(-event.deltaY * 0.0015);
      zoomAt(transform.scale * factor, point);
    };

    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [relativePoint, transform.scale, zoomAt]);

  const onPointerDown = (event: ReactPointerEvent) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointersRef.current.set(
      event.pointerId,
      relativePoint(event.clientX, event.clientY),
    );
    pointerStartRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      target: event.target,
    });
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
    const start = pointerStartRef.current.get(event.pointerId);
    if (
      event.type === "pointerup" &&
      start &&
      Math.hypot(event.clientX - start.x, event.clientY - start.y) < 5
    ) {
      const entity = findDiagramEntity(start.target);
      if (entity) onToggleMembers?.(entity);
    }
    pointersRef.current.delete(event.pointerId);
    pointerStartRef.current.delete(event.pointerId);
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
          transform: `translate(${transform.translateX}px, ${transform.translateY}px) scale(${transform.scale})`,
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

      <ViewportControls
        scale={transform.scale}
        canFit={Boolean(diagramSize)}
        onZoomOut={() => zoomFromCenter(0.8)}
        onZoomIn={() => zoomFromCenter(1.25)}
        onFit={fit}
        onReset={reset}
      />
    </div>
  );
}

function findDiagramEntity(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  const group = target.closest<SVGGElement>(
    "g.entity[data-qualified-name], g.entity[data-entity], g.entity[id^='entity_']",
  );
  if (!group) return null;

  const dataEntity = (
    group.getAttribute("data-qualified-name") ??
    group.getAttribute("data-entity")
  )?.trim();
  if (dataEntity) return dataEntity;

  const id = group.id;
  return id.startsWith("entity_") ? id.slice("entity_".length) : null;
}
