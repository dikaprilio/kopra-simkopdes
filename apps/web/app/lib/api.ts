'use client';
import { getSession, clearSession } from './session';
const BASE = process.env.NEXT_PUBLIC_API_BASE!;

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const s = getSession();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(s ? { authorization: `Bearer ${s.token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 401) {
    clearSession();
    if (typeof window !== 'undefined') window.location.href = '/login';
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({} as { message?: string }));
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}
