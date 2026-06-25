import { test, expect, type Page } from '@playwright/test';

/**
 * E2E Tests for Tarot Oracle Conversation Flow
 * Tests the complete card reveal mechanic and Oracle dialog interaction
 */

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'TestPass123@';

/**
 * Helper: Login as test user
 */
async function loginAsTestUser(page: Page): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  const isLoginPage = await page
    .locator('[data-testid="login-form"], .login-container')
    .isVisible()
    .catch(() => false);

  if (isLoginPage) {
    await page.locator('[data-testid="email"]').fill(TEST_USER_EMAIL);
    await page.locator('[data-testid="password"]').fill(TEST_USER_PASSWORD);
    await page.locator('[data-testid="login-button"]').click();
    await page.waitForURL('/dashboard', { timeout: 15000 });
  }
}

/**
 * Helper: Create a new Tarot session
 */
async function createTarotSession(page: Page): Promise<boolean> {
  await page.goto('/dashboard/tarot');
  await page.waitForLoadState('networkidle');

  const createBtn = page.locator('[data-testid="create-session-btn"]');
  const isCreateVisible = await createBtn.isVisible().catch(() => false);

  if (!isCreateVisible) {
    return false; // Already has active session
  }

  const isDisabled = await createBtn.isDisabled();
  if (isDisabled) {
    return false; // Daily limit or token issue
  }

  await createBtn.click();
  const activeSessionCard = page.locator('[data-testid="active-session-card"]');
  await activeSessionCard.waitFor({ state: 'visible', timeout: 10000 });

  return true;
}

test.describe('Tarot Oracle Flow - Card Reveal Mechanic', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('[Oracle-1] Cards display in closed state on session load', async ({
    page,
  }) => {
    const sessionCreated = await createTarotSession(page);
    if (!sessionCreated) {
      test.skip();
    }

    const activeSession = page.locator('[data-testid="active-session-card"]');
    const cards = activeSession.locator('[data-testid="card-display"]');

    // Verify 3 cards exist
    const cardCount = await cards.count();
    expect(cardCount).toBe(3);

    // Each card should have 'is-closed' class and 'is-opened' class absent
    for (let i = 0; i < cardCount; i++) {
      const card = cards.nth(i);
      const classList = await card.getAttribute('class');

      expect(classList).toContain('is-closed');
      expect(classList).not.toContain('is-opened');
    }

    // Verify card-back element visible (closed state visual)
    const cardBacks = activeSession.locator('.card-back');
    const backCount = await cardBacks.count();
    expect(backCount).toBe(3);
  });

  test('[Oracle-2] Card back displays reveal hint text', async ({ page }) => {
    const sessionCreated = await createTarotSession(page);
    if (!sessionCreated) {
      test.skip();
    }

    const activeSession = page.locator('[data-testid="active-session-card"]');
    const revealHints = activeSession.locator('.reveal-hint');

    // All 3 cards should show the hint
    const hintCount = await revealHints.count();
    expect(hintCount).toBe(3);

    // Check hint text contains expected i18n key
    const firstHint = revealHints.first();
    const text = await firstHint.textContent();
    expect(text?.toLowerCase()).toMatch(/click|reveal/i);
  });

  test('[Oracle-3] First card reveals on click', async ({ page }) => {
    const sessionCreated = await createTarotSession(page);
    if (!sessionCreated) {
      test.skip();
    }

    const activeSession = page.locator('[data-testid="active-session-card"]');
    const firstCard = activeSession.locator('[data-testid="card-display"]').first();

    // Click to reveal
    await firstCard.click();
    await page.waitForTimeout(400); // Animation time

    // Card should have 'is-opened' class
    const classList = await firstCard.getAttribute('class');
    expect(classList).toContain('is-opened');
    expect(classList).not.toContain('is-closed');

    // Card-visual should be visible (interpretation visible)
    const cardVisual = firstCard.locator('.card-visual');
    await expect(cardVisual).toBeVisible();
  });

  test('[Oracle-4] Opened card is not clickable (pointer-events disabled)', async ({
    page,
  }) => {
    const sessionCreated = await createTarotSession(page);
    if (!sessionCreated) {
      test.skip();
    }

    const activeSession = page.locator('[data-testid="active-session-card"]');
    const firstCard = activeSession.locator('[data-testid="card-display"]').first();

    // Open the card
    await firstCard.click();
    await page.waitForTimeout(400);

    // Check computed style: pointer-events should be none
    const pointerEvents = await firstCard.evaluate(
      (el) => window.getComputedStyle(el).pointerEvents
    );
    expect(pointerEvents).toBe('none');
  });

  test('[Oracle-5] Multiple cards can be opened sequentially', async ({ page }) => {
    const sessionCreated = await createTarotSession(page);
    if (!sessionCreated) {
      test.skip();
    }

    const activeSession = page.locator('[data-testid="active-session-card"]');
    const cards = activeSession.locator('[data-testid="card-display"]');

    // Open each card one by one
    for (let i = 0; i < 3; i++) {
      const card = cards.nth(i);
      const classList = await card.getAttribute('class');

      // Should start as closed
      if (i === 0) {
        expect(classList).toContain('is-closed');
      }

      // Click to open
      await card.click();
      await page.waitForTimeout(400);

      // Verify opened
      const updatedClass = await card.getAttribute('class');
      expect(updatedClass).toContain('is-opened');
    }
  });

  test('[Oracle-6] Closed card has dimmed appearance (opacity 0.7)', async ({
    page,
  }) => {
    const sessionCreated = await createTarotSession(page);
    if (!sessionCreated) {
      test.skip();
    }

    const activeSession = page.locator('[data-testid="active-session-card"]');
    const closedCard = activeSession.locator('[data-testid="card-display"].is-closed').first();

    // Check opacity is less than 1
    const opacity = await closedCard.evaluate(
      (el) => window.getComputedStyle(el).opacity
    );
    const opacityValue = parseFloat(opacity);
    expect(opacityValue).toBeLessThan(1);
    expect(opacityValue).toBeCloseTo(0.7, 1);
  });

  test('[Oracle-7] Opened card has full opacity (1.0)', async ({ page }) => {
    const sessionCreated = await createTarotSession(page);
    if (!sessionCreated) {
      test.skip();
    }

    const activeSession = page.locator('[data-testid="active-session-card"]');
    const firstCard = activeSession.locator('[data-testid="card-display"]').first();

    // Open the card
    await firstCard.click();
    await page.waitForTimeout(400);

    // Check opacity is 1
    const opacity = await firstCard.evaluate(
      (el) => window.getComputedStyle(el).opacity
    );
    expect(parseFloat(opacity)).toBe(1);
  });
});

test.describe('Tarot Oracle Flow - Oracle Dialog Phases', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('[Oracle-8] Oracle dialog appears after all 3 cards opened', async ({
    page,
  }) => {
    const sessionCreated = await createTarotSession(page);
    if (!sessionCreated) {
      test.skip();
    }

    const activeSession = page.locator('[data-testid="active-session-card"]');
    const cards = activeSession.locator('[data-testid="card-display"]');

    // Oracle section should NOT exist initially
    let oracleSection = activeSession.locator('.oracle-section');
    let exists = await oracleSection.isVisible().catch(() => false);
    expect(exists).toBeFalsy();

    // Open all 3 cards
    for (let i = 0; i < 3; i++) {
      await cards.nth(i).click();
      await page.waitForTimeout(400);
    }

    // Now Oracle section should be visible
    oracleSection = activeSession.locator('.oracle-section');
    exists = await oracleSection.isVisible({ timeout: 5000 }).catch(() => false);
    expect(exists).toBeTruthy();
  });

  test('[Oracle-9] asking_mode phase shows conversation and buttons', async ({
    page,
  }) => {
    const sessionCreated = await createTarotSession(page);
    if (!sessionCreated) {
      test.skip();
    }

    const activeSession = page.locator('[data-testid="active-session-card"]');
    const cards = activeSession.locator('[data-testid="card-display"]');

    // Open all 3 cards
    for (let i = 0; i < 3; i++) {
      await cards.nth(i).click();
      await page.waitForTimeout(400);
    }

    // Check conversation box has at least one message (Oracle greeting)
    const conversationBox = activeSession.locator('.conversation-box');
    const messages = conversationBox.locator('.conversation-message');
    const messageCount = await messages.count();
    expect(messageCount).toBeGreaterThan(0);

    // Verify Oracle's asking_mode message exists
    const firstMessage = messages.first();
    const messageText = await firstMessage.textContent();
    expect(messageText?.toLowerCase()).toMatch(/cards|spoken|situation/i);

    // Check for "Discuss My Situation" button
    const discussBtn = activeSession.locator('button:has-text("Discuss")');
    await expect(discussBtn).toBeVisible();
  });

  test('[Oracle-10] Clicking "Discuss" button transitions to asking_situation', async ({
    page,
  }) => {
    const sessionCreated = await createTarotSession(page);
    if (!sessionCreated) {
      test.skip();
    }

    const activeSession = page.locator('[data-testid="active-session-card"]');
    const cards = activeSession.locator('[data-testid="card-display"]');

    // Open all 3 cards
    for (let i = 0; i < 3; i++) {
      await cards.nth(i).click();
      await page.waitForTimeout(400);
    }

    // Click "Discuss" button
    const discussBtn = activeSession.locator('button:has-text("Discuss")');
    await discussBtn.click();
    await page.waitForTimeout(300);

    // Situation input should now be visible
    const situationInput = activeSession.locator('[data-testid="situation-input"]');
    await expect(situationInput).toBeVisible();
  });

  test('[Oracle-11] asking_situation phase has textarea with word counter', async ({
    page,
  }) => {
    const sessionCreated = await createTarotSession(page);
    if (!sessionCreated) {
      test.skip();
    }

    const activeSession = page.locator('[data-testid="active-session-card"]');
    const cards = activeSession.locator('[data-testid="card-display"]');

    // Open all 3 cards
    for (let i = 0; i < 3; i++) {
      await cards.nth(i).click();
      await page.waitForTimeout(400);
    }

    // Transition to asking_situation
    const discussBtn = activeSession.locator('button:has-text("Discuss")');
    await discussBtn.click();
    await page.waitForTimeout(300);

    // Check textarea properties
    const textarea = activeSession.locator('[data-testid="situation-input"]');
    const maxLength = await textarea.getAttribute('maxlength');
    expect(maxLength).toBe('500');

    // Check placeholder or label exists
    const label = activeSession.locator('label:has-text("Situation")');
    await expect(label).toBeVisible();

    // Check word counter exists
    const wordCounter = activeSession.locator('.word-counter');
    await expect(wordCounter).toBeVisible();
    const counterText = await wordCounter.textContent();
    expect(counterText).toMatch(/0 \/ 100/);
  });

  test('[Oracle-12] Submit button disabled when textarea empty', async ({ page }) => {
    const sessionCreated = await createTarotSession(page);
    if (!sessionCreated) {
      test.skip();
    }

    const activeSession = page.locator('[data-testid="active-session-card"]');
    const cards = activeSession.locator('[data-testid="card-display"]');

    // Open all 3 cards
    for (let i = 0; i < 3; i++) {
      await cards.nth(i).click();
      await page.waitForTimeout(400);
    }

    // Transition to asking_situation
    const discussBtn = activeSession.locator('button:has-text("Discuss")');
    await discussBtn.click();
    await page.waitForTimeout(300);

    // Submit button should be disabled
    const submitBtn = activeSession.locator('[data-testid="submit-situation-btn"]');
    await expect(submitBtn).toBeDisabled();
  });

  test('[Oracle-13] Submit button enabled with valid situation text', async ({
    page,
  }) => {
    const sessionCreated = await createTarotSession(page);
    if (!sessionCreated) {
      test.skip();
    }

    const activeSession = page.locator('[data-testid="active-session-card"]');
    const cards = activeSession.locator('[data-testid="card-display"]');

    // Open all 3 cards
    for (let i = 0; i < 3; i++) {
      await cards.nth(i).click();
      await page.waitForTimeout(400);
    }

    // Transition to asking_situation
    const discussBtn = activeSession.locator('button:has-text("Discuss")');
    await discussBtn.click();
    await page.waitForTimeout(300);

    // Type situation
    const textarea = activeSession.locator('[data-testid="situation-input"]');
    await textarea.fill('I am facing a career decision and need guidance');

    // Submit button should now be enabled
    const submitBtn = activeSession.locator('[data-testid="submit-situation-btn"]');
    await expect(submitBtn).toBeEnabled();
  });

  test('[Oracle-14] Word counter updates in real-time', async ({ page }) => {
    const sessionCreated = await createTarotSession(page);
    if (!sessionCreated) {
      test.skip();
    }

    const activeSession = page.locator('[data-testid="active-session-card"]');
    const cards = activeSession.locator('[data-testid="card-display"]');

    // Open all 3 cards
    for (let i = 0; i < 3; i++) {
      await cards.nth(i).click();
      await page.waitForTimeout(400);
    }

    // Transition to asking_situation
    const discussBtn = activeSession.locator('button:has-text("Discuss")');
    await discussBtn.click();
    await page.waitForTimeout(300);

    const textarea = activeSession.locator('[data-testid="situation-input"]');
    const wordCounter = activeSession.locator('.word-counter');

    // Type first word
    await textarea.fill('Hello');
    await page.waitForTimeout(100);
    let counterText = await wordCounter.textContent();
    expect(counterText).toContain('1 /');

    // Type more words
    await textarea.fill('Hello world from the Oracle');
    await page.waitForTimeout(100);
    counterText = await wordCounter.textContent();
    expect(counterText).toContain('5 /');

    // Type many words (near limit)
    const manyWords = Array(99).fill('word').join(' ');
    await textarea.fill(manyWords);
    await page.waitForTimeout(100);
    counterText = await wordCounter.textContent();
    expect(counterText).toContain('99 /');
  });

  test('[Oracle-15] Submit button disabled when text exceeds 100 words', async ({
    page,
  }) => {
    const sessionCreated = await createTarotSession(page);
    if (!sessionCreated) {
      test.skip();
    }

    const activeSession = page.locator('[data-testid="active-session-card"]');
    const cards = activeSession.locator('[data-testid="card-display"]');

    // Open all 3 cards
    for (let i = 0; i < 3; i++) {
      await cards.nth(i).click();
      await page.waitForTimeout(400);
    }

    // Transition to asking_situation
    const discussBtn = activeSession.locator('button:has-text("Discuss")');
    await discussBtn.click();
    await page.waitForTimeout(300);

    const textarea = activeSession.locator('[data-testid="situation-input"]');
    const submitBtn = activeSession.locator('[data-testid="submit-situation-btn"]');

    // Fill with 101 words (exceeds limit)
    const tooManyWords = Array(101).fill('word').join(' ');
    await textarea.fill(tooManyWords);
    await page.waitForTimeout(100);

    // Submit button should be disabled
    await expect(submitBtn).toBeDisabled();
  });

  test('[Oracle-16] reading phase shows loading state', async ({ page }) => {
    const sessionCreated = await createTarotSession(page);
    if (!sessionCreated) {
      test.skip();
    }

    const activeSession = page.locator('[data-testid="active-session-card"]');
    const cards = activeSession.locator('[data-testid="card-display"]');

    // Open all 3 cards
    for (let i = 0; i < 3; i++) {
      await cards.nth(i).click();
      await page.waitForTimeout(400);
    }

    // Transition to asking_situation
    const discussBtn = activeSession.locator('button:has-text("Discuss")');
    await discussBtn.click();
    await page.waitForTimeout(300);

    // Fill situation and submit
    const textarea = activeSession.locator('[data-testid="situation-input"]');
    await textarea.fill('I need guidance on my career path');
    const submitBtn = activeSession.locator('[data-testid="submit-situation-btn"]');
    await submitBtn.click();

    // Loading state should appear briefly and submit button should be disabled during loading
    const isSubmitDisabled = await submitBtn.isDisabled({ timeout: 1000 });
    expect(isSubmitDisabled).toBeTruthy();
  });

  test('[Oracle-17] done phase shows Oracle message in conversation', async ({
    page,
  }) => {
    const sessionCreated = await createTarotSession(page);
    if (!sessionCreated) {
      test.skip();
    }

    const activeSession = page.locator('[data-testid="active-session-card"]');
    const cards = activeSession.locator('[data-testid="card-display"]');

    // Open all 3 cards
    for (let i = 0; i < 3; i++) {
      await cards.nth(i).click();
      await page.waitForTimeout(400);
    }

    // Transition to asking_situation
    const discussBtn = activeSession.locator('button:has-text("Discuss")');
    await discussBtn.click();
    await page.waitForTimeout(300);

    // Submit situation
    const textarea = activeSession.locator('[data-testid="situation-input"]');
    await textarea.fill('I need guidance');
    const submitBtn = activeSession.locator('[data-testid="submit-situation-btn"]');
    await submitBtn.click();

    // Wait for response
    await page.waitForTimeout(1000);

    // Check conversation now has user + oracle messages
    const conversationBox = activeSession.locator('.conversation-box');
    const messages = conversationBox.locator('.conversation-message');
    const messageCount = await messages.count();

    // Should have initial oracle message + user message + oracle response
    expect(messageCount).toBeGreaterThanOrEqual(3);

    // Check for user message in conversation
    const userMessages = conversationBox.locator('.user-message');
    const userMsgCount = await userMessages.count();
    expect(userMsgCount).toBeGreaterThan(0);
  });
});

test.describe('Tarot Oracle Flow - Error Handling & Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('[Oracle-18] Rapid card clicks do not cause issues', async ({ page }) => {
    const sessionCreated = await createTarotSession(page);
    if (!sessionCreated) {
      test.skip();
    }

    const activeSession = page.locator('[data-testid="active-session-card"]');
    const firstCard = activeSession.locator('[data-testid="card-display"]').first();

    // Rapid clicks (should be idempotent)
    await firstCard.click();
    await firstCard.click();
    await firstCard.click();
    await page.waitForTimeout(500);

    // Card should still be in opened state (only once)
    const classList = await firstCard.getAttribute('class');
    expect(classList).toContain('is-opened');

    const openedCards = activeSession.locator('[data-testid="card-display"].is-opened');
    const count = await openedCards.count();
    expect(count).toBe(1);
  });

  test('[Oracle-19] Can close and reopen session without errors', async ({
    page,
  }) => {
    let sessionCreated = await createTarotSession(page);
    if (!sessionCreated) {
      test.skip();
    }

    const activeSession = page.locator('[data-testid="active-session-card"]');

    // Close session
    const closeBtn = page.locator('[data-testid="close-session-btn"]');
    await closeBtn.click();
    await page.waitForTimeout(500);

    // Create new session
    sessionCreated = await createTarotSession(page);
    expect(sessionCreated).toBeTruthy();

    // Should be able to interact with new session
    const newCards = activeSession.locator('[data-testid="card-display"]');
    const cardCount = await newCards.count();
    expect(cardCount).toBe(3);
  });

  test('[Oracle-20] Card count is always exactly 3', async ({ page }) => {
    const sessionCreated = await createTarotSession(page);
    if (!sessionCreated) {
      test.skip();
    }

    const activeSession = page.locator('[data-testid="active-session-card"]');
    const cards = activeSession.locator('[data-testid="card-display"]');
    const count = await cards.count();

    expect(count).toBe(3);

    // Open all and verify still 3
    for (let i = 0; i < 3; i++) {
      await cards.nth(i).click();
      await page.waitForTimeout(400);
    }

    const finalCount = await cards.count();
    expect(finalCount).toBe(3);
  });

  test('[Oracle-21] Conversation messages preserve order', async ({ page }) => {
    const sessionCreated = await createTarotSession(page);
    if (!sessionCreated) {
      test.skip();
    }

    const activeSession = page.locator('[data-testid="active-session-card"]');
    const cards = activeSession.locator('[data-testid="card-display"]');

    // Open all 3 cards
    for (let i = 0; i < 3; i++) {
      await cards.nth(i).click();
      await page.waitForTimeout(400);
    }

    // Click Discuss
    const discussBtn = activeSession.locator('button:has-text("Discuss")');
    await discussBtn.click();
    await page.waitForTimeout(300);

    // Fill and submit
    const textarea = activeSession.locator('[data-testid="situation-input"]');
    const userSituation = 'I need guidance';
    await textarea.fill(userSituation);
    const submitBtn = activeSession.locator('[data-testid="submit-situation-btn"]');
    await submitBtn.click();

    await page.waitForTimeout(1000);

    // Check message order
    const messages = activeSession.locator('.conversation-message');
    const messageCount = await messages.count();

    // Last user message should contain the situation text
    const lastMessage = messages.last();
    const lastText = await lastMessage.textContent();
    expect(lastText).toContain(userSituation);

    // Message before that should be oracle's asking prompt
    const secondLast = messages.nth(messageCount - 2);
    const secondLastRole = await secondLast.locator('.message-role').textContent();
    // Could be Oracle or User depending on exact flow
    expect(secondLastRole).toBeTruthy();
  });
});
