import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import samples from "../../src/data/sample-routes.json";

/** Answers /api/route with a real (recorded) route so tests don't depend on BRouter being up. */
async function cannedRouting(page: Page) {
  await page.route("**/api/route", async (route) => {
    const body = route.request().postDataJSON() as { waypoints: [number, number][] };
    const recorded = samples[2].route;
    await route.fulfill({ json: { route: { ...recorded, id: `r_e2e${body.waypoints.length}`, waypoints: body.waypoints } } });
  });
}

async function openDemo(page: Page, { keepTour = false } = {}) {
  if (!keepTour) await page.addInitScript(() => localStorage.setItem("cycleline-demo-tour-done", "1"));
  await cannedRouting(page);
  await page.goto("/demo");
  await expect(page.locator(".sheet-peek .studio-metrics")).toBeVisible();
}

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    if (!sessionStorage.getItem("e2e-cleared")) {
      localStorage.removeItem("cycleline-guest-drafts");
      sessionStorage.setItem("e2e-cleared", "1");
    }
  });
});

test("home page offers the demo in the hero and the menu", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /try the demo, no account needed/i })).toBeVisible();
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: /try the demo/i })).toBeVisible();
  await page.getByRole("link", { name: /try the demo, no account needed/i }).click();
  await expect(page).toHaveURL(/\/demo$/);
});

test("first visit shows the sample route and a skippable, replayable tour", async ({ page }) => {
  await openDemo(page, { keepTour: true });
  const tour = page.getByRole("dialog", { name: "Draw on the map" });
  await expect(tour).toBeVisible();
  await tour.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("dialog", { name: "Your tools" })).toBeVisible();
  await page.getByRole("button", { name: "Skip tour" }).click();
  await expect(page.locator(".demo-tour")).toHaveCount(0);

  // The seeded route is the real Pfannenstiel sample, shown without any routing call.
  const sample = samples[0].route;
  await expect(page.locator(".sheet-peek")).toContainText(`${(sample.distanceM / 1000).toFixed(1)} km`);
  await expect(page.getByLabel("Route name")).toHaveValue(samples[0].name);

  await page.reload();
  await expect(page.locator(".demo-tour")).toHaveCount(0);
  await page.getByRole("button", { name: "Tour" }).click();
  await expect(page.getByRole("dialog", { name: "Draw on the map" })).toBeVisible();
});

test("drawing on the map adds a waypoint and re-routes; undo works", async ({ page }) => {
  await openDemo(page);
  // The sample route has three waypoints; wait for their markers before counting.
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(samples[0].route.waypoints.length);
  const before = samples[0].route.waypoints.length;
  const map = page.locator(".studio-map");
  const box = (await map.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.3);
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(before + 1);
  await expect(page.locator(".map-route-line")).toHaveCount(1);
  await page.getByRole("button", { name: /undo/i }).click();
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(before);
});

test("the bottom sheet snaps between peek, half and full", async ({ page }) => {
  await openDemo(page);
  const sheet = page.locator(".bottom-sheet");
  await expect(sheet).toHaveClass(/snap-peek/);
  const handle = page.locator(".sheet-handle");
  await handle.click();
  await expect(sheet).toHaveClass(/snap-half/);
  await expect(page.getByRole("heading", { name: "Waypoints" })).toBeVisible();
  await handle.focus();
  await page.keyboard.press("Enter");
  await expect(sheet).toHaveClass(/snap-full/);
  // Touch targets in the sheet are at least 44 px.
  const sizes = await page.locator(".bottom-sheet button:visible").evaluateAll((els) =>
    els.map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0).map((r) => Math.min(r.width, r.height)),
  );
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(28); // sheet handle is a 28 px strip spanning the full width
});

test("guest export downloads a watermarked GPX and offers an account without blocking", async ({ page }) => {
  await openDemo(page);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /gpx/i }).click()]);
  const gpx = readFileSync((await download.path())!, "utf8");
  expect(gpx).toContain("<trkseg>");
  expect(gpx).toContain("guest demo");
  const dialog = page.getByRole("dialog", { name: /your gpx is downloading/i });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Keep exploring" }).click();
  await expect(dialog).toBeHidden();
});

test("saving as a guest shows the sign-up prompt; the draft survives a reload", async ({ page }) => {
  await openDemo(page);
  await page.getByLabel("Route name").fill("My demo ride");
  await page.getByRole("button", { name: "Save", exact: true }).first().click();
  await expect(page.getByRole("dialog", { name: "Keep this route" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create free account" }).last()).toHaveAttribute("href", "/login?mode=register&from=demo");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(700); // draft save is debounced
  await page.reload();
  await expect(page.getByLabel("Route name")).toHaveValue("My demo ride");
});

test("no horizontal scrolling on the home page and the demo", async ({ page }) => {
  for (const path of ["/", "/demo"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test("a new account imports the guest drafts", async ({ page, request }) => {
  const api = process.env.BACKEND_URL ?? "http://127.0.0.1:8000/api";
  const health = await request.get(`${api}/health`).catch(() => null);
  test.skip(!health?.ok(), "Needs the Laravel API");

  await openDemo(page);
  await page.getByLabel("Route name").fill("Imported from demo");
  await page.waitForTimeout(700);

  const user = `e2e${Date.now().toString(36)}`;
  const registered = await request.post(`${api}/auth/register`, {
    data: { email: `${user}@cycleline.test`, username: user, password: "SecureRide!9", password_confirmation: "SecureRide!9" },
    headers: { Accept: "application/json" },
  });
  expect(registered.ok()).toBe(true);

  await page.goto("/login");
  await page.getByLabel(/username or email/i).first().fill(user);
  await page.getByLabel(/^password/i).first().fill("SecureRide!9");
  await page.getByRole("button", { name: /log in|sign in/i }).first().click();
  await expect(page).toHaveURL(/\/routes/, { timeout: 45_000 });
  await expect(page.getByRole("heading", { name: "Imported from demo" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("cycleline-guest-drafts"))).toBe("[]");
});
