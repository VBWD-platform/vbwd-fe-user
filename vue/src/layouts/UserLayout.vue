<template>
  <div class="user-layout">
    <!-- Mobile Header with Burger Menu (Tablet & Mobile only) -->
    <header class="mobile-header">
      <button
        class="burger-menu"
        :class="{ active: showMobileMenu }"
        data-testid="burger-menu"
        @click="toggleMobileMenu"
      >
        <span />
        <span />
        <span />
      </button>
      <div class="logo-mobile">
        <h2>VBWD</h2>
      </div>
      <div class="header-spacer" />
    </header>

    <!-- Sidebar (Desktop and Mobile Expanded) -->
    <aside
      class="sidebar"
      :class="{ 'sidebar-mobile-open': showMobileMenu }"
      @click.self="closeMobileMenu"
    >
      <div class="sidebar-content">
        <!-- Logo (Desktop only) -->
        <div class="logo">
          <h2>VBWD</h2>
        </div>

        <!-- Navigation Menu -->
        <nav class="nav-menu">
          <!-- Dashboard -->
          <router-link
            to="/dashboard"
            class="nav-item"
            @click="closeMobileMenu"
          >
            {{ $t('nav.dashboard') }}
          </router-link>

          <!-- Plugin sidebar nav items (registered dynamically by plugins) -->
          <router-link
            v-for="item in sidebarNavItems"
            :key="item.pluginName"
            :to="item.to"
            class="nav-item"
            :data-testid="item.testId"
            @click="closeMobileMenu"
          >
            {{ $t(item.labelKey) }}
          </router-link>

          <!-- Store (Plans, Tokens, Add-Ons) -->
          <div class="nav-group">
            <button
              class="nav-item nav-group-toggle"
              :class="{ active: expandedGroups.store }"
              @click="toggleGroup('store')"
            >
              {{ $t('nav.store') }}
              <svg
                class="chevron"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            <div
              v-if="expandedGroups.store"
              class="nav-subgroup"
            >
              <router-link
                to="/dashboard/plans"
                class="nav-subitem"
                @click="closeMobileMenu"
              >
                {{ $t('nav.plans') }}
              </router-link>
              <router-link
                to="/dashboard/tokens"
                class="nav-subitem"
                @click="closeMobileMenu"
              >
                {{ $t('nav.tokens') }}
              </router-link>
              <router-link
                to="/dashboard/add-ons"
                class="nav-subitem"
                @click="closeMobileMenu"
              >
                {{ $t('nav.addons') }}
              </router-link>
            </div>
          </div>

          <!-- Subscription (with Invoices sub-item) -->
          <div class="nav-group">
            <button
              class="nav-item nav-group-toggle"
              :class="{ active: expandedGroups.subscription }"
              @click="toggleGroup('subscription')"
            >
              {{ $t('nav.subscription') }}
              <svg
                class="chevron"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            <div
              v-if="expandedGroups.subscription"
              class="nav-subgroup"
            >
              <router-link
                to="/dashboard/subscription"
                class="nav-subitem"
                @click="closeMobileMenu"
              >
                {{ $t('nav.subscription') }}
              </router-link>
              <router-link
                to="/dashboard/subscription/invoices"
                class="nav-subitem"
                @click="closeMobileMenu"
              >
                {{ $t('nav.invoices') }}
              </router-link>
            </div>
          </div>
        </nav>
      </div>

      <!-- Sidebar Footer: Cart + User Menu -->
      <div class="sidebar-footer">
        <!-- Cart Icon -->
        <div class="cart-wrapper">
          <button
            class="cart-btn"
            data-testid="cart-icon"
            @click="toggleCart"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle
                cx="9"
                cy="21"
                r="1"
              />
              <circle
                cx="20"
                cy="21"
                r="1"
              />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <span
              v-if="cartItemCount > 0"
              class="cart-badge"
              data-testid="cart-count"
            >
              {{ cartItemCount }}
            </span>
          </button>

          <!-- Cart Dropdown -->
          <div
            v-if="showCart"
            class="cart-dropdown"
            data-testid="cart-dropdown"
          >
            <div class="cart-header">
              <h4>{{ $t('layout.shoppingCart') }}</h4>
              <span class="cart-count-text">{{ cartItemCount }} {{ cartItemCount === 1 ? $t('common.item') : $t('common.items') }}</span>
            </div>
            <div class="cart-content">
              <div
                v-if="cartStore.isEmpty"
                class="cart-empty"
              >
                <p data-testid="cart-empty-message">
                  {{ $t('layout.cartEmpty') }}
                </p>
              </div>
              <div
                v-else
                class="cart-items"
              >
                <div
                  v-for="item in cartStore.items"
                  :key="`${item.type}-${item.id}`"
                  class="cart-item"
                  :data-testid="`cart-item-${item.id}`"
                >
                  <div class="cart-item-info">
                    <span class="cart-item-name">{{ item.name }}</span>
                    <span class="cart-item-qty">x{{ item.quantity }}</span>
                  </div>
                  <div class="cart-item-actions">
                    <span class="cart-item-price">{{ formatPrice(item.price * item.quantity) }}</span>
                    <button
                      class="remove-btn"
                      :data-testid="`remove-cart-item-${item.id}`"
                      @click="cartStore.removeItem(item.id)"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div
              v-if="!cartStore.isEmpty"
              class="cart-footer"
            >
              <div class="cart-total">
                <span>{{ $t('layout.cartTotal') }}</span>
                <span
                  class="total-value"
                  data-testid="cart-total"
                >{{ formatPrice(cartStore.total) }}</span>
              </div>
              <button
                class="checkout-btn"
                data-testid="cart-checkout-btn"
                @click="goToCheckout"
              >
                {{ $t('common.checkout') }}
              </button>
            </div>
          </div>
        </div>

        <!-- User Menu (Profile, Appearance, Logout) -->
        <div
          class="user-menu"
          data-testid="user-menu"
        >
          <button
            class="user-menu-btn"
            @click="toggleUserMenu"
          >
            <svg
              class="user-icon"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
            <span class="user-email">{{ userEmail }}</span>
          </button>

          <div
            v-if="showUserMenu"
            class="user-dropdown"
          >
            <router-link
              to="/dashboard/profile"
              class="user-dropdown-item"
              @click="closeUserMenu"
            >
              {{ $t('nav.profile') }}
            </router-link>
            <!-- Plugin user-menu items (registered dynamically by plugins) -->
            <router-link
              v-for="item in menuNavItems"
              :key="item.pluginName"
              :to="item.to"
              class="user-dropdown-item"
              :data-testid="item.testId"
              @click="closeUserMenu"
            >
              {{ $t(item.labelKey) }}
            </router-link>
            <button
              class="user-dropdown-item logout-btn"
              data-testid="logout-button"
              @click="logout"
            >
              {{ $t('common.logout') }}
            </button>
          </div>
        </div>
      </div>
    </aside>

    <!-- Mobile Menu Overlay -->
    <div
      v-if="showMobileMenu"
      class="mobile-overlay"
      @click="closeMobileMenu"
    />

    <!-- Main Content -->
    <main class="main-content">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useCartStore } from 'vbwd-view-component';
import { storeToRefs } from 'pinia';
import { userNavRegistry } from '@/plugins/userNavRegistry';

const router = useRouter();

const sidebarNavItems = computed(() => userNavRegistry.getSidebarItems());
const menuNavItems = computed(() => userNavRegistry.getMenuItems());

// Cart store
const cartStoreRaw = useCartStore();
const { items: cartItems, itemCount: cartItemCount, total: cartTotal, isEmpty: cartIsEmpty } = storeToRefs(cartStoreRaw);

const cartStore = {
  get items() { return cartItems.value; },
  get total() { return cartTotal.value; },
  get isEmpty() { return cartIsEmpty.value; },
  removeItem: (id: string) => cartStoreRaw.removeItem(id),
};

// Menu states
const showMobileMenu = ref(false);
const showCart = ref(false);
const showUserMenu = ref(false);
const expandedGroups = ref({
  store: false,
  subscription: false,
});

const userEmail = computed(() => {
  const user = localStorage.getItem('user');
  if (user) {
    try {
      return JSON.parse(user).email || 'User';
    } catch {
      return 'User';
    }
  }
  return 'User';
});

function toggleMobileMenu() {
  showMobileMenu.value = !showMobileMenu.value;
}

function closeMobileMenu() {
  showMobileMenu.value = false;
}

function toggleGroup(groupName: 'store' | 'subscription') {
  expandedGroups.value[groupName] = !expandedGroups.value[groupName];
}

function toggleCart() {
  showCart.value = !showCart.value;
  showUserMenu.value = false;
}

function toggleUserMenu() {
  showUserMenu.value = !showUserMenu.value;
  showCart.value = false;
}

function closeUserMenu() {
  showUserMenu.value = false;
  closeMobileMenu();
}

function goToCheckout() {
  showCart.value = false;
  const planItems = cartItems.value.filter(i => i.type === 'PLAN');
  if (planItems.length > 0) {
    router.push({ name: 'checkout', params: { planSlug: planItems[0].id } });
  } else {
    router.push('/dashboard/checkout/cart');
  }
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price);
}

function logout() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user');
  router.push('/login');
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (!target.closest('.cart-wrapper')) {
    showCart.value = false;
  }
  if (!target.closest('.user-menu')) {
    showUserMenu.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.user-layout {
  display: flex;
  min-height: 100vh;
}

/* Mobile Header (hidden on desktop, visible on tablet/mobile) */
.mobile-header {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  background-color: var(--vbwd-sidebar-bg, #2c3e50);
  color: white;
  z-index: 999;
  align-items: center;
  padding: 0 20px;
  gap: 15px;
}

.burger-menu {
  display: none;
  flex-direction: column;
  gap: 6px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  width: 40px;
  height: 40px;
}

.burger-menu span {
  width: 25px;
  height: 3px;
  background-color: white;
  border-radius: 2px;
  transition: all 0.3s;
}

.burger-menu.active span:nth-child(1) {
  transform: translateY(9px) rotate(45deg);
}

.burger-menu.active span:nth-child(2) {
  opacity: 0;
}

.burger-menu.active span:nth-child(3) {
  transform: translateY(-9px) rotate(-45deg);
}

.logo-mobile {
  flex: 1;
}

.logo-mobile h2 {
  margin: 0;
  font-size: 1.3rem;
  color: white;
}

.header-spacer {
  width: 40px;
}

/* Desktop Sidebar */
.sidebar {
  width: 250px;
  background-color: var(--vbwd-sidebar-bg, #2c3e50);
  color: var(--vbwd-sidebar-text, rgba(255, 255, 255, 0.8));
  display: flex;
  flex-direction: column;
  position: fixed;
  height: 100vh;
  z-index: 1000;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.logo {
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.logo h2 {
  margin: 0;
  font-size: 1.5rem;
}

.nav-menu {
  flex: 1;
  padding: 20px 0;
}

.nav-item {
  display: block;
  padding: 12px 20px;
  color: var(--vbwd-sidebar-text, rgba(255, 255, 255, 0.8));
  text-decoration: none;
  transition: all 0.2s;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
  width: 100%;
  font-size: 0.95rem;
}

.nav-item:hover,
.nav-item.router-link-active {
  background-color: var(--vbwd-sidebar-active-bg, rgba(255, 255, 255, 0.1));
  color: white;
}

.nav-group {
  margin: 0;
}

.nav-group-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-group-toggle .chevron {
  transition: transform 0.2s;
  margin-left: auto;
}

.nav-group-toggle.active .chevron {
  transform: rotate(180deg);
}

.nav-subgroup {
  background-color: rgba(0, 0, 0, 0.2);
  padding: 0;
}

.nav-subitem {
  display: block;
  padding: 10px 20px 10px 40px;
  color: var(--vbwd-sidebar-text, rgba(255, 255, 255, 0.7));
  text-decoration: none;
  transition: all 0.2s;
  font-size: 0.9rem;
}

.nav-subitem:hover,
.nav-subitem.router-link-active {
  background-color: rgba(255, 255, 255, 0.1);
  color: white;
}

/* Sidebar Footer */
.sidebar-footer {
  margin-top: auto;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.cart-wrapper {
  position: relative;
  padding: 10px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.cart-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  width: 100%;
  transition: background-color 0.2s;
  position: relative;
}

.cart-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.cart-badge {
  background: #e74c3c;
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
  position: absolute;
  top: -5px;
  right: 0;
}

.cart-dropdown {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  background: white;
  border-radius: 8px;
  box-shadow: 0 -5px 20px rgba(0, 0, 0, 0.15);
  margin-bottom: 5px;
  z-index: 100;
  max-height: 400px;
  display: flex;
  flex-direction: column;
}

.cart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 15px;
  border-bottom: 1px solid #eee;
}

.cart-header h4 {
  margin: 0;
  color: #2c3e50;
  font-size: 0.875rem;
}

.cart-count-text {
  font-size: 0.75rem;
  color: #666;
}

.cart-content {
  flex: 1;
  overflow-y: auto;
  max-height: 200px;
}

.cart-empty {
  padding: 30px 15px;
  text-align: center;
  color: #999;
}

.cart-items {
  padding: 10px 15px;
}

.cart-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.cart-item:last-child {
  border-bottom: none;
}

.cart-item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cart-item-name {
  font-size: 0.875rem;
  color: #2c3e50;
}

.cart-item-qty {
  font-size: 0.75rem;
  color: #999;
}

.cart-item-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cart-item-price {
  font-size: 0.875rem;
  font-weight: 600;
  color: #2c3e50;
}

.remove-btn {
  background: none;
  border: none;
  color: #e74c3c;
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.remove-btn:hover {
  color: #c0392b;
}

.cart-footer {
  padding: 12px 15px;
  border-top: 1px solid #eee;
  background: #f8f9fa;
  border-radius: 0 0 8px 8px;
}

.cart-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  font-size: 0.875rem;
  color: #2c3e50;
}

.total-value {
  font-weight: 700;
  font-size: 1rem;
}

.checkout-btn {
  width: 100%;
  padding: 10px;
  background: var(--vbwd-color-primary, #3498db);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.checkout-btn:hover {
  background: var(--vbwd-color-primary-hover, #2980b9);
}

/* User Menu */
.user-menu {
  position: relative;
}

.user-menu-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 15px 20px;
  background: none;
  border: none;
  color: var(--vbwd-sidebar-text, rgba(255, 255, 255, 0.8));
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.user-menu-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
  color: white;
}

.user-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
}

.user-email {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.9rem;
}

.user-dropdown {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  background-color: #34495e;
  padding: 10px;
  margin-bottom: 5px;
  border-radius: 4px;
  z-index: 100;
}

.user-dropdown-item {
  display: block;
  width: 100%;
  padding: 10px 15px;
  margin-bottom: 5px;
  background-color: rgba(0, 0, 0, 0.2);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  text-decoration: none;
  text-align: left;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.user-dropdown-item:last-child {
  margin-bottom: 0;
}

.user-dropdown-item:hover {
  background-color: rgba(0, 0, 0, 0.4);
}

.logout-btn {
  background-color: #e74c3c !important;
}

.logout-btn:hover {
  background-color: #c0392b !important;
}

/* Main Content */
.main-content {
  flex: 1;
  margin-left: 250px;
  padding: 30px;
  background-color: var(--vbwd-page-bg, #f5f5f5);
  min-height: 100vh;
}

/* Mobile Menu Overlay */
.mobile-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 999;
}

/* Tablet Breakpoint (768px - 1024px) */
@media (max-width: 1024px) {
  .mobile-header {
    display: flex;
  }

  .burger-menu {
    display: flex;
  }

  .sidebar {
    position: fixed;
    left: 0;
    top: 60px;
    height: calc(100vh - 60px);
    transform: translateX(-100%);
    transition: transform 0.3s ease;
    box-shadow: 2px 0 10px rgba(0, 0, 0, 0.2);
  }

  .sidebar-mobile-open {
    transform: translateX(0);
  }

  .mobile-overlay {
    display: block;
  }

  .logo {
    display: none;
  }

  .main-content {
    margin-left: 0;
    margin-top: 60px;
  }
}

/* Mobile Breakpoint (< 768px) */
@media (max-width: 768px) {
  .sidebar {
    width: 100%;
  }

  .main-content {
    padding: 20px;
  }

  .nav-menu {
    padding: 15px 0;
  }

  .nav-item,
  .nav-subitem {
    padding: 10px 20px;
  }

  .nav-subitem {
    padding: 8px 20px 8px 40px;
  }

  .cart-btn {
    padding: 10px;
    justify-content: center;
  }

  .user-menu-btn {
    padding: 12px 20px;
  }
}
</style>
