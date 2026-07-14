import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VsCodePreviewApp, type VsCodeApi } from "./VsCodePreviewApp";
import type { ExtensionToWebviewMessage } from "./messages";

afterEach(cleanup);

function send(message: ExtensionToWebviewMessage) {
  fireEvent(
    window,
    new MessageEvent("message", {
      data: message,
    }),
  );
}

describe("VsCodePreviewApp", () => {
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
      source,
      version: 7,
      fileName: "example.puml",
      selection: { from, to: from + 4 },
    });

    fireEvent.click(screen.getByRole("button", { name: "Wrap selection" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "DETAILS Off" }));

    expect(postMessage).toHaveBeenLastCalledWith({
      type: "replaceSource",
      source: [
        "@startuml",
        "!$_live_DETAILS = %false()",
        "!if $_live_DETAILS",
        "class User",
        "!endif",
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
  });

  it("shows renderer status in the preview footer", () => {
    render(<VsCodePreviewApp api={{ postMessage: vi.fn() }} />);
    expect(screen.getByText("Loading engine")).toBeInTheDocument();
  });
});
