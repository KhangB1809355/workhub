import 'server-only';
import path from 'node:path';
import nodemailer from 'nodemailer';
import { BANK } from '@/lib/bank';
import { addDays, ddmm, ddmmyyyy, isoWeek, startOfWeek, weekday } from '@/lib/date';
import type { Entry, Person } from '@/lib/finance';

const QR_PATH = path.join(process.cwd(), 'src', 'assets', 'qr_card.jpg');

/** SMTP settings from .env.local (works with Gmail app passwords and most providers). */
function smtp() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT || 465);
  return {
    configured: !!(host && user && pass),
    host,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    user,
    pass,
    from: process.env.MAIL_FROM || user,
  };
}

export function mailConfigured(): boolean {
  return smtp().configured;
}

/** Base URL put into emails. Set APP_URL in production so links work outside this computer. */
export function appBaseUrl(req: Request): string {
  return (process.env.APP_URL || new URL(req.url).origin).replace(/\/+$/, '');
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const money = (k: number) => `${Math.round(k * 1000).toLocaleString('vi-VN')}đ`;
const oneLine = (s: string) => s.replace(/[\r\n]+/g, ' ').trim();

export interface UnpaidWeek {
  start: string;
  items: Entry[];
  total: number;
}

/** A person's unpaid entries grouped by week, newest week first. */
export function unpaidWeeks(personId: string, entries: Entry[]): UnpaidWeek[] {
  const weeks = new Map<string, Entry[]>();
  for (const e of entries) {
    if (e.personId !== personId || e.paid) continue;
    const w = startOfWeek(e.date);
    weeks.set(w, [...(weeks.get(w) ?? []), e]);
  }
  return [...weeks.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([start, items]) => ({
      start,
      items: items.sort((a, b) => (a.date < b.date ? -1 : 1)),
      total: items.reduce((s, e) => s + e.amount, 0),
    }));
}

export const MAIL_TITLE = 'Thanh toán chi phí ăn uống';

/** "Phạm Đoàn Khang" -> "Pham Doan Khang" (bank transfer notes should avoid diacritics). */
const plain = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^\w .-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Suggested transfer note, e.g. "A.Phong TT an uong T45-46". */
export function transferNote(name: string, weeks: UnpaidWeek[]): string {
  const nums = [...new Set(weeks.map((w) => isoWeek(w.start)))].sort((a, b) => a - b);
  const range = nums.length > 1 ? `${nums[0]}-${nums[nums.length - 1]}` : `${nums[0] ?? ''}`;
  return `${plain(name)} TT an uong T${range}`.trim();
}

// Palette (inline styles only: email clients ignore <style> blocks unevenly)
const C = {
  bg: '#F3F4F8',
  card: '#FFFFFF',
  ink: '#0F172A',
  muted: '#64748B',
  faint: '#94A3B8',
  line: '#E8EAF2',
  brand: '#1E1B4B',
  brand2: '#4F46E5',
  accent: '#EA580C',
  accentBg: '#FFF4EC',
  soft: '#F8F9FC',
};
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function render(person: Person, weeks: UnpaidWeek[], link: string) {
  const total = weeks.reduce((s, w) => s + w.total, 0);
  const count = weeks.reduce((s, w) => s + w.items.length, 0);
  const note = transferNote(person.name, weeks);
  const oldest = weeks[weeks.length - 1]?.start;
  const newest = weeks[0]?.start;
  const period = oldest && newest ? `${ddmm(oldest)} – ${ddmmyyyy(addDays(newest, 6))}` : '';

  const weekBlocks = weeks
    .map(
      (w) => `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.line};border-radius:14px;border-collapse:separate;margin:0 0 12px">
        <tr>
          <td style="padding:12px 16px;background:${C.soft};border-radius:14px 14px 0 0;border-bottom:1px solid ${C.line}">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="font:700 14px/1.3 ${FONT};color:${C.ink}">Tuần ${isoWeek(w.start)}
                <div style="font:400 12px/1.4 ${FONT};color:${C.muted};margin-top:2px">${ddmm(w.start)} – ${ddmmyyyy(addDays(w.start, 6))}</div>
              </td>
              <td align="right" style="font:800 16px/1.3 ${FONT};color:${C.accent};white-space:nowrap">${money(w.total)}</td>
            </tr></table>
          </td>
        </tr>
        ${w.items
          .map(
            (e, i) => `
        <tr>
          <td style="padding:10px 16px;${i ? `border-top:1px solid ${C.line};` : ''}">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td width="74" style="font:600 12px/1.4 ${FONT};color:${C.muted};white-space:nowrap">${weekday(e.date)} · ${ddmm(e.date)}</td>
              <td style="font:500 14px/1.4 ${FONT};color:${C.ink};padding:0 8px">${esc(e.content)}</td>
              <td align="right" style="font:700 14px/1.4 ${FONT};color:${C.ink};white-space:nowrap">${money(e.amount)}</td>
            </tr></table>
          </td>
        </tr>`,
          )
          .join('')}
      </table>`,
    )
    .join('');

  const infoRow = (label: string, value: string, big = false) => `
    <tr>
      <td style="padding:7px 0;font:400 13px/1.4 ${FONT};color:${C.muted};white-space:nowrap;vertical-align:top">${label}</td>
      <td align="right" style="padding:7px 0 7px 12px;font:${big ? '800 17px' : '700 14px'}/1.4 ${FONT};color:${C.ink};letter-spacing:${big ? '.04em' : '0'}">${value}</td>
    </tr>`;

  const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${MAIL_TITLE}</title></head>
<body style="margin:0;padding:0;background:${C.bg};-webkit-text-size-adjust:100%">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">Cần thanh toán ${money(total)} chi phí ăn uống (${weeks.length} tuần). Quét mã QR để chuyển khoản.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}">
    <tr><td align="center" style="padding:28px 12px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">

        <!-- Header -->
        <tr><td style="background:${C.brand};background-image:linear-gradient(135deg,${C.brand} 0%,#312E81 55%,${C.brand2} 100%);border-radius:20px 20px 0 0;padding:28px 28px 26px">
          <div style="font:700 11px/1 ${FONT};letter-spacing:.14em;text-transform:uppercase;color:#C7D2FE">🍜 ${MAIL_TITLE}</div>
          <div style="font:800 24px/1.3 ${FONT};color:#FFFFFF;margin-top:12px">Chào ${esc(person.name)} 👋</div>
          <div style="font:400 14px/1.5 ${FONT};color:#E0E7FF;margin-top:6px">Đây là các khoản ăn uống bạn chưa thanh toán${period ? ` (${period})` : ''}.</div>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:${C.card};padding:24px 28px 8px">

          <!-- Amount -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.accentBg};border-radius:16px">
            <tr><td align="center" style="padding:20px 16px">
              <div style="font:600 12px/1 ${FONT};letter-spacing:.08em;text-transform:uppercase;color:${C.muted}">Số tiền cần thanh toán</div>
              <div style="font:800 34px/1.2 ${FONT};color:${C.accent};margin-top:10px">${money(total)}</div>
              <div style="font:400 13px/1.4 ${FONT};color:${C.muted};margin-top:6px">${count} khoản · ${weeks.length} tuần</div>
            </td></tr>
          </table>

          <div style="font:700 15px/1.4 ${FONT};color:${C.ink};margin:26px 0 12px">Chi tiết theo tuần</div>
          ${weekBlocks}

          <!-- Payment -->
          <div style="font:700 15px/1.4 ${FONT};color:${C.ink};margin:26px 0 12px">Thanh toán bằng chuyển khoản</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.line};border-radius:16px;border-collapse:separate">
            <tr><td align="center" style="padding:22px 16px 6px">
              <img src="cid:qr" width="200" alt="Mã QR chuyển khoản ${esc(BANK.name)}" style="display:block;width:200px;max-width:100%;height:auto;border-radius:14px;border:0">
              <div style="font:400 12px/1.4 ${FONT};color:${C.faint};margin-top:10px">Mở app ngân hàng → Quét mã QR</div>
            </td></tr>
            <tr><td style="padding:8px 20px 16px">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${infoRow('Ngân hàng', esc(BANK.name))}
                ${infoRow('Chủ tài khoản', esc(BANK.holder))}
                ${infoRow('Số tài khoản', esc(BANK.account), true)}
                ${infoRow('Số tiền', `<span style="color:${C.accent}">${money(total)}</span>`)}
                ${infoRow('Nội dung', esc(note))}
              </table>
            </td></tr>
          </table>

          <!-- CTA -->
          <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:26px auto 8px">
            <tr><td align="center" bgcolor="${C.brand2}" style="border-radius:12px">
              <a href="${esc(link)}" target="_blank" style="display:inline-block;padding:13px 26px;font:700 14px/1 ${FONT};color:#FFFFFF;text-decoration:none;border-radius:12px">Xem bảng chi phí ăn uống →</a>
            </td></tr>
          </table>
          <div style="text-align:center;font:400 12px/1.5 ${FONT};color:${C.faint};margin:0 0 20px">Bảng chỉ để xem, cập nhật liên tục.</div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:${C.card};border-top:1px solid ${C.line};border-radius:0 0 20px 20px;padding:16px 28px 22px">
          <div style="font:400 12px/1.6 ${FONT};color:${C.muted};text-align:center">Nếu bạn đã chuyển khoản, vui lòng bỏ qua email này. Cảm ơn bạn! 🙏</div>
        </td></tr>
        <tr><td style="padding:14px 0 0;text-align:center;font:400 11px/1.5 ${FONT};color:${C.faint}">${MAIL_TITLE}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `${MAIL_TITLE.toUpperCase()}`,
    ``,
    `Chào ${person.name},`,
    `Số tiền cần thanh toán: ${money(total)} (${count} khoản, ${weeks.length} tuần)${period ? ` · ${period}` : ''}`,
    ...weeks.flatMap((w) => [
      ``,
      `Tuần ${isoWeek(w.start)} (${ddmm(w.start)} – ${ddmmyyyy(addDays(w.start, 6))}): ${money(w.total)}`,
      ...w.items.map((e) => `  • ${weekday(e.date)} ${ddmm(e.date)}  ${e.content}: ${money(e.amount)}`),
    ]),
    ``,
    `Chuyển khoản:`,
    `  Ngân hàng:     ${BANK.name}`,
    `  Chủ tài khoản: ${BANK.holder}`,
    `  Số tài khoản:  ${BANK.account}`,
    `  Số tiền:       ${money(total)}`,
    `  Nội dung:      ${note}`,
    `  (Mã QR đính kèm)`,
    ``,
    `Xem bảng chi phí ăn uống: ${link}`,
    ``,
    `Nếu bạn đã chuyển khoản, vui lòng bỏ qua email này. Cảm ơn bạn!`,
  ].join('\n');

  return { html, text, total };
}

/** HTML + text of the reminder, without sending (used for previews). */
export function renderPaymentMail(person: Person, weeks: UnpaidWeek[], link: string) {
  return render(person, weeks, link);
}

/** Sends one payment reminder with the share link and the QR code embedded. */
export async function sendPaymentMail(person: Person & { email: string }, weeks: UnpaidWeek[], link: string) {
  const cfg = smtp();
  if (!cfg.configured) throw new Error('Chưa cấu hình SMTP trong .env.local');
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  const { html, text, total } = render(person, weeks, link);
  await transport.sendMail({
    from: cfg.from,
    to: person.email,
    subject: oneLine(`${MAIL_TITLE}: ${person.name} cần thanh toán ${money(total)}`),
    text,
    html,
    attachments: [{ filename: 'qr-chuyen-khoan.jpg', path: QR_PATH, cid: 'qr' }],
  });
}
