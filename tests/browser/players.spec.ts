import { test, expect } from "@playwright/test";
test("Team rosters and optional CSV review show duplicates and editable issues", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("http://127.0.0.1:3001");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "More", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Teams & players", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Players by team" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Fixtures", exact: true })
    .click();
  await page.getByLabel("Find a team or player").fill("Pink Player 1");
  await expect(
    page.getByRole("list", { name: "Pink Arrows roster" }),
  ).toContainText("Pink Player 1");
  await expect(
    page.getByRole("list", { name: "Pink Arrows roster" }),
  ).not.toContainText("Pink Player 2");
  await page.getByLabel("Player CSV file").setInputFiles({
    name: "players.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "name,team,notes\nPink Player 1,Pink Arrows,\nJane,Wrong team,Confirm spelling\nJane,Pink Arrows,",
    ),
  });
  const section = page.getByRole("region", { name: "Import players" });
  await expect(section).toContainText("1 new players");
  await expect(section).toContainText("1 duplicates skipped");
  await expect(section).toContainText("Choose an existing team");
  await section.getByLabel("Row 2 team").selectOption("Pink Arrows");
  await expect(section).toContainText("2 duplicates skipped");
  await section.getByLabel("Row 2 player name").fill("Janet");
  await expect(section).toContainText("2 new players");
  await section.getByRole("checkbox").check();
  await expect(
    section.getByRole("button", { name: "Import 2 players" }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/players-phone.png",
    fullPage: true,
  });
  await section.getByRole("button", { name: "Cancel import" }).click();
  await expect(section.getByLabel("Row 2 player name")).toHaveCount(0);
});
test("Typing a name needs explicit selection and filters by team", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:3001");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Add Result", exact: true })
    .click();
  await page.getByRole("combobox", { name: /^Fixture/ }).selectOption("f1");
  const game = page.getByRole("region", { name: "Game 1", exact: true });
  const input = game.getByRole("combobox", {
    name: "Pink Arrows player 1",
    exact: true,
  });
  await input.fill("Pink Player 3");
  await expect(
    game.getByRole("option", { name: "Pink Player 3" }),
  ).toBeVisible();
  await input.press("Enter");
  await expect(input).toHaveValue("Pink Player 3");
  await input.fill("Not Registered");
  await expect(game).toContainText("No matching players");
  await expect(
    page.getByRole("button", { name: "Review result", exact: true }),
  ).toBeDisabled();
  await input.fill("City Player");
  await expect(game.getByRole("option")).toHaveCount(0);
});
