const END_UML_PATTERN = /^\s*@enduml\b/im;

export function toggleHiddenMembers(source: string, entity: string): string {
  const normalizedEntity = entity.trim();
  if (!normalizedEntity || /[\r\n]/.test(normalizedEntity)) return source;

  const directive = `hide ${formatEntity(normalizedEntity)} members`;
  const directivePattern = new RegExp(
    `^[\\t ]*hide[\\t ]+${escapeRegExp(formatEntity(normalizedEntity))}[\\t ]+members[\\t ]*(?:'[^\\r\\n]*)?(?:\\r?\\n|$)`,
    "im",
  );
  const existing = directivePattern.exec(source);

  if (existing) {
    return source.slice(0, existing.index) + source.slice(existing.index + existing[0].length);
  }

  const end = END_UML_PATTERN.exec(source);
  if (!end) {
    return `${source}${source.endsWith("\n") || !source ? "" : "\n"}${directive}\n`;
  }

  const before = source.slice(0, end.index);
  const separator = before.endsWith("\n") || !before ? "" : "\n";
  return `${before}${separator}${directive}\n${source.slice(end.index)}`;
}

function formatEntity(entity: string): string {
  return /^[A-Za-z_][\w.$]*$/.test(entity)
    ? entity
    : `"${entity.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
