import { useCallback, useEffect, useState } from "react";

export const DEFAULT_SOURCE = `@startuml
skinparam backgroundColor transparent
skinparam sequenceMessageAlign center

actor User
participant "Live Editor" as Editor
participant "PlantUML" as Engine

User -> Editor: Write diagram code
Editor -> Engine: Render source
Engine --> Editor: Return SVG
Editor --> User: Update preview
@enduml`;

const STORAGE_KEY = "plantuml-live-editor.source";

function readInitialSource(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_SOURCE;
  } catch {
    return DEFAULT_SOURCE;
  }
}

export function useEditorState() {
  const [source, setSource] = useState(readInitialSource);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, source);
    } catch {
      // Editing remains functional when storage is blocked or full.
    }
  }, [source]);

  const resetSource = useCallback(() => setSource(DEFAULT_SOURCE), []);

  return { source, setSource, resetSource };
}
