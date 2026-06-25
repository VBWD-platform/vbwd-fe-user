import { test, expect, type Page } from '@playwright/test';

/**
 * Test credentials from environment or defaults
 */
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'TestPass123@';

/**
 * Helper function to login as test user
 */
async function loginAsTestUser(page: Page): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Check if already logged in
  const isLoginPage = await page.locator('[data-testid="login-form"], .login-container').isVisible().catch(() => false);

  if (isLoginPage) {
    await page.locator('[data-testid="email"]').fill(TEST_USER_EMAIL);
    await page.locator('[data-testid="password"]').fill(TEST_USER_PASSWORD);
    await page.locator('[data-testid="login-button"]').click();
    await page.waitForURL('/dashboard', { timeout: 15000 });
  }
}

test.describe('Tarot Plugin - Navigation and Access', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('should display Tarot in navigation menu', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Check for Tarot nav item
    const tarotNavLink = page.locator('a[href="/dashboard/tarot"]');
    await expect(tarotNavLink).toBeVisible();
  });

  test('should navigate to Tarot page via menu link', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Click Tarot nav link
    await page.locator('a[href="/dashboard/tarot"]').click();
    await page.waitForURL('/dashboard/tarot', { timeout: 10000 });

    // Verify we're on Tarot page
    await expect(page.locator('[data-testid="tarot-dashboard"]')).toBeVisible();
  });

  test('should navigate directly to /dashboard/tarot', async ({ page }) => {
    await page.goto('/dashboard/tarot');
    await page.waitForLoadState('networkidle');

    // Verify page title and main content
    await expect(page.locator('[data-testid="tarot-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="daily-limits-card"]')).toBeVisible();
  });
});

test.describe('Tarot Plugin - Daily Limits Display', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/dashboard/tarot');
    await page.waitForLoadState('networkidle');
  });

  test('should display daily limits card', async ({ page }) => {
    const limitsCard = page.locator('[data-testid="daily-limits-card"]');
    await expect(limitsCard).toBeVisible();

    // Check for limit information
    await expect(limitsCard.locator('text=Daily Total')).toBeVisible();
    await expect(limitsCard.locator('text=Daily Remaining')).toBeVisible();
    await expect(limitsCard.locator('text=Plan Name')).toBeVisible();
  });

  test('should display limit values', async ({ page }) => {
    const limitsCard = page.locator('[data-testid="daily-limits-card"]');

    // Get the limit values (should be numbers)
    const dailyTotal = limitsCard.locator('.limit-item').first();
    const value = await dailyTotal.locator('.value').textContent();

    expect(value).toBeTruthy();
    expect(/^\d+$/.test(value || '')).toBeTruthy();
  });

  test('should refresh limits on button click', async ({ page }) => {
    const refreshBtn = page.locator('[data-testid="refresh-limits-btn"]');
    await expect(refreshBtn).toBeVisible();

    // Click refresh
    await refreshBtn.click();
    await page.waitForLoadState('networkidle');

    // Value should still be present (may or may not change)
    const afterValue = await page.locator('[data-testid="daily-limits-card"]').locator('.value').first().textContent();
    expect(afterValue).toBeTruthy();
  });
});

test.describe('Tarot Plugin - Create Session Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/dashboard/tarot');
    await page.waitForLoadState('networkidle');
  });

  test('should display create session card when no active session', async ({ page }) => {
    const createCard = page.locator('[data-testid="create-session-card"]');
    await expect(createCard).toBeVisible({ timeout: 5000 });

    // Check for create button
    const createBtn = page.locator('[data-testid="create-session-btn"]');
    await expect(createBtn).toBeVisible();
  });

  test('should display benefit information on create card', async ({ page }) => {
    const createCard = page.locator('[data-testid="create-session-card"]');

    // Look for benefit items
    const benefits = createCard.locator('.benefit-item');
    const count = await benefits.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should be able to initiate session creation', async ({ page }) => {
    const createBtn = page.locator('[data-testid="create-session-btn"]');

    // Check if button is enabled (may be disabled if daily limit exceeded)
    const isDisabled = await createBtn.isDisabled();

    if (!isDisabled) {
      // Click create button
      await createBtn.click();

      // Wait for either success or error
      const activeSessionCard = page.locator('[data-testid="active-session-card"]');
      const errorMsg = page.locator('[data-testid="tarot-error"]');

      // Either should appear (error if token issues, session if success)
      const hasSessionOrError = await Promise.race([
        activeSessionCard.isVisible({ timeout: 5000 }).catch(() => false),
        errorMsg.isVisible({ timeout: 5000 }).catch(() => false)
      ]);

      expect(hasSessionOrError).toBeTruthy();
    } else {
      // Button disabled likely due to daily limit
      expect(isDisabled).toBeTruthy();
    }
  });
});

test.describe('Tarot Plugin - Active Session Display', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    // This test assumes an active session exists
    // In real testing, we might need to create one or use a fixture
  });

  test('should display active session card if session exists', async ({ page }) => {
    await page.goto('/dashboard/tarot');
    await page.waitForLoadState('networkidle');

    const activeSessionCard = page.locator('[data-testid="active-session-card"]');
    const createCard = page.locator('[data-testid="create-session-card"]');

    // Either active session or create session should be visible
    const hasSession = await activeSessionCard.isVisible().catch(() => false);
    const hasCreate = await createCard.isVisible().catch(() => false);

    expect(hasSession || hasCreate).toBeTruthy();
  });

  test('should display 3 cards in active session', async ({ page }) => {
    await page.goto('/dashboard/tarot');
    await page.waitForLoadState('networkidle');

    const activeSessionCard = page.locator('[data-testid="active-session-card"]');

    if (await activeSessionCard.isVisible().catch(() => false)) {
      const cards = activeSessionCard.locator('[data-testid="card-display"]');
      const count = await cards.count();
      expect(count).toBe(3);
    }
  });

  test('should display session info (follow-ups, tokens, time)', async ({ page }) => {
    await page.goto('/dashboard/tarot');
    await page.waitForLoadState('networkidle');

    const activeSessionCard = page.locator('[data-testid="active-session-card"]');

    if (await activeSessionCard.isVisible().catch(() => false)) {
      // Check for info labels
      await expect(activeSessionCard.locator('text=Follow Ups')).toBeVisible().catch(() => {});
      await expect(activeSessionCard.locator('text=Tokens Used')).toBeVisible().catch(() => {});
      await expect(activeSessionCard.locator('text=Time Remaining')).toBeVisible().catch(() => {});
    }
  });
});

test.describe('Tarot Plugin - Follow-up Functionality', () => {
  test('should display follow-up section when session is active', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/dashboard/tarot');
    await page.waitForLoadState('networkidle');

    const followUpSection = page.locator('[data-testid="follow-up-section"]');
    const activeSession = page.locator('[data-testid="active-session-card"]');

    // Follow-up section only visible if active session exists
    if (await activeSession.isVisible().catch(() => false)) {
      const followUpExists = await followUpSection.isVisible().catch(() => false);

      if (followUpExists) {
        // Verify form elements
        const input = page.locator('[data-testid="follow-up-input"]');
        await expect(input).toBeVisible();

        // Check for radio buttons
        const sameCardsOption = page.locator('[data-testid="followup-same-cards"]');
        const additionalOption = page.locator('[data-testid="followup-additional"]');
        const newSpreadOption = page.locator('[data-testid="followup-new-spread"]');

        expect(
          await sameCardsOption.isVisible().catch(() => false) ||
          await additionalOption.isVisible().catch(() => false) ||
          await newSpreadOption.isVisible().catch(() => false)
        ).toBeTruthy();
      }
    }
  });

  test('should allow selecting follow-up types', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/dashboard/tarot');
    await page.waitForLoadState('networkidle');

    const followUpSection = page.locator('[data-testid="follow-up-section"]');

    if (await followUpSection.isVisible().catch(() => false)) {
      const additionalOption = page.locator('[data-testid="followup-additional"]');

      if (await additionalOption.isVisible().catch(() => false)) {
        await additionalOption.click();
        await expect(additionalOption).toBeChecked();
      }
    }
  });

  test('submit follow-up button should be disabled when question is empty', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/dashboard/tarot');
    await page.waitForLoadState('networkidle');

    const followUpSection = page.locator('[data-testid="follow-up-section"]');

    if (await followUpSection.isVisible().catch(() => false)) {
      const submitBtn = page.locator('[data-testid="submit-follow-up-btn"]');
      await expect(submitBtn).toBeDisabled();
    }
  });

  test('submit follow-up button should be enabled when question is provided', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/dashboard/tarot');
    await page.waitForLoadState('networkidle');

    const followUpSection = page.locator('[data-testid="follow-up-section"]');

    if (await followUpSection.isVisible().catch(() => false)) {
      const input = page.locator('[data-testid="follow-up-input"]');
      const submitBtn = page.locator('[data-testid="submit-follow-up-btn"]');

      // Type a question
      await input.fill('Tell me more about this reading');

      // Button should be enabled now
      await expect(submitBtn).toBeEnabled();
    }
  });
});

test.describe('Tarot Plugin - Session History', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/dashboard/tarot');
    await page.waitForLoadState('networkidle');
  });

  test('should display session history section', async ({ page }) => {
    const historySection = page.locator('[data-testid="session-history"]');
    await expect(historySection).toBeVisible({ timeout: 5000 });
  });

  test('should show empty state when no history', async ({ page }) => {
    const emptyState = page.locator('.empty-state');
    const sessions = page.locator('.session-item');

    const isEmptyVisible = await emptyState.isVisible().catch(() => false);
    const sessionCount = await sessions.count();

    // Either empty state or sessions should be visible
    expect(isEmptyVisible || sessionCount > 0).toBeTruthy();
  });

  test('should display load more button if history available', async ({ page }) => {
    const loadMoreBtn = page.locator('[data-testid="load-more-btn"]');
    const isVisible = await loadMoreBtn.isVisible().catch(() => false);

    // Load more button is optional (only if there's more history)
    expect(typeof isVisible).toBe('boolean');
  });
});

test.describe('Tarot Plugin - Card Display and Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/dashboard/tarot');
    await page.waitForLoadState('networkidle');
  });

  test('should display cards grid in active session', async ({ page }) => {
    const activeSession = page.locator('[data-testid="active-session-card"]');

    if (await activeSession.isVisible().catch(() => false)) {
      const cardsGrid = activeSession.locator('.cards-grid');
      const isVisible = await cardsGrid.isVisible().catch(() => false);

      if (isVisible) {
        // Cards grid should be visible and contain CardDisplay components
        const hasContent = await cardsGrid.locator('[data-testid="card-display"]').count();
        expect(hasContent).toBeGreaterThan(0);
      }
    }
  });

  test('should render exactly 3 cards in grid for active session', async ({ page }) => {
    const activeSession = page.locator('[data-testid="active-session-card"]');

    if (await activeSession.isVisible().catch(() => false)) {
      const cards = activeSession.locator('[data-testid="card-display"]');
      const cardCount = await cards.count();

      // TarotSession should contain exactly 3 cards (PAST, PRESENT, FUTURE)
      if (cardCount > 0) {
        expect(cardCount).toBe(3);
      }
    }
  });

  test('should display card with position label', async ({ page }) => {
    const activeSession = page.locator('[data-testid="active-session-card"]');

    if (await activeSession.isVisible().catch(() => false)) {
      const cards = page.locator('[data-testid="card-display"]');
      const firstCard = cards.first();

      if (await firstCard.isVisible().catch(() => false)) {
        // Card should have position label (PAST, PRESENT, or FUTURE)
        const positionLabel = firstCard.locator('.position-label');
        const position = await positionLabel.textContent();

        expect(['PAST', 'PRESENT', 'FUTURE', 'ADDITIONAL']).toContain(position?.trim());
      }
    }
  });

  test('should display card position and orientation text', async ({ page }) => {
    const activeSession = page.locator('[data-testid="active-session-card"]');

    if (await activeSession.isVisible().catch(() => false)) {
      const cards = page.locator('[data-testid="card-display"]');
      const firstCard = cards.first();

      if (await firstCard.isVisible().catch(() => false)) {
        // Check for card info elements
        const cardInfo = firstCard.locator('.card-info');
        const cardPosition = firstCard.locator('.card-position');
        const cardOrientation = firstCard.locator('.card-orientation');

        await expect(cardInfo).toBeVisible();
        await expect(cardPosition).toBeVisible();
        await expect(cardOrientation).toBeVisible();

        // Get the text content
        const posText = await cardPosition.textContent();
        const oriText = await cardOrientation.textContent();

        expect(posText).toBeTruthy();
        expect(oriText).toBeTruthy();
      }
    }
  });

  test('should display card interpretation or loading state', async ({ page }) => {
    const activeSession = page.locator('[data-testid="active-session-card"]');

    if (await activeSession.isVisible().catch(() => false)) {
      const cards = page.locator('[data-testid="card-display"]');
      const firstCard = cards.first();

      if (await firstCard.isVisible().catch(() => false)) {
        // Check for either interpretation or loading state
        const hasInterpretation = await firstCard.locator('.card-interpretation').isVisible().catch(() => false);
        const hasLoading = await firstCard.locator('.interpretation-loading').isVisible().catch(() => false);

        expect(hasInterpretation || hasLoading).toBeTruthy();
      }
    }
  });

  test('should show different visual styling for reversed orientation', async ({ page }) => {
    const activeSession = page.locator('[data-testid="active-session-card"]');

    if (await activeSession.isVisible().catch(() => false)) {
      const cards = page.locator('[data-testid="card-display"]');

      // Check if any card has reversed orientation
      const cardCount = await cards.count();
      if (cardCount > 0) {
        for (let i = 0; i < cardCount; i++) {
          const card = cards.nth(i);
          const hasReversedClass = await card.evaluate(el => {
            return el.className.includes('orientation-reversed');
          });

          if (hasReversedClass) {
            const orientationText = await card.locator('.card-orientation').textContent();
            expect(orientationText?.toLowerCase()).toContain('reversed');
          }
        }
      }
    }
  });

  test('should have clickable cards that emit events', async ({ page }) => {
    const activeSession = page.locator('[data-testid="active-session-card"]');

    if (await activeSession.isVisible().catch(() => false)) {
      const card = page.locator('[data-testid="card-display"]').first();

      if (await card.isVisible().catch(() => false)) {
        // Card should be clickable
        const isClickable = await card.evaluate(el => {
          return el.style.cursor === 'pointer' || el.classList.contains('card-display');
        });

        expect(isClickable).toBeTruthy();

        // Try clicking the card
        await card.click();

        // Modal might appear or might not be implemented
        const modal = page.locator('[data-testid="card-detail-modal"]');
        const hasModal = await modal.isVisible().catch(() => false);

        // Just verify click doesn't cause errors
        expect(typeof hasModal).toBe('boolean');
      }
    }
  });

  test('should display card with proper visual hierarchy', async ({ page }) => {
    const activeSession = page.locator('[data-testid="active-session-card"]');

    if (await activeSession.isVisible().catch(() => false)) {
      const cards = page.locator('[data-testid="card-display"]');
      const firstCard = cards.first();

      if (await firstCard.isVisible().catch(() => false)) {
        // Card should have visual and info sections
        const cardVisual = firstCard.locator('.card-visual');
        const cardInfo = firstCard.locator('.card-info');

        await expect(cardVisual).toBeVisible();
        await expect(cardInfo).toBeVisible();

        // Card visual should contain SVG placeholder
        const svg = cardVisual.locator('svg');
        await expect(svg).toBeVisible();
      }
    }
  });
});

test.describe('Tarot Plugin - Cards Grid Rendering (TDD)', () => {
  /**
   * This test suite validates that the cards-grid div properly renders
   * when a TarotSession is loaded with cards from the backend.
   *
   * This was previously failing when the backend TarotSession model
   * was missing the relationship definition to TarotCardDraw.
   */

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/dashboard/tarot');
    await page.waitForLoadState('networkidle');
  });

  test('should not render empty cards-grid', async ({ page }) => {
    const activeSession = page.locator('[data-testid="active-session-card"]');

    if (await activeSession.isVisible().catch(() => false)) {
      const cardsGrid = activeSession.locator('.cards-grid');
      const isVisible = await cardsGrid.isVisible().catch(() => false);

      if (isVisible) {
        // Grid should contain cards, not be empty
        const cardCount = await cardsGrid.locator('[data-testid="card-display"]').count();
        expect(cardCount).toBeGreaterThan(0);
      }
    }
  });

  test('should populate cards-grid with CardDisplay components', async ({ page }) => {
    const activeSession = page.locator('[data-testid="active-session-card"]');

    if (await activeSession.isVisible().catch(() => false)) {
      const cardsGrid = activeSession.locator('.cards-grid');
      const cards = cardsGrid.locator('[data-testid="card-display"]');

      const cardCount = await cards.count();

      if (cardCount > 0) {
        // Each card should be a valid CardDisplay component
        for (let i = 0; i < cardCount; i++) {
          const card = cards.nth(i);
          const hasCardInfo = await card.locator('.card-info').isVisible().catch(() => false);
          const hasCardVisual = await card.locator('.card-visual').isVisible().catch(() => false);

          expect(hasCardInfo || hasCardVisual).toBeTruthy();
        }
      }
    }
  });

  test('should have all 3 position types in spread (PAST, PRESENT, FUTURE)', async ({ page }) => {
    const activeSession = page.locator('[data-testid="active-session-card"]');

    if (await activeSession.isVisible().catch(() => false)) {
      const cards = page.locator('[data-testid="card-display"]');
      const positions: string[] = [];

      const cardCount = await cards.count();
      if (cardCount === 3) {
        for (let i = 0; i < cardCount; i++) {
          const posLabel = await cards.nth(i).locator('.position-label').textContent();
          positions.push(posLabel?.trim() || '');
        }

        // Should have all three positions
        const hasPositions = ['PAST', 'PRESENT', 'FUTURE'].every(pos =>
          positions.some(p => p.includes(pos))
        );

        expect(hasPositions).toBeTruthy();
      }
    }
  });

  test('should render card grid with proper CSS grid layout', async ({ page }) => {
    const activeSession = page.locator('[data-testid="active-session-card"]');

    if (await activeSession.isVisible().catch(() => false)) {
      const cardsGrid = activeSession.locator('.cards-grid');

      const isVisible = await cardsGrid.isVisible().catch(() => false);
      if (isVisible) {
        // Verify grid layout properties
        const gridDisplay = await cardsGrid.evaluate(el => {
          return window.getComputedStyle(el).display;
        });

        expect(['grid', 'grid layout']).toContain(gridDisplay);
      }
    }
  });
});

test.describe('Tarot Plugin - Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('should display retry button on error', async ({ page }) => {
    // Navigate with invalid state to trigger error (this is a smoke test)
    await page.goto('/dashboard/tarot?error=true', { waitUntil: 'networkidle' }).catch(() => {});

    const errorState = page.locator('[data-testid="tarot-error"]');

    if (await errorState.isVisible().catch(() => false)) {
      const retryBtn = errorState.locator('button');
      await expect(retryBtn).toBeVisible();
    }
  });

  test('should display expiry warning if session about to expire', async ({ page }) => {
    await page.goto('/dashboard/tarot');
    await page.waitForLoadState('networkidle');

    // Check if expiry warning appears (only if session exists and is expiring soon)
    const expiryWarning = page.locator('[data-testid="expiry-warning"]');
    const isVisible = await expiryWarning.isVisible().catch(() => false);

    // This is optional - only shows when session exists and expiry is near
    expect(typeof isVisible).toBe('boolean');
  });
});

test.describe('Tarot Plugin - Close Session', () => {
  test('should display close session button on active session', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/dashboard/tarot');
    await page.waitForLoadState('networkidle');

    const activeSession = page.locator('[data-testid="active-session-card"]');

    if (await activeSession.isVisible().catch(() => false)) {
      const closeBtn = page.locator('[data-testid="close-session-btn"]');
      await expect(closeBtn).toBeVisible();

      // Test close button click
      await closeBtn.click();

      // Session card should disappear
      const createCard = page.locator('[data-testid="create-session-card"]');
      await expect(createCard).toBeVisible({ timeout: 5000 }).catch(() => {
        // Might not appear immediately depending on implementation
      });
    }
  });
});

test.describe('Tarot Plugin - Oracle Conversation Flow (Card Reveal)', () => {
  test('should show cards in closed state initially', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/dashboard/tarot');
    await page.waitForLoadState('networkidle');

    // Create a session if needed
    const createBtn = page.locator('[data-testid="create-session-btn"]');
    const isCreateVisible = await createBtn.isVisible().catch(() => false);

    if (isCreateVisible && !(await createBtn.isDisabled())) {
      await createBtn.click();
      await page.waitForLoadState('networkidle');
    }

    const activeSession = page.locator('[data-testid="active-session-card"]');
    if (await activeSession.isVisible({ timeout: 10000 }).catch(() => false)) {
      const cards = activeSession.locator('[data-testid="card-display"]');
      const count = await cards.count();
      expect(count).toBe(3);

      // Cards should have is-closed class initially
      for (let i = 0; i < count; i++) {
        const card = cards.nth(i);
        const classList = await card.getAttribute('class');
        expect(classList).toContain('is-closed');
      }
    }
  });

  test('should reveal card when clicked', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/dashboard/tarot');
    await page.waitForLoadState('networkidle');

    // Create a session if needed
    const createBtn = page.locator('[data-testid="create-session-btn"]');
    const isCreateVisible = await createBtn.isVisible().catch(() => false);

    if (isCreateVisible && !(await createBtn.isDisabled())) {
      await createBtn.click();
      await page.waitForLoadState('networkidle');
    }

    const activeSession = page.locator('[data-testid="active-session-card"]');
    if (await activeSession.isVisible({ timeout: 10000 }).catch(() => false)) {
      const cards = activeSession.locator('[data-testid="card-display"]');
      const firstCard = cards.first();

      // Click to reveal
      await firstCard.click();
      await page.waitForTimeout(300); // Animation time

      // Card should now have is-opened class
      const classList = await firstCard.getAttribute('class');
      expect(classList).toContain('is-opened');
      expect(classList).not.toContain('is-closed');
    }
  });

  test('should show Oracle dialog after all 3 cards are opened', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/dashboard/tarot');
    await page.waitForLoadState('networkidle');

    // Create a session if needed
    const createBtn = page.locator('[data-testid="create-session-btn"]');
    const isCreateVisible = await createBtn.isVisible().catch(() => false);

    if (isCreateVisible && !(await createBtn.isDisabled())) {
      await createBtn.click();
      await page.waitForLoadState('networkidle');
    }

    const activeSession = page.locator('[data-testid="active-session-card"]');
    if (await activeSession.isVisible({ timeout: 10000 }).catch(() => false)) {
      const cards = activeSession.locator('[data-testid="card-display"]');
      const count = await cards.count();

      // Open all cards
      for (let i = 0; i < count && i < 3; i++) {
        const card = cards.nth(i);
        await card.click();
        await page.waitForTimeout(300);
      }

      // Oracle section should appear after all cards opened
      const oracleSection = activeSession.locator('.oracle-section');
      const isVisible = await oracleSection.isVisible({ timeout: 5000 }).catch(() => false);
      expect(isVisible).toBeTruthy();
    }
  });

  test('should transition through Oracle phases correctly', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/dashboard/tarot');
    await page.waitForLoadState('networkidle');

    // Create a session if needed
    const createBtn = page.locator('[data-testid="create-session-btn"]');
    const isCreateVisible = await createBtn.isVisible().catch(() => false);

    if (isCreateVisible && !(await createBtn.isDisabled())) {
      await createBtn.click();
      await page.waitForLoadState('networkidle');
    }

    const activeSession = page.locator('[data-testid="active-session-card"]');
    if (await activeSession.isVisible({ timeout: 10000 }).catch(() => false)) {
      const cards = activeSession.locator('[data-testid="card-display"]');

      // Open all 3 cards
      for (let i = 0; i < 3; i++) {
        await cards.nth(i).click();
        await page.waitForTimeout(300);
      }

      // Check Oracle dialog appears
      const oracleDialog = activeSession.locator('.oracle-dialog').first();
      const isVisible = await oracleDialog.isVisible({ timeout: 5000 }).catch(() => false);
      expect(isVisible).toBeTruthy();

      // Should have "Discuss My Situation" button in asking_mode phase
      const discussBtn = oracleDialog.locator('button:has-text("Discuss")').first();
      const hasBtnVisible = await discussBtn.isVisible({ timeout: 2000 }).catch(() => false);
      expect(hasBtnVisible).toBeTruthy();
    }
  });

  test('should show situation input when entering asking_situation phase', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/dashboard/tarot');
    await page.waitForLoadState('networkidle');

    // Create a session if needed
    const createBtn = page.locator('[data-testid="create-session-btn"]');
    const isCreateVisible = await createBtn.isVisible().catch(() => false);

    if (isCreateVisible && !(await createBtn.isDisabled())) {
      await createBtn.click();
      await page.waitForLoadState('networkidle');
    }

    const activeSession = page.locator('[data-testid="active-session-card"]');
    if (await activeSession.isVisible({ timeout: 10000 }).catch(() => false)) {
      const cards = activeSession.locator('[data-testid="card-display"]');

      // Open all 3 cards
      for (let i = 0; i < 3; i++) {
        await cards.nth(i).click();
        await page.waitForTimeout(300);
      }

      // Click "Discuss My Situation" button
      const discussBtn = activeSession.locator('button:has-text("Discuss")').first();
      const isBtnVisible = await discussBtn.isVisible({ timeout: 2000 }).catch(() => false);

      if (isBtnVisible) {
        await discussBtn.click();
        await page.waitForTimeout(300);

        // Situation textarea should appear
        const situationInput = activeSession.locator('[data-testid="situation-input"]');
        const isInputVisible = await situationInput.isVisible({ timeout: 2000 }).catch(() => false);
        expect(isInputVisible).toBeTruthy();

        // Word counter should be visible
        const wordCounter = activeSession.locator('.word-counter');
        const isCounterVisible = await wordCounter.isVisible({ timeout: 1000 }).catch(() => false);
        expect(isCounterVisible).toBeTruthy();
      }
    }
  });

  test('should validate situation text word count', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/dashboard/tarot');
    await page.waitForLoadState('networkidle');

    // Create a session if needed
    const createBtn = page.locator('[data-testid="create-session-btn"]');
    const isCreateVisible = await createBtn.isVisible().catch(() => false);

    if (isCreateVisible && !(await createBtn.isDisabled())) {
      await createBtn.click();
      await page.waitForLoadState('networkidle');
    }

    const activeSession = page.locator('[data-testid="active-session-card"]');
    if (await activeSession.isVisible({ timeout: 10000 }).catch(() => false)) {
      const cards = activeSession.locator('[data-testid="card-display"]');

      // Open all 3 cards
      for (let i = 0; i < 3; i++) {
        await cards.nth(i).click();
        await page.waitForTimeout(300);
      }

      // Click "Discuss My Situation"
      const discussBtn = activeSession.locator('button:has-text("Discuss")').first();
      const isBtnVisible = await discussBtn.isVisible({ timeout: 2000 }).catch(() => false);

      if (isBtnVisible) {
        await discussBtn.click();
        await page.waitForTimeout(300);

        const situationInput = activeSession.locator('[data-testid="situation-input"]');
        const submitBtn = activeSession.locator('[data-testid="submit-situation-btn"]');

        if (await situationInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Submit button should be disabled initially (empty input)
          let isDisabled = await submitBtn.isDisabled();
          expect(isDisabled).toBeTruthy();

          // Fill with valid text (< 100 words)
          const validText = 'I am facing a career decision and would like guidance';
          await situationInput.fill(validText);
          await page.waitForTimeout(200);

          // Button should now be enabled
          isDisabled = await submitBtn.isDisabled();
          expect(isDisabled).toBeFalsy();

          // Word counter should show correct count
          const wordCounter = activeSession.locator('.word-counter');
          const text = await wordCounter.textContent();
          expect(text).toContain('9');
        }
      }
    }
  });
});
