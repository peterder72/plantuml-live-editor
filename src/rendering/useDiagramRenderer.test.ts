import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { plantUmlRenderer, type RenderResult } from "./plantumlRenderer";
import { useDiagramRenderer } from "./useDiagramRenderer";

const FIRST_SOURCE = "@startuml\nAlice -> Bob\n@enduml";
const SECOND_SOURCE = "@startuml\nBob -> Alice\n@enduml";
const THIRD_SOURCE = "@startuml\nAlice -> Carol\n@enduml";

function success(renderId: number, label: string): RenderResult {
  return {
    ok: true,
    svg: `<svg xmlns="http://www.w3.org/2000/svg"><text>${label}</text></svg>`,
    renderId,
    durationMs: 12,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

async function flushTimers() {
  await act(async () => {
    await vi.runOnlyPendingTimersAsync();
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("useDiagramRenderer", () => {
  it("does not render before a source snapshot is available", async () => {
    vi.useFakeTimers();
    const renderSpy = vi.spyOn(plantUmlRenderer, "render");

    const { result } = renderHook(() => useDiagramRenderer(null));
    await flushTimers();

    expect(renderSpy).not.toHaveBeenCalled();
    expect(result.current.status).toEqual({
      kind: "initializing",
      label: "Loading engine",
    });
  });

  it("renders the initial source and then replaces it after the edit debounce", async () => {
    vi.useFakeTimers();
    const renderSpy = vi
      .spyOn(plantUmlRenderer, "render")
      .mockResolvedValueOnce(success(1, "first"))
      .mockResolvedValueOnce(success(2, "second"));
    const { result, rerender } = renderHook(
      ({ source }) => useDiagramRenderer(source),
      { initialProps: { source: FIRST_SOURCE as string | null } },
    );

    await flushTimers();
    expect(result.current.svg).toContain("first");
    expect(result.current.renderRevision).toBe(1);

    rerender({ source: SECOND_SOURCE });
    expect(result.current.status.label).toBe("Rendering changes");
    await act(async () => vi.advanceTimersByTimeAsync(299));
    expect(renderSpy).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(1));

    expect(renderSpy).toHaveBeenLastCalledWith(SECOND_SOURCE, 2);
    expect(result.current.svg).toContain("second");
    expect(result.current.renderRevision).toBe(2);
    expect(result.current.status.kind).toBe("success");
  });

  it("debounces rapid source changes before rendering starts", async () => {
    vi.useFakeTimers();
    const renderSpy = vi
      .spyOn(plantUmlRenderer, "render")
      .mockResolvedValue(success(3, "latest"));
    const { rerender } = renderHook(
      ({ source }) => useDiagramRenderer(source),
      { initialProps: { source: null as string | null } },
    );

    rerender({ source: FIRST_SOURCE });
    rerender({ source: SECOND_SOURCE });
    rerender({ source: THIRD_SOURCE });
    await flushTimers();

    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(renderSpy).toHaveBeenCalledWith(THIRD_SOURCE, 3);
  });

  it("coalesces in-flight edits and ignores the stale completion", async () => {
    vi.useFakeTimers();
    const first = deferred<RenderResult>();
    const renderSpy = vi
      .spyOn(plantUmlRenderer, "render")
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(success(3, "latest"));
    const { result, rerender } = renderHook(
      ({ source }) => useDiagramRenderer(source),
      { initialProps: { source: FIRST_SOURCE as string | null } },
    );
    await flushTimers();

    rerender({ source: SECOND_SOURCE });
    await act(async () => vi.advanceTimersByTimeAsync(300));
    rerender({ source: THIRD_SOURCE });
    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(renderSpy).toHaveBeenCalledTimes(1);

    await act(async () => first.resolve(success(1, "stale")));

    expect(renderSpy).toHaveBeenCalledTimes(2);
    expect(renderSpy).toHaveBeenLastCalledWith(THIRD_SOURCE, 3);
    expect(result.current.svg).toContain("latest");
    expect(result.current.svg).not.toContain("stale");
  });

  it("preserves the last valid SVG on failure and recovers on the next edit", async () => {
    vi.useFakeTimers();
    const renderSpy = vi
      .spyOn(plantUmlRenderer, "render")
      .mockResolvedValueOnce(success(1, "valid"))
      .mockResolvedValueOnce({
        ok: false,
        error: "PlantUML rendering timed out.",
        renderId: 2,
        durationMs: 30_000,
      })
      .mockResolvedValueOnce(success(3, "recovered"));
    const { result, rerender } = renderHook(
      ({ source }) => useDiagramRenderer(source),
      { initialProps: { source: FIRST_SOURCE as string | null } },
    );
    await flushTimers();

    rerender({ source: SECOND_SOURCE });
    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(result.current.svg).toContain("valid");
    expect(result.current.status).toEqual({
      kind: "error",
      label: "PlantUML rendering timed out.",
    });

    rerender({ source: THIRD_SOURCE });
    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(renderSpy).toHaveBeenCalledTimes(3);
    expect(result.current.svg).toContain("recovered");
    expect(result.current.status.kind).toBe("success");
  });

  it("reports an unexpected renderer exception and recovers on the next source", async () => {
    vi.useFakeTimers();
    const renderSpy = vi
      .spyOn(plantUmlRenderer, "render")
      .mockImplementationOnce(() => {
        throw new TypeError("Cannot read properties of undefined");
      })
      .mockResolvedValueOnce(success(2, "recovered"));
    const { result, rerender } = renderHook(
      ({ source }) => useDiagramRenderer(source),
      { initialProps: { source: FIRST_SOURCE as string | null } },
    );

    await flushTimers();
    expect(result.current.status).toEqual({
      kind: "error",
      label: "Cannot read properties of undefined",
    });

    rerender({ source: SECOND_SOURCE });
    await act(async () => vi.advanceTimersByTimeAsync(300));

    expect(renderSpy).toHaveBeenCalledTimes(2);
    expect(result.current.svg).toContain("recovered");
    expect(result.current.status.kind).toBe("success");
  });
});
