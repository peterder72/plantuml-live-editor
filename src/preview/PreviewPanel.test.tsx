import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PreviewPanel } from "./PreviewPanel";

afterEach(cleanup);

describe("PreviewPanel web defaults", () => {
  it("retains the standalone web preview chrome and local controls", () => {
    render(
      <PreviewPanel
        svg={'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'}
        renderRevision={1}
        status={{ kind: "success", label: "Rendered in 1 ms" }}
      />,
    );

    expect(screen.getByText("Preview")).toBeInTheDocument();
    expect(screen.getByText("SVG")).toBeInTheDocument();
    expect(screen.getByText(/Scroll to zoom/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fit diagram" })).toBeInTheDocument();
    expect(screen.getByText("Client-side renderer")).toBeInTheDocument();
    expect(screen.getByText("Max 8192 × 8192")).toBeInTheDocument();
  });
});
