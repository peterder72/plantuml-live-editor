import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { plantUmlRenderer } from "../rendering/plantumlRenderer";
import { VsCodePreviewApp, type VsCodeApi } from "./VsCodePreviewApp";
import type { ExtensionToWebviewMessage } from "./messages";

const DOCUMENT_URI = "file:///workspace/example.puml";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function send(message: ExtensionToWebviewMessage) {
  fireEvent(
    window,
    new MessageEvent("message", {
      data: message,
    }),
  );
}

describe("VsCodePreviewApp", () => {
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

  it("uses native editor selection to wrap source and restore selection", () => {
    const postMessage = vi.fn<VsCodeApi["postMessage"]>();
    const source = [
      "@startuml",
      "!$_live_DETAILS = %false()",
      "class User",
      "@enduml",
    ].join("\n");
    const from = source.indexOf("User");

    render(<VsCodePreviewApp api={{ postMessage }} />);
    expect(postMessage).toHaveBeenCalledWith({ type: "ready" });
    expect(screen.getByRole("button", { name: "Wrap selection" })).toBeDisabled();

    send({
      type: "documentState",
      documentUri: DOCUMENT_URI,
      source,
      version: 7,
      fileName: "example.puml",
      selection: { from, to: from + 4 },
    });

    fireEvent.click(screen.getByRole("button", { name: "Wrap selection" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "DETAILS Off" }));

    expect(postMessage).toHaveBeenLastCalledWith({
      type: "replaceSource",
      documentUri: DOCUMENT_URI,
      source: [
        "@startuml",
        "!$_live_DETAILS = %false()",
        "!if $_live_DETAILS",
        "class User",
        "!endif /' _live_DETAILS '/",
        "@enduml",
      ].join("\n"),
      expectedVersion: 7,
      selectionAfter: { from: from + 19, to: from + 23 },
    });
  });

  it("emits live-toggle edits and displays host errors", () => {
    const postMessage = vi.fn<VsCodeApi["postMessage"]>();
    render(<VsCodePreviewApp api={{ postMessage }} />);

    send({
      type: "documentState",
      documentUri: DOCUMENT_URI,
      source: "@startuml\n!$_live_DETAILS = %false()\n@enduml",
      version: 3,
      fileName: "flags.puml",
      selection: { from: 0, to: 0 },
    });
    fireEvent.click(screen.getByLabelText("DETAILS"));

    expect(postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "replaceSource",
        expectedVersion: 3,
        selectionAfter: undefined,
      }),
    );
    const lastMessage = postMessage.mock.calls.at(-1)?.[0];
    expect(lastMessage?.type).toBe("replaceSource");
    if (lastMessage?.type !== "replaceSource") {
      throw new Error("Expected a source replacement message.");
    }
    expect(lastMessage.source).toContain("!$_live_DETAILS = %true()");

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

  it("shows renderer status in the preview footer", () => {
    render(<VsCodePreviewApp api={{ postMessage: vi.fn() }} />);
    expect(screen.getByText("Loading engine")).toBeInTheDocument();
  });

  it("rebinds an existing render to a different document with identical source", async () => {
    vi.useFakeTimers();
    const postMessage = vi.fn<VsCodeApi["postMessage"]>();
    const source = "@startuml\nAlice -> Bob\n@enduml";
    const renderSpy = vi.spyOn(plantUmlRenderer, "render").mockResolvedValue({
      ok: true,
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10"><text>Shared</text></svg>',
      renderId: 1,
      durationMs: 1,
    });
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
    await act(async () => {});

    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByText("second.puml")).toBeInTheDocument();
    expect(postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "rendered",
        documentUri: "file:///workspace/second.puml",
        documentVersion: 1,
      }),
    );
  });
});
