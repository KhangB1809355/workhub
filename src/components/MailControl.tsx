'use client';

import { debtOf } from '@/lib/finance';

import { useEffect, useState } from 'react';
import { CARD, FAINT, MUTED } from '@/lib/constants';
import type { Entry, Person } from '@/lib/finance';
import { sendMail, summarizeResults, type MailResult, type MailStatus } from '@/lib/mail';
import { Icon } from './Icon';

const money = (k: number) => `${Math.round(k * 1000).toLocaleString('vi-VN')}đ`;

/**
 * Admin only: ONE "Gửi email" button. The dialog lists everyone who has an email address and something unpaid
 * (all ticked by default); the admin picks who to send to, then everything goes out in a single request.
 */
export function MailControl({ people, entries, status, flash }: { people: Person[]; entries: Entry[]; status: MailStatus | null; flash: (msg: string) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<MailResult[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy]);

  const due = new Map<string, number>();
  for (const e of entries) if (!e.paid) due.set(e.personId, (due.get(e.personId) ?? 0) + e.amount);
  // Opening debt counts too (it is included in the email).
  for (const p of people) if (debtOf(p)) due.set(p.id, (due.get(p.id) ?? 0) + debtOf(p));
  const owing = people.filter((p) => (due.get(p.id) ?? 0) > 0);
  const recipients = owing.filter((p) => p.email);
  const missing = owing.filter((p) => !p.email);
  const chosen = recipients.filter((p) => selected.has(p.id));
  const allChosen = recipients.length > 0 && chosen.length === recipients.length;

  const openDialog = () => {
    setSelected(new Set(recipients.map((p) => p.id)));
    setResults(null);
    setOpen(true);
  };
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () => setSelected(allChosen ? new Set() : new Set(recipients.map((p) => p.id)));

  const send = async () => {
    setBusy(true);
    try {
      const r = await sendMail(chosen.map((p) => p.id));
      setResults(r.results);
      flash(summarizeResults(r.results) + (r.shareCreated ? ' · đã bật link chia sẻ' : ''));
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Gửi email thất bại');
    }
    setBusy(false);
  };

  const close = () => {
    if (busy) return;
    setOpen(false);
    setResults(null);
  };
  const canSend = !!status?.configured && chosen.length > 0 && !busy;

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="flex h-10 items-center gap-2 rounded-xl border border-white/25 px-3.5 text-[13px] font-bold text-white transition hover:bg-white/10"
      >
        <Icon name="mail" strokeWidth={2.2} />
        Gửi email
        {recipients.length > 0 && <span className="rounded-full bg-white/20 px-1.5 text-[11px]">{recipients.length}</span>}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center text-slate-900 sm:items-center dark:text-slate-100">
          <button type="button" aria-label="Đóng" onClick={close} className="absolute inset-0 cursor-default bg-slate-900/45 dark:bg-black/60" />
          <div role="dialog" aria-modal="true" aria-label="Gửi email nhắc thanh toán" className={`${CARD} relative flex max-h-[85vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-b-none p-5 sm:rounded-b-[18px]`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold">Gửi email nhắc thanh toán</h2>
                <p className={`text-[13px] ${MUTED}`}>Mỗi người nhận số tiền chưa trả theo tuần, link xem bảng và mã QR chuyển khoản.</p>
              </div>
              <button type="button" onClick={close} aria-label="Đóng" className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg ${FAINT} hover:bg-slate-100 dark:hover:bg-[#1B2238]`}>
                <Icon name="x" strokeWidth={2.2} />
              </button>
            </div>

            {status && !status.configured && (
              <div className="rounded-xl bg-amber-50 px-3.5 py-3 text-[13px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                Chưa cấu hình gửi email. Thêm <code>SMTP_HOST</code>, <code>SMTP_USER</code>, <code>SMTP_PASS</code> vào <code>.env.local</code> rồi khởi động lại app.
              </div>
            )}
            {status?.configured && status.isLocal && (
              <div className="rounded-xl bg-amber-50 px-3.5 py-3 text-[13px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                Link trong email sẽ là <b>{status.base}</b>, người nhận không mở được. Hãy đặt <code>APP_URL</code> khi app chạy trên tên miền thật.
              </div>
            )}

            {results ? (
              <ul className="flex flex-col gap-1.5 text-[13px]">
                {results.map((r) => (
                  <li key={r.personId} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-[#1B2238]">
                    <span className="font-semibold">{r.name}</span>
                    <span
                      className={
                        r.status === 'sent' ? 'font-bold text-green-700 dark:text-emerald-300' : r.status === 'error' ? 'font-bold text-red-700 dark:text-red-300' : FAINT
                      }
                    >
                      {r.status === 'sent' ? '✓ Đã gửi' : r.status === 'error' ? `Lỗi: ${r.error ?? ''}` : r.status === 'no-email' ? 'Chưa có email' : 'Đã trả đủ'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold">
                      Chọn người nhận ({chosen.length}/{recipients.length})
                    </p>
                    {recipients.length > 1 && (
                      <button type="button" onClick={toggleAll} className="text-[13px] font-semibold text-indigo-600 hover:underline dark:text-indigo-300">
                        {allChosen ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                      </button>
                    )}
                  </div>
                  {recipients.length === 0 ? (
                    <p className={`text-[13px] ${MUTED}`}>Không có ai vừa có email vừa còn khoản chưa trả.</p>
                  ) : (
                    <ul className="flex flex-col gap-1 text-[13px]">
                      {recipients.map((p) => (
                        <li key={p.id}>
                          <label
                            className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 transition hover:bg-slate-100 dark:bg-[#1B2238] dark:hover:bg-[#232B45] ${selected.has(p.id) ? '' : 'opacity-60'}`}
                          >
                            <span className="flex min-w-0 items-center gap-2.5">
                              <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} disabled={busy} className="h-4 w-4 flex-none accent-indigo-600" />
                              <span className="min-w-0">
                                <span className="font-semibold">{p.name}</span>
                                <span className={`ml-2 text-xs ${FAINT}`}>{p.email}</span>
                              </span>
                            </span>
                            <b className="whitespace-nowrap tabular-nums text-orange-700 dark:text-orange-300">{money(due.get(p.id) ?? 0)}</b>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {missing.length > 0 && (
                  <p className={`text-xs ${FAINT}`}>
                    Chưa có email (sẽ không nhận): {missing.map((p) => p.name).join(', ')}. Thêm email bằng icon 👁 cạnh tên.
                  </p>
                )}
              </>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={close} disabled={busy} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50 dark:border-[#2A3350] dark:hover:bg-[#1B2238]">
                {results ? 'Đóng' : 'Hủy'}
              </button>
              {!results && (
                <button
                  type="button"
                  onClick={send}
                  disabled={!canSend}
                  className="flex h-10 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500"
                >
                  <Icon name="mail" />
                  {busy ? 'Đang gửi…' : `Gửi cho ${chosen.length} người`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
