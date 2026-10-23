import { defineConfig } from "@playwright/test";
import { existsSync } from "fs";

// E2E runs against a production build on its own SQLite file, reset and
// re-seeded before every run (see tests/e2e/global-setup.ts).
const PORT = 3100;
const env = { DATABASE_URL: "file:./e2e.db", NEXTAUTH_URL: `http://localhost:${PORT}`, NEXTAUTH_SECRET: "e2e-secret" };
const preinstalled = "/opt/pw-browsers/chromium";

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: existsSync(preinstalled) ? { executablePath: preinstalled } : {},
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    port: PORT,
    reuseExistingServer: false,
    env,
    timeout: 120_000,
  },
});
