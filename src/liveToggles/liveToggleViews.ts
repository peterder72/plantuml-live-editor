import {
  findLiveToggles,
  setLiveToggleValue,
  type LiveToggle,
} from "./liveToggleSource";

export interface LiveToggleView {
  name: string;
  toggles: Record<string, boolean>;
}

export interface LiveToggleViews {
  activeView: string;
  views: LiveToggleView[];
}

const DEFAULT_VIEW = "Default";
const BLOCK_START = "/' @plantuml-live-editor views v2";
const BLOCK_END = "@end-plantuml-live-editor views '/";
const BLOCK_PATTERN =
  /(?:^|\r?\n)\/' @plantuml-live-editor views v(?<version>[12])\r?\n(?<body>[\s\S]*?)\r?\n@end-plantuml-live-editor views '\/(?=\r?\n|$)/;

interface SerializedViewsV2 {
  activeView: string;
  views: Record<string, Record<string, boolean>>;
}

function valuesFromToggles(toggles: LiveToggle[]): Record<string, boolean> {
  return Object.fromEntries(toggles.map(({ name, value }) => [name, value]));
}

function defaultViews(source: string): LiveToggleViews {
  return {
    activeView: DEFAULT_VIEW,
    views: [
      {
        name: DEFAULT_VIEW,
        toggles: valuesFromToggles(findLiveToggles(source)),
      },
    ],
  };
}

export function readLiveToggleViews(source: string): LiveToggleViews {
  const fallback = defaultViews(source);
  const match = BLOCK_PATTERN.exec(source);
  if (!match?.groups?.body) return fallback;

  if (match.groups.version === "2") {
    try {
      const parsed: unknown = JSON.parse(match.groups.body);
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        !("activeView" in parsed) ||
        !("views" in parsed) ||
        typeof parsed.activeView !== "string" ||
        typeof parsed.views !== "object" ||
        parsed.views === null
      ) {
        return fallback;
      }

      const views = Object.entries(parsed.views).flatMap(([name, toggles]) => {
        if (!name.trim() || typeof toggles !== "object" || toggles === null) {
          return [];
        }
        return [{
          name,
          toggles: Object.fromEntries(
            Object.entries(toggles)
              .filter(
                (entry): entry is [string, boolean] =>
                  typeof entry[1] === "boolean",
              )
              .map(([toggleName, value]) => [`_live_${toggleName}`, value]),
          ),
        }];
      });
      if (views.length === 0) return fallback;

      return {
        activeView: views.some((view) => view.name === parsed.activeView)
          ? parsed.activeView
          : views[0].name,
        views,
      };
    } catch {
      return fallback;
    }
  }

  let activeView = DEFAULT_VIEW;
  const views: LiveToggleView[] = [];

  for (const line of match.groups.body.split(/\r\n|\r|\n/)) {
    const activeMatch = /^active: (.+)$/.exec(line);
    if (activeMatch) {
      try {
        const parsed = JSON.parse(activeMatch[1]);
        if (typeof parsed === "string" && parsed.trim()) activeView = parsed;
      } catch {
        return fallback;
      }
      continue;
    }

    const viewMatch = /^view: (.+)$/.exec(line);
    if (!viewMatch) continue;

    try {
      const parsed: unknown = JSON.parse(viewMatch[1]);
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        !("name" in parsed) ||
        !("toggles" in parsed) ||
        typeof parsed.name !== "string" ||
        !parsed.name.trim() ||
        typeof parsed.toggles !== "object" ||
        parsed.toggles === null
      ) {
        return fallback;
      }

      const toggles = Object.fromEntries(
        Object.entries(parsed.toggles).filter(
          (entry): entry is [string, boolean] =>
            typeof entry[1] === "boolean",
        ),
      );
      views.push({ name: parsed.name, toggles });
    } catch {
      return fallback;
    }
  }

  if (views.length === 0) return fallback;
  if (!views.some((view) => view.name === activeView)) {
    activeView = views[0].name;
  }

  return { activeView, views };
}

function serializeLiveToggleViews(views: LiveToggleViews): string {
  const serialized: SerializedViewsV2 = {
    activeView: views.activeView,
    views: Object.fromEntries(
      views.views.map((view) => [
        view.name,
        Object.fromEntries(
          Object.entries(view.toggles).map(([name, value]) => [
            name.replace(/^_live_/, ""),
            value,
          ]),
        ),
      ]),
    ),
  };

  return [
    BLOCK_START,
    JSON.stringify(serialized, null, 2),
    BLOCK_END,
  ].join("\n");
}

export function writeLiveToggleViews(
  source: string,
  views: LiveToggleViews,
): string {
  const block = serializeLiveToggleViews(views);
  if (BLOCK_PATTERN.test(source)) {
    return source.replace(BLOCK_PATTERN, (matched) =>
      matched.startsWith("\n") || matched.startsWith("\r\n")
        ? `${matched.startsWith("\r\n") ? "\r\n" : "\n"}${block}`
        : block,
    );
  }

  const endIndex = source.lastIndexOf("@enduml");
  if (endIndex < 0) return `${source.replace(/\s*$/, "")}\n\n${block}`;

  const before = source.slice(0, endIndex).replace(/\s*$/, "");
  const after = source.slice(endIndex);
  return `${before}\n\n${block}\n${after}`;
}

function syncActiveView(source: string, state: LiveToggleViews): LiveToggleViews {
  const currentValues = valuesFromToggles(findLiveToggles(source));
  return {
    ...state,
    views: state.views.map((view) =>
      view.name === state.activeView
        ? { ...view, toggles: { ...view.toggles, ...currentValues } }
        : view,
    ),
  };
}

export function setLiveToggleValueForActiveView(
  source: string,
  name: string,
  value: boolean,
): string {
  const updatedSource = setLiveToggleValue(source, name, value);
  const state = syncActiveView(updatedSource, readLiveToggleViews(source));
  return writeLiveToggleViews(updatedSource, state);
}

export function switchLiveToggleView(source: string, name: string): string {
  const state = syncActiveView(source, readLiveToggleViews(source));
  const target = state.views.find((view) => view.name === name);
  if (!target) return source;

  let updatedSource = source;
  for (const [toggleName, value] of Object.entries(target.toggles)) {
    updatedSource = setLiveToggleValue(updatedSource, toggleName, value);
  }

  return writeLiveToggleViews(updatedSource, {
    ...state,
    activeView: target.name,
  });
}

export function createLiveToggleView(source: string, name: string): string {
  const trimmedName = name.trim();
  const state = syncActiveView(source, readLiveToggleViews(source));
  if (
    !trimmedName ||
    state.views.some(
      (view) => view.name.toLocaleLowerCase() === trimmedName.toLocaleLowerCase(),
    )
  ) {
    return source;
  }

  const toggles = valuesFromToggles(findLiveToggles(source));
  return writeLiveToggleViews(source, {
    activeView: trimmedName,
    views: [...state.views, { name: trimmedName, toggles }],
  });
}

export function renameLiveToggleView(
  source: string,
  currentName: string,
  nextName: string,
): string {
  const trimmedName = nextName.trim();
  const state = syncActiveView(source, readLiveToggleViews(source));
  if (
    !trimmedName ||
    !state.views.some((view) => view.name === currentName) ||
    state.views.some(
      (view) =>
        view.name !== currentName &&
        view.name.toLocaleLowerCase() === trimmedName.toLocaleLowerCase(),
    )
  ) {
    return source;
  }

  return writeLiveToggleViews(source, {
    activeView:
      state.activeView === currentName ? trimmedName : state.activeView,
    views: state.views.map((view) =>
      view.name === currentName ? { ...view, name: trimmedName } : view,
    ),
  });
}
