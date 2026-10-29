import { expect, test } from "@playwright/test";

// Every width from the brief, portrait and landscape; checked once (phone-390 project only).
const WIDTHS = [320, 360, 390, 430, 768, 1024, 1440];
const HEIGHTS: Record<number, number> = { 320: 568, 360: 740, 390: 844, 430: 932, 768: 1024, 1024: 768, 1440: 900 };

for (const width of WIDTHS) {
  for (const orientation of ["portrait", "landscape"] as const) {
    const [w, h] = orientation === "portrait" ? [width, HEIGHTS[width]] : [HEIGHTS[width], width];
    test(`no horizontal overflow at ${w}×${h} (${orientation} ${width})`, async ({ page }, info) => {
      test.skip(info.project.name !== "phone-390", "Viewport sweep runs once");
      await page.setViewportSize({ width: w, height: h });
      await page.addInitScript(() => localStorage.setItem("cycleline-demo-tour-done", "1"));
      for (const path of ["/", "/demo", "/login", "/news"]) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${path} at ${w}×${h}`).toBeLessThanOrEqual(0);
      }
    });
  }
}

test("the demo map fills the space between header and sheet on a short landscape phone", async ({ page }, info) => {
  test.skip(info.project.name !== "phone-390", "Runs once");
  await page.setViewportSize({ width: 740, height: 360 });
  await page.addInitScript(() => localStorage.setItem("cycleline-demo-tour-done", "1"));
  await page.goto("/demo");
  const map = await page.locator(".studio-map").boundingBox();
  expect(map!.height).toBeGreaterThan(120);
});
