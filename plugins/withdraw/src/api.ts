/**
 * Thin fetch wrappers for the withdraw backend API (S79).
 *
 * Each function reads the JWT from localStorage, hits the corresponding
 * `/api/v1/...` endpoint, and either returns typed JSON or throws an Error
 * carrying the backend's `{error}` message. Lives in this plugin (not
 * vbwd-fe-core) because withdraw endpoints are plugin-specific.
 */

export interface DestinationField {
  name: string;
  type: string;
  label_key: string;
}

export interface WithdrawProvider {
  name: string;
  destination_schema: DestinationField[];
}

export interface WithdrawConfig {
  currency: string;
  token_to_currency_rate: number;
  min_withdraw_tokens: number;
}

export type WithdrawStatus =
  | 'pending'
  | 'approved'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'rejected';

export interface WithdrawRequestRow {
  id: string;
  balance_source: string;
  amount: number;
  payout_amount: number;
  currency: string;
  provider: string;
  destination: Record<string, string>;
  status: WithdrawStatus;
  provider_payout_id: string | null;
  error: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface WithdrawSubmitPayload {
  provider: string;
  amount: number;
  destination: Record<string, string>;
  balance_source: string;
}

function authHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('auth_token') ?? ''}`,
  };
}

async function jsonOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // Non-JSON error body — keep the HTTP status message.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function getProviders(): Promise<{
  providers: WithdrawProvider[];
  config: WithdrawConfig;
}> {
  const response = await fetch('/api/v1/withdraw/providers', {
    headers: authHeaders(),
  });
  return jsonOrThrow(response);
}

/** Balance endpoint is caller-supplied so S80 can point the panel at another source. */
export async function getBalance(endpoint: string): Promise<{ balance: number }> {
  const response = await fetch(endpoint, { headers: authHeaders() });
  return jsonOrThrow(response);
}

export async function submitWithdraw(
  payload: WithdrawSubmitPayload,
): Promise<WithdrawRequestRow> {
  const response = await fetch('/api/v1/withdraw', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await jsonOrThrow<{ request: WithdrawRequestRow }>(response);
  return data.request;
}

export async function listRequests(): Promise<{ requests: WithdrawRequestRow[] }> {
  const response = await fetch('/api/v1/withdraw/requests', {
    headers: authHeaders(),
  });
  return jsonOrThrow(response);
}

export async function getRequest(id: string): Promise<WithdrawRequestRow> {
  const response = await fetch(`/api/v1/withdraw/requests/${id}`, {
    headers: authHeaders(),
  });
  const data = await jsonOrThrow<{ request: WithdrawRequestRow }>(response);
  return data.request;
}
