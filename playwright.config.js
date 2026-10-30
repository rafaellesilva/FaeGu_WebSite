import { defineConfig, devices } from "@playwright/test";
import { BASE_URL } from "./tests/e2e/config.js";

// Testes end-to-end: "npm run test:e2e". Sobem o site com um banco de teste separado (tests/e2e/server.mjs).
export default defineConfig({
  testDir: "tests/e2e",
  // Um teste por vez: todos usam o mesmo servidor e o mesmo banco de teste.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "tests/e2e/report" }]],
  outputDir: "tests/e2e/results",
  globalTeardown: "./tests/e2e/teardown.js",
  use: {
    baseURL: BASE_URL,
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node tests/e2e/server.mjs",
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
