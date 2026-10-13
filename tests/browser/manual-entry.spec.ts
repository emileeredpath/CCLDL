import { test, expect } from "@playwright/test";
test("Summary entry requires all categories, checks achievements and calculates final score", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("http://127.0.0.1:3001");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Add Result", exact: true })
    .click();
  await page.getByRole("combobox", { name: /^Fixture/ }).selectOption("f1");
  const review = page.getByRole("button", {
    name: "Review result",
    exact: true,
  });
  await expect(review).toBeDisabled();
  for (const [kind, n] of [
    ["Pairs", "2"],
    ["Trebles", "1"],
    ["Captains & vice", "0"],
    ["Singles", "5"],
  ])
    await page
      .getByLabel(`Pink Arrows ${kind} wins`, { exact: true })
      .selectOption(n);
  await expect(page.locator(".score-summary-row.total")).toHaveText(
    "Final score84",
  );
  await expect(review).toBeEnabled();
  await page
    .getByRole("button", { name: "+ Add player achievement", exact: true })
    .click();
  await expect(review).toBeDisabled();
  const input = page.getByRole("combobox", { name: "Achievement player 1" });
  await input.fill("Pink Player 1");
  await input.press("ArrowDown");
  await input.press("Enter");
  await page.getByLabel("Highest score", { exact: true }).fill("181");
  await expect(review).toBeDisabled();
  await page.getByLabel("Highest score", { exact: true }).fill("140");
  await page.getByLabel("Double 1s", { exact: true }).fill("2");
  await review.click();
  await expect(
    page.getByRole("heading", { name: "3. Check your result" }),
  ).toBeVisible();
  await expect(page.getByLabel("Highest score", { exact: true })).toHaveValue(
    "140",
  );
  await expect(
    page.getByRole("button", { name: "Approve & save result" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Make corrections" }).click();
  await expect(input).toHaveValue("Pink Player 1 · Pink Arrows");
  await input.fill("City Player 2");
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(page.getByLabel("Highest score", { exact: true })).toHaveValue(
    "",
  );
  await expect(review).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/summary-phone.png",
    fullPage: true,
  });
});
