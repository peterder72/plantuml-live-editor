import { expect, test } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

test("renders offline and preserves zoom while editing", async ({ page }) => {
  await page.goto(pathToFileURL(resolve("dist/index.html")).href);
  await expect(page.locator(".diagram-content svg")).toBeVisible({
    timeout: 30_000,
  });

  const viewport = page.getByTestId("diagram-viewport");
  const box = await viewport.boundingBox();
  if (!box) throw new Error("Preview viewport is not visible.");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -600);
  const transform = page.getByTestId("diagram-transform");
  const before = await transform.getAttribute("style");

  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type("\n' rerender");
  await expect(page.getByText(/Rendered in/)).toBeVisible({ timeout: 30_000 });

  await expect(transform).toHaveAttribute("style", before ?? "");
});
