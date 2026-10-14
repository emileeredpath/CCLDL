import { test, expect } from "@playwright/test";

test("Players and match results survive draft, approval and reload; pending achievements resolve safely", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const user = {
    id: "00000000-0000-0000-0000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: "committee@example.test",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const jwt = [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        sub: user.id,
        aud: "authenticated",
        role: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url"),
    "test-signature",
  ].join(".");
  const players: { id: string; name: string; team_id: string }[] = [];
  const writes: { name: string; team_id: string }[] = [];
  let failNext = false;
  let savedResult: Record<string, unknown> | null = null;
  const sheets: Record<string, unknown>[] = [];
  let photoWrites = 0;
  let approvedPayload: Record<string, unknown> | null = null;
  await page.route("https://league-test.invalid/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname;
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (req.method() === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "*",
        },
      });
    if (path === "/auth/v1/token")
      return json({
        access_token: jwt,
        refresh_token: "mock-refresh-token",
        token_type: "bearer",
        expires_in: 3600,
        user,
      });
    if (path === "/auth/v1/user") return json(user);
    if (path === "/rest/v1/committee_members")
      return json({ role: "administrator" });
    if (path === "/rest/v1/seasons")
      return json([{ id: "season", name: "2026/27" }]);
    if (path === "/rest/v1/teams")
      return json([
        { id: "home", name: "Home Team" },
        { id: "away", name: "Away Team" },
      ]);
    if (path === "/rest/v1/fixtures")
      return json([
        {
          id: "fixture",
          season_id: "season",
          competition: "league",
          played_on: "2026-10-06",
          home_team_id: "home",
          away_team_id: "away",
        },
      ]);
    if (path.startsWith("/storage/v1/object/result-sheets/")) {
      photoWrites++;
      return json({ Key: path.split("/object/")[1] });
    }
    if (path === "/rest/v1/result_sheets") {
      if (req.method() === "POST") {
        const row = {
          ...req.postDataJSON(),
          id: "sheet",
          created_at: new Date().toISOString(),
        };
        sheets.push(row);
        return json(row, 201);
      }
      return json(sheets);
    }
    if (path === "/rest/v1/results") {
      if (url.searchParams.get("limit") === "0") return json([]);
      return json(
        req.headers()["accept"]?.includes("object")
          ? savedResult
          : savedResult
            ? [savedResult]
            : [],
      );
    }
    if (
      path === "/rest/v1/rpc/save_summary_draft" ||
      path === "/rest/v1/rpc/save_summary_result"
    ) {
      const body = req.postDataJSON();
      const approved = path.endsWith("save_summary_result");
      savedResult = {
        id: "result",
        fixture_id: body.p_fixture,
        sheet_id: body.p_sheet,
        status: approved ? "approved" : "draft",
        summary: body.p_summary,
        games: [],
      };
      if (approved) approvedPayload = body;
      return json("result");
    }
    if (path === "/rest/v1/players") {
      if (req.method() === "POST") {
        const body = req.postDataJSON();
        if (failNext) {
          failNext = false;
          return json({ message: "Temporary save failure", code: "TEST" }, 500);
        }
        writes.push(body);
        const saved = { ...body, id: `player-${writes.length}` };
        players.push(saved);
        return json(saved, 201);
      }
      const team = url.searchParams.get("team_id")?.replace("eq.", "");
      return json(players.filter((p) => !team || p.team_id === team));
    }
    return json({ message: `Unexpected mock endpoint ${path}` }, 400);
  });
  await page.goto("http://127.0.0.1:3002");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "Secure sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome to your league" }),
  ).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await nav.getByRole("button", { name: "Add Result", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Fixture", exact: true })
    .selectOption("fixture");
  for (const [kind, n] of [
    ["Pairs", "1"],
    ["Trebles", "1"],
    ["Captains & vice", "1"],
    ["Singles", "4"],
  ])
    await page
      .getByLabel(`Home Team ${kind} wins`, { exact: true })
      .selectOption(n);
  await page
    .getByRole("button", { name: "+ Add player achievement", exact: true })
    .click();
  const name = page.getByRole("combobox", {
    name: "Achievement player 1",
    exact: true,
  });
  await name.fill("New Player");
  await page.getByLabel("Highest score", { exact: true }).fill("140");
  await page.getByLabel("Double 1s", { exact: true }).fill("2");
  const add = page.getByRole("button", {
    name: "Add player to team",
    exact: true,
  });
  await expect(add).toBeDisabled();
  await page
    .getByLabel("Achievement player 1 new team", { exact: true })
    .selectOption("away");
  failNext = true;
  await add.click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Temporary save failure" }),
  ).toBeVisible();
  await expect(name).toHaveValue("New Player");
  await expect(page.getByLabel("Highest score", { exact: true })).toHaveValue(
    "140",
  );
  await add.click();
  await expect(name).toHaveValue("New Player · Away Team");
  await expect(page.getByLabel("Highest score", { exact: true })).toHaveValue(
    "140",
  );
  await expect(page.getByLabel("Double 1s", { exact: true })).toHaveValue("2");
  expect(writes).toEqual([{ name: "New Player", team_id: "away" }]);
  // A fresh lookup must reuse an existing player even when not in the cached roster.
  players.push({ id: "existing", name: "Existing Player", team_id: "home" });
  await page
    .getByRole("button", { name: "+ Add player achievement", exact: true })
    .click();
  const second = page.getByRole("combobox", {
    name: "Achievement player 2",
    exact: true,
  });
  await second.fill(" existing   player ");
  await page.getByLabel("Highest checkout", { exact: true }).nth(1).fill("78");
  await page
    .getByLabel("Achievement player 2 new team", { exact: true })
    .selectOption("home");
  await add.click();
  await expect(second).toHaveValue("Existing Player · Home Team");
  expect(writes).toHaveLength(1);
  await expect(
    page.getByLabel("Highest checkout", { exact: true }).nth(1),
  ).toHaveValue("78");
  await expect(
    page.getByRole("button", { name: "Review result", exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/inline-player-phone.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Draft saved to the league database",
  );
  await nav.getByRole("button", { name: "Fixtures", exact: true }).click();
  await page.getByRole("button", { name: /Home Team vs Away Team/ }).click();
  await expect(
    page.getByRole("heading", { name: "Match summary", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".match-score")).toHaveText("7 – 5");
  await expect(
    page.getByText("Saved draft · not yet included in standings", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Finish & approve result", exact: true })
    .click();
  await expect(
    page.getByLabel("Highest score", { exact: true }).first(),
  ).toHaveValue("140");
  await page.locator('input[type="file"]').setInputFiles({
    name: "sheet.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aA8sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page
    .getByRole("button", { name: "Review result", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Approve & save result", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Saved successfully");
  await expect(
    page.getByText("Saved & approved", { exact: true }),
  ).toBeVisible();
  expect(photoWrites).toBe(1);
  expect(approvedPayload).toMatchObject({
    p_sheet: "sheet",
    p_fixture: "fixture",
    p_summary: {
      counts: { Pairs: 1, Trebles: 1, "Captains & vice": 1, Singles: 4 },
      achievements: [
        {
          player_id: "player-1",
          side: "away",
          double_ones: 2,
          highest_score: 140,
        },
        { player_id: "existing", side: "home", highest_checkout: 78 },
      ],
    },
  });
  await page.reload();
  await nav.getByRole("button", { name: "Fixtures", exact: true }).click();
  await page.getByRole("button", { name: /Home Team vs Away Team/ }).click();
  await expect(
    page.getByText("Saved & approved", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Double 1s: 2 · Highest score: 140 · Checkout: —", {
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/match-summary-phone.png",
    fullPage: true,
  });
  await nav.getByRole("button", { name: "More", exact: true }).click();
  await page
    .getByRole("button", { name: "Teams & players", exact: true })
    .click();
  await page.getByLabel("Find a team or player").fill("New Player");
  await expect(
    page.getByRole("list", { name: "Away Team roster" }),
  ).toContainText("New Player");
  // A transcribed draft with an unidentified achievement stays incomplete until resolved.
  savedResult = {
    ...(savedResult ?? {}),
    status: "draft",
    summary: {
      ...(approvedPayload as any).p_summary,
      pending_achievements: [
        {
          name: "Unconfirmed",
          side: "home",
          double_ones: 1,
          highest_score: null,
          highest_checkout: null,
          note: "Check surname",
        },
      ],
    },
  };
  await page.reload();
  await nav.getByRole("button", { name: "Fixtures", exact: true }).click();
  await page.getByRole("button", { name: /Home Team vs Away Team/ }).click();
  await expect(page.getByText(/Needs checking: Unconfirmed/)).toBeVisible();
  await page
    .getByRole("button", { name: "Finish & approve result", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Review result", exact: true }),
  ).toBeDisabled();
  const pending = page.getByRole("combobox", {
    name: "Resolve Unconfirmed",
    exact: true,
  });
  await pending.fill("Existing Player");
  await pending.press("ArrowDown");
  await pending.press("Enter");
  await expect(
    page.getByRole("combobox", { name: "Resolve Unconfirmed", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Review result", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByLabel("Double 1s", { exact: true }).nth(1),
  ).toHaveValue("1");
  await expect(
    page.getByLabel("Highest checkout", { exact: true }).nth(1),
  ).toHaveValue("78");
});
