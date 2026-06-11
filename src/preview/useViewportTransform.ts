import { useCallback, useState } from "react";

export interface ViewportTransform {
  scale: number;
  translateX: number;
  translateY: number;
}

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 8;
export const INITIAL_TRANSFORM: ViewportTransform = {
  scale: 1,
  translateX: 0,
  translateY: 0,
};

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

export function zoomAtPoint(
  transform: ViewportTransform,
  nextScaleValue: number,
  point: { x: number; y: number },
): ViewportTransform {
  const nextScale = clampScale(nextScaleValue);
  const diagramX = (point.x - transform.translateX) / transform.scale;
  const diagramY = (point.y - transform.translateY) / transform.scale;

  return {
    scale: nextScale,
    translateX: point.x - diagramX * nextScale,
    translateY: point.y - diagramY * nextScale,
  };
}

export function fitTransform(
  viewport: { width: number; height: number },
  diagram: { width: number; height: number },
  padding = 48,
): ViewportTransform {
  const availableWidth = Math.max(1, viewport.width - padding * 2);
  const availableHeight = Math.max(1, viewport.height - padding * 2);
  const scale = clampScale(
    Math.min(availableWidth / diagram.width, availableHeight / diagram.height, 1),
  );

  return {
    scale,
    translateX: (viewport.width - diagram.width * scale) / 2,
    translateY: (viewport.height - diagram.height * scale) / 2,
  };
}

export function useViewportTransform() {
  const [transform, setTransform] =
    useState<ViewportTransform>(INITIAL_TRANSFORM);

  const reset = useCallback(() => setTransform(INITIAL_TRANSFORM), []);

  const panBy = useCallback((deltaX: number, deltaY: number) => {
    setTransform((current) => ({
      ...current,
      translateX: current.translateX + deltaX,
      translateY: current.translateY + deltaY,
    }));
  }, []);

  const zoomAt = useCallback(
    (scale: number, point: { x: number; y: number }) => {
      setTransform((current) => zoomAtPoint(current, scale, point));
    },
    [],
  );

  return { transform, setTransform, reset, panBy, zoomAt };
}
