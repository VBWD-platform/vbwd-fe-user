<template>
  <div class="profile">
    <h1>{{ $t('profile.title') }}</h1>

    <div
      v-if="loading"
      class="loading"
      data-testid="profile-loading"
    >
      <div class="spinner" />
      <p>{{ $t('profile.loading') }}</p>
    </div>

    <div
      v-else-if="error"
      class="error"
      data-testid="profile-error"
    >
      {{ error }}
      <button
        class="retry-btn"
        @click="loadProfile"
      >
        {{ $t('common.retry') }}
      </button>
    </div>

    <div
      v-else
      class="profile-content"
    >
      <!-- Plugin-contributed sections placed ABOVE the core cards
           (e.g. meinchat nickname picker — shown first so the user
           can claim their handle before browsing the rest). -->
      <component
        :is="section.component"
        v-for="section in profileSectionsTop"
        :key="section.id"
        :data-testid="`profile-section-${section.id}`"
        class="card"
      />

      <!-- Account Info Card -->
      <div class="card">
        <h2>{{ $t('profile.accountInfo.title') }}</h2>
        <div class="info-grid">
          <div class="info-item">
            <label>{{ $t('profile.personalInfo.firstName') }} {{ $t('profile.personalInfo.lastName') }}</label>
            <span data-testid="profile-name">{{ profileName }}</span>
          </div>
          <div class="info-item">
            <label>{{ $t('profile.accountInfo.email') }}</label>
            <span data-testid="profile-email">{{ userEmail }}</span>
          </div>
          <div class="info-item">
            <label>{{ $t('profile.accountInfo.accountStatus') }}</label>
            <span
              class="status-badge active"
              data-testid="account-status"
            >{{ $t('profile.accountInfo.statusActive') }}</span>
          </div>
          <div class="info-item">
            <label>{{ $t('profile.accountInfo.tokenBalance') }}</label>
            <span
              class="balance"
              data-testid="token-balance"
            >{{ formatNumber(tokenBalance) }} {{ $t('common.tokenUnit') }}</span>
          </div>
        </div>
      </div>

      <!-- Personal Information Card -->
      <div class="card">
        <h2>{{ $t('profile.personalInfo.title') }}</h2>
        <form @submit.prevent="handleUpdateProfile">
          <div class="form-row">
            <div class="form-group">
              <label for="firstName">{{ $t('profile.personalInfo.firstName') }}</label>
              <input
                id="firstName"
                v-model="formData.first_name"
                type="text"
                data-testid="name-input"
                :placeholder="$t('profile.personalInfo.firstNamePlaceholder')"
              >
            </div>
            <div class="form-group">
              <label for="lastName">{{ $t('profile.personalInfo.lastName') }}</label>
              <input
                id="lastName"
                v-model="formData.last_name"
                type="text"
                data-testid="last-name-input"
                :placeholder="$t('profile.personalInfo.lastNamePlaceholder')"
              >
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="company">{{ $t('profile.personalInfo.company') }}</label>
              <input
                id="company"
                v-model="formData.company"
                type="text"
                data-testid="company-input"
                :placeholder="$t('profile.personalInfo.companyPlaceholder')"
              >
            </div>
            <div class="form-group">
              <label for="taxNumber">{{ $t('profile.personalInfo.taxNumber') }}</label>
              <input
                id="taxNumber"
                v-model="formData.tax_number"
                type="text"
                data-testid="tax-number-input"
                :placeholder="$t('profile.personalInfo.taxNumberPlaceholder')"
              >
            </div>
          </div>

          <div class="form-group">
            <label for="phone">{{ $t('profile.personalInfo.phone') }}</label>
            <input
              id="phone"
              v-model="formData.phone"
              type="tel"
              data-testid="phone-input"
              :placeholder="$t('profile.personalInfo.phonePlaceholder')"
            >
          </div>

          <h3>{{ $t('profile.address.title') }}</h3>

          <div class="form-group">
            <label for="addressLine1">{{ $t('profile.address.addressLine1') }}</label>
            <input
              id="addressLine1"
              v-model="formData.address_line_1"
              type="text"
              data-testid="address-line1-input"
              :placeholder="$t('profile.address.addressLine1Placeholder')"
            >
          </div>

          <div class="form-group">
            <label for="addressLine2">{{ $t('profile.address.addressLine2') }}</label>
            <input
              id="addressLine2"
              v-model="formData.address_line_2"
              type="text"
              data-testid="address-line2-input"
              :placeholder="$t('profile.address.addressLine2Placeholder')"
            >
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="city">{{ $t('profile.address.city') }}</label>
              <input
                id="city"
                v-model="formData.city"
                type="text"
                data-testid="city-input"
                :placeholder="$t('profile.address.cityPlaceholder')"
              >
            </div>
            <div class="form-group">
              <label for="postalCode">{{ $t('profile.address.postalCode') }}</label>
              <input
                id="postalCode"
                v-model="formData.postal_code"
                type="text"
                data-testid="postal-code-input"
                :placeholder="$t('profile.address.postalCodePlaceholder')"
              >
            </div>
          </div>

          <div class="form-group">
            <label for="country">{{ $t('profile.address.country') }}</label>
            <select
              id="country"
              v-model="formData.country"
              data-testid="country-input"
            >
              <option value="">
                {{ $t('profile.address.countryPlaceholder') }}
              </option>
              <option
                v-for="c in countries"
                :key="c.code"
                :value="c.code"
              >
                {{ c.name }}
              </option>
            </select>
          </div>

          <div class="form-actions">
            <button
              type="submit"
              class="btn primary"
              data-testid="save-profile"
              :disabled="saving"
            >
              {{ saving ? $t('profile.actions.saving') : $t('profile.actions.saveChanges') }}
            </button>
          </div>
        </form>
      </div>

      <!-- Preferences Card -->
      <div class="card">
        <h2>{{ $t('profile.preferences') }}</h2>
        <div class="form-group">
          <label for="language">{{ $t('profile.language') }}</label>
          <select
            id="language"
            v-model="formData.language"
            data-testid="language-select"
            class="form-select"
            @change="onLanguageChange"
          >
            <option
              v-for="lang in availableLanguages"
              :key="lang.code"
              :value="lang.code"
            >
              {{ lang.name }}
            </option>
          </select>
        </div>
      </div>

      <!-- Change Password Card -->
      <div class="card">
        <h2>{{ $t('profile.changePassword.title') }}</h2>
        <form @submit.prevent="handleChangePassword">
          <div class="form-group">
            <label for="currentPassword">{{ $t('profile.changePassword.currentPassword') }}</label>
            <input
              id="currentPassword"
              v-model="passwordData.currentPassword"
              type="password"
              data-testid="current-password"
              required
            >
          </div>
          <div class="form-group">
            <label for="newPassword">{{ $t('profile.changePassword.newPassword') }}</label>
            <input
              id="newPassword"
              v-model="passwordData.newPassword"
              type="password"
              data-testid="new-password"
              required
            >
          </div>
          <div class="form-group">
            <label for="confirmPassword">{{ $t('profile.changePassword.confirmPassword') }}</label>
            <input
              id="confirmPassword"
              v-model="passwordData.confirmPassword"
              type="password"
              data-testid="confirm-password"
              required
            >
          </div>
          <div
            v-if="passwordError"
            class="field-error"
          >
            {{ passwordError }}
          </div>
          <div class="form-actions">
            <button
              type="submit"
              class="btn secondary"
              data-testid="change-password"
              :disabled="changingPassword"
            >
              {{ changingPassword ? $t('profile.changePassword.changing') : $t('profile.changePassword.changePassword') }}
            </button>
          </div>
        </form>
      </div>

      <!-- Plugin-contributed sections placed BELOW the core cards
           (supplementary plugin settings; default placement). -->
      <component
        :is="section.component"
        v-for="section in profileSectionsBottom"
        :key="section.id"
        :data-testid="`profile-section-${section.id}`"
        class="card"
      />
    </div>

    <!-- Success Toast -->
    <div
      v-if="successMessage"
      class="toast success"
      data-testid="success-toast"
    >
      {{ successMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useProfileStore } from '../stores/profile';
import { api } from '../api';
import { setLocale, type LocaleCode } from '../i18n';
import { getProfileSections } from '@/registries/profileSectionsRegistry';

const { t, locale } = useI18n();
const profileStore = useProfileStore();

// Plugin-contributed cards. Two slots: ``top`` renders above the core
// cards (use for things the user should see first, e.g. picking a
// nickname); ``bottom`` is the default for supplementary settings.
const profileSectionsTop = getProfileSections('top');
const profileSectionsBottom = getProfileSections('bottom');

const loading = ref(true);
const error = ref<string | null>(null);
const saving = ref(false);

interface Country {
  code: string;
  name: string;
}
interface Language {
  code: string;
  name: string;
}
const countries = ref<Country[]>([]);
const availableLanguages = ref<Language[]>([]);
const changingPassword = ref(false);
const successMessage = ref('');
const passwordError = ref('');

interface FormData {
  first_name: string;
  last_name: string;
  company: string;
  tax_number: string;
  phone: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  postal_code: string;
  country: string;
  language: LocaleCode;
}

const formData = reactive<FormData>({
  first_name: '',
  last_name: '',
  company: '',
  tax_number: '',
  phone: '',
  address_line_1: '',
  address_line_2: '',
  city: '',
  postal_code: '',
  country: '',
  language: 'en',
});

const passwordData = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
});

const userEmail = computed(() => profileStore.profile?.email || '');
const profileName = computed(() => {
  const first = formData.first_name || '';
  const last = formData.last_name || '';
  return (first + ' ' + last).trim() || userEmail.value;
});
const tokenBalance = ref(0);

async function fetchTokenBalance(): Promise<void> {
  try {
    const response = await api.get('/user/tokens/balance') as { balance: number };
    tokenBalance.value = response.balance || 0;
  } catch {
    tokenBalance.value = 0;
  }
}

async function fetchLanguages(): Promise<void> {
  try {
    const response = await api.get('/config/languages') as { languages: Language[] };
    availableLanguages.value = response.languages;
  } catch {
    // Fallback to all available languages
    availableLanguages.value = [
      { code: 'en', name: 'English' },
      { code: 'de', name: 'Deutsch' },
      { code: 'ru', name: 'Русский' },
      { code: 'th', name: 'ไทย' },
      { code: 'zh', name: '中文' },
      { code: 'es', name: 'Español' },
      { code: 'fr', name: 'Français' },
      { code: 'ja', name: '日本語' },
    ];
  }
}

async function loadCountries(): Promise<void> {
  try {
    const response = await api.get('/settings/countries') as { countries: Country[] };
    countries.value = response.countries;
  } catch {
    countries.value = [
      { code: 'DE', name: 'Germany' },
      { code: 'AT', name: 'Austria' },
      { code: 'CH', name: 'Switzerland' },
      { code: 'US', name: 'United States' },
      { code: 'GB', name: 'United Kingdom' },
    ];
  }
}

async function loadProfile(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    // Fetch token balance and countries in parallel
    fetchTokenBalance();
    loadCountries();

    // Fetch full profile with details
    const response = await api.get('/user/profile') as {
      user: { id: string; email: string };
      details: {
        first_name?: string;
        last_name?: string;
        company?: string;
        tax_number?: string;
        phone?: string;
        address_line_1?: string;
        address_line_2?: string;
        city?: string;
        postal_code?: string;
        country?: string;
        balance?: number;
      } | null;
    };

    // Update profile store
    await profileStore.fetchProfile();

    // Populate form with details
    if (response.details) {
      formData.first_name = response.details.first_name || '';
      formData.last_name = response.details.last_name || '';
      formData.company = response.details.company || '';
      formData.tax_number = response.details.tax_number || '';
      formData.phone = response.details.phone || '';
      formData.address_line_1 = response.details.address_line_1 || '';
      formData.address_line_2 = response.details.address_line_2 || '';
      formData.city = response.details.city || '';
      formData.postal_code = response.details.postal_code || '';
      formData.country = response.details.country || '';
    }

    // Set the language dropdown to show the current app locale
    formData.language = locale.value as LocaleCode;
  } catch (err) {
    error.value = (err as Error).message || t('profile.errors.failedToLoad');
  } finally {
    loading.value = false;
  }
}

function onLanguageChange(): void {
  // Update UI language immediately
  setLocale(formData.language);
  locale.value = formData.language;
}

async function handleUpdateProfile(): Promise<void> {
  saving.value = true;
  error.value = null;

  try {
    await api.put('/user/details', {
      first_name: formData.first_name,
      last_name: formData.last_name,
      company: formData.company,
      tax_number: formData.tax_number,
      phone: formData.phone,
      address_line_1: formData.address_line_1,
      address_line_2: formData.address_line_2,
      city: formData.city,
      postal_code: formData.postal_code,
      country: formData.country,
    });

    // Language preference is saved via onLanguageChange (immediate)
    // Backend stores language in browser localStorage, no persistence endpoint needed yet

    // Refresh profile store
    await profileStore.fetchProfile();

    showSuccess(t('profile.messages.profileUpdated'));
  } catch (err) {
    error.value = (err as Error).message || t('profile.errors.failedToUpdate');
  } finally {
    saving.value = false;
  }
}

async function handleChangePassword(): Promise<void> {
  passwordError.value = '';

  if (passwordData.newPassword !== passwordData.confirmPassword) {
    passwordError.value = t('profile.messages.passwordsDoNotMatch');
    return;
  }

  if (passwordData.newPassword.length < 8) {
    passwordError.value = t('profile.messages.passwordMinLength');
    return;
  }

  changingPassword.value = true;

  try {
    await profileStore.changePassword(
      passwordData.currentPassword,
      passwordData.newPassword
    );

    // Clear form
    passwordData.currentPassword = '';
    passwordData.newPassword = '';
    passwordData.confirmPassword = '';

    showSuccess(t('profile.messages.passwordChanged'));
  } catch (err) {
    passwordError.value = (err as Error).message || t('profile.errors.failedToChangePassword');
  } finally {
    changingPassword.value = false;
  }
}

function showSuccess(message: string): void {
  successMessage.value = message;
  setTimeout(() => {
    successMessage.value = '';
  }, 3000);
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

onMounted(() => {
  fetchLanguages();
  loadProfile();
});
</script>

<style scoped>
.profile {
  max-width: 800px;
}

h1 {
  margin-bottom: 30px;
  color: var(--vbwd-text-heading, #2c3e50);
}

.loading {
  text-align: center;
  padding: 60px 20px;
  color: #666;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--vbwd-border-light, #f3f3f3);
  border-top: 3px solid var(--vbwd-color-primary, #3498db);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 15px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.retry-btn {
  margin-left: 15px;
  padding: 8px 16px;
  background: var(--vbwd-color-primary, #3498db);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.profile-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.card {
  background: var(--vbwd-card-bg, #ffffff);
  padding: 25px;
  border-radius: 8px;
  box-shadow: var(--vbwd-card-shadow, 0 2px 5px rgba(0, 0, 0, 0.05));
}

.card h2 {
  margin-bottom: 20px;
  color: var(--vbwd-text-heading, #2c3e50);
  font-size: 1.2rem;
  border-bottom: 1px solid var(--vbwd-border-light, #eee);
  padding-bottom: 10px;
}

.card h3 {
  margin: 20px 0 15px;
  color: var(--vbwd-text-heading, #2c3e50);
  font-size: 1rem;
}

/* Account Info */
.info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

@media (max-width: 600px) {
  .info-grid {
    grid-template-columns: 1fr;
  }
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.info-item label {
  font-size: 0.85rem;
  color: #666;
}

.info-item span {
  font-size: 1rem;
  font-weight: 500;
  color: var(--vbwd-text-heading, #2c3e50);
}

.status-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.85rem;
  width: fit-content;
}

.status-badge.active {
  background: #d4edda;
  color: #155724;
}

.balance {
  color: var(--vbwd-color-success, #27ae60) !important;
  font-weight: 600 !important;
}

/* Form */
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

@media (max-width: 500px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  color: #666;
  font-size: 0.9rem;
}

.form-group input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--vbwd-border-color, #ddd);
  border-radius: 4px;
  font-size: 1rem;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: var(--vbwd-color-primary, #3498db);
}

.form-group input::placeholder {
  color: #aaa;
}

.form-group select,
.form-select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--vbwd-border-color, #ddd);
  border-radius: 4px;
  font-size: 1rem;
  box-sizing: border-box;
  background-color: white;
  cursor: pointer;
}

.form-group select:focus,
.form-select:focus {
  outline: none;
  border-color: var(--vbwd-color-primary, #3498db);
}

.field-error {
  color: #dc3545;
  font-size: 0.9rem;
  margin-bottom: 15px;
}

.form-actions {
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid var(--vbwd-border-light, #eee);
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.2s;
}

.btn.primary {
  background-color: var(--vbwd-color-primary, #3498db);
  color: white;
}

.btn.primary:hover:not(:disabled) {
  background-color: var(--vbwd-color-primary-hover, #2980b9);
}

.btn.secondary {
  background-color: #6c757d;
  color: white;
}

.btn.secondary:hover:not(:disabled) {
  background-color: #5a6268;
}

.btn:disabled {
  background-color: #95a5a6;
  cursor: not-allowed;
}

.error {
  background-color: #f8d7da;
  color: #721c24;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.toast {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 15px 25px;
  border-radius: 4px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  z-index: 1000;
}

.toast.success {
  background-color: var(--vbwd-color-success, #27ae60);
  color: white;
}
</style>
