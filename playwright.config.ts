import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: [
    ["list"],
    ["html", { outputFolder: "logs/playwright-report", open: "never" }],
  ],
  outputDir: "logs/test-results",
  use: {
    baseURL: process.env.TEST_BASE_URL || "http://127.0.0.1:3001",
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      executablePath:
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
