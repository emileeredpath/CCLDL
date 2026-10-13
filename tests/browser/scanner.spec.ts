import { test, expect } from "@playwright/test";
test("Free OCR reads a printed table locally and requires confirmation before filling", async ({
  page,
}) => {
  test.setTimeout(120000);
  const external: string[] = [];
  page.context().on("request", (r) => {
    const u = new URL(r.url());
    if (
      ["http:", "https:"].includes(u.protocol) &&
      !u.hostname.match(/^(127\.0\.0\.1|localhost)$/)
    )
      external.push(r.url());
  });
  await page.goto("http://127.0.0.1:3001");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Add Result", exact: true })
    .click();
  await page.getByRole("combobox", { name: /^Fixture/ }).selectOption("f1");
  // Synthetic printed fixture, not evidence of handwriting accuracy.
  const data = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1600;
    const c = canvas.getContext("2d")!;
    c.fillStyle = "white";
    c.fillRect(0, 0, 1200, 1600);
    c.fillStyle = "black";
    c.font = "32px Arial";
    c.fillText("DEMONSTRATION RESULT SHEET", 100, 60);
    for (const [s, x] of [
      ["GAME", 70],
      ["NAME", 260],
      ["RES", 540],
      ["NAME", 710],
      ["RES", 1000],
    ] as const)
      c.fillText(s, x, 140);
    for (let i = 1; i <= 12; i++) {
      const y = 170 + i * 100;
      c.fillText(String(i), 100, y);
      c.fillText("Home Player", 220, y);
      c.fillText("1", 560, y);
      c.fillText("Away Player", 710, y);
      c.fillText("0", 1020, y);
    }
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "printed-test.png",
      mimeType: "image/png",
      buffer: Buffer.from(data, "base64"),
    });
  await page.getByRole("button", { name: "Scan photo for free" }).click();
  await expect(
    page.getByText("Scan complete. Review the photo and suggestions below."),
  ).toBeVisible({ timeout: 90000 });
  const apply = page.getByRole("button", {
    name: "Fill empty fields with checked suggestions",
  });
  await expect(apply).toBeVisible();
  await expect(apply).toBeDisabled();
  await page
    .getByRole("checkbox", { name: /I checked these suggestions/ })
    .check();
  await apply.click();
  await expect(
    page.getByRole("combobox", { name: /Game winner/ }).first(),
  ).toHaveValue("home");
  await expect(
    page.getByRole("button", { name: "Review result", exact: true }),
  ).toBeDisabled();
  expect(external).toEqual([]);
});
test("Unsupported images fail visibly and leave manual entry available", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:3001");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Add Result", exact: true })
    .click();
  await page.getByRole("combobox", { name: /^Fixture/ }).selectOption("f1");
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "test.heic",
      mimeType: "image/heic",
      buffer: Buffer.from("invalid"),
    });
  await page.getByRole("button", { name: "Scan photo for free" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Choose a JPEG" }),
  ).toContainText("Choose a JPEG");
  await expect(
    page.getByRole("combobox", { name: /Game winner/ }).first(),
  ).toBeEnabled();
});
