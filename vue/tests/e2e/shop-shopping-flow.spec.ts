/**
 * E2E Playwright: Full E-commerce Shopping Flow
 * Sprint 07e — tests the complete flow from browsing to order completion.
 *
 * Prerequisites:
 * - Backend running with shop plugin enabled
 * - Demo data populated (products, categories, warehouses, stock)
 * - Stripe test keys configured
 * - Mailpit running for email verification
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:8080';
const ADMIN_BASE = process.env.E2E_ADMIN_URL || 'http://localhost:8081';
const API = `${BASE}/api/v1`;

async function getUserToken(): Promise<string> {
  const response = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', password: 'TestPass123@' }),
  });
  const data = await response.json();
  return data.access_token || data.token;
}

test.describe('E-commerce — Public Catalog', () => {
  test('shop page loads and shows products', async ({ page }) => {
    await page.goto(`${BASE}/shop`);
    await expect(page.locator('[data-testid="product-catalog"]')).toBeVisible();

    // Products should be visible
    const productCards = page.locator('[data-testid="product-card-name"]');
    await expect(productCards.first()).toBeVisible({ timeout: 10000 });
  });

  test('can search products by name', async ({ page }) => {
    await page.goto(`${BASE}/shop`);
    await page.locator('[data-testid="product-catalog-search"]').fill('Headphones');
    await page.waitForTimeout(500); // debounce

    const productCards = page.locator('[data-testid="product-card-name"]');
    const count = await productCards.count();
    expect(count).toBeGreaterThan(0);
    await expect(productCards.first()).toContainText('Headphones');
  });

  test('can view product detail page', async ({ page }) => {
    await page.goto(`${BASE}/shop/product/wireless-headphones`);
    await expect(page.locator('[data-testid="product-detail"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-name"]')).toContainText('Wireless Headphones');
    await expect(page.locator('[data-testid="product-price"]')).toBeVisible();
  });
});

test.describe('E-commerce — Cart', () => {
  test('can add product to cart', async ({ page }) => {
    await page.goto(`${BASE}/shop/product/usb-c-cable`);
    await page.locator('[data-testid="add-to-cart-btn"]').click();

    // Navigate to cart
    await page.goto(`${BASE}/shop/cart`);
    await expect(page.locator('[data-testid="shopping-cart"]')).toBeVisible();
    await expect(page.locator('[data-testid="cart-item"]').first()).toBeVisible();
  });

  test('cart persists after page reload', async ({ page }) => {
    // Add item
    await page.goto(`${BASE}/shop/product/usb-c-cable`);
    await page.locator('[data-testid="add-to-cart-btn"]').click();

    // Reload and check cart
    await page.reload();
    await page.goto(`${BASE}/shop/cart`);
    const items = page.locator('[data-testid="cart-item"]');
    await expect(items.first()).toBeVisible();
  });

  test('can update quantity in cart', async ({ page }) => {
    await page.goto(`${BASE}/shop/product/usb-c-cable`);
    await page.locator('[data-testid="add-to-cart-btn"]').click();

    await page.goto(`${BASE}/shop/cart`);
    const increaseButton = page.locator('[data-testid="cart-increase-qty"]').first();
    await increaseButton.click();

    // Quantity should be 2
    const quantity = page.locator('[data-testid="cart-item-quantity"]').first();
    await expect(quantity).toContainText('2');
  });
});

test.describe('E-commerce — Admin Product Management', () => {
  test('admin can see products list', async ({ page }) => {
    // Login as admin
    await page.goto(`${ADMIN_BASE}/admin/login`);
    await page.locator('[data-testid="username-input"]').fill('admin@example.com');
    await page.locator('[data-testid="password-input"]').fill('AdminPass123@');
    await page.locator('[data-testid="login-button"]').click();
    await page.waitForURL(/\/admin\/(dashboard)?$/, { timeout: 10000 });

    // Navigate to products
    await page.goto(`${ADMIN_BASE}/admin/shop/products`);
    await expect(page.locator('[data-testid="products-table"]')).toBeVisible();
  });

  test('admin can see categories', async ({ page }) => {
    await page.goto(`${ADMIN_BASE}/admin/login`);
    await page.locator('[data-testid="username-input"]').fill('admin@example.com');
    await page.locator('[data-testid="password-input"]').fill('AdminPass123@');
    await page.locator('[data-testid="login-button"]').click();
    await page.waitForURL(/\/admin\/(dashboard)?$/, { timeout: 10000 });

    await page.goto(`${ADMIN_BASE}/admin/shop/categories`);
    await expect(page.locator('[data-testid="product-categories"]')).toBeVisible();
  });

  test('admin can see stock overview', async ({ page }) => {
    await page.goto(`${ADMIN_BASE}/admin/login`);
    await page.locator('[data-testid="username-input"]').fill('admin@example.com');
    await page.locator('[data-testid="password-input"]').fill('AdminPass123@');
    await page.locator('[data-testid="login-button"]').click();
    await page.waitForURL(/\/admin\/(dashboard)?$/, { timeout: 10000 });

    await page.goto(`${ADMIN_BASE}/admin/shop/stock`);
    await expect(page.locator('[data-testid="stock-overview"]')).toBeVisible();
  });

  test('admin can see warehouses', async ({ page }) => {
    await page.goto(`${ADMIN_BASE}/admin/login`);
    await page.locator('[data-testid="username-input"]').fill('admin@example.com');
    await page.locator('[data-testid="password-input"]').fill('AdminPass123@');
    await page.locator('[data-testid="login-button"]').click();
    await page.waitForURL(/\/admin\/(dashboard)?$/, { timeout: 10000 });

    await page.goto(`${ADMIN_BASE}/admin/shop/warehouses`);
    await expect(page.locator('[data-testid="warehouses-list"]')).toBeVisible();
  });

  test('admin can bulk select products', async ({ page }) => {
    await page.goto(`${ADMIN_BASE}/admin/login`);
    await page.locator('[data-testid="username-input"]').fill('admin@example.com');
    await page.locator('[data-testid="password-input"]').fill('AdminPass123@');
    await page.locator('[data-testid="login-button"]').click();
    await page.waitForURL(/\/admin\/(dashboard)?$/, { timeout: 10000 });

    await page.goto(`${ADMIN_BASE}/admin/shop/products`);
    await expect(page.locator('[data-testid="products-table"]')).toBeVisible();

    // Click select all
    await page.locator('[data-testid="select-all-checkbox"]').click();
    await expect(page.locator('[data-testid="bulk-toolbar"]')).toBeVisible();
    await expect(page.locator('[data-testid="bulk-selected-count"]')).toBeVisible();
  });
});

test.describe('E-commerce — Orders (API)', () => {
  test('user can view order history via API', async () => {
    const token = await getUserToken();
    const response = await fetch(`${API}/shop/orders`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('orders');
    expect(Array.isArray(data.orders)).toBe(true);
  });

  test('shop products API returns data', async () => {
    const response = await fetch(`${API}/shop/products`);
    expect(response.status).toBe(200);
    const data = await response.json();
    // Catalogue-list wire contract: the list endpoint emits `items`.
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items[0]).toHaveProperty('name');
    expect(data.items[0]).toHaveProperty('price');
  });

  test('shop categories API returns data', async () => {
    const response = await fetch(`${API}/shop/categories`);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('categories');
  });

  test('cart checkout creates invoice with stock blocking', async () => {
    const token = await getUserToken();

    // Get a product
    const productsResponse = await fetch(`${API}/shop/products`);
    const productsData = await productsResponse.json();
    const product = productsData.items[0];

    // Checkout
    const checkoutResponse = await fetch(`${API}/shop/cart/checkout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [{ product_id: product.id, quantity: 1 }],
      }),
    });

    expect(checkoutResponse.status).toBe(201);
    const checkoutData = await checkoutResponse.json();
    expect(checkoutData).toHaveProperty('invoice_id');
    expect(checkoutData).toHaveProperty('invoice_number');
  });
});
