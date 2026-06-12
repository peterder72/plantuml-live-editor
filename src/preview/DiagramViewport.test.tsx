import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DiagramViewport } from "./DiagramViewport";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100"><rect width="200" height="100"/></svg>`;

describe("DiagramViewport", () => {
  it("preserves the transform when SVG content changes", () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);
    const { getByTestId, rerender } = render(
      <DiagramViewport svg={svg} renderRevision={1} />,
    );
    const viewport = getByTestId("diagram-viewport");
    Object.defineProperty(viewport, "getBoundingClientRect", {
      value: () => ({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
        right: 800,
        bottom: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });

    const wheelEvent = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: 400,
      clientY: 300,
      deltaY: -500,
    });
    let dispatchResult = true;
    act(() => {
      dispatchResult = viewport.dispatchEvent(wheelEvent);
    });
    expect(dispatchResult).toBe(false);
    expect(wheelEvent.defaultPrevented).toBe(true);
    const before = getByTestId("diagram-transform").getAttribute("style");

    rerender(
      <DiagramViewport
        svg={svg.replace("<rect", '<circle cx="20" cy="20" r="10"/><rect')}
        renderRevision={2}
      />,
    );

    expect(getByTestId("diagram-transform").getAttribute("style")).toBe(before);
  });
});
