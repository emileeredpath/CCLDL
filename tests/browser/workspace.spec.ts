import fs from "node:fs";
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
  await expect(
    page.getByText("Upcoming fixtures", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Archived sheets", { exact: true })).toHaveCount(
    0,
  );
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await nav.getByRole("button", { name: "Add Result", exact: true }).click();
  await page.getByRole("combobox", { name: /^Fixture/ }).selectOption("f1");
  await expect(
    page.getByText("No scanning is needed", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save photograph" }),
  ).toBeDisabled();
  await nav.getByRole("button", { name: "Fixtures", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Fixtures & results" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Season administration" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save fixture" })).toHaveCount(
    0,
  );
  await nav.getByRole("button", { name: "Tables", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Double 1 finishes" }),
  ).toBeVisible();
  await nav.getByRole("button", { name: "More", exact: true }).click();
  await page
    .getByRole("button", { name: "Weekly Overview", exact: true })
    .last()
    .click();
  // One image is the default: tables, awards and this week's results together.
  await expect(
    page.getByRole("heading", { name: "Weekly standings", exact: true }).last(),
  ).toBeVisible();
  const single = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  const one = await single;
  expect(one.suggestedFilename()).toMatch(/CCLDL-weekly-.*-DEMO.png/);
  await one.saveAs("test-results/weekly-one.png");
  const onePng = fs.readFileSync("test-results/weekly-one.png");
  expect(onePng.readUInt32BE(16)).toBe(2160);
  expect(onePng.readUInt32BE(20)).toBeGreaterThanOrEqual(2700);
  await page.getByRole("button", { name: "Three images" }).click();
  // Three share images, each 1080 x 1350 or taller, exported at 2x.
  await expect(
    page.getByRole("heading", { name: "This week's results", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "League table" }).last(),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Cup & player awards", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Most Double 1s", exact: true }).last(),
  ).toBeVisible();
  const items = page.locator(".si-set-item");
  await expect(items).toHaveCount(3);
  for (const [i, name] of ["results", "league", "cup-awards"].entries()) {
    const dl = page.waitForEvent("download");
    await items
      .nth(i)
      .getByRole("button", { name: "Download", exact: true })
      .click();
    const d = await dl;
    expect(d.suggestedFilename()).toMatch(
      new RegExp(`CCLDL-${i + 1}-${name}-.*-DEMO.png`),
    );
    await d.saveAs(`test-results/weekly-${i + 1}.png`);
    const png = fs.readFileSync(`test-results/weekly-${i + 1}.png`);
    expect(png.readUInt32BE(16)).toBe(2160);
    expect(png.readUInt32BE(20)).toBeGreaterThanOrEqual(2700);
    expect(await d.failure()).toBeNull();
  }
  // Browsers without file sharing fall back to downloads and explain why.
  let count = 0;
  page.on("download", () => count++);
  await page.getByRole("button", { name: "Share all 3" }).click();
  await expect(page.getByText(/Sharing isn't available/)).toBeVisible();
  await expect.poll(() => count).toBe(3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
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

for (const width of [375, 390])
  test(`Phone ${width}px fits dashboard, fixtures, result entry and tables`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("http://127.0.0.1:3001");
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    for (const name of ["Home", "Fixtures", "Tables", "Add Result"]) {
      await nav.getByRole("button", { name, exact: true }).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.getByRole("combobox", { name: /^Fixture/ }).selectOption("f1");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/entry-${width}.png`,
      fullPage: true,
    });
  });
