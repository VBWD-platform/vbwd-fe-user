/**
 * Browser download helpers.
 *
 * Fetch an authenticated binary (PDF, iCal, etc.) as a Blob and trigger a
 * save-as dialog. Kept small and dependency-free so stores and views can
 * call it directly without reaching for a new abstraction.
 */
import { api } from '@/api';

/**
 * Fetch a URL with the current auth token and save the response as a file.
 *
 * Uses the browser's native fetch — the shared ApiClient wrapper doesn't
 * expose a responseType option, and re-implementing its interceptors for
 * one-off binary downloads isn't worth the complexity.
 */
export async function downloadAuthenticatedFile(
  path: string,
  filename: string,
): Promise<void> {
  const baseUrl = (api as unknown as { baseURL: string }).baseURL ?? '/api/v1';
  const token = api.getToken();

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'same-origin',
  });

  if (!response.ok) {
    throw new Error(
      `Download failed: ${response.status} ${response.statusText}`,
    );
  }

  const blob = await response.blob();
  triggerBlobDownload(blob, filename);
}

/**
 * Trigger a browser save-as for an existing Blob via a hidden anchor.
 * Revokes the object URL on next tick to free memory.
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Defer revocation so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
