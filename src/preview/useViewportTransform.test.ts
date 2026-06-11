import { describe, expect, it } from "vitest";
import {
  fitTransform,
  zoomAtPoint,
  type ViewportTransform,
} from "./useViewportTransform";

describe("viewport transforms", () => {
  it("keeps the diagram point under the cursor while zooming", () => {
    const before: ViewportTransform = {
      scale: 1,
      translateX: 40,
      translateY: 20,
    };
    const point = { x: 200, y: 140 };
    const diagramPoint = {
      x: (point.x - before.translateX) / before.scale,
      y: (point.y - before.translateY) / before.scale,
    };

    const after = zoomAtPoint(before, 2, point);

    expect(after.translateX + diagramPoint.x * after.scale).toBeCloseTo(point.x);
    expect(after.translateY + diagramPoint.y * after.scale).toBeCloseTo(point.y);
  });

  it("centers a diagram when fitting", () => {
    expect(
      fitTransform(
        { width: 1000, height: 800 },
        { width: 400, height: 200 },
      ),
    ).toEqual({
      scale: 1,
      translateX: 300,
      translateY: 300,
    });
  });
});
