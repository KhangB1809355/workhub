import { NextResponse } from 'next/server';
import { getPerson, listEntries } from '@/server/db';
import { appBaseUrl, mailConfigured, sendPaymentMail, unpaidWeeks } from '@/server/mail';
import { handler } from '@/server/route';
import { getShareToken, rotateShareToken } from '@/server/share';
import { BadRequest, obj } from '@/server/validate';

/** Admin only: whether email can be sent and which address links will use. */
export async function GET(req: Request) {
  return handler(async () => {
    const base = appBaseUrl(req);
    return {
      configured: mailConfigured(),
      base,
      isLocal: /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|$|\/)/.test(base),
      shareEnabled: !!(await getShareToken()),
    };
  })(req, undefined);
}

type Result = { personId: string; name: string; status: 'sent' | 'no-email' | 'nothing-due' | 'error'; error?: string };

/**
 * Admin only. Body: { personIds: string[] }.
 * Emails each person their unpaid weeks, the read-only share link and the payment QR code.
 * Turns sharing on if it was off (the email needs a working link).
 */
export async function POST(req: Request) {
  return handler(async (body) => {
    if (!mailConfigured()) throw new BadRequest('Chưa cấu hình gửi email (SMTP_HOST, SMTP_USER, SMTP_PASS trong .env.local)');
    const ids = obj(body).personIds;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) throw new BadRequest('personIds phải có từ 1 đến 100 người');

    let token = await getShareToken();
    const shareCreated = !token;
    if (!token) token = await rotateShareToken();
    const link = `${appBaseUrl(req)}/view/${token}`;
    const entries = await listEntries();

    const results: Result[] = [];
    for (const id of ids) {
      const p = typeof id === 'string' ? await getPerson(id) : null;
      if (!p) continue;
      if (!p.email) {
        results.push({ personId: p.id, name: p.name, status: 'no-email' });
        continue;
      }
      const weeks = unpaidWeeks(p.id, entries);
      if (!weeks.length) {
        results.push({ personId: p.id, name: p.name, status: 'nothing-due' });
        continue;
      }
      try {
        await sendPaymentMail({ ...p, email: p.email }, weeks, link);
        results.push({ personId: p.id, name: p.name, status: 'sent' });
      } catch (e) {
        console.error('send mail failed', p.email, e);
        results.push({ personId: p.id, name: p.name, status: 'error', error: e instanceof Error ? e.message : 'Lỗi gửi email' });
      }
    }
    return NextResponse.json({ results, shareCreated, link });
  })(req, undefined);
}
