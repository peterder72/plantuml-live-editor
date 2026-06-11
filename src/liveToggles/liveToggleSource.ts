export interface LiveToggle {
  name: string;
  label: string;
  value: boolean;
}

const LIVE_TOGGLE_ASSIGNMENT =
  /^([ \t]*)!\$(?<name>_live_(?<label>[A-Za-z0-9_]+))(?<beforeEquals>[ \t]*)=(?<afterEquals>[ \t]*)(?<value>true|false)(?<suffix>[ \t]*(?:'.*)?)$/i;

function parseLine(line: string) {
  const match = LIVE_TOGGLE_ASSIGNMENT.exec(line);
  if (!match?.groups) return null;

  const { name, label, value } = match.groups;
  if (!name.startsWith("_live_")) return null;

  return {
    match,
    name,
    label,
    value: value.toLowerCase() === "true",
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
      return `${part.slice(0, valueStart)}${String(value)}${part.slice(valueEnd)}`;
    })
    .join("");
}
