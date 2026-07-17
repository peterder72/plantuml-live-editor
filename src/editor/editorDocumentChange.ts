export interface DocumentChange {
  from: number;
  to: number;
  insert: string;
}

export function minimalDocumentChange(
  currentValue: string,
  nextValue: string,
): DocumentChange | null {
  if (currentValue === nextValue) return null;

  let prefixLength = 0;
  const maximumPrefix = Math.min(currentValue.length, nextValue.length);
  while (
    prefixLength < maximumPrefix &&
    currentValue[prefixLength] === nextValue[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  const maximumSuffix = Math.min(
    currentValue.length - prefixLength,
    nextValue.length - prefixLength,
  );
  while (
    suffixLength < maximumSuffix &&
    currentValue[currentValue.length - suffixLength - 1] ===
      nextValue[nextValue.length - suffixLength - 1]
  ) {
    suffixLength += 1;
  }

  return {
    from: prefixLength,
    to: currentValue.length - suffixLength,
    insert: nextValue.slice(prefixLength, nextValue.length - suffixLength),
  };
}
