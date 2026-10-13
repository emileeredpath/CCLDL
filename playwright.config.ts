import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  use: {
    browserName: "chromium",
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
    viewport: { width: 390, height: 844 },
  },
  webServer: [
    {
      command: "npm start -- --port 3000",
      url: "http://127.0.0.1:3000",
      reuseExistingServer: !process.env.CI,
    },
    {
      command:
        "NEXT_PUBLIC_DEMO_MODE=true CCLDL_DIST_DIR=.next-demo npm run build && CCLDL_DIST_DIR=.next-demo npm start -- --port 3001",
      url: "http://127.0.0.1:3001",
      reuseExistingServer: !process.env.CI,
    },
  ],
  workers: 1,
});
