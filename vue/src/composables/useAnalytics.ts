/**
 * Simple analytics composable.
 * Can be extended to integrate with GA4, Plausible, etc.
 */
export function useAnalytics() {
  const track = (event: string, data: Record<string, unknown> = {}) => {
    // Log to console in development
    if (import.meta.env.DEV) {
      console.warn('[Analytics]', event, data);
    }

    // Send to analytics provider (example: GA4)
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as { gtag: (cmd: string, event: string, data: unknown) => void }).gtag('event', event, data);
    }
  };

  return { track };
}
