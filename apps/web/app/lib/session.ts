'use client';
export interface Session { token: string; role: 'OWNER' | 'PENGURUS' | 'ANGGOTA'; name: string }
const KEY = 'kopra.session';
export const getSession = (): Session | null => {
  if (typeof window === 'undefined') return null;
  const v = localStorage.getItem(KEY);
  return v ? (JSON.parse(v) as Session) : null;
};
export const setSession = (s: Session) => localStorage.setItem(KEY, JSON.stringify(s));
export const clearSession = () => localStorage.removeItem(KEY);
export const canWrite = (s: Session | null) => s?.role === 'PENGURUS' || s?.role === 'OWNER';
