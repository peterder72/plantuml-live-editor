import { describe, expect, it } from "vitest";
import { assertInertSvg, sanitizeSvg } from "./svgSanitizer";

describe("sanitizeSvg", () => {
  it("removes executable SVG content", () => {
    const result = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><rect width="10" height="10"/></svg>',
    );

    expect(result).toContain("<rect");
    expect(result).not.toContain("<script");
    expect(result).not.toContain("onload");
  });

  it("removes external resources, navigation, and CSS URLs", () => {
    const result = sanitizeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg">
        <a href="https://example.test/leak"><text>link</text></a>
        <image href="https://example.test/pixel"/>
        <style>@import url(https://example.test/style.css)</style>
        <rect style="fill:url(https://example.test/fill)"/>
        <rect fill="url(#local-gradient)"/>
      </svg>`,
    );

    expect(result).not.toMatch(/example\.test|<a\b|<image\b|<style\b/);
    expect(result).toContain('fill="url(#local-gradient)"');
  });

  it.each(["onclick=handler", "href=destination", "url(https://example.test)"])(
    "preserves harmless label text: %s",
    (label) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg"><text>${label}</text></svg>`;
      expect(() => assertInertSvg(svg)).not.toThrow();
      expect(sanitizeSvg(svg)).toContain(`<text>${label}</text>`);
    },
  );

  it.each([
    '<rect onclick="handler()"/>',
    '<rect fill="url(https://example.test/fill)"/>',
    '<rect style="fill:url(https://example.test/fill)"/>',
    '<a href="https://example.test"><text>link</text></a>',
  ])("rejects unsafe DOM content: %s", (content) => {
    expect(() => assertInertSvg(
      `<svg xmlns="http://www.w3.org/2000/svg">${content}</svg>`,
    )).toThrow(/unsafe external SVG resource/);
  });

  it.each(['<svg', '<html xmlns="http://www.w3.org/1999/xhtml"/>'])(
    "rejects invalid SVG documents: %s",
    (svg) => expect(() => assertInertSvg(svg)).toThrow(/invalid SVG/),
  );

  it("rejects externally resolving SVG at the final boundary", () => {
    expect(() =>
      assertInertSvg(
        '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.test"/></svg>',
      ),
    ).toThrow(/unsafe external SVG resource/);
  });
});
