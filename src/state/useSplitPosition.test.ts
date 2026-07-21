import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SPLIT_PERCENT,
  SPLIT_PERCENT_STORAGE_KEY,
  useSplitPosition,
} from "./useSplitPosition";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("useSplitPosition", () => {
  it("uses the current 50 percent default when no value is stored", () => {
    const { result } = renderHook(() => useSplitPosition());

    expect(result.current.splitPercent).toBe(DEFAULT_SPLIT_PERCENT);
  });

  it("restores a valid stored percentage", () => {
    window.localStorage.setItem(SPLIT_PERCENT_STORAGE_KEY, "62.5");

    const { result } = renderHook(() => useSplitPosition());

    expect(result.current.splitPercent).toBe(62.5);
  });

  it("clamps restored and updated percentages to the supported range", () => {
    window.localStorage.setItem(SPLIT_PERCENT_STORAGE_KEY, "10");
    const { result } = renderHook(() => useSplitPosition());

    expect(result.current.splitPercent).toBe(25);

    act(() => result.current.setSplitPercent(90));

    expect(result.current.splitPercent).toBe(75);
    expect(window.localStorage.getItem(SPLIT_PERCENT_STORAGE_KEY)).toBe("75");
  });

  it("persists user-driven position changes", () => {
    const { result } = renderHook(() => useSplitPosition());

    act(() => result.current.setSplitPercent(58.25));

    expect(result.current.splitPercent).toBe(58.25);
    expect(window.localStorage.getItem(SPLIT_PERCENT_STORAGE_KEY)).toBe("58.25");
  });

  it.each(["", "not-a-number", "Infinity", "NaN"])(
    "uses the default for the malformed stored value %j",
    (storedValue) => {
      window.localStorage.setItem(SPLIT_PERCENT_STORAGE_KEY, storedValue);

      const { result, unmount } = renderHook(() => useSplitPosition());

      expect(result.current.splitPercent).toBe(DEFAULT_SPLIT_PERCENT);
      unmount();
    },
  );

  it("keeps resizing functional when local storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage is blocked");
    });
    const { result } = renderHook(() => useSplitPosition());
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage is blocked");
    });

    expect(result.current.splitPercent).toBe(DEFAULT_SPLIT_PERCENT);

    act(() => result.current.setSplitPercent(60));

    expect(result.current.splitPercent).toBe(60);
  });
});
