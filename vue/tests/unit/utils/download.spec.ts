import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../../src/api', () => ({
  api: {
    getToken: vi.fn(() => 'fake-token'),
    baseURL: '/api/v1',
  },
}));

import {
  downloadAuthenticatedFile,
  triggerBlobDownload,
} from '../../../src/utils/download';

describe('downloadAuthenticatedFile', () => {
  const originalFetch = globalThis.fetch;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;

  beforeEach(() => {
    vi.useFakeTimers();
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    vi.useRealTimers();
  });

  it('fetches with the auth token and triggers a browser download', async () => {
    const mockResponse = {
      ok: true,
      blob: vi.fn(() => Promise.resolve(new Blob(['PDF'], { type: 'application/pdf' }))),
    };
    globalThis.fetch = vi.fn(() => Promise.resolve(mockResponse as unknown as Response));

    await downloadAuthenticatedFile('/user/invoices/inv_1/pdf', 'invoice-1.pdf');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/v1/user/invoices/inv_1/pdf',
      expect.objectContaining({
        method: 'GET',
        headers: { Authorization: 'Bearer fake-token' },
      }),
    );
    expect(URL.createObjectURL).toHaveBeenCalled();
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });

  it('throws on non-OK response', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, status: 403, statusText: 'Forbidden' } as Response),
    );

    await expect(
      downloadAuthenticatedFile('/path', 'x.pdf'),
    ).rejects.toThrow(/403/);
  });
});

describe('triggerBlobDownload', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('creates a hidden anchor, clicks it, then removes it', () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');
    const blob = new Blob(['ok']);

    triggerBlobDownload(blob, 'out.pdf');

    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(appendSpy).toHaveBeenCalled();
    const appendCallArgs = appendSpy.mock.calls[0];
    const anchor = appendCallArgs[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('out.pdf');
    expect(anchor.href).toContain('blob:mock');
    expect(removeSpy).toHaveBeenCalledWith(anchor);
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });
});
