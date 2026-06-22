import { defineConfig } from "@playwright/test";
// One DSD vNext — e2e config. Boots the built app and runs browser checks.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: { baseURL: "http://127.0.0.1:8787" },
  webServer: {
    command: "PORT=8787 node dist/server.js",
    url: "http://127.0.0.1:8787/healthz",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
