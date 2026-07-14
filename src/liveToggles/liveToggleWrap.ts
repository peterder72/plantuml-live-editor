export interface SourceSelection {
  from: number;
  to: number;
}

export interface WrappedLiveToggleSelection {
  source: string;
  selection: SourceSelection;
}

export function wrapSelectionWithLiveToggle(
  source: string,
  selection: SourceSelection,
  flagName: string,
): WrappedLiveToggleSelection | null {
  const from = Math.max(0, Math.min(selection.from, selection.to, source.length));
  const to = Math.max(0, Math.min(Math.max(selection.from, selection.to), source.length));
  if (from === to || !/^_live_[A-Za-z0-9_]+$/.test(flagName)) return null;

  const lineStart = source.lastIndexOf("\n", from - 1) + 1;
  const lastSelectedCharacter = to - 1;
  const lineBreak = source.indexOf("\n", lastSelectedCharacter);
  let lineEnd = lineBreak === -1 ? source.length : lineBreak;
  if (lineEnd > lineStart && source[lineEnd - 1] === "\r") lineEnd -= 1;

  const selectedLines = source.slice(lineStart, lineEnd);
  const indent = /^[ \t]*/.exec(selectedLines)?.[0] ?? "";
  const lineEnding = source.includes("\r\n") ? "\r\n" : "\n";
  const opening = `${indent}!if $${flagName}${lineEnding}`;
  const closing = `${lineEnding}${indent}!endif`;
  const wrapped = `${source.slice(0, lineStart)}${opening}${selectedLines}${closing}${source.slice(lineEnd)}`;
  const contentStart = lineStart + opening.length;

  return {
    source: wrapped,
    selection: {
      from: contentStart + (from - lineStart),
      to: contentStart + (to - lineStart),
    },
  };
}
