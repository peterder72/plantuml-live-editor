import { describe, expect, it } from "vitest";
import { sanitizeSvg } from "./svgSanitizer";

describe("sanitizeSvg", () => {
  it("removes executable SVG content", () => {
    const result = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><rect width="10" height="10"/></svg>',
    );

    expect(result).toContain("<rect");
    expect(result).not.toContain("<script");
    expect(result).not.toContain("onload");
  });
});
