import { defineConfig, devices } from "@playwright/test";

/**
 * Guest demo e2e on phone viewports. Runs against E2E_BASE_URL (default: a local dev server on 3300,
 * started if it isn't running). The sign-up/import test also needs the Laravel API (BACKEND_URL).
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3300";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 2,
  reporter: [["list"]],
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "phone-360", use: { ...devices["Galaxy S9+"], viewport: { width: 360, height: 740 } } },
    { name: "phone-390", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npx next dev --turbopack -p 3300", url: `${baseURL}/login`, reuseExistingServer: true, timeout: 120_000 },
});
