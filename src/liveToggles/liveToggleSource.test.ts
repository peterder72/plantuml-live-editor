import { describe, expect, it } from "vitest";
import { findLiveToggles, setLiveToggleValue } from "./liveToggleSource";

describe("findLiveToggles", () => {
  it("detects boolean assignments in source order", () => {
    const source = [
      "!$_live_DETAILS = TRUE",
      "\t!$_live_GRID=false ' keep this comment",
      "!$_other = true",
    ].join("\n");

    expect(findLiveToggles(source)).toEqual([
      { name: "_live_DETAILS", label: "DETAILS", value: true },
      { name: "_live_GRID", label: "GRID", value: false },
    ]);
  });

  it("ignores invalid, non-boolean, and incorrectly cased prefixes", () => {
    const source = [
      "!$_live_VALID = false",
      "!$_live_EXPRESSION = %true()",
      "!$_live_STRING = \"true\"",
      "!$_Live_WRONG_CASE = true",
      "note !$_live_INLINE = true",
    ].join("\n");

    expect(findLiveToggles(source)).toEqual([
      { name: "_live_VALID", label: "VALID", value: false },
    ]);
  });

  it("uses the first value for duplicate declarations", () => {
    const source = "!$_live_FLAG = false\n!$_live_FLAG = true";

    expect(findLiveToggles(source)).toEqual([
      { name: "_live_FLAG", label: "FLAG", value: false },
    ]);
  });
});

describe("setLiveToggleValue", () => {
  it("updates all duplicates and preserves formatting and line endings", () => {
    const source =
      "\t!$_live_FLAG  =  FALSE ' first\r\n!$_live_OTHER=true\r\n!$_live_FLAG=true";

    expect(setLiveToggleValue(source, "_live_FLAG", true)).toBe(
      "\t!$_live_FLAG  =  true ' first\r\n!$_live_OTHER=true\r\n!$_live_FLAG=true",
    );
  });

  it("leaves unrelated and differently cased variables unchanged", () => {
    const source = "!$_live_FLAG=false\n!$_live_flag=false";

    expect(setLiveToggleValue(source, "_live_FLAG", true)).toBe(
      "!$_live_FLAG=true\n!$_live_flag=false",
    );
  });
});
