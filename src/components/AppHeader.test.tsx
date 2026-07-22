import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AppHeader } from "./AppHeader";

afterEach(cleanup);

describe("AppHeader", () => {
  it("opens the bundled changelog and restores focus when closed", () => {
    render(
      <AppHeader status={{ kind: "success", label: "Rendered locally" }} />,
    );
    const trigger = screen.getByRole("button", { name: "Changelog" });

    expect(screen.getByText("v0.4.0")).toBeInTheDocument();
    fireEvent.click(trigger);

    expect(screen.getByRole("dialog", { name: "Changelog" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Version 0.4.0" })).toBeInTheDocument();
    expect(
      screen.getByText(/Centralized release history in CHANGELOG.json/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close changelog" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Changelog" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
