import { describe, expect, it } from "vitest";
import { toggleHiddenMembers } from "./classMemberVisibility";

describe("toggleHiddenMembers", () => {
  it("adds a hide directive before @enduml", () => {
    expect(
      toggleHiddenMembers("@startuml\nclass User\n@enduml", "User"),
    ).toBe("@startuml\nclass User\nhide User members\n@enduml");
  });

  it("removes an existing hide directive", () => {
    expect(
      toggleHiddenMembers(
        "@startuml\nclass User\nhide User members\n@enduml",
        "User",
      ),
    ).toBe("@startuml\nclass User\n@enduml");
  });

  it("quotes display names that are not identifiers", () => {
    expect(
      toggleHiddenMembers("@startuml\nclass \"Display Name\"\n@enduml", "Display Name"),
    ).toContain('hide "Display Name" members');
  });

  it("rejects entities containing newlines", () => {
    const source = "@startuml\n@enduml";
    expect(toggleHiddenMembers(source, "User\nhide *")).toBe(source);
  });
});
