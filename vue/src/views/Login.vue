<template>
  <div class="login-page">
    <div class="login-card">
      <h1>{{ $t('login.title') }}</h1>
      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="email">{{ $t('login.emailLabel') }}</label>
          <input
            id="email"
            v-model="email"
            type="email"
            data-testid="email"
            required
          >
        </div>
        <div class="form-group">
          <label for="password">{{ $t('login.passwordLabel') }}</label>
          <input
            id="password"
            v-model="password"
            type="password"
            data-testid="password"
            required
          >
        </div>
        <div
          v-if="error"
          class="error"
          data-testid="error-message"
        >
          {{ error }}
        </div>
        <button
          type="submit"
          data-testid="login-button"
          :disabled="loading"
        >
          {{ loading ? $t('login.loggingIn') : $t('login.loginButton') }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { api, clearSessionExpiry } from '@/api';

const router = useRouter();
const route = useRoute();

const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);
const { t } = useI18n();

async function handleLogin() {
  loading.value = true;
  error.value = '';

  try {
    const response = await api.post('/auth/login', {
      email: email.value,
      password: password.value
    }) as { success: boolean; token: string; user_id: string; error?: string };

    if (!response.success) {
      throw new Error(response.error || t('login.errors.loginFailed'));
    }

    localStorage.setItem('auth_token', response.token);
    localStorage.setItem('user_id', response.user_id);
    api.setToken(response.token);

    // Clear any session expired state
    clearSessionExpiry();

    // Redirect to stored destination or dashboard (?redirect= param takes priority)
    const raw = (route.query.redirect as string) || sessionStorage.getItem('redirect_after_login') || '';
    sessionStorage.removeItem('redirect_after_login');
    // Never chain back into /login (prevents double-redirect loops)
    const redirectPath = raw && !raw.startsWith('/login') ? raw : '/dashboard';

    router.push(redirectPath);
  } catch (err) {
    error.value = (err as Error).message || t('login.errors.loginFailed');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f5f5;
}

.login-card {
  background: white;
  padding: 40px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
}

h1 {
  margin-bottom: 30px;
  text-align: center;
  color: #2c3e50;
}

.form-group {
  margin-bottom: 20px;
}

label {
  display: block;
  margin-bottom: 5px;
  color: #666;
  font-size: 0.9rem;
}

input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

input:focus {
  outline: none;
  border-color: #3498db;
}

button {
  width: 100%;
  padding: 12px;
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

button:hover:not(:disabled) {
  background-color: #2980b9;
}

button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.error {
  background-color: #fee;
  color: #c00;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 15px;
  font-size: 0.9rem;
}
</style>
