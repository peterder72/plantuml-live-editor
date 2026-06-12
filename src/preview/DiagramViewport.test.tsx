import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DiagramViewport } from "./DiagramViewport";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100"><rect width="200" height="100"/></svg>`;

describe("DiagramViewport", () => {
  it("preserves the transform when SVG content changes", () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);
    const { getByTestId, rerender, container } = render(
      <DiagramViewport svg={svg} renderRevision={1} />,
    );
    const viewport = container.querySelector<HTMLElement>(
      '[data-testid="diagram-viewport"]',
    );
    if (!viewport) throw new Error("Viewport was not rendered.");
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

  it("toggles members when an entity is clicked without dragging", () => {
    const onToggleMembers = vi.fn();
    const entitySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><g class="entity" data-entity="User"><rect width="100" height="50"/></g></svg>`;
    const { container } = render(
      <DiagramViewport
        svg={entitySvg}
        renderRevision={1}
        onToggleMembers={onToggleMembers}
      />,
    );
    const viewport = container.querySelector<HTMLElement>(
      '[data-testid="diagram-viewport"]',
    );
    if (!viewport) throw new Error("Viewport was not rendered.");
    const entity = container.querySelector("g[data-entity]");
    if (!entity) throw new Error("Entity was not rendered.");

    const pointerDownResult = fireEvent(
      entity,
      new MouseEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        clientX: 20,
        clientY: 20,
      }),
    );
    fireEvent(
      viewport,
      new MouseEvent("pointerup", {
        bubbles: true,
        cancelable: true,
        clientX: 20,
        clientY: 20,
      }),
    );

    expect(pointerDownResult).toBe(false);
    expect(onToggleMembers).toHaveBeenCalledWith("User");
  });

  it("does not toggle members after a drag", () => {
    const onToggleMembers = vi.fn();
    const entitySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><g class="entity" id="entity_User"><rect width="100" height="50"/></g></svg>`;
    const { container } = render(
      <DiagramViewport
        svg={entitySvg}
        renderRevision={1}
        onToggleMembers={onToggleMembers}
      />,
    );
    const viewport = container.querySelector<HTMLElement>(
      '[data-testid="diagram-viewport"]',
    );
    if (!viewport) throw new Error("Viewport was not rendered.");
    const entity = container.querySelector("#entity_User");
    if (!entity) throw new Error("Entity was not rendered.");

    fireEvent(
      entity,
      new MouseEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        clientX: 20,
        clientY: 20,
      }),
    );
    fireEvent(
      viewport,
      new MouseEvent("pointermove", {
        bubbles: true,
        cancelable: true,
        clientX: 40,
        clientY: 40,
      }),
    );
    fireEvent(
      viewport,
      new MouseEvent("pointerup", {
        bubbles: true,
        cancelable: true,
        clientX: 40,
        clientY: 40,
      }),
    );

    expect(onToggleMembers).not.toHaveBeenCalled();
  });
});
