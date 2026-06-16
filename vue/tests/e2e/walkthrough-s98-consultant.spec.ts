import { test, expect } from '@playwright/test';

// S98 — bot-meinchat-llm consultant: frontend walkthrough (real meinchat widget).
// A guest opens the bot-widget, claims the consultant with /consultant, asks a
// question, and gets the consultant's reply (served by the deterministic stub
// LLM connection seeded by CI → distinctive "[E2E-STUB]" marker).
//
// Requires (seeded by e2e.yml): the bot-meinchat-llm plugin enabled, a default
// LlmConnection pointing at the stub server, and a CMS page hosting the meinchat
// bot-widget at WIDGET_PATH.

const WIDGET_PATH = process.env.WIDGET_PATH || '/contact-with-chat';

test('S98 — guest consults the bot-meinchat-llm consultant in the widget', async ({ page }) => {
  await page.goto(WIDGET_PATH, { waitUntil: 'networkidle' });

  // Open the dock launcher if the widget renders collapsed.
  const dockToggle = page.getByTestId('meinchat-widget-dock-toggle');
  if (await dockToggle.first().isVisible().catch(() => false)) {
    await dockToggle.first().click();
  }

  await expect(page.getByTestId('meinchat-chat-widget')).toBeVisible({ timeout: 20000 });

  // Start as a public guest.
  const nameInput = page.getByTestId('meinchat-widget-name-input');
  await expect(nameInput).toBeVisible({ timeout: 15000 });
  await nameInput.fill('E2E Guest');
  await page.getByTestId('meinchat-widget-start').click();
  await expect(page.getByTestId('meinchat-widget-room')).toBeVisible({ timeout: 20000 });

  const composer = page.getByTestId('composer-input');
  const send = page.getByTestId('composer-send');
  const messages = page.getByTestId('meinchat-widget-messages');

  // Claim the consultant, then ask a question.
  await composer.fill('/consultant');
  await send.click();
  await page.waitForTimeout(1500);

  await composer.fill('I run a small team and want an AI chat assistant. What do you recommend?');
  await send.click();

  // The consultant's reply (via the stub LLM) carries the distinctive marker.
  await expect(messages.getByText('[E2E-STUB]', { exact: false })).toBeVisible({ timeout: 30000 });
  await expect(messages.getByText(/recommend/i).first()).toBeVisible();

  await page.screenshot({ path: 'test-results/s98-consultant-walkthrough.png', fullPage: true });
});
