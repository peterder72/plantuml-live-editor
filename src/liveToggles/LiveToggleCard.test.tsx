import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveToggleCard } from "./LiveToggleCard";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LiveToggleCard", () => {
  it("shows an add flag button without live variables", () => {
    render(<LiveToggleCard source="@startuml\n@enduml" onChange={vi.fn()} />);

    expect(screen.getByText("Live toggles")).toBeInTheDocument();
    expect(screen.getByLabelText("Add flag")).toBeInTheDocument();
  });

  it("adds a named flag from the toolbar after @startuml", () => {
    const onChange = vi.fn();
    render(
      <LiveToggleCard
        source={"@startuml\n@enduml"}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByLabelText("Add flag"));
    fireEvent.change(screen.getByLabelText("New flag name"), {
      target: { value: "SHOW_DETAILS" },
    });
    fireEvent.click(screen.getByLabelText("Save flag"));

    expect(onChange).toHaveBeenCalledWith(
      "@startuml\n!$_live_SHOW_DETAILS = %false()\n@enduml",
    );
  });

  it("enables wrapping only with both a selection and a flag", () => {
    const { rerender } = render(
      <LiveToggleCard
        source={"@startuml\n!$_live_DETAILS = %true()\nclass User\n@enduml"}
        selection={{ from: 0, to: 0 }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("DETAILS")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Wrap selection" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Wrap selection" })).toHaveAttribute(
      "title",
      "Select one or more lines to wrap.",
    );
    rerender(
      <LiveToggleCard
        source={"@startuml\n!$_live_DETAILS = %true()\nclass User\n@enduml"}
        selection={{ from: 40, to: 50 }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Wrap selection" })).toBeEnabled();
  });

  it("explains that a live toggle is required before wrapping", () => {
    render(
      <LiveToggleCard
        source={"@startuml\nclass User\n@enduml"}
        selection={{ from: 10, to: 20 }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Wrap selection" })).toHaveAttribute(
      "title",
      "Add a live toggle first.",
    );
  });

  it("shows flag state and supports keyboard navigation in the wrap menu", () => {
    render(
      <LiveToggleCard
        source={"!$_live_DETAILS = %false()\n!$_live_GRID = %true()"}
        selection={{ from: 0, to: 1 }}
        onChange={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Wrap selection" });
    fireEvent.click(trigger);

    const details = screen.getByRole("menuitem", { name: "DETAILS Off" });
    const grid = screen.getByRole("menuitem", { name: "GRID On" });
    expect(screen.getByRole("menu", { name: "Wrap with live flag" })).toBeInTheDocument();
    expect(details).toHaveFocus();

    fireEvent.keyDown(details, { key: "ArrowDown" });
    expect(grid).toHaveFocus();
    fireEvent.keyDown(grid, { key: "Escape" });
    expect(trigger).toHaveFocus();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("wraps selected lines with the chosen flag", () => {
    const onWrap = vi.fn();
    const source = "@startuml\n!$_live_DETAILS = %false()\nclass User\n@enduml";
    const from = source.indexOf("User");
    render(
      <LiveToggleCard
        source={source}
        selection={{ from, to: from + 1 }}
        onChange={vi.fn()}
        onWrap={onWrap}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Wrap selection" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "DETAILS Off" }));
    expect(onWrap).toHaveBeenCalledWith(
      expect.objectContaining({
        source:
          "@startuml\n!$_live_DETAILS = %false()\n!if $_live_DETAILS\nclass User\n!endif // _live_DETAILS\n@enduml",
      }),
    );
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("renders exact suffix labels and emits rewritten source", () => {
    const onChange = vi.fn();
    render(
      <LiveToggleCard
        source={"!$_live_SHOW_DETAILS = %true()\n!$_live_GRID=%false()"}
        onChange={onChange}
      />,
    );

    expect(screen.getByLabelText("SHOW_DETAILS")).toBeChecked();
    expect(screen.getByLabelText("GRID")).not.toBeChecked();

    fireEvent.click(screen.getByLabelText("GRID"));
    expect(onChange.mock.calls[0][0]).toContain("!$_live_GRID=%true()");
    expect(onChange.mock.calls[0][0]).toContain(
      "/' @plantuml-live-editor views v2",
    );
  });

  it("creates and switches between named views", () => {
    const onChange = vi.fn();
    const { getByLabelText, getByRole, rerender } = render(
      <LiveToggleCard
        source={"!$_live_SHOW_DETAILS = %true()"}
        onChange={onChange}
      />,
    );

    expect(getByLabelText("Active view")).toHaveValue("Default");
    fireEvent.click(getByLabelText("Create view"));
    fireEvent.change(getByLabelText("New view name"), {
      target: { value: "Minimal" },
    });
    fireEvent.click(getByLabelText("Save view"));

    const updatedSource = onChange.mock.calls[0][0] as string;
    rerender(<LiveToggleCard source={updatedSource} onChange={onChange} />);
    expect(getByLabelText("Active view")).toHaveValue("Minimal");
    expect(getByRole("option", { name: "Default" })).toBeInTheDocument();
  });

  it("renames the active view", () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <LiveToggleCard
        source={"!$_live_SHOW_DETAILS = %true()"}
        onChange={onChange}
      />,
    );

    fireEvent.click(getByLabelText("Rename view"));
    expect(getByLabelText("Rename view")).toHaveValue("Default");
    fireEvent.change(getByLabelText("Rename view"), {
      target: { value: "Overview" },
    });
    fireEvent.click(getByLabelText("Save renamed view"));

    expect(onChange.mock.calls[0][0]).toContain('"activeView": "Overview"');
    expect(onChange.mock.calls[0][0]).toContain('"Overview":');
  });
});
