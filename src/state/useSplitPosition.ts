import { useCallback, useState } from "react";

export const DEFAULT_SPLIT_PERCENT = 50;
export const MIN_SPLIT_PERCENT = 25;
export const MAX_SPLIT_PERCENT = 75;
export const SPLIT_PERCENT_STORAGE_KEY = "plantuml-live-editor.split-percent";

export function clampSplitPercent(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_SPLIT_PERCENT;
  return Math.min(MAX_SPLIT_PERCENT, Math.max(MIN_SPLIT_PERCENT, value));
}

function readInitialSplitPercent() {
  try {
    const storedValue = window.localStorage.getItem(SPLIT_PERCENT_STORAGE_KEY);
    if (storedValue === null || storedValue.trim() === "") {
      return DEFAULT_SPLIT_PERCENT;
    }

    const parsedValue = Number(storedValue);
    return Number.isFinite(parsedValue)
      ? clampSplitPercent(parsedValue)
      : DEFAULT_SPLIT_PERCENT;
  } catch {
    return DEFAULT_SPLIT_PERCENT;
  }
}

export function useSplitPosition() {
  const [splitPercent, setSplitPercentState] = useState(readInitialSplitPercent);

  const setSplitPercent = useCallback((value: number) => {
    const nextValue = clampSplitPercent(value);
    setSplitPercentState(nextValue);

    try {
      window.localStorage.setItem(
        SPLIT_PERCENT_STORAGE_KEY,
        String(nextValue),
      );
    } catch {
      // Resizing remains functional when storage is blocked or full.
    }
  }, []);

  return { splitPercent, setSplitPercent };
}
