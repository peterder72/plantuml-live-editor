import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VsCodeControlsApp, type VsCodeControlsApi } from "./VsCodeControlsApp";
import type { ExtensionToControlsMessage } from "./messages";

const DOCUMENT_URI = "file:///workspace/example.puml";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function send(message: ExtensionToControlsMessage) {
  fireEvent(
    window,
    new MessageEvent("message", {
      data: message,
    }),
  );
}

function openDocument(source = "@startuml\n!$_live_DETAILS = %false()\nclass User\n@enduml") {
  send({
    type: "documentState",
    documentUri: DOCUMENT_URI,
    source,
    version: 7,
    fileName: "example.puml",
    selection: { from: source.indexOf("User"), to: source.indexOf("User") + 4 },
  });
}

describe("VsCodeControlsApp", () => {
  it("announces the controls surface and explains its empty state", () => {
    const postMessage = vi.fn<VsCodeControlsApi["postMessage"]>();
    render(<VsCodeControlsApp api={{ postMessage }} />);

    expect(postMessage).toHaveBeenCalledWith({ type: "ready", surface: "controls" });
    expect(screen.getByText("Open a PlantUML file")).toBeInTheDocument();
  });

  it("shows Open Preview only until the preview is ready and restores it on close", () => {
    const postMessage = vi.fn<VsCodeControlsApi["postMessage"]>();
    render(<VsCodeControlsApp api={{ postMessage }} />);
    openDocument();

    const openPreview = screen.getByRole("button", { name: "Open Preview" });
    fireEvent.click(openPreview);
    expect(postMessage).toHaveBeenLastCalledWith({ type: "openPreview" });
    send({ type: "previewAvailability", available: true });
    expect(screen.queryByRole("button", { name: "Open Preview" })).not.toBeInTheDocument();

    send({ type: "previewAvailability", available: false });
    expect(screen.getByRole("button", { name: "Open Preview" })).toBeInTheDocument();
  });

  it("wraps the native editor selection and includes version protection", () => {
    const postMessage = vi.fn<VsCodeControlsApi["postMessage"]>();
    render(<VsCodeControlsApp api={{ postMessage }} />);
    openDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Wrap selection" }), {
      target: { value: "_live_DETAILS" },
    });

    expect(postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "replaceSource",
        documentUri: DOCUMENT_URI,
        expectedVersion: 7,
        source: expect.stringContaining("!if $_live_DETAILS"),
        selectionAfter: expect.objectContaining({ from: expect.any(Number), to: expect.any(Number) }),
      }),
    );
  });

  it("contains only compact document controls and no diagram chrome", () => {
    render(<VsCodeControlsApp api={{ postMessage: vi.fn() }} />);
    openDocument();

    expect(screen.getByRole("heading", { name: "Views" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Live toggles" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Active view" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "DETAILS" })).toBeInTheDocument();
    expect(screen.queryByText("example.puml")).not.toBeInTheDocument();
    expect(screen.queryByText("SVG")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Zoom in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Export/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Scroll to zoom/)).not.toBeInTheDocument();
  });

  it("uses native inline actions to add flags and create views", () => {
    const postMessage = vi.fn<VsCodeControlsApi["postMessage"]>();
    render(<VsCodeControlsApp api={{ postMessage }} />);
    openDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add flag" }));
    fireEvent.change(screen.getByRole("textbox", { name: "New flag name" }), {
      target: { value: "AUDIT" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save flag" }));
    expect(postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "replaceSource",
        source: expect.stringContaining("!$_live_AUDIT = %false()"),
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Create view" }));
    fireEvent.change(screen.getByRole("textbox", { name: "New view name" }), {
      target: { value: "Review" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save view" }));
    expect(postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "replaceSource",
        source: expect.stringContaining('"activeView": "Review"'),
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Rename view" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Rename view" }), {
      target: { value: "Expanded" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save renamed view" }));
    expect(postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "replaceSource",
        source: expect.stringContaining('"activeView": "Expanded"'),
      }),
    );
  });
});
