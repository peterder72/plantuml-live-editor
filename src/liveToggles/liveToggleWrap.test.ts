import { describe, expect, it } from "vitest";
import { wrapSelectionWithLiveToggle } from "./liveToggleWrap";

describe("wrapSelectionWithLiveToggle", () => {
  it("wraps a complete single line and retains its selection", () => {
    const source = "@startuml\nclass User\n@enduml";
    const from = source.indexOf("class User");
    const wrapped = wrapSelectionWithLiveToggle(source, { from, to: from + 10 }, "_live_DETAILS");

    expect(wrapped).toEqual({
      source: "@startuml\n!if $_live_DETAILS\nclass User\n!endif /' _live_DETAILS '/\n@enduml",
      selection: { from: from + "!if $_live_DETAILS\n".length, to: from + "!if $_live_DETAILS\n".length + 10 },
    });
  });

  it("expands a partial selection to all touched lines and preserves indentation", () => {
    const source = "@startuml\n  class First\n  class Second\n@enduml";
    const from = source.indexOf("First") + 2;
    const to = source.indexOf("Second") + 3;

    expect(wrapSelectionWithLiveToggle(source, { from, to }, "_live_GROUP")?.source).toBe(
      "@startuml\n  !if $_live_GROUP\n  class First\n  class Second\n  !endif /' _live_GROUP '/\n@enduml",
    );
  });

  it("preserves CRLF line endings", () => {
    const source = "@startuml\r\nclass User\r\n@enduml";
    const from = source.indexOf("class User");

    expect(wrapSelectionWithLiveToggle(source, { from, to: from + 1 }, "_live_DETAILS")?.source).toBe(
      "@startuml\r\n!if $_live_DETAILS\r\nclass User\r\n!endif /' _live_DETAILS '/\r\n@enduml",
    );
  });
});
