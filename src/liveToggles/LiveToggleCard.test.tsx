import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LiveToggleCard } from "./LiveToggleCard";

describe("LiveToggleCard", () => {
  it("does not render without live variables", () => {
    render(<LiveToggleCard source="@startuml\n@enduml" onChange={vi.fn()} />);

    expect(screen.queryByText("Live toggles")).not.toBeInTheDocument();
  });

  it("renders exact suffix labels and emits rewritten source", () => {
    const onChange = vi.fn();
    render(
      <LiveToggleCard
        source={"!$_live_SHOW_DETAILS = true\n!$_live_GRID=false"}
        onChange={onChange}
      />,
    );

    expect(screen.getByLabelText("SHOW_DETAILS")).toBeChecked();
    expect(screen.getByLabelText("GRID")).not.toBeChecked();

    fireEvent.click(screen.getByLabelText("GRID"));
    expect(onChange).toHaveBeenCalledWith(
      "!$_live_SHOW_DETAILS = true\n!$_live_GRID=true",
    );
  });
});
