import { test, expect } from '@playwright/test';

// Reproduction: guest "Bob" opens /contact-with-chat and tries to talk.
// We observe the initial balance and whether the "buy tokens" block appears
// on the very first send.
test('guest Bob tries to chat on /contact-with-chat', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('/contact-with-chat', { waitUntil: 'networkidle' });

  // The widget may render as a collapsed dock launcher — open it if so.
  const dockToggle = page.getByTestId('meinchat-widget-dock-toggle');
  if (await dockToggle.first().isVisible().catch(() => false)) {
    await dockToggle.first().click();
  }

  const widget = page.getByTestId('meinchat-chat-widget');
  await expect(widget).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: 'test-results/contact-chat-01-loaded.png', fullPage: true });

  // Pre-start: enter name "Bob" and start.
  const nameInput = page.getByTestId('meinchat-widget-name-input');
  await expect(nameInput).toBeVisible({ timeout: 10000 });
  await nameInput.fill('Bob');
  await page.getByTestId('meinchat-widget-start').click();

  // Chat pane.
  await expect(page.getByTestId('meinchat-widget-room')).toBeVisible({ timeout: 15000 });

  const balanceEl = page.getByTestId('meinchat-widget-balance');
  const startBalance = (await balanceEl.isVisible().catch(() => false))
    ? await balanceEl.innerText()
    : '(no balance shown)';
  // eslint-disable-next-line no-console
  console.log('START BALANCE:', startBalance);
  await page.screenshot({ path: 'test-results/contact-chat-02-started.png', fullPage: true });

  const buyTokens = page.getByTestId('meinchat-widget-buy-tokens');

  // Try to send a few messages, recording balance + buy-tokens visibility each time.
  for (let i = 1; i <= 3; i++) {
    const composer = page.getByTestId('composer-input');
    if (!(await composer.isVisible().catch(() => false))) {
      // eslint-disable-next-line no-console
      console.log(`SEND ${i}: composer not visible (chat closed?)`);
      break;
    }
    await composer.fill(`Hello, this is Bob — message ${i}`);
    await page.getByTestId('composer-send').click();

    // Give the send round-trip / 402 a moment to resolve.
    await page.waitForTimeout(1500);

    const buyVisible = await buyTokens.isVisible().catch(() => false);
    const balanceNow = (await balanceEl.isVisible().catch(() => false))
      ? await balanceEl.innerText()
      : '(none)';
    // eslint-disable-next-line no-console
    console.log(`SEND ${i}: balance=${balanceNow} buyTokensShown=${buyVisible}`);
    await page.screenshot({ path: `test-results/contact-chat-03-send-${i}.png`, fullPage: true });

    if (buyVisible) {
      // eslint-disable-next-line no-console
      console.log(`>>> "buy tokens" block appeared after send ${i}`);
      break;
    }
  }

  // eslint-disable-next-line no-console
  console.log('CONSOLE ERRORS:', JSON.stringify(consoleErrors, null, 2));
});
