import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'url'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['vue/tests/unit/**/*.spec.{js,ts}', 'vue/tests/integration/**/*.spec.{js,ts}', 'plugins/*/tests/**/*.spec.{js,ts}'],
    // Playwright e2e specs (core AND plugin) must never be collected by vitest —
    // they call test.describe.configure() etc. which vitest cannot run.
    exclude: ['vue/tests/e2e/**', 'plugins/*/tests/e2e/**'],
    coverage: {
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'vue/tests/']
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./vue/src', import.meta.url))
    }
  }
})
