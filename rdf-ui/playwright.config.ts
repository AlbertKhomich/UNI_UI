import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ?? "3000";
const baseURL = `http://127.0.0.1:${PORT}`;

const config = defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  expect: {
    timeout: 7_000,
  },
  retries: 0,
  use: {
    baseURL,
    headless: true,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${PORT}`,
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

export default config;
