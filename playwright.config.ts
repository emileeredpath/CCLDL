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
      command:
        "NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= NEXT_PUBLIC_DEMO_MODE=false CCLDL_DIST_DIR=.next-test npm run build && CCLDL_DIST_DIR=.next-test npm start -- --port 3000",
      url: "http://127.0.0.1:3000",
      reuseExistingServer: false,
    },
    {
      command:
        "NEXT_PUBLIC_DEMO_MODE=true CCLDL_DIST_DIR=.next-demo npm run build && CCLDL_DIST_DIR=.next-demo npm start -- --port 3001",
      url: "http://127.0.0.1:3001",
      reuseExistingServer: false,
    },
  ],
  workers: 1,
});
