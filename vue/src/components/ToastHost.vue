<template>
  <div
    class="toast-host"
    aria-live="polite"
    aria-atomic="true"
  >
    <transition-group name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="toast"
        :class="`toast--${toast.type}`"
        data-testid="toast"
        role="status"
        @click="dismiss(toast.id)"
      >
        <span
          class="toast__icon"
          aria-hidden="true"
        >{{ icon(toast.type) }}</span>
        <span class="toast__message">{{ toast.message }}</span>
      </div>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
/**
 * Global toast host. Listens on the shared fe-core event bus for
 * `notification:show` events (AppEvents.NOTIFICATION_SHOW) and renders a small
 * stack of auto-dismissing popups. Any core view or plugin can trigger one:
 *   eventBus.emit(AppEvents.NOTIFICATION_SHOW, { type: 'success', message })
 */
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { eventBus, AppEvents } from 'vbwd-view-component';

type ToastType = 'success' | 'error' | 'warning' | 'info';
interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

const toasts = ref<Toast[]>([]);
let seq = 0;
let unsubscribe: (() => void) | null = null;

function icon(type: ToastType): string {
  return { success: '✓', error: '✕', warning: '!', info: 'i' }[type] || 'i';
}

function dismiss(id: number): void {
  toasts.value = toasts.value.filter((t) => t.id !== id);
}

function show(payload: { type?: ToastType; message: string; duration?: number }): void {
  if (!payload || !payload.message) return;
  const id = ++seq;
  toasts.value.push({ id, type: payload.type || 'info', message: payload.message });
  const duration = payload.duration ?? 3000;
  window.setTimeout(() => dismiss(id), duration);
}

onMounted(() => {
  unsubscribe = eventBus.on(AppEvents.NOTIFICATION_SHOW, show);
});
onBeforeUnmount(() => {
  if (unsubscribe) unsubscribe();
});
</script>

<style scoped>
.toast-host {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 240px;
  max-width: 360px;
  padding: 12px 16px;
  border-radius: 8px;
  background: #2c3e50;
  color: #fff;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
  font-size: 0.92rem;
  cursor: pointer;
}

.toast--success { background: #1e7e44; }
.toast--error { background: #b0223a; }
.toast--warning { background: #b8860b; }
.toast--info { background: #2c3e50; }

.toast__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.22);
  font-weight: 700;
  font-size: 0.8rem;
  flex-shrink: 0;
}

.toast__message {
  line-height: 1.3;
}

/* Enter/leave animation */
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(20px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
