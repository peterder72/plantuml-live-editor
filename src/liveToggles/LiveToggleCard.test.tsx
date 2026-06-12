import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveToggleCard } from "./LiveToggleCard";

afterEach(cleanup);

describe("LiveToggleCard", () => {
  it("does not render without live variables", () => {
    render(<LiveToggleCard source="@startuml\n@enduml" onChange={vi.fn()} />);

    expect(screen.queryByText("Live toggles")).not.toBeInTheDocument();
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
