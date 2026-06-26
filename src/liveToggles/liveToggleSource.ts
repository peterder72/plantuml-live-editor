export interface LiveToggle {
  name: string;
  label: string;
  value: boolean;
}

const LIVE_TOGGLE_ASSIGNMENT =
  /^([ \t]*)!\$(?<name>_live_(?<label>[A-Za-z0-9_]+))(?<beforeEquals>[ \t]*)=(?<afterEquals>[ \t]*)(?<value>%true\(\)|%false\(\)|true|false)(?<suffix>[ \t]*(?:'.*)?)$/i;

function parseLine(line: string) {
  const match = LIVE_TOGGLE_ASSIGNMENT.exec(line);
  if (!match?.groups) return null;

  const { name, label, value } = match.groups;
  if (!name.startsWith("_live_")) return null;

  return {
    match,
    name,
    label,
    value: /^(?:%true\(\)|true)$/i.test(value),
  };
}

export function findLiveToggles(source: string): LiveToggle[] {
  const toggles = new Map<string, LiveToggle>();

  for (const line of source.split(/\r\n|\r|\n/)) {
    const parsed = parseLine(line);
    if (!parsed || toggles.has(parsed.name)) continue;

    toggles.set(parsed.name, {
      name: parsed.name,
      label: parsed.label,
      value: parsed.value,
    });
  }

  return [...toggles.values()];
}

export function addLiveToggle(source: string, label: string): string {
  const normalizedLabel = label.trim();
  if (!/^[A-Za-z0-9_]+$/.test(normalizedLabel)) return source;

  const name = `_live_${normalizedLabel}`;
  if (findLiveToggles(source).some((toggle) => toggle.name === name)) {
    return source;
  }

  const lineEnding = source.includes("\r\n") ? "\r\n" : "\n";
  const startMatch = /^@startuml[^\r\n]*(?:\r\n|\r|\n|$)/im.exec(source);
  if (!startMatch || startMatch.index === undefined) {
    return `!$${name} = %false()${lineEnding}${source}`;
  }

  const insertionIndex = startMatch.index + startMatch[0].length;
  const separator = /\r\n|\r|\n$/.test(startMatch[0]) ? "" : lineEnding;
  return `${source.slice(0, insertionIndex)}${separator}!$${name} = %false()${lineEnding}${source.slice(insertionIndex)}`;
}

export function setLiveToggleValue(
  source: string,
  name: string,
  value: boolean,
): string {
  return source
    .split(/(\r\n|\r|\n)/)
    .map((part, index) => {
      if (index % 2 === 1) return part;

      const parsed = parseLine(part);
      if (!parsed || parsed.name !== name) return part;

      const valueStart = parsed.match.index + parsed.match[0].indexOf(parsed.match.groups!.value);
      const valueEnd = valueStart + parsed.match.groups!.value.length;
      return `${part.slice(0, valueStart)}${value ? "%true()" : "%false()"}${part.slice(valueEnd)}`;
    })
    .join("");
}
