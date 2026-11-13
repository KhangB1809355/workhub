import 'server-only';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { deleteSetting, getSetting, setSetting } from './db';

const KEY = 'share_token';

export async function getShareToken(): Promise<string | null> {
  return getSetting(KEY);
}

/** Creates a new random token; any previous link stops working. */
export async function rotateShareToken(): Promise<string> {
  const token = randomBytes(24).toString('base64url');
  await setSetting(KEY, token);
  return token;
}

export async function disableShare(): Promise<void> {
  await deleteSetting(KEY);
}

export async function isValidShareToken(token: string | null | undefined): Promise<boolean> {
  if (!token) return false;
  const current = await getShareToken();
  if (!current) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(current);
  return a.length === b.length && timingSafeEqual(a, b);
}
