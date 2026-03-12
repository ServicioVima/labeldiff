const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE) ? import.meta.env.VITE_API_BASE : '';

function getDefaultOptions(): RequestInit {
  return {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  };
}

export async function apiGet<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, { ...getDefaultOptions(), method: 'GET' });
  if (!r.ok) throw new Error(await r.text().catch(() => r.statusText));
  return r.json();
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    ...getDefaultOptions(),
    method: 'POST',
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(await r.text().catch(() => r.statusText));
  return r.json();
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    ...getDefaultOptions(),
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text().catch(() => r.statusText));
  return r.json();
}

export async function apiDelete(path: string): Promise<void> {
  const r = await fetch(`${API_BASE}${path}`, { ...getDefaultOptions(), method: 'DELETE' });
  if (!r.ok) throw new Error(await r.text().catch(() => r.statusText));
}

export interface ConfigResponse {
  geminiModel?: string;
  geminiApiKey?: string;
}

export async function getConfig(): Promise<ConfigResponse> {
  return apiGet<ConfigResponse>('/api/config');
}

export interface MeResponse {
  authenticated: boolean;
  id?: number;
  email?: string;
  name?: string;
  role?: string;
}

export async function getMe(): Promise<MeResponse> {
  return apiGet<MeResponse>('/api/auth/me');
}

export function getLoginUrl(): string {
  return `${API_BASE}/api/auth/login`;
}

export function getLogoutUrl(): string {
  return `${API_BASE}/api/auth/logout`;
}

export async function getSasUrl(blobPath: string): Promise<string> {
  const res = await apiGet<{ url: string }>(`/api/catalog/sas?blob_path=${encodeURIComponent(blobPath)}`);
  return res.url;
}

export async function listCatalog(params?: { name?: string; version?: string; client?: string }): Promise<import('../types').CatalogItem[]> {
  const q = new URLSearchParams();
  if (params?.name) q.set('name', params.name);
  if (params?.version) q.set('version', params.version);
  if (params?.client) q.set('client', params.client);
  const query = q.toString();
  return apiGet<import('../types').CatalogItem[]>(`/api/catalog${query ? `?${query}` : ''}`);
}

export interface SendReportEmailBody {
  language: 'es' | 'en';
  subject: string;
  htmlBody: string;
  attachments: { filename: string; contentBase64: string; contentId: string | null }[];
}

export async function sendReportEmail(body: SendReportEmailBody): Promise<{ ok: boolean; message: string }> {
  return apiPost<{ ok: boolean; message: string }>('/api/email/send-report', body);
}
