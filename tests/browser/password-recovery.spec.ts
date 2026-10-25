import { test, expect } from "@playwright/test";

test("Password recovery requests a PKCE email, verifies the link and saves matching passwords", async ({ page }) => {
  let requested = false;
  let saved = false;
  const user = { id: "00000000-0000-0000-0000-000000000001", aud: "authenticated", email: "member@example.test", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  const jwt = [Buffer.from('{}').toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url'), 'signature'].join('.');
  await page.route('https://league-test.invalid/**', async route => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (body: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname.endsWith('/recover')) {
      expect(url.searchParams.get('redirect_to')).toBe('http://127.0.0.1:3002/reset-password');
      expect(req.postDataJSON().email).toBe('member@example.test');
      expect(req.postDataJSON().code_challenge).toBeTruthy();
      requested = true;
      return json({});
    }
    if (url.pathname.endsWith('/token')) {
      expect(req.postDataJSON().auth_code).toBe('test-recovery-code');
      expect(req.postDataJSON().code_verifier).toBeTruthy();
      return json({ access_token: jwt, refresh_token: 'test-refresh', expires_in: 3600, token_type: 'bearer', user });
    }
    if (url.pathname.endsWith('/user')) {
      if (req.method() === 'PUT') {
        expect(req.postDataJSON().password).toBe('new-test-password');
        saved = true;
      }
      return json(user);
    }
    if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204 });
    return json([]);
  });
  await page.goto('http://127.0.0.1:3002/forgot-password');
  await page.getByLabel('Email address').fill('member@example.test');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('status')).toContainText('Check your inbox');
  expect(requested).toBe(true);
  await page.goto('http://127.0.0.1:3002/reset-password?code=test-recovery-code');
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
  await expect(page).toHaveURL('http://127.0.0.1:3002/reset-password');
  await page.getByLabel('New password', { exact: true }).fill('new-test-password');
  await page.getByLabel('Confirm new password').fill('different-password');
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page.getByRole('status')).toContainText('don’t match');
  expect(saved).toBe(false);
  await page.getByLabel('Confirm new password').fill('new-test-password');
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page.getByRole('status')).toContainText('Your password has been changed');
  expect(saved).toBe(true);
});

test('Missing and expired recovery links do not expose the password form', async ({ page }) => {
  for (const suffix of ['', '?error=access_denied&error_description=expired']) {
    await page.goto(`http://127.0.0.1:3002/reset-password${suffix}`);
    await expect(page.getByRole('status')).toContainText('missing, expired or already used');
    await expect(page.getByRole('button', { name: 'Save new password' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Request a new reset link' })).toBeVisible();
  }
});
