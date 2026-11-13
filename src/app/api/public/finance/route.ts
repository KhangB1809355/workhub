import { NextResponse } from 'next/server';
import { financeSnapshot } from '@/server/db';
import { isValidShareToken } from '@/server/share';

/**
 * Read-only finance data for people holding the share link (no login).
 * Only GET exists here; every route that changes data still requires login.
 * Served from a short server cache to keep database reads low.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('t');
  if (!(await isValidShareToken(token))) return NextResponse.json({ error: 'Link không hợp lệ hoặc đã bị thu hồi' }, { status: 404 });
  return NextResponse.json(await financeSnapshot(), { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}
