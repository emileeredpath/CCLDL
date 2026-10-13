import { test, expect } from "@playwright/test";
test("Quick manual entry reuses players without copying stats and removes the scanner", async ({
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
      name: "example.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aA8sAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await expect(page.getByRole("button", { name: /Scan photo/ })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Archive photograph" }),
  ).toBeVisible();
  const first = page.getByRole("region", { name: "Game 1", exact: true });
  const second = page.getByRole("region", { name: "Game 2", exact: true });
  await first.getByRole("button", { name: "Pink Arrows", exact: true }).click();
  await expect(
    first.getByRole("button", { name: "Pink Arrows", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await first
    .getByLabel("Pink Arrows player 1", { exact: true })
    .selectOption("demo-pink-1");
  await expect(
    first
      .getByLabel("Pink Arrows player 2", { exact: true })
      .locator('option[value="demo-pink-1"]'),
  ).toHaveJSProperty('disabled', true);
  await first
    .getByLabel("Pink Arrows player 2", { exact: true })
    .selectOption("demo-pink-2");
  await first.locator("summary").first().click();
  await first.getByLabel("Double 1s", { exact: true }).first().fill("2");
  await second
    .getByLabel("Reuse home lineup", { exact: true })
    .selectOption("1");
  await expect(
    second.getByLabel("Pink Arrows player 1", { exact: true }),
  ).toHaveValue("demo-pink-1");
  await expect(
    second.getByLabel("Pink Arrows player 2", { exact: true }),
  ).toHaveValue("demo-pink-2");
  await expect(
    second.getByLabel("Reuse home lineup", { exact: true }),
  ).toBeDisabled();
  await second.locator("summary").first().click();
  await expect(
    second.getByLabel("Double 1s", { exact: true }).first(),
  ).toHaveValue("0");
  await expect(
    second.getByRole("button", { name: "Pink Arrows", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    second.getByLabel("City Belles player 1", { exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "Review result", exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await first
    .getByLabel("Pink Arrows player 1", { exact: true })
    .selectOption("demo-pink-3");
  await expect(
    first.getByLabel("Double 1s", { exact: true }).first(),
  ).toHaveValue("0");
  await first.getByRole("button", { name: "Clear winner" }).click();
  await expect(
    first.getByRole("button", { name: "Pink Arrows", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});
test("All 12 manually completed games reach review with the right total", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:3001");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Add Result", exact: true })
    .click();
  await page.getByRole("combobox", { name: /^Fixture/ }).selectOption("f1");
  for (let n = 1; n <= 12; n++) {
    const game = page.getByRole("region", { name: `Game ${n}`, exact: true });
    await game
      .getByRole("button", {
        name: n % 2 ? "Pink Arrows" : "City Belles",
        exact: true,
      })
      .click();
    for (const [team, id] of [
      ["Pink Arrows", "pink"],
      ["City Belles", "city"],
    ]) {
      const selects = game.getByRole("combobox", {
        name: new RegExp(`^${team} player`),
      });
      for (let i = 0; i < (await selects.count()); i++)
        await selects.nth(i).selectOption(`demo-${id}-${i + 1}`);
    }
  }
  await expect(page.getByText(/12 of 12 games complete/)).toBeVisible();
  await page
    .getByRole("button", { name: "Review result", exact: true })
    .click();
  await expect(page.getByText(/Home 6 – Away 6/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approve & save result" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Make corrections" }).click();
  await expect(
    page
      .getByRole("region", { name: "Game 1", exact: true })
      .getByLabel("Pink Arrows player 1", { exact: true }),
  ).toHaveValue("demo-pink-1");
});
