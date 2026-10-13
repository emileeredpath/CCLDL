import { test, expect } from "@playwright/test";
test("Unconfigured production fails closed without showing league records", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:3000");
  await expect(
    page.getByRole("heading", { name: "Committee sign in" }),
  ).toBeVisible();
  await expect(
    page.getByText("Supabase has not been configured.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("Rose & Crown")).toHaveCount(0);
});
test("Mobile demo navigation, tables, manual review warning and PNG download", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:3001");
  await expect(
    page.getByRole("heading", { name: "Welcome to your league" }),
  ).toBeVisible();
  await expect(
    page.getByText("Demonstration workspace", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await nav.getByRole("button", { name: "Add Result", exact: true }).click();
  await page.getByRole("combobox", { name: /^Fixture/ }).selectOption("f1");
  await expect(
    page.getByText("No scanning is needed", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Archive photograph" }),
  ).toBeDisabled();
  await nav.getByRole("button", { name: "Fixtures", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Fixtures & results" }),
  ).toBeVisible();
  await nav.getByRole("button", { name: "Stats", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Most Double 1 finishes" }),
  ).toBeVisible();
  await nav.getByRole("button", { name: "More", exact: true }).click();
  await page
    .getByRole("button", { name: "Weekly Overview", exact: true })
    .last()
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG" }).click();
  const d = await download;
  expect(d.suggestedFilename()).toMatch(/CCLDL-.*-DEMO.png/);
  expect(await d.failure()).toBeNull();
  expect(errors).toEqual([]);
});
test("Desktop dashboard and PWA assets", async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("http://127.0.0.1:3001");
  await expect(
    page.getByRole("heading", { name: "Welcome to your league" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  const manifest = await request.get(
    "http://127.0.0.1:3000/manifest.webmanifest",
  );
  expect(manifest.ok()).toBe(true);
  expect((await manifest.json()).short_name).toBe("CCLDL");
  expect((await request.get("http://127.0.0.1:3000/icon-512.png")).ok()).toBe(
    true,
  );
  expect((await request.get("http://127.0.0.1:3000/sw.js")).ok()).toBe(true);
});
