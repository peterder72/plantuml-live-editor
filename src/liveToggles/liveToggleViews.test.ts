import { describe, expect, it } from "vitest";
import {
  createLiveToggleView,
  readLiveToggleViews,
  renameLiveToggleView,
  setLiveToggleValueForActiveView,
  switchLiveToggleView,
} from "./liveToggleViews";

const source = [
  "@startuml",
  "!$_live_DETAILS = %false()",
  "!$_live_GRID = %true()",
  "class Example",
  "@enduml",
].join("\n");

describe("live toggle views", () => {
  it("treats a script without metadata as the Default view", () => {
    expect(readLiveToggleViews(source)).toEqual({
      activeView: "Default",
      views: [
        {
          name: "Default",
          toggles: { _live_DETAILS: false, _live_GRID: true },
        },
      ],
    });
  });

  it("creates a readable commented metadata block before @enduml", () => {
    const updated = createLiveToggleView(source, "Presentation");

    expect(updated).toContain("/' @plantuml-live-editor views v2");
    expect(updated).toContain('"activeView": "Presentation"');
    expect(updated).toContain('"DETAILS": false');
    expect(updated).not.toContain('"_live_DETAILS"');
    expect(updated.indexOf("/' @plantuml-live-editor")).toBeLessThan(
      updated.indexOf("@enduml"),
    );
    expect(readLiveToggleViews(updated).views).toHaveLength(2);
  });

  it("stores toggle changes in the active view and restores each view", () => {
    let updated = setLiveToggleValueForActiveView(
      source,
      "_live_DETAILS",
      true,
    );
    updated = createLiveToggleView(updated, "Minimal");
    updated = setLiveToggleValueForActiveView(updated, "_live_GRID", false);

    updated = switchLiveToggleView(updated, "Default");
    expect(updated).toContain("!$_live_DETAILS = %true()");
    expect(updated).toContain("!$_live_GRID = %true()");

    updated = switchLiveToggleView(updated, "Minimal");
    expect(updated).toContain("!$_live_DETAILS = %true()");
    expect(updated).toContain("!$_live_GRID = %false()");
  });

  it("preserves the current active values before switching views", () => {
    let updated = createLiveToggleView(source, "Second");
    updated = updated.replace(
      "!$_live_DETAILS = %false()",
      "!$_live_DETAILS = %true()",
    );
    updated = switchLiveToggleView(updated, "Default");
    updated = switchLiveToggleView(updated, "Second");

    expect(updated).toContain("!$_live_DETAILS = %true()");
  });

  it("ignores malformed metadata and duplicate names", () => {
    const malformed = `${source}\n/' @plantuml-live-editor views v1\nactive: nope\n@end-plantuml-live-editor views '/`;
    expect(readLiveToggleViews(malformed).activeView).toBe("Default");

    const withView = createLiveToggleView(source, "Review");
    expect(createLiveToggleView(withView, " review ")).toBe(withView);
  });

  it("renames a view without changing its values or position", () => {
    let updated = createLiveToggleView(source, "Review");
    updated = setLiveToggleValueForActiveView(updated, "_live_DETAILS", true);
    updated = renameLiveToggleView(updated, "Review", "Detailed review");

    const state = readLiveToggleViews(updated);
    expect(state.activeView).toBe("Detailed review");
    expect(state.views.map((view) => view.name)).toEqual([
      "Default",
      "Detailed review",
    ]);
    expect(state.views[1].toggles._live_DETAILS).toBe(true);
    expect(updated).toContain('"Detailed review"');
    expect(updated).not.toContain('"Review":');
  });

  it("rejects empty, missing, and duplicate rename targets", () => {
    const withView = createLiveToggleView(source, "Review");

    expect(renameLiveToggleView(withView, "Review", " default ")).toBe(
      withView,
    );
    expect(renameLiveToggleView(withView, "Review", " ")).toBe(withView);
    expect(renameLiveToggleView(withView, "Missing", "Other")).toBe(withView);
  });
});
