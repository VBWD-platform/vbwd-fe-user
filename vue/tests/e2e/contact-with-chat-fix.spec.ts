import { test, expect, APIRequestContext } from '@playwright/test';

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'AdminPass123@';

async function adminToken(request: APIRequestContext): Promise<string> {
  const res = await request.post('/api/v1/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok(), `admin login failed: ${res.status()}`).toBeTruthy();
  const body = await res.json();
  return body.access_token ?? body.token ?? body.data?.access_token;
}

async function setGuestTokens(
  request: APIRequestContext,
  token: string,
  guestUserId: string,
  mode: 'topup' | 'reset',
  amount: number,
) {
  const res = await request.post(`/api/v1/admin/meinchat/guests/${guestUserId}/tokens`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { mode, amount },
  });
  expect(res.ok(), `${mode} failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  return res.json();
}

test('exhausted guest sees "buy tokens", admin top-up restores chat', async ({ page, request }) => {
  await page.goto('/contact-with-chat', { waitUntil: 'networkidle' });
  const dockToggle = page.getByTestId('meinchat-widget-dock-toggle');
  if (await dockToggle.first().isVisible().catch(() => false)) {
    await dockToggle.first().click();
  }

  await page.getByTestId('meinchat-widget-name-input').fill('Bob');
  await page.getByTestId('meinchat-widget-start').click();
  await expect(page.getByTestId('meinchat-widget-room')).toBeVisible({ timeout: 15000 });

  const buyTokens = page.getByTestId('meinchat-widget-buy-tokens');
  const composer = page.getByTestId('composer-input');
  const send = page.getByTestId('composer-send');

  // Sanity: with tokens, the first send works and no buy-tokens block shows.
  await composer.fill('Hi, this is Bob.');
  await send.click();
  await page.waitForTimeout(1200);
  expect(await buyTokens.isVisible().catch(() => false)).toBeFalsy();

  // Find THIS run's Bob via the new admin guests list. The freshly-started Bob
  // has the highest balance (prior runs' Bobs are drained), so max-balance Bob
  // is unambiguously the guest backing this page.
  const token = await adminToken(request);
  const listRes = await request.get('/api/v1/admin/meinchat/guests?per_page=200', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(listRes.ok(), `guests list failed: ${listRes.status()}`).toBeTruthy();
  const list = await listRes.json();
  // Public guests get a generated nickname like `bob-<hash>`. THIS run's guest
  // is the most-recently-seen one (its session row was just touched by start +
  // the sanity send), so sort by last_seen desc and take the newest bob-*.
  type GuestRow = { display_name?: string; last_seen?: string; balance: number; guest_user_id: string };
  const bobs = (list.items || []).filter(
    (row: GuestRow) => (row.display_name || '').toLowerCase().startsWith('bob'),
  );
  expect(bobs.length, 'no bob-* in admin guests list').toBeGreaterThan(0);
  bobs.sort((a: GuestRow, b: GuestRow) => (b.last_seen || '').localeCompare(a.last_seen || ''));
  const guestUserId = bobs[0].guest_user_id;
  // eslint-disable-next-line no-console
  console.log('Bob guest:', bobs[0].display_name, guestUserId, 'balance:', bobs[0].balance);

  // --- Reproduce the user's symptom: drain Bob to 0 via the new admin reset. ---
  await setGuestTokens(request, token, guestUserId, 'reset', 0);
  // eslint-disable-next-line no-console
  console.log('admin reset Bob -> 0 tokens');

  await composer.fill('Anyone there?');
  await send.click();
  await expect(buyTokens).toBeVisible({ timeout: 8000 });
  // eslint-disable-next-line no-console
  console.log('>>> SYMPTOM REPRODUCED: "buy tokens" block appeared at balance 0');
  await page.screenshot({ path: 'test-results/fix-01-buy-tokens.png', fullPage: true });

  // --- Apply the fix: admin tops Bob back up. ---
  await setGuestTokens(request, token, guestUserId, 'topup', 500);
  // eslint-disable-next-line no-console
  console.log('admin top-up Bob +500 tokens');

  // Bob can chat again — the send succeeds and the buy-tokens block clears.
  await composer.fill('Great, I can talk again!');
  await send.click();
  await expect(buyTokens).toBeHidden({ timeout: 8000 });
  const balanceText = await page.getByTestId('meinchat-widget-balance').innerText();
  // eslint-disable-next-line no-console
  console.log('>>> FIX VERIFIED: chat restored, balance now', balanceText);
  await page.screenshot({ path: 'test-results/fix-02-restored.png', fullPage: true });
});
