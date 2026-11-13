import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const SESSION_COOKIE = 'workhub_session';
export const SESSION_DAYS = 30;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET chưa được đặt (cần ít nhất 32 ký tự) trong .env.local');
  return s;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  // Compare against itself when lengths differ so the timing does not reveal the length.
  return x.length === y.length ? timingSafeEqual(x, y) : (timingSafeEqual(x, x), false);
}

/** Token format: "<username>.<expiresAtMs>.<hmac>" */
export function createSessionToken(username: string): { token: string; expires: Date } {
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  const payload = `${Buffer.from(username).toString('base64url')}.${expires.getTime()}`;
  return { token: `${payload}.${sign(payload)}`, expires };
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const i = token.lastIndexOf('.');
  if (i < 0) return false;
  const payload = token.slice(0, i);
  if (!safeEqual(token.slice(i + 1), sign(payload))) return false;
  const [user, exp] = payload.split('.');
  return Number(exp) > Date.now() && Buffer.from(user ?? '', 'base64url').toString() === process.env.WORKHUB_USER;
}

export function checkCredentials(username: string, password: string): boolean {
  const u = process.env.WORKHUB_USER;
  const p = process.env.WORKHUB_PASSWORD;
  if (!u || !p) throw new Error('WORKHUB_USER / WORKHUB_PASSWORD chưa được đặt trong .env.local');
  const okUser = safeEqual(username, u);
  const okPass = safeEqual(password, p);
  return okUser && okPass;
}

export async function isAuthenticated(): Promise<boolean> {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}

/** Returns a 401 response when the request is not logged in, otherwise null. */
export async function requireAuth(): Promise<NextResponse | null> {
  return (await isAuthenticated()) ? null : NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
}
