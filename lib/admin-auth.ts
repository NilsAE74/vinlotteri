import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { cookies, headers } from 'next/headers';
import { prisma } from './prisma';

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

// --- Begrensning av innloggingsforsøk ---
// Lagres i databasen, fordi appen på Vercel kjører i flere instanser samtidig.
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutter
const MAX_FAILURES_PER_IP = 5;
// Tak for alle IP-er samlet, mot gjetting fra mange adresser samtidig
const MAX_FAILURES_TOTAL = 50;

async function clientIpHash(): Promise<string> {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'ukjent';
  return createHash('sha256').update(`vinlotteri-login:${ip}`).digest('hex');
}

/** Returnerer en feilmelding hvis innlogging er sperret akkurat nå, ellers null. */
export async function loginBlockedMessage(): Promise<string | null> {
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const ipHash = await clientIpHash();
  // Etter hverandre for å holde antall databasetilkoblinger nede
  const fromIp = await prisma.adminLoginAttempt.count({ where: { ipHash, createdAt: { gte: since } } });
  const total = await prisma.adminLoginAttempt.count({ where: { createdAt: { gte: since } } });
  if (fromIp >= MAX_FAILURES_PER_IP || total >= MAX_FAILURES_TOTAL) {
    return 'For mange mislykkede forsøk. Prøv igjen om 15 minutter.';
  }
  return null;
}

export async function recordFailedLogin() {
  const ipHash = await clientIpHash();
  await prisma.adminLoginAttempt.create({ data: { ipHash } });
  // Rydd bort gamle forsøk, så tabellen ikke vokser
  await prisma.adminLoginAttempt.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
}

export async function clearFailedLogins() {
  const ipHash = await clientIpHash();
  await prisma.adminLoginAttempt.deleteMany({ where: { ipHash } });
}
