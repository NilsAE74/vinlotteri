import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

// Admin-innlogging.
//
// Cookien inneholder en HMAC avledet av ADMIN_PASSWORD, ikke bare "true".
// Den kan derfor ikke forfalskes uten å kjenne passordet, og alle
// innlogginger blir ugyldige hvis passordet byttes.
//
// NB: Denne filen er IKKE en 'use server'-fil, så funksjonene her kan ikke
// kalles direkte fra nettleseren.

export const ADMIN_COOKIE = 'admin_auth';

function sessionToken(): string | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  return createHmac('sha256', password).update('vinlotteri-admin-session').digest('hex');
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function checkAdminPassword(input: unknown): boolean {
  const password = process.env.ADMIN_PASSWORD;
  return !!password && typeof input === 'string' && safeEqual(input, password);
}

export async function setAdminSession() {
  const token = sessionToken();
  if (!token) return;
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 timer
  });
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const token = sessionToken();
  const value = (await cookies()).get(ADMIN_COOKIE)?.value;
  return !!token && !!value && safeEqual(value, token);
}

export async function getAdminTheme() {
  return ((await cookies()).get('admin-theme')?.value ?? 'dark') as 'dark' | 'light';
}
