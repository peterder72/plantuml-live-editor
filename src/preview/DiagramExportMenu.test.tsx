import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiagramExportMenu } from "./DiagramExportMenu";

const mocks = vi.hoisted(() => ({
  copyDiagram: vi.fn().mockResolvedValue(undefined),
  saveDiagram: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../rendering/diagramExporter", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../rendering/diagramExporter")>()),
  copyDiagram: mocks.copyDiagram,
  saveDiagram: mocks.saveDiagram,
}));

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DiagramExportMenu", () => {
  it("is disabled until a valid diagram is available", () => {
    render(<DiagramExportMenu svg="" sourceFileName="diagram" />);
    expect(screen.getByRole("button", { name: /Export/ })).toBeDisabled();
  });

  it("keeps the web export basename fixed to diagram", () => {
    render(<DiagramExportMenu svg={svg} sourceFileName="diagram" />);
    fireEvent.click(screen.getByRole("button", { name: /Export/ }));
    expect(screen.getByText("diagram.png")).toBeInTheDocument();
  });

  it("shows the selected filename and remembers choices while mounted", () => {
    render(<DiagramExportMenu svg={svg} sourceFileName="architecture.puml" />);
    const trigger = screen.getByRole("button", { name: /Export/ });
    fireEvent.click(trigger);

    expect(screen.getByRole("dialog", { name: "Export diagram" })).toHaveFocus();
    expect(screen.getByText("architecture.png")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "PNG" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Transparent" })).toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: "SVG" }));
    fireEvent.click(screen.getByRole("radio", { name: "White" }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.getByText("architecture.svg")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "SVG" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "White" })).toBeChecked();
  });

  it("saves with the selected options and returns focus", async () => {
    render(<DiagramExportMenu svg={svg} sourceFileName="model.puml" />);
    const trigger = screen.getByRole("button", { name: /Export/ });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("radio", { name: "SVG" }));
    fireEvent.click(screen.getByRole("radio", { name: "White" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(mocks.saveDiagram).toHaveBeenCalledWith(
        svg,
        { format: "svg", background: "white" },
        "model.svg",
      ),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(screen.getByText("Saved model.svg")).toBeInTheDocument();
  });

  it("keeps the popover open and announces copy errors", async () => {
    mocks.copyDiagram.mockRejectedValueOnce(
      new Error("This browser cannot copy SVG images. Save the SVG instead."),
    );
    render(<DiagramExportMenu svg={svg} sourceFileName="model.puml" />);
    fireEvent.click(screen.getByRole("button", { name: /Export/ }));
    fireEvent.click(screen.getByRole("radio", { name: "SVG" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy image" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "cannot copy SVG images",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes on Escape and restores focus to Export", () => {
    render(<DiagramExportMenu svg={svg} sourceFileName="diagram" />);
    const trigger = screen.getByRole("button", { name: /Export/ });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
