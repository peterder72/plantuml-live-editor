import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { plantUmlRenderer } from "../rendering/plantumlRenderer";
import { VsCodePreviewApp, type VsCodeApi } from "./VsCodePreviewApp";
import type { ExtensionToPreviewMessage } from "./messages";

const DOCUMENT_URI = "file:///workspace/example.puml";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function send(message: ExtensionToPreviewMessage) {
  fireEvent(
    window,
    new MessageEvent("message", {
      data: message,
    }),
  );
}

describe("VsCodePreviewApp", () => {
  it("posts diagnostics for the exact document snapshot and clears them on version or URI changes", async () => {
    vi.useFakeTimers();
    const diagnostic = { line: 2, message: "Syntax error near line 2." };
    let resolve!: (
      value: import("../rendering/plantumlRenderer").RenderResult,
    ) => void;
    vi.spyOn(plantUmlRenderer, "render")
      .mockResolvedValueOnce({
        ok: false,
        error: diagnostic.message,
        diagnostic,
        renderId: 1,
        durationMs: 1,
      })
      .mockImplementationOnce(
        () =>
          new Promise((settle) => {
            resolve = settle;
          }),
      )
      .mockResolvedValueOnce({
        ok: true,
        svg: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
        renderId: 3,
        durationMs: 1,
      });
    const postMessage = vi.fn();
    render(<VsCodePreviewApp api={{ postMessage }} />);
    const snapshot = {
      type: "documentState" as const,
      documentUri: DOCUMENT_URI,
      source: "@startuml\ninvalid\n@enduml",
      version: 1,
      fileName: "example.puml",
      selection: { from: 0, to: 0 },
    };
    send(snapshot);
    await act(async () => vi.runAllTimersAsync());
    expect(postMessage).toHaveBeenCalledWith({
      type: "diagnostics",
      documentUri: DOCUMENT_URI,
      documentVersion: 1,
      diagnostics: [diagnostic],
    });
    send({ ...snapshot, version: 2 });
    expect(postMessage).toHaveBeenCalledWith({
      type: "diagnostics",
      documentUri: DOCUMENT_URI,
      documentVersion: 2,
      diagnostics: [],
    });
    await act(async () => vi.runAllTimersAsync());
    const otherUri = "file:///workspace/other.puml";
    send({ ...snapshot, documentUri: otherUri });
    await act(async () => vi.runAllTimersAsync());
    postMessage.mockClear();
    await act(async () =>
      resolve({
        ok: false,
        error: diagnostic.message,
        diagnostic,
        renderId: 2,
        durationMs: 1,
      }),
    );
    const messages = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === "diagnostics");
    expect(messages).not.toHaveLength(0);
    expect(
      messages.every(
        (message) =>
          message.documentUri === otherUri && message.diagnostics.length === 0,
      ),
    ).toBe(true);
  });

  it("waits for the first document snapshot and replaces the rendered SVG after edits", async () => {
    vi.useFakeTimers();
    const renderSpy = vi
      .spyOn(plantUmlRenderer, "render")
      .mockResolvedValueOnce({
        ok: true,
        svg: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10"><text>Initial participant</text></svg>',
        renderId: 1,
        durationMs: 1,
      })
      .mockResolvedValueOnce({
        ok: true,
        svg: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10"><text>Updated participant</text></svg>',
        renderId: 2,
        durationMs: 2,
      });

    render(<VsCodePreviewApp api={{ postMessage: vi.fn() }} />);
    await act(async () => vi.runAllTimersAsync());
    expect(renderSpy).not.toHaveBeenCalled();

    const source = "@startuml\nAlice -> Bob\n@enduml";
    send({
      type: "documentState",
      documentUri: DOCUMENT_URI,
      source,
      version: 1,
      fileName: "example.puml",
      selection: { from: 0, to: 0 },
    });
    await act(async () => vi.runAllTimersAsync());

    expect(renderSpy).toHaveBeenCalledWith(source, 1);
    expect(screen.getByText("Initial participant")).toBeInTheDocument();

    const updated = "@startuml\nBob -> Carol\n@enduml";
    send({
      type: "documentState",
      documentUri: DOCUMENT_URI,
      source: updated,
      version: 2,
      fileName: "example.puml",
      selection: { from: 0, to: 0 },
    });
    await act(async () => vi.advanceTimersByTimeAsync(300));

    expect(renderSpy).toHaveBeenLastCalledWith(updated, 2);
    expect(screen.getByText("Updated participant")).toBeInTheDocument();
    expect(screen.queryByText("Initial participant")).not.toBeInTheDocument();
    expect(screen.getByText("Rendered in 2 ms")).toBeInTheDocument();
  });

  it("keeps the last valid diagram when a later render fails and then recovers", async () => {
    vi.useFakeTimers();
    vi.spyOn(plantUmlRenderer, "render")
      .mockResolvedValueOnce({
        ok: true,
        svg: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10"><text>Last valid</text></svg>',
        renderId: 1,
        durationMs: 1,
      })
      .mockResolvedValueOnce({
        ok: false,
        error: "PlantUML rendering timed out.",
        renderId: 2,
        durationMs: 30_000,
      })
      .mockResolvedValueOnce({
        ok: true,
        svg: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10"><text>Recovered</text></svg>',
        renderId: 3,
        durationMs: 3,
      });
    render(<VsCodePreviewApp api={{ postMessage: vi.fn() }} />);

    send({
      type: "documentState",
      documentUri: DOCUMENT_URI,
      source: "@startuml\nAlice -> Bob\n@enduml",
      version: 1,
      fileName: "example.puml",
      selection: { from: 0, to: 0 },
    });
    await act(async () => vi.runAllTimersAsync());

    send({
      type: "documentState",
      documentUri: DOCUMENT_URI,
      source: "@startuml\nbroken",
      version: 2,
      fileName: "example.puml",
      selection: { from: 0, to: 0 },
    });
    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(screen.getByText("Last valid")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "PlantUML rendering timed out.",
    );

    send({
      type: "documentState",
      documentUri: DOCUMENT_URI,
      source: "@startuml\nAlice -> Carol\n@enduml",
      version: 3,
      fileName: "example.puml",
      selection: { from: 0, to: 0 },
    });
    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(screen.getByText("Recovered")).toBeInTheDocument();
    expect(screen.queryByText("Last valid")).not.toBeInTheDocument();
  });

  it("renders only the latest snapshot from a rapid document burst", async () => {
    vi.useFakeTimers();
    const renderSpy = vi.spyOn(plantUmlRenderer, "render").mockResolvedValue({
      ok: true,
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><text>Latest</text></svg>',
      renderId: 3,
      durationMs: 1,
    });
    render(<VsCodePreviewApp api={{ postMessage: vi.fn() }} />);

    for (const [index, participant] of ["Bob", "Carol", "Dave"].entries()) {
      send({
        type: "documentState",
        documentUri: DOCUMENT_URI,
        source: `@startuml\nAlice -> ${participant}\n@enduml`,
        version: index + 1,
        fileName: "example.puml",
        selection: { from: 0, to: 0 },
      });
    }
    await act(async () => vi.runAllTimersAsync());

    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(renderSpy).toHaveBeenCalledWith(
      "@startuml\nAlice -> Dave\n@enduml",
      3,
    );
    expect(screen.getByText("Latest")).toBeInTheDocument();
  });

  it("announces the preview surface and owns all diagram action chrome", () => {
    const postMessage = vi.fn<VsCodeApi["postMessage"]>();
    const { container } = render(<VsCodePreviewApp api={{ postMessage }} />);
    expect(postMessage).toHaveBeenCalledWith({ type: "ready", surface: "preview" });
    expect(screen.queryByLabelText("Active view")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Export/ })).toBeInTheDocument();
    expect(screen.getByText(/Scroll to zoom/)).toHaveTextContent("Max 8192 × 8192");

    const toolbar = container.querySelector(".preview-export-toolbar");
    if (!toolbar) throw new Error("Preview export toolbar was not rendered.");
    const transform = container.querySelector<HTMLElement>(
      "[data-testid='diagram-transform']",
    );
    const transformBefore = transform?.getAttribute("style");
    fireEvent.pointerDown(toolbar, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(toolbar, { clientX: 80, clientY: 80 });
    fireEvent.pointerUp(toolbar, { clientX: 80, clientY: 80 });
    expect(transform?.getAttribute("style")).toBe(transformBefore);
  });

  it("displays host errors until the next authoritative document state", () => {
    render(<VsCodePreviewApp api={{ postMessage: vi.fn() }} />);

    send({
      type: "documentState",
      documentUri: DOCUMENT_URI,
      source: "@startuml\n!$_live_DETAILS = %false()\n@enduml",
      version: 3,
      fileName: "flags.puml",
      selection: { from: 0, to: 0 },
    });
    send({ type: "showError", message: "The document changed before the edit." });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The document changed before the edit.",
    );

    send({
      type: "documentState",
      documentUri: DOCUMENT_URI,
      source: "@startuml\n!$_live_DETAILS = %true()\n@enduml",
      version: 4,
      fileName: "flags.puml",
      selection: { from: 0, to: 0 },
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows renderer status in the on-canvas HUD", () => {
    render(<VsCodePreviewApp api={{ postMessage: vi.fn() }} />);
    expect(screen.getByText("Loading engine")).toBeInTheDocument();
  });

  it("restores and persists export options in the preview webview", async () => {
    vi.useFakeTimers();
    vi.spyOn(plantUmlRenderer, "render").mockResolvedValue({
      ok: true,
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10"/>',
      renderId: 1,
      durationMs: 1,
    });
    const setState = vi.fn();
    render(
      <VsCodePreviewApp
        api={{
          postMessage: vi.fn(),
          getState: () => ({ exportFormat: "svg", exportBackground: "white" }),
          setState,
        }}
      />,
    );
    send({
      type: "documentState",
      documentUri: DOCUMENT_URI,
      source: "@startuml\nAlice -> Bob\n@enduml",
      version: 1,
      fileName: "architecture.puml",
      selection: { from: 0, to: 0 },
    });
    await act(async () => vi.runAllTimersAsync());

    fireEvent.click(screen.getByRole("button", { name: /Export/ }));
    expect(screen.getByRole("radio", { name: "SVG" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "White" })).toBeChecked();
    expect(screen.getByText("architecture.svg")).toBeInTheDocument();
    expect(setState).toHaveBeenCalledWith({
      exportFormat: "svg",
      exportBackground: "white",
    });
  });

  it("renders a fresh document snapshot even when its source is identical", async () => {
    vi.useFakeTimers();
    const postMessage = vi.fn<VsCodeApi["postMessage"]>();
    const source = "@startuml\nAlice -> Bob\n@enduml";
    const renderSpy = vi
      .spyOn(plantUmlRenderer, "render")
      .mockImplementation(async (_source, renderId) => ({
        ok: true,
        svg: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10"><text>Shared</text></svg>',
        renderId,
        durationMs: 1,
      }));
    render(<VsCodePreviewApp api={{ postMessage }} />);

    send({
      type: "documentState",
      documentUri: "file:///workspace/first.puml",
      source,
      version: 1,
      fileName: "first.puml",
      selection: { from: 0, to: 0 },
    });
    await act(async () => vi.runAllTimersAsync());

    send({
      type: "documentState",
      documentUri: "file:///workspace/second.puml",
      source,
      version: 1,
      fileName: "second.puml",
      selection: { from: 0, to: 0 },
    });
    await act(async () => vi.advanceTimersByTimeAsync(300));

    expect(renderSpy).toHaveBeenCalledTimes(2);
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "rendered",
        documentUri: "file:///workspace/second.puml",
        documentVersion: 1,
      }),
    );
    const renderedMessage = postMessage.mock.calls
      .map(([message]) => message)
      .find(
        (message) =>
          message.type === "rendered" &&
          message.documentUri === "file:///workspace/second.puml",
      );
    expect(renderedMessage).not.toHaveProperty("svg");
  });
});
