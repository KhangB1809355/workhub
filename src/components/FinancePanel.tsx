'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CARD, FAINT, FIELD, LABEL, MUTED } from '@/lib/constants';
import { addDays, ddmm, ddmmyyyy, isoWeek, startOfWeek, weekday } from '@/lib/date';
import { debtOf, money, paidAtLabel, totals, type Entry, type FinanceStore, type Person } from '@/lib/finance';
import { isDriveUrl } from '@/lib/drive';
import Image from 'next/image';
import qrCard from '@/assets/qr_card.jpg';
import { BANK, transferNote } from '@/lib/bank';
import { VietQr } from './VietQr';
import { Icon } from './Icon';
import { looksLikeEmail, useMailStatus } from '@/lib/mail';
import { MailControl } from './MailControl';
import { ShareControl } from './ShareControl';

// Tạm ẩn khối "Thống kê theo tuần". Đổi thành true để hiện lại.
const SHOW_WEEK_STATS = false;

const ghostBtn =
  'flex h-11 items-center justify-center rounded-xl border border-white/20 text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white';
const navBtn =
  'flex h-10 items-center justify-center rounded-xl border border-slate-200 text-sm font-semibold transition hover:bg-slate-50 dark:border-[#2A3350] dark:hover:bg-[#1B2238]';

function parseK(s: string): number {
  const n = Number(s.replace(',', '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** 90 -> "90", 12.5 -> "12,5" (thousands of VND, compact for grid cells). */
const k = (n: number) => n.toLocaleString('vi-VN');

/** Amount input (thousands of VND) that keeps its own text while typing and commits on blur / Enter. */
function AmountInput({ value, onCommit, label, className }: { value: number; onCommit: (n: number) => void; label: string; className: string }) {
  const [text, setText] = useState(String(value));
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setText(String(value));
  }
  const commit = () => {
    const n = parseK(text);
    if (n > 0 && n !== value) onCommit(n);
    else setText(String(value));
  };
  return (
    <input
      inputMode="decimal"
      aria-label={label}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className={className}
    />
  );
}

/** Grid input for a person's debt from before (thousands of VND). Empty or 0 clears it; commits on blur / Enter. */
function DebtInput({ value, onCommit, label }: { value: number; onCommit: (n: number) => void; label: string }) {
  const shown = value ? String(value).replace('.', ',') : '';
  const [text, setText] = useState(shown);
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setText(shown);
  }
  const commit = () => {
    const n = text.trim() ? parseK(text) : 0;
    if (text.trim() && !n) return setText(shown);
    if (n !== value) onCommit(n);
    else setText(shown);
  };
  return (
    <input
      inputMode="decimal"
      aria-label={label}
      title="Số tiền nợ trước đó (nghìn đồng). Xóa trống để bỏ."
      placeholder="+ nợ"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className={`h-13 w-full rounded-lg border border-transparent bg-transparent px-2 text-center text-base font-bold tabular-nums outline-none transition placeholder:text-xs placeholder:font-medium placeholder:text-slate-300 hover:border-slate-200 focus:border-indigo-500 focus:bg-white dark:placeholder:text-slate-600 dark:hover:border-[#2A3350] dark:focus:bg-[#0F1527] ${
        value ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300' : ''
      }`}
    />
  );
}

/** Dialog for one cell (one person, one day): list, edit, add and mark entries as paid. */
function CellDialog({
  person,
  people,
  date,
  entries,
  suggestions,
  store,
  onClose,
  readOnly = false,
}: {
  readOnly?: boolean;
  /** null = the whole day (opened from the day column header) */
  person: Person | null;
  people: Person[];
  date: string;
  entries: Entry[];
  suggestions: string[];
  store: FinanceStore;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(person ? [person.id] : []));
  const [content, setContent] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const c = content.trim();
    const n = parseK(amount);
    const ids = people.filter((p) => picked.has(p.id)).map((p) => p.id);
    if (!ids.length) return setError('Chọn ít nhất một người');
    if (!c) return setError('Nhập nội dung');
    if (!n) return setError('Nhập giá tiền');
    setError(null);
    store.addEntries(ids.map((personId) => ({ personId, content: c, date, amount: n })));
    setContent('');
    setAmount('');
    first.current?.focus();
  };

  const t = totals(entries);
  const names = new Map(people.map((p) => [p.id, p.name]));
  const toggle = (id: string) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const title = person ? person.name : `Cả ngày ${weekday(date)} ${ddmm(date)}`;
  const field = `${FIELD} h-10`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" aria-label="Đóng" onClick={onClose} className="absolute inset-0 cursor-default bg-slate-900/45 dark:bg-black/60" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${title} – ${weekday(date)} ${ddmm(date)}`}
        className={`${CARD} relative flex max-h-[85vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-b-none p-5 sm:rounded-b-[18px]`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold">{title}</h2>
            <p className={`text-[13px] ${MUTED}`}>
              {weekday(date)}, {ddmmyyyy(date)} · tuần {isoWeek(date)}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className={`flex h-9 w-9 items-center justify-center rounded-lg ${FAINT} hover:bg-slate-100 dark:hover:bg-[#1B2238]`}>
            <Icon name="x" strokeWidth={2.2} />
          </button>
        </div>

        {entries.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {entries.map((e) => (
              <div key={e.id} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${e.paid ? 'bg-green-50 dark:bg-emerald-950/40' : 'bg-slate-50 dark:bg-[#1B2238]'}`}>
                {!person && <span className="w-20 flex-none truncate pl-1 text-xs font-bold">{names.get(e.personId) ?? '?'}</span>}
                {readOnly ? (
                  <>
                    <span className="min-w-0 flex-1 truncate px-2 py-1.5 text-sm font-semibold">{e.content}</span>
                    <span className="px-2 text-sm font-bold tabular-nums">{money(e.amount)}</span>
                    <span
                      className={`flex-none rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                        e.paid ? 'bg-green-600 text-white dark:bg-emerald-500' : 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300'
                      }`}
                    >
                      {e.paid ? `✓ Đã trả${e.paidAt ? ` ${paidAtLabel(e.paidAt, false).slice(0, 5)}` : ''}` : 'Chưa trả'}
                    </span>
                  </>
                ) : (
                <>
                <input
                  key={e.content}
                  aria-label="Nội dung"
                  defaultValue={e.content}
                  onBlur={(ev) => {
                    const c = ev.target.value.trim();
                    if (c && c !== e.content) store.updateEntry(e.id, { content: c });
                    else ev.target.value = e.content;
                  }}
                  onKeyDown={(ev) => ev.key === 'Enter' && (ev.target as HTMLInputElement).blur()}
                  className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1.5 text-sm font-semibold outline-none focus:bg-white dark:focus:bg-[#0F1527]"
                />
                <AmountInput
                  value={e.amount}
                  label={`Giá tiền – ${e.content}`}
                  onCommit={(amount) => store.updateEntry(e.id, { amount })}
                  className="w-20 rounded-lg bg-transparent px-2 py-1.5 text-right text-sm font-bold tabular-nums outline-none focus:bg-white dark:focus:bg-[#0F1527]"
                />
                <button
                  type="button"
                  onClick={() => store.updateEntry(e.id, { paid: !e.paid })}
                  aria-pressed={e.paid}
                  title={e.paid && e.paidAt ? `Đã trả lúc ${paidAtLabel(e.paidAt)} · bấm để bỏ` : undefined}
                  className={`h-8 flex-none rounded-lg px-2.5 text-xs font-bold transition ${
                    e.paid
                      ? 'bg-green-600 text-white dark:bg-emerald-500'
                      : 'border border-slate-300 text-slate-600 hover:border-green-600 hover:text-green-700 dark:border-slate-600 dark:text-slate-300'
                  }`}
                >
                  {e.paid ? `✓ Đã trả${e.paidAt ? ` ${paidAtLabel(e.paidAt, false).slice(0, 5)}` : ''}` : 'Chưa trả'}
                </button>
                <button
                  type="button"
                  aria-label={`Xóa ${e.content}`}
                  onClick={() => store.deleteEntry(e.id)}
                  className={`flex h-8 w-8 flex-none items-center justify-center rounded-lg ${FAINT} hover:bg-red-50 hover:text-red-600 dark:hover:bg-[#3A1D24] dark:hover:text-red-300`}
                >
                  <Icon name="trash" />
                </button>
                </>
                )}
              </div>
            ))}
            <p className="px-2 text-right text-[13px] tabular-nums">
              Tổng ngày: <b>{money(t.total)}</b>
              {t.due > 0 && <span className="ml-2 text-orange-700 dark:text-orange-300">chưa trả {money(t.due)}</span>}
            </p>
          </div>
        )}

        {readOnly && entries.length === 0 && <p className={`text-sm ${MUTED}`}>Chưa có khoản nào.</p>}
        {!readOnly && (
        <form onSubmit={add} className="flex flex-col gap-2.5 border-t border-slate-100 pt-4 dark:border-[#232B45]">
          <p className="text-sm font-bold">Thêm khoản</p>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-xs font-semibold ${MUTED}`}>
                Người ({picked.size} đã chọn)
              </span>
              <button
                type="button"
                onClick={() => setPicked(picked.size === people.length ? new Set() : new Set(people.map((p) => p.id)))}
                className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
              >
                {picked.size === people.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {people.map((p) => {
                const on = picked.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(p.id)}
                    className={`min-h-8 rounded-full border px-3 text-xs font-semibold transition ${
                      on
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-800 dark:border-indigo-400 dark:bg-[#2B2F63] dark:text-indigo-200'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-[#2A3350] dark:text-slate-400'
                    }`}
                  >
                    {on && '✓ '}
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-2">
            <label className={`${LABEL} min-w-0 flex-1`}>
              Nội dung
              <input ref={first} list="finance-contents" value={content} onChange={(e) => setContent(e.target.value)} placeholder="VD: Bún sáng" className={field} />
            </label>
            <label className={`${LABEL} w-28`}>
              Giá (nghìn đ)
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="90" className={`${field} text-right`} />
            </label>
          </div>
          <datalist id="finance-contents">
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          {error && <p className="text-[13px] font-semibold text-red-700 dark:text-red-300">{error}</p>}
          <button
            type="submit"
            className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 text-sm font-bold text-white transition hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            <Icon name="plus" strokeWidth={2.4} />
            {picked.size > 1 ? `Thêm cho ${picked.size} người` : 'Thêm'}
          </button>
        </form>
        )}
      </div>
    </div>
  );
}

type PanelKey = 'grid' | 'stats' | 'rank';

/** Expand / restore button shown in each panel header. */
/** Email field inside the person popup (admin only). Sending is done with the single "Gửi email" button in the header. */
function EmailBox({ person, onEmail }: { person: Person; onEmail: (email: string | null) => void }) {
  const [value, setValue] = useState(person.email ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const v = value.trim();
    if (v === (person.email ?? '')) return setError(null);
    if (v && !looksLikeEmail(v)) return setError('Email không hợp lệ');
    setError(null);
    onEmail(v || null);
  };

  return (
    <div className="flex flex-none flex-col gap-1.5 border-b border-slate-100 px-5 py-3.5 dark:border-[#232B45]">
      <label className={`flex items-center gap-2 text-xs font-semibold ${MUTED}`}>
        <Icon name="mail" className="h-4 w-4" />
        Email nhận nhắc thanh toán
      </label>
      <input
        type="email"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        placeholder="vd: ten@gmail.com"
        aria-label={`Email của ${person.name}`}
        className={`${FIELD} h-10 text-[13px]`}
      />
      {error && <p className="text-xs font-semibold text-red-700 dark:text-red-300">{error}</p>}
    </div>
  );
}

/** Opening-debt editor inside the person popup (admin only): amount in thousands + optional note. */
function DebtBox({ person, onDebt }: { person: Person; onDebt: (debt: number, note: string | null) => void }) {
  const cur = debtOf(person);
  const [amount, setAmount] = useState(cur ? String(cur) : '');
  const [note, setNote] = useState(person.debtNote ?? '');
  const [prev, setPrev] = useState({ cur, note: person.debtNote ?? '' });
  if (prev.cur !== cur || prev.note !== (person.debtNote ?? '')) {
    setPrev({ cur, note: person.debtNote ?? '' });
    setAmount(cur ? String(cur) : '');
    setNote(person.debtNote ?? '');
  }
  const n = amount.trim() ? parseK(amount) : 0;
  const changed = n !== cur || (n > 0 && note.trim() !== (person.debtNote ?? ''));
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount.trim() && !n) return;
    onDebt(n, note.trim() || null);
  };

  return (
    <form onSubmit={save} className="flex flex-none flex-col gap-1.5 border-b border-slate-100 px-5 py-3.5 dark:border-[#232B45]">
      <label htmlFor={`debt-${person.id}`} className={`flex items-center gap-2 text-xs font-semibold ${MUTED}`}>
        <Icon name="wallet" className="h-4 w-4" />
        Nợ trước đó (nghìn đồng)
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={`debt-${person.id}`}
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="vd: 150"
          className={`${FIELD} h-10 w-28 text-right text-[13px] font-bold tabular-nums`}
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={120}
          placeholder="Ghi chú, vd: nợ tháng 10"
          aria-label={`Ghi chú nợ cũ của ${person.name}`}
          className={`${FIELD} h-10 min-w-0 flex-1 text-[13px]`}
        />
        <button
          type="submit"
          disabled={!changed || (!!amount.trim() && !n)}
          className="flex h-10 items-center rounded-xl bg-indigo-600 px-3.5 text-xs font-bold text-white transition hover:bg-indigo-700 disabled:opacity-40 dark:bg-indigo-500"
        >
          Lưu
        </button>
      </div>
      {!!amount.trim() && !n && <p className="text-xs font-semibold text-red-700 dark:text-red-300">Số tiền không hợp lệ</p>}
      <p className={`text-[11px] ${FAINT}`}>Được cộng vào “Chưa trả tất cả”, bảng Xếp hạng và email nhắc. Để trống rồi Lưu để xóa.</p>
    </form>
  );
}

/** Link to the shared Google Drive folder; the owner can also set, change or remove it. */
function DriveLink({ url, onChange, flash }: { url: string | null; onChange?: (url: string | null) => void; flash: (msg: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(url ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setEditing(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [editing]);

  if (!url && !onChange) return null;
  const open = () => {
    setValue(url ?? '');
    setError(null);
    setEditing(true);
  };
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (v && !isDriveUrl(v)) return setError('Hãy dán link Google Drive (https://drive.google.com/… hoặc https://docs.google.com/…)');
    onChange?.(v || null);
    setEditing(false);
    flash(v ? 'Đã lưu link Google Drive' : 'Đã xóa link Google Drive');
  };
  const pill = 'flex h-10 items-center gap-2 rounded-xl px-3.5 text-[13px] font-bold transition';

  return (
    <>
      {url ? (
        <span className="flex">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            title="Kiểm tra số tiền nợ trước đó trên Google Drive"
            className={`${pill} border border-white/25 text-white hover:bg-white/10 ${onChange ? 'rounded-r-none border-r-0' : ''}`}
          >
            <Icon name="folder" className="h-4 w-4" strokeWidth={2.1} />
            Google Drive
          </a>
          {onChange && (
            <button
              type="button"
              onClick={open}
              aria-label="Sửa link Google Drive"
              title="Sửa link Google Drive"
              className="flex h-10 items-center rounded-r-xl border border-white/25 px-2 text-[11px] font-bold text-indigo-200 transition hover:bg-white/10"
            >
              Sửa
            </button>
          )}
        </span>
      ) : (
        <button type="button" onClick={open} className={`${pill} border border-dashed border-white/35 text-indigo-100 hover:bg-white/10`}>
          <Icon name="folder" className="h-4 w-4" strokeWidth={2.1} />
          Thêm link Drive
        </button>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center text-slate-900 sm:items-center dark:text-slate-100">
          <button type="button" aria-label="Đóng" onClick={() => setEditing(false)} className="absolute inset-0 cursor-default bg-slate-900/45 dark:bg-black/60" />
          <form
            onSubmit={save}
            role="dialog"
            aria-modal="true"
            aria-label="Link Google Drive"
            className={`${CARD} relative flex w-full max-w-lg flex-col gap-3 rounded-b-none p-5 sm:rounded-b-[18px]`}
          >
            <div>
              <h2 className="text-lg font-extrabold">Link Google Drive</h2>
              <p className={`text-[13px] ${MUTED}`}>
                File/thư mục trên Drive ghi số tiền nợ trước đó, để mọi người kiểm tra lại. Hiện trên bảng (cột “Nợ trước đó”), trang chia sẻ và trong email nhắc. Nhớ bật quyền “Bất kỳ ai có đường liên kết” trên Drive.
              </p>
            </div>
            <input
              autoFocus
              type="url"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/…"
              aria-label="Link Google Drive"
              className={`${FIELD} h-10 text-[13px]`}
            />
            {error && <p className="text-xs font-semibold text-red-700 dark:text-red-300">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              {url && (
                <button
                  type="button"
                  onClick={() => {
                    onChange?.(null);
                    setEditing(false);
                    flash('Đã xóa link Google Drive');
                  }}
                  className="mr-auto flex h-10 items-center rounded-xl px-3.5 text-sm font-bold text-red-700 transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-[#3A1D24]"
                >
                  Xóa link
                </button>
              )}
              <button type="button" onClick={() => setEditing(false)} className={`${navBtn} px-4`}>
                Hủy
              </button>
              <button type="submit" className="flex h-10 items-center rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white transition hover:bg-indigo-700 dark:bg-indigo-500">
                Lưu
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

/** Popup: every week in which one person still has unpaid entries. */
function UnpaidWeeksDialog({
  person,
  entries,
  readOnly,
  onToggle,
  onPayWeek,
  onGoWeek,
  onClose,
  onEmail,
  onDebt,
  driveUrl,
}: {
  /** Shared Google Drive link for checking the debt from before. */
  driveUrl?: string | null;
  /** Admin only: edit the person's email. */
  onEmail?: (email: string | null) => void;
  /** Admin only: edit / clear the person's opening debt. */
  onDebt?: (debt: number, note: string | null) => void;
  person: Person;
  entries: Entry[];
  readOnly: boolean;
  onToggle: (e: Entry) => void;
  onPayWeek: (list: Entry[]) => void;
  onGoWeek: (start: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const unpaid = entries.filter((e) => e.personId === person.id && !e.paid);
  const weeks = new Map<string, Entry[]>();
  for (const e of unpaid) {
    const w = startOfWeek(e.date);
    weeks.set(w, [...(weeks.get(w) ?? []), e]);
  }
  const list = [...weeks.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([start, items]) => ({ start, items: items.sort((a, b) => (a.date < b.date ? -1 : 1)), total: totals(items).total }));
  const debt = debtOf(person);
  const grand = totals(unpaid).total + debt;

  // QR for everything unpaid (opening debt included), or for one week when "QR tuần này" is picked.
  const [qrWeek, setQrWeek] = useState<string | null>(null);
  const qrItems = qrWeek ? (list.find((w) => w.start === qrWeek)?.items ?? unpaid) : unpaid;
  const qrAmount = totals(qrItems).total + (qrWeek ? 0 : debt);
  const qrNote = transferNote(person.name, qrItems.map((e) => e.date));
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (what: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      /* clipboard blocked: the value is visible anyway */
    }
  };

  // Payment history: paid entries grouped by the day they were marked paid, newest first.
  const history = useMemo(() => {
    const days = new Map<string, Entry[]>();
    for (const e of entries) {
      if (e.personId !== person.id || !e.paid || !e.paidAt) continue;
      const day = paidAtLabel(e.paidAt, false);
      days.set(day, [...(days.get(day) ?? []), e]);
    }
    return [...days.values()]
      .map((items) => ({ at: items.reduce((m, e) => (e.paidAt! > m ? e.paidAt! : m), ''), items, total: totals(items).total }))
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, 12);
  }, [entries, person.id]);
  const paidNoDate = entries.filter((e) => e.personId === person.id && e.paid && !e.paidAt).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" aria-label="Đóng" onClick={onClose} className="absolute inset-0 cursor-default bg-slate-900/45 dark:bg-black/60" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Các tuần chưa trả của ${person.name}`}
        className={`${CARD} relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-b-none sm:rounded-b-[18px]`}
      >
        <div className="flex flex-none items-start justify-between gap-3 border-b border-slate-100 p-5 pb-4 dark:border-[#232B45]">
          <div>
            <h2 className="text-lg font-extrabold">{person.name}</h2>
            <p className={`text-[13px] ${MUTED}`}>
              {grand > 0 ? (
                <>
                  {[list.length ? `${list.length} tuần chưa trả` : '', debt ? 'nợ trước đó' : ''].filter(Boolean).join(' + ')} · tổng{' '}
                  <b className="text-orange-700 dark:text-orange-300">{money(grand)}</b>
                </>
              ) : (
                'Đã trả đủ tất cả các tuần 🎉'
              )}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg ${FAINT} hover:bg-slate-100 dark:hover:bg-[#1B2238]`}>
            <Icon name="x" strokeWidth={2.2} />
          </button>
        </div>

        {onEmail && <EmailBox person={person} onEmail={onEmail} />}
        {onDebt && <DebtBox person={person} onDebt={onDebt} />}

        {!readOnly && list.length + (debt ? 1 : 0) > 1 && (
          <div className="flex flex-none items-center justify-between gap-3 border-b border-slate-100 px-5 py-2.5 dark:border-[#232B45]">
            <span className={`text-[13px] ${MUTED}`}>Đã nhận đủ {money(grand)}?</span>
            <button
              type="button"
              onClick={() => {
                if (unpaid.length) onPayWeek(unpaid);
                if (debt) onDebt?.(0, null);
              }}
              className="flex h-8 items-center rounded-xl bg-green-600 px-3 text-xs font-bold text-white transition hover:bg-green-700 dark:bg-emerald-500"
            >
              ✓ Đã trả hết {unpaid.length ? `${unpaid.length} khoản` : ''}
              {unpaid.length && debt ? ' + ' : ''}
              {debt ? 'nợ trước đó' : ''}
            </button>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-5 pt-4">
          {qrAmount > 0 && (
            <section aria-label="Chuyển khoản bằng QR" className="flex flex-wrap items-center gap-4 rounded-2xl bg-orange-50 p-3.5 dark:bg-orange-950/30">
              <div className="mx-auto flex-none overflow-hidden rounded-xl bg-white p-1.5">
                <VietQr amount={qrAmount} note={qrNote} alt={`QR chuyển ${money(qrAmount)} cho ${BANK.holder}`} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-[13px]">
                <p className={`text-xs ${MUTED}`}>{qrWeek ? `QR tuần ${isoWeek(qrWeek)}` : 'QR toàn bộ khoản chưa trả'} · quét là có sẵn số tiền</p>
                <p className="text-xl font-extrabold tabular-nums text-orange-700 dark:text-orange-300">{money(qrAmount)}</p>
                <p className="min-w-0">
                  <span className={FAINT}>Nội dung: </span>
                  <b className="break-words">{qrNote}</b>
                </p>
                <p className={`text-xs ${FAINT}`}>
                  {BANK.name} · {BANK.account} · {BANK.holder}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => copy('amount', String(Math.round(qrAmount * 1000)))} className={`${navBtn} h-8 px-2.5 text-xs`}>
                    {copied === 'amount' ? '✓ Đã chép' : 'Chép số tiền'}
                  </button>
                  <button type="button" onClick={() => copy('note', qrNote)} className={`${navBtn} h-8 px-2.5 text-xs`}>
                    {copied === 'note' ? '✓ Đã chép' : 'Chép nội dung'}
                  </button>
                  {qrWeek && (
                    <button type="button" onClick={() => setQrWeek(null)} className={`${navBtn} h-8 px-2.5 text-xs`}>
                      QR tất cả
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}

          {debt > 0 && (
            <section aria-label="Nợ trước đó" className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-3.5 py-2.5 dark:border-[#2A3350]">
              <div className="min-w-0">
                <p className="text-sm font-bold">Nợ trước đó</p>
                <p className={`truncate text-xs ${FAINT}`}>
                  {person.debtNote || 'Trước khi dùng bảng này'}
                  {driveUrl && (
                    <>
                      {' · '}
                      <a href={driveUrl} target="_blank" rel="noreferrer" className="font-semibold text-indigo-600 hover:underline dark:text-indigo-300">
                        Kiểm tra trên Drive
                      </a>
                    </>
                  )}
                </p>
              </div>
              <div className="flex flex-none items-center gap-2">
                <span className="text-[15px] font-extrabold tabular-nums text-orange-700 dark:text-orange-300">{money(debt)}</span>
                {!readOnly && onDebt && (
                  <button
                    type="button"
                    onClick={() => onDebt(0, null)}
                    className="h-7 flex-none rounded-lg border border-slate-300 px-2 text-[11px] font-bold text-slate-600 transition hover:border-green-600 hover:text-green-700 dark:border-slate-600 dark:text-slate-300"
                  >
                    Đã trả
                  </button>
                )}
              </div>
            </section>
          )}

          {list.map((w) => (
            <section key={w.start} className="rounded-2xl border border-slate-200 dark:border-[#2A3350]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3.5 py-2.5 dark:border-[#232B45]">
                <div>
                  <p className="text-sm font-bold">Tuần {isoWeek(w.start)}</p>
                  <p className={`text-xs ${FAINT}`}>
                    {ddmm(w.start)} – {ddmmyyyy(addDays(w.start, 6))}
                  </p>
                </div>
                <span className="text-[15px] font-extrabold tabular-nums text-orange-700 dark:text-orange-300">{money(w.total)}</span>
              </div>
              <ul className="flex flex-col px-1.5 py-1.5">
                {w.items.map((e) => (
                  <li key={e.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px]">
                    <span className={`w-14 flex-none text-xs ${FAINT}`}>
                      {weekday(e.date)} {ddmm(e.date)}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{e.content}</span>
                    <span className="font-bold tabular-nums">{money(e.amount)}</span>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => onToggle(e)}
                        className="h-7 flex-none rounded-lg border border-slate-300 px-2 text-[11px] font-bold text-slate-600 transition hover:border-green-600 hover:text-green-700 dark:border-slate-600 dark:text-slate-300"
                      >
                        Đã trả
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-3.5 py-2 dark:border-[#232B45]">
                {list.length + (debt ? 1 : 0) > 1 && (
                  <button
                    type="button"
                    aria-pressed={qrWeek === w.start}
                    onClick={() => setQrWeek(qrWeek === w.start ? null : w.start)}
                    className={`${navBtn} h-8 px-3 text-xs ${qrWeek === w.start ? 'border-orange-400 text-orange-700 dark:text-orange-300' : ''}`}
                  >
                    QR tuần này
                  </button>
                )}
                <button type="button" onClick={() => onGoWeek(w.start)} className={`${navBtn} h-8 px-3 text-xs`}>
                  Xem tuần này
                </button>
                {!readOnly && w.items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onPayWeek(w.items)}
                    className="flex h-8 items-center rounded-xl bg-green-600 px-3 text-xs font-bold text-white transition hover:bg-green-700 dark:bg-emerald-500"
                  >
                    ✓ Đã trả cả tuần
                  </button>
                )}
              </div>
            </section>
          ))}

          {(history.length > 0 || paidNoDate > 0) && (
            <section aria-label="Lịch sử thanh toán" className="flex flex-col gap-1.5">
              <p className="text-sm font-bold">Lịch sử thanh toán</p>
              {history.map((h) => (
                <details key={h.at} className="rounded-xl bg-green-50 px-3 py-2 text-[13px] dark:bg-emerald-950/30">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <span>
                      <b>{paidAtLabel(h.at, false)}</b>
                      <span className={`ml-2 text-xs ${FAINT}`}>{h.items.length} khoản</span>
                    </span>
                    <b className="tabular-nums text-green-700 dark:text-emerald-300">{money(h.total)}</b>
                  </summary>
                  <ul className="mt-1.5 flex flex-col gap-0.5">
                    {h.items
                      .sort((a, b) => (a.date < b.date ? -1 : 1))
                      .map((e) => (
                        <li key={e.id} className="flex items-center gap-2">
                          <span className={`w-14 flex-none text-xs ${FAINT}`}>
                            {weekday(e.date)} {ddmm(e.date)}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{e.content}</span>
                          <span className="tabular-nums">{money(e.amount)}</span>
                        </li>
                      ))}
                  </ul>
                </details>
              ))}
              {paidNoDate > 0 && <p className={`text-xs ${FAINT}`}>{paidNoDate} khoản đã trả trước khi app ghi ngày thanh toán.</p>}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/** Confirmation before deleting every entry of a week. */
function ConfirmDeleteWeek({
  start,
  entries,
  people,
  onCancel,
  onConfirm,
}: {
  start: string;
  entries: Entry[];
  people: Person[];
  onCancel: () => void;
  onConfirm: (ids: string[]) => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const t = totals(entries);
  const who = new Set(entries.map((e) => e.personId));
  const names = people.filter((p) => who.has(p.id)).map((p) => p.name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Hủy" onClick={onCancel} className="absolute inset-0 cursor-default bg-slate-900/45 dark:bg-black/60" />
      <div role="alertdialog" aria-modal="true" aria-labelledby="del-week-title" className={`${CARD} relative flex w-full max-w-md flex-col gap-4 p-5`}>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-[#3A1D24] dark:text-red-300">
            <Icon name="trash" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 id="del-week-title" className="text-lg font-extrabold">
              Xóa tuần {isoWeek(start)}?
            </h2>
            <p className={`text-[13px] ${MUTED}`}>
              {ddmm(start)} – {ddmmyyyy(addDays(start, 6))}
            </p>
          </div>
        </div>
        {entries.length ? (
          <div className="flex flex-col gap-1.5 rounded-xl bg-red-50 px-3.5 py-3 text-[13px] text-red-900 dark:bg-[#3A1D24] dark:text-red-200">
            <p>
              Sẽ xóa vĩnh viễn <b>{entries.length} khoản</b> · tổng <b>{money(t.total)}</b>
              {t.due > 0 && (
                <>
                  {' '}
                  (trong đó <b>{money(t.due)}</b> chưa trả)
                </>
              )}
              .
            </p>
            <p className="text-xs opacity-80">Của: {names.join(', ')}</p>
            <p className="text-xs font-semibold">Không thể hoàn tác.</p>
          </div>
        ) : (
          <p className={`text-[13px] ${MUTED}`}>Tuần này chưa có khoản nào. Tab sẽ được đóng.</p>
        )}
        <div className="flex justify-end gap-2">
          <button ref={cancelRef} type="button" onClick={onCancel} className={`${navBtn} px-4`}>
            Hủy
          </button>
          <button
            type="button"
            onClick={() => onConfirm(entries.map((e) => e.id))}
            className="flex h-10 items-center rounded-xl bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 dark:bg-red-500"
          >
            {entries.length ? `Xóa ${entries.length} khoản` : 'Đóng tab'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MaxButton({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={on ? 'Thu nhỏ' : 'Phóng to'}
      title={on ? 'Thu nhỏ (Esc)' : 'Phóng to'}
      className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg ${FAINT} transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-[#1B2238] dark:hover:text-slate-100`}
    >
      <Icon name={on ? 'minimize' : 'maximize'} className="h-4 w-4" strokeWidth={2.2} />
    </button>
  );
}


/** Bank transfer QR (VietQR) shown on the finance tab; click to enlarge. */
function PaymentQR({ flash }: { flash: (msg: string) => void }) {
  const [big, setBig] = useState(false);

  useEffect(() => {
    if (!big) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setBig(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [big]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(BANK.account);
      flash(`Đã sao chép số tài khoản ${BANK.account}`);
    } catch {
      flash(`Số tài khoản: ${BANK.account}`);
    }
  };

  return (
    <section className={`${CARD} flex flex-none items-center gap-3 p-3`}>
      <button
        type="button"
        onClick={() => setBig(true)}
        aria-label="Phóng to mã QR"
        title="Phóng to mã QR"
        className="flex-none overflow-hidden rounded-xl transition hover:opacity-90"
      >
        <Image src={qrCard} alt={`Mã VietQR ${BANK.name} – ${BANK.holder} – ${BANK.account}`} className="h-auto w-18" priority={false} />
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-[13px]">
        <p className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] ${FAINT}`}>
          <Icon name="wallet" className="h-3.5 w-3.5" /> Chuyển khoản
        </p>
        <p className="truncate font-semibold" title={`${BANK.name} · ${BANK.holder}`}>
          {BANK.name} · {BANK.holder}
        </p>
        <div className="flex items-center gap-2">
          <p className="truncate text-[15px] font-extrabold tracking-wide tabular-nums">{BANK.account}</p>
          <button
            type="button"
            onClick={copy}
            className="flex-none rounded-md px-1.5 py-0.5 text-[11px] font-bold text-indigo-600 transition hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-[#1B2238]"
          >
            Sao chép
          </button>
        </div>
      </div>

      {big && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Đóng" onClick={() => setBig(false)} className="absolute inset-0 cursor-default bg-slate-900/70 dark:bg-black/80" />
          <div role="dialog" aria-modal="true" aria-label="Mã QR chuyển khoản" className="relative flex flex-col items-center gap-3">
            <Image src={qrCard} alt={`Mã VietQR ${BANK.name} – ${BANK.holder} – ${BANK.account}`} className="h-auto max-h-[80vh] w-auto rounded-3xl shadow-2xl" />
            <button type="button" onClick={() => setBig(false)} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#1E1B4B]">
              Đóng
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export function FinancePanel({
  store,
  today,
  onMenu,
  flash,
  readOnly = false,
}: {
  store: FinanceStore;
  today: string;
  onMenu?: () => void;
  flash: (msg: string) => void;
  /** Share-link view: everything visible, nothing editable. */
  readOnly?: boolean;
}) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));
  const [open, setOpen] = useState<{ personId: string | null; date: string } | null>(null);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newDebt, setNewDebt] = useState('');
  const closeDialog = useCallback(() => setOpen(null), []);
  const [eyeFor, setEyeFor] = useState<string | null>(null);
  const mailStatus = useMailStatus(!readOnly);
  const closeEye = useCallback(() => setEyeFor(null), []);
  /** Empty weeks opened with “+” stay as tabs for this session. */
  const [extraWeeks, setExtraWeeks] = useState<string[]>([]);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [deleteWeek, setDeleteWeek] = useState<string | null>(null);
  const [weekStatus, setWeekStatus] = useState<'all' | 'due' | 'paid'>('all');
  const [weekMonth, setWeekMonth] = useState('all');
  const [weekPerson, setWeekPerson] = useState('all');
  const [rankScope, setRankScope] = useState<'all' | 'filtered' | 'week'>('all');
  const gridRef = useRef<HTMLElement>(null);
  const [max, setMax] = useState<PanelKey | null>(null);
  const data = store.data;

  useEffect(() => {
    if (!max) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('[role="dialog"],[role="alertdialog"]') && setMax(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [max]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekEnd = days[6];

  /** personId -> date -> entries, for the visible week only. */
  const cells = useMemo(() => {
    const m = new Map<string, Map<string, Entry[]>>();
    for (const e of data?.entries ?? []) {
      if (e.date < weekStart || e.date > weekEnd) continue;
      const row = m.get(e.personId) ?? new Map<string, Entry[]>();
      row.set(e.date, [...(row.get(e.date) ?? []), e]);
      m.set(e.personId, row);
    }
    return m;
  }, [data?.entries, weekStart, weekEnd]);

  const suggestions = useMemo(() => {
    const seen = new Map<string, number>();
    for (const e of data?.entries ?? []) seen.set(e.content, (seen.get(e.content) ?? 0) + 1);
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([c]) => c);
  }, [data?.entries]);

  /** Sheet tabs: every week with entries + this week + the viewed week + weeks added with “+”, oldest first. */
  const sheetWeeks = useMemo(() => {
    const m = new Map<string, Entry[]>();
    for (const e of data?.entries ?? []) {
      const w = startOfWeek(e.date);
      m.set(w, [...(m.get(w) ?? []), e]);
    }
    for (const w of [startOfWeek(today), weekStart, ...extraWeeks]) if (!m.has(w)) m.set(w, []);
    return [...m.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([start, list]) => ({ start, totals: totals(list), count: list.length }));
  }, [data?.entries, today, weekStart, extraWeeks]);

  // Keep the active tab visible in the tab strip.
  useEffect(() => {
    tabsRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [weekStart, sheetWeeks.length]);

  if (!data) return <div aria-busy="true" />;

  const weekEntries = data.entries.filter((e) => e.date >= weekStart && e.date <= weekEnd);
  const week = totals(weekEntries);
  const all = totals(data.entries);
  const debtTotal = data.people.reduce((s, p) => s + debtOf(p), 0);
  const stats = [
    { label: `Tổng tuần ${isoWeek(weekStart)}`, value: money(week.total), cls: 'text-white' },
    { label: 'Chưa trả trong tuần', value: money(week.due), cls: 'text-orange-300' },
    {
      label: debtTotal ? `Chưa trả tất cả (gồm ${money(debtTotal)} nợ trước đó)` : 'Chưa trả tất cả các tuần',
      value: money(all.due + debtTotal),
      cls: 'text-orange-200',
    },
  ];

  const addName = (e: React.FormEvent) => {
    e.preventDefault();
    const n = newName.trim();
    if (!n) return;
    if (data.people.some((p) => p.name.toLocaleLowerCase('vi') === n.toLocaleLowerCase('vi'))) return flash(`“${n}” đã có trong bảng`);
    const mail = newEmail.trim();
    if (mail && !looksLikeEmail(mail)) return flash('Email không hợp lệ');
    const debt = newDebt.trim() ? parseK(newDebt) : 0;
    if (newDebt.trim() && !debt) return flash('Số tiền nợ trước đó không hợp lệ');
    store.addPerson(n, mail || null, debt);
    setNewName('');
    setNewEmail('');
    setNewDebt('');
    flash(`Đã thêm “${n}” vào bảng${mail ? ` · email ${mail}` : ''}${debt ? ` · nợ trước đó ${money(debt)}` : ''}`);
  };
  const removePerson = (p: Person) => {
    const count = data.entries.filter((e) => e.personId === p.id).length;
    const msg = count ? `Xóa “${p.name}”? ${count} khoản của người này (mọi tuần) cũng sẽ bị xóa.` : `Xóa “${p.name}” khỏi bảng?`;
    if (confirm(msg)) store.removePerson(p.id);
  };

  const rows = data.people;
  /** personId -> unpaid amount (all weeks) and number of weeks with unpaid entries. */
  const dueAll = new Map<string, number>();
  const dueWeekSets = new Map<string, Set<string>>();
  for (const e of data.entries) {
    if (e.paid) continue;
    dueAll.set(e.personId, (dueAll.get(e.personId) ?? 0) + e.amount);
    const set = dueWeekSets.get(e.personId) ?? new Set<string>();
    set.add(startOfWeek(e.date));
    dueWeekSets.set(e.personId, set);
  }
  for (const p of data.people) if (debtOf(p)) dueAll.set(p.id, (dueAll.get(p.id) ?? 0) + debtOf(p));
  const dueWeeks = new Map([...dueWeekSets].map(([id, set]) => [id, set.size]));
  const eyePerson = eyeFor ? data.people.find((p) => p.id === eyeFor) : undefined;
  const names = new Map(data.people.map((p) => [p.id, p.name]));

  // ----- weekly statistics table (filtered) -----
  const months = [...new Set(data.entries.map((e) => e.date.slice(0, 7)))].sort().reverse();
  const statEntries = weekPerson === 'all' ? data.entries : data.entries.filter((e) => e.personId === weekPerson);
  const byWeek = new Map<string, Entry[]>();
  for (const e of statEntries) {
    const w = startOfWeek(e.date);
    byWeek.set(w, [...(byWeek.get(w) ?? []), e]);
  }
  const weekRows = [...byWeek.entries()]
    .map(([start, list]) => {
      const end = addDays(start, 6);
      const due = new Map<string, number>();
      for (const e of list) if (!e.paid) due.set(e.personId, (due.get(e.personId) ?? 0) + e.amount);
      const top = [...due.entries()].sort((x, y) => y[1] - x[1])[0];
      return { start, end, list, totals: totals(list), people: new Set(list.map((e) => e.personId)).size, top };
    })
    .filter((w) => weekMonth === 'all' || w.start.slice(0, 7) === weekMonth || w.end.slice(0, 7) === weekMonth)
    .filter((w) => (weekStatus === 'due' ? w.totals.due > 0 : weekStatus === 'paid' ? w.totals.due === 0 : true))
    .sort((x, y) => (x.start < y.start ? 1 : -1));
  const filteredTotals = totals(weekRows.flatMap((w) => w.list));
  const hasWeekFilter = weekStatus !== 'all' || weekMonth !== 'all' || weekPerson !== 'all';
  const showWeek = (start: string) => {
    setWeekStart(start);
    if (max === 'stats') setMax(null);
    gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  const toggleMax = (key: PanelKey) => setMax((m) => (m === key ? null : key));
  /** A panel either sits in the one-screen layout (scrolling inside itself) or fills the screen when maximized. */
  const panel = (key: PanelKey, extra = '') =>
    `${CARD} flex min-h-0 flex-col overflow-hidden ${extra} ${
      max === key ? 'fixed inset-3 z-40 shadow-[0_24px_80px_rgba(15,23,42,0.35)] sm:inset-6' : ''
    }`;

  const rankEntries = rankScope === 'week' ? weekEntries : rankScope === 'filtered' ? weekRows.flatMap((w) => w.list) : data.entries;
  const ranking = data.people
    .map((person) => {
      const list = rankEntries.filter((e) => e.personId === person.id);
      const t = totals(list);
      // Opening debt only belongs to the "all" scope (it is not tied to a week).
      const debt = rankScope === 'all' ? debtOf(person) : 0;
      return { person, total: t.total + debt, paid: t.paid, due: t.due + debt, debt, unpaid: list.filter((e) => !e.paid).length + (debt ? 1 : 0) };
    })
    .filter((r) => r.due > 0)
    .sort((a, b) => b.due - a.due || a.person.name.localeCompare(b.person.name, 'vi'));
  const maxDue = ranking[0]?.due ?? 0;
  /** Competition ranking: equal amounts share a rank (1, 2, 2, 4). */
  const ranks = ranking.map((r, i, arr) => arr.findIndex((x) => x.due === r.due) + 1);

  const openPerson = open?.personId ? (data.people.find((p) => p.id === open.personId) ?? null) : null;
  const order = new Map(data.people.map((p, i) => [p.id, i]));
  const dialogEntries = !open
    ? []
    : open.personId
      ? (cells.get(open.personId)?.get(open.date) ?? [])
      : weekEntries.filter((e) => e.date === open.date).sort((a, b) => (order.get(a.personId) ?? 0) - (order.get(b.personId) ?? 0));
  const th = `whitespace-nowrap px-2 py-2.5 text-center text-xs font-bold ${MUTED}`;
  const sticky = 'sticky left-0 z-10 bg-white dark:bg-[#151B2E]';

  return (
    <>
      <section className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[18px] bg-[#1E1B4B] px-5 py-3.5 text-white dark:bg-[#1A1745]">
        {onMenu && (
          <button type="button" onClick={onMenu} aria-label="Mở menu" className={`${ghostBtn} w-11 lg:hidden`}>
            <Icon name="menu" className="h-4.5 w-4.5" />
          </button>
        )}
        <div className="min-w-0 flex-[1_1_220px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-indigo-200">Quản lý thu chi</p>
          <h1 className="text-xl font-extrabold leading-tight">
            Tuần {isoWeek(weekStart)}
            <span className="ml-2 text-sm font-medium text-indigo-200">
              {ddmm(weekStart)} – {ddmmyyyy(weekEnd)}
            </span>
          </h1>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {stats.map((x) => (
            <div key={x.label} className="rounded-xl bg-white/10 px-3.5 py-1.5">
              <p className="text-[11px] text-indigo-200">{x.label}</p>
              <p className={`text-base font-extrabold tabular-nums ${x.cls}`}>{x.value}</p>
            </div>
          ))}
        </div>
        {readOnly ? (
          <div className="flex flex-wrap items-center gap-2">
            <DriveLink url={data.driveUrl ?? null} flash={flash} />
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-indigo-100">Chỉ xem</span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <DriveLink url={data.driveUrl ?? null} onChange={store.setDriveUrl} flash={flash} />
            <MailControl people={data.people} entries={data.entries} status={mailStatus} flash={flash} />
            <ShareControl flash={flash} />
          </div>
        )}
      </section>

      {max && <button type="button" aria-label="Thu nhỏ" onClick={() => setMax(null)} className="fixed inset-0 z-30 cursor-default bg-slate-900/45 dark:bg-black/60" />}

      <div className="grid gap-4 xl:h-[calc(100vh-11rem)] xl:min-h-[680px] xl:grid-cols-12 xl:grid-rows-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <section ref={gridRef} className={panel('grid', `scroll-mt-4 xl:col-span-9 ${SHOW_WEEK_STATS ? '' : 'xl:row-span-2'}`)}>
        <div className="flex flex-none flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 pb-2.5 pt-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold">Bảng thu chi tuần {isoWeek(weekStart)}</h2>
            <p className={`text-xs ${FAINT}`}>Nghìn đồng · {readOnly ? 'bấm vào ô để xem chi tiết' : 'bấm vào ô để thêm/sửa'}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" aria-label="Tuần trước" onClick={() => setWeekStart((w) => addDays(w, -7))} className={`${navBtn} w-10`}>
              <Icon name="left" strokeWidth={2.2} />
            </button>
            <button type="button" onClick={() => setWeekStart(startOfWeek(today))} className={`${navBtn} px-3.5`}>
              Tuần này
            </button>
            <button type="button" aria-label="Tuần sau" onClick={() => setWeekStart((w) => addDays(w, 7))} className={`${navBtn} w-10`}>
              <Icon name="right" strokeWidth={2.2} />
            </button>
            <MaxButton on={max === 'grid'} onClick={() => toggleMax('grid')} />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto border-t border-slate-100 dark:border-[#232B45]">
          <table className="w-full border-collapse text-[15px]">
            <thead className="sticky top-0 z-20 bg-white dark:bg-[#151B2E]">
              <tr className="border-b border-slate-200 dark:border-[#2A3350]">
                <th className={`${th} ${sticky} min-w-44 pl-4 text-left`}>Tên</th>
                {days.map((d) => (
                  <th key={d} className={`${th} min-w-24 p-1 ${d === today ? 'text-indigo-700 dark:text-indigo-300' : ''}`}>
                    <button
                      type="button"
                      onClick={() => setOpen({ personId: null, date: d })}
                      title={readOnly ? 'Xem các khoản trong ngày' : 'Thêm khoản cho nhiều người trong ngày này'}
                      className="w-full rounded-lg px-1 py-1 transition hover:bg-slate-100 dark:hover:bg-[#1B2238]"
                    >
                      <span className="block">{weekday(d)}</span>
                      <span className={`block font-medium ${d === today ? '' : FAINT}`}>{ddmm(d)}</span>
                    </button>
                  </th>
                ))}
                <th className={`${th} min-w-28 bg-slate-50 dark:bg-[#1B2238]`}>Tổng tuần</th>
                <th className={`${th} min-w-28 bg-slate-50 dark:bg-[#1B2238]`}>Chưa trả</th>
                <th className={`${th} min-w-28 border-l border-slate-200 bg-amber-50/60 dark:border-[#2A3350] dark:bg-amber-950/20`}>
                  <span className="flex items-center justify-center gap-1">
                    Nợ trước đó
                    {data.driveUrl && (
                      <a
                        href={data.driveUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Kiểm tra số tiền nợ trước đó trên Google Drive"
                        title="Kiểm tra số tiền nợ trước đó trên Google Drive"
                        className="flex h-6 w-6 items-center justify-center rounded-md text-indigo-600 transition hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-[#1B2238]"
                      >
                        <Icon name="folder" className="h-3.5 w-3.5" strokeWidth={2.2} />
                      </a>
                    )}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const row = cells.get(p.id);
                const rowTotals = totals([...(row?.values() ?? [])].flat());
                return (
                  <tr key={p.id} className="group border-b border-slate-100 dark:border-[#232B45]">
                    <td className={`${sticky} py-1 pl-2 pr-1`}>
                      {readOnly ? (
                        <div className="flex items-center">
                          <span className="block min-w-0 flex-1 truncate px-2 py-1.5 font-semibold">{p.name}</span>
                          <button
                            type="button"
                            aria-label={`Xem các tuần chưa trả của ${p.name}`}
                            title={dueAll.get(p.id) ? `Chưa trả ${money(dueAll.get(p.id) ?? 0)} · bấm để xem các tuần` : 'Đã trả đủ'}
                            onClick={() => setEyeFor(p.id)}
                            className={`relative flex h-7 w-7 flex-none items-center justify-center rounded-lg opacity-0 transition hover:bg-slate-100 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 dark:hover:bg-[#1B2238] [@media(hover:none)]:opacity-100 ${
                              dueAll.get(p.id) ? 'text-orange-600 dark:text-orange-300' : FAINT
                            }`}
                          >
                            <Icon name="eye" className="h-4 w-4" strokeWidth={2.1} />
                            {(dueWeeks.get(p.id) ?? 0) > 0 && (
                              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-extrabold text-white">
                                {dueWeeks.get(p.id)}
                              </span>
                            )}
                          </button>
                        </div>
                      ) : (
                      <div className="flex items-center">
                        <input
                          key={p.name}
                          aria-label="Tên"
                          defaultValue={p.name}
                          onBlur={(ev) => {
                            const n = ev.target.value.trim();
                            if (n && n !== p.name) store.renamePerson(p.id, n);
                            else ev.target.value = p.name;
                          }}
                          onKeyDown={(ev) => ev.key === 'Enter' && (ev.target as HTMLInputElement).blur()}
                          className="w-full min-w-0 rounded-lg bg-transparent px-2 py-1.5 font-semibold outline-none focus:bg-slate-50 dark:focus:bg-[#0F1527]"
                        />
                        <button
                          type="button"
                          aria-label={`Xem các tuần chưa trả của ${p.name}`}
                          title={dueAll.get(p.id) ? `Chưa trả ${money(dueAll.get(p.id) ?? 0)} · bấm để xem các tuần` : 'Đã trả đủ'}
                          onClick={() => setEyeFor(p.id)}
                          className={`relative flex h-7 w-7 flex-none items-center justify-center rounded-lg opacity-0 transition hover:bg-slate-100 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 dark:hover:bg-[#1B2238] [@media(hover:none)]:opacity-100 ${
                            dueAll.get(p.id) ? 'text-orange-600 dark:text-orange-300' : FAINT
                          }`}
                        >
                          <Icon name="eye" className="h-4 w-4" strokeWidth={2.1} />
                          {(dueWeeks.get(p.id) ?? 0) > 0 && (
                            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-extrabold text-white">
                              {dueWeeks.get(p.id)}
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          aria-label={`Xóa ${p.name}`}
                          onClick={() => removePerson(p)}
                          className={`flex h-7 w-7 flex-none items-center justify-center rounded-lg opacity-0 transition group-hover:opacity-100 focus:opacity-100 ${FAINT} hover:text-red-600 dark:hover:text-red-300`}
                        >
                          <Icon name="x" className="h-3.5 w-3.5" strokeWidth={2.4} />
                        </button>
                      </div>
                      )}
                    </td>
                    {days.map((d) => {
                      const list = row?.get(d) ?? [];
                      const t = totals(list);
                      const state = !list.length ? 'empty' : t.due === 0 ? 'paid' : 'due';
                      return (
                        <td key={d} className="p-1">
                          <button
                            type="button"
                            disabled={readOnly && !list.length}
                            onClick={() => setOpen({ personId: p.id, date: d })}
                            title={list.map((e) => `${e.content}: ${money(e.amount)}${e.paid ? ' (đã trả)' : ''}`).join('\n') || (readOnly ? '' : 'Thêm khoản')}
                            aria-label={`${p.name}, ${weekday(d)} ${ddmm(d)}: ${list.length ? money(t.total) : 'trống'}`}
                            className={`flex h-13 w-full flex-col items-center justify-center rounded-lg text-base tabular-nums transition ${
                              state === 'empty'
                                ? `${FAINT} hover:bg-slate-100 dark:hover:bg-[#1B2238]`
                                : state === 'paid'
                                  ? 'bg-green-50 font-bold text-green-800 hover:bg-green-100 dark:bg-emerald-950/50 dark:text-emerald-300'
                                  : 'bg-orange-50 font-bold text-orange-800 hover:bg-orange-100 dark:bg-orange-950/40 dark:text-orange-300'
                            }`}
                          >
                            {list.length ? k(t.total) : <span className="opacity-0 transition group-hover:opacity-60">{readOnly ? '' : '+'}</span>}
                            {list.length > 1 && <span className="text-[10px] font-semibold opacity-70">{list.length} khoản</span>}
                          </button>
                        </td>
                      );
                    })}
                    <td className="bg-slate-50 px-2 text-center font-bold tabular-nums dark:bg-[#1B2238]">{rowTotals.total ? k(rowTotals.total) : '–'}</td>
                    <td
                      className={`bg-slate-50 px-2 text-center text-[19px] font-bold tabular-nums dark:bg-[#1B2238] ${
                        rowTotals.due ? 'text-orange-700 dark:text-orange-300' : rowTotals.total ? 'text-green-700 dark:text-emerald-300' : FAINT
                      }`}
                    >
                      {rowTotals.due ? k(rowTotals.due) : rowTotals.total ? '✓' : '–'}
                    </td>
                    <td className="border-l border-slate-200 p-1 dark:border-[#2A3350]">
                      {readOnly ? (
                        <span
                          title={p.debtNote ?? undefined}
                          className={`flex h-13 items-center justify-center rounded-lg text-base font-bold tabular-nums ${
                            debtOf(p) ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300' : FAINT
                          }`}
                        >
                          {debtOf(p) ? k(debtOf(p)) : '–'}
                        </span>
                      ) : (
                        <DebtInput
                          value={debtOf(p)}
                          label={`Nợ trước đó của ${p.name} (nghìn đồng)`}
                          onCommit={(n) => {
                            store.setPersonDebt(p.id, n, n ? (p.debtNote ?? null) : null);
                            flash(n ? `Đã ghi nợ trước đó ${money(n)} cho ${p.name}` : `Đã xóa nợ trước đó của ${p.name}`);
                          }}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}

              {!readOnly && (
              <tr className="border-b border-slate-200 dark:border-[#2A3350]">
                <td colSpan={11} className="py-2 pl-2 pr-1">
                  <form onSubmit={addName} className="sticky left-2 flex w-max max-w-[calc(100vw-4rem)] flex-wrap items-center gap-1.5">
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="+ Thêm tên"
                      aria-label="Thêm tên vào bảng"
                      className="w-36 rounded-lg border border-dashed border-slate-300 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-indigo-500 dark:border-slate-600"
                    />
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="Email (không bắt buộc)"
                      aria-label="Email của người mới"
                      className="w-56 rounded-lg border border-dashed border-slate-300 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-indigo-500 dark:border-slate-600"
                    />
                    <input
                      inputMode="decimal"
                      value={newDebt}
                      onChange={(e) => setNewDebt(e.target.value)}
                      placeholder="Nợ trước đó (nghìn đ)"
                      aria-label="Nợ trước đó của người mới (nghìn đồng)"
                      className="w-44 rounded-lg border border-dashed border-slate-300 bg-transparent px-2 py-1.5 text-sm tabular-nums outline-none focus:border-indigo-500 dark:border-slate-600"
                    />
                    {newName.trim() && (
                      <button type="submit" className="flex h-8 flex-none items-center gap-1 rounded-lg bg-indigo-600 px-2.5 text-xs font-bold text-white dark:bg-indigo-500">
                        <Icon name="plus" className="h-3.5 w-3.5" strokeWidth={2.6} />
                        Thêm
                      </button>
                    )}
                  </form>
                </td>
              </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 dark:bg-[#1B2238]">
                <th className={`${sticky} bg-slate-50 px-4 py-3 text-left text-xs font-bold dark:bg-[#1B2238]`}>Tổng ngày</th>
                {days.map((d) => {
                  const t = totals(weekEntries.filter((e) => e.date === d));
                  return (
                    <td key={d} className="px-2 text-center font-bold tabular-nums">
                      {t.total ? k(t.total) : <span className={FAINT}>–</span>}
                    </td>
                  );
                })}
                <td className="px-2 text-center font-extrabold tabular-nums">{k(week.total)}</td>
                <td className={`px-2 text-center text-[19px] font-extrabold tabular-nums ${week.due ? 'text-orange-700 dark:text-orange-300' : FAINT}`}>{week.due ? k(week.due) : '–'}</td>
                <td className={`border-l border-slate-200 px-2 text-center font-extrabold tabular-nums dark:border-[#2A3350] ${debtTotal ? 'text-amber-800 dark:text-amber-300' : FAINT}`}>
                  {debtTotal ? k(debtTotal) : '–'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex flex-none items-stretch border-t border-slate-200 bg-slate-100 dark:border-[#2A3350] dark:bg-[#10162A]">
          {!readOnly && (
            <button
              type="button"
              aria-label="Thêm tuần tiếp theo"
              title="Thêm tuần tiếp theo"
              onClick={() => {
                const next = addDays(sheetWeeks[sheetWeeks.length - 1]?.start ?? weekStart, 7);
                setExtraWeeks((w) => [...w, next]);
                setWeekStart(next);
              }}
              className={`flex w-10 flex-none items-center justify-center border-r border-slate-200 transition hover:bg-slate-200 dark:border-[#2A3350] dark:hover:bg-[#1B2238] ${MUTED}`}
            >
              <Icon name="plus" strokeWidth={2.4} />
            </button>
          )}
          <div className="relative flex flex-none items-center border-r border-slate-200 px-1 dark:border-[#2A3350]">
            <select
              aria-label="Danh sách tất cả các tuần"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              {[...sheetWeeks].reverse().map((w) => (
                <option key={w.start} value={w.start}>
                  Tuần {isoWeek(w.start)} · {ddmm(w.start)} – {ddmmyyyy(addDays(w.start, 6))}
                </option>
              ))}
            </select>
            <span className={`pointer-events-none flex h-full w-8 items-center justify-center ${MUTED}`}>
              <Icon name="list" />
            </span>
          </div>
          <div ref={tabsRef} role="tablist" aria-label="Các tuần" className="flex min-w-0 flex-1 items-end gap-px overflow-x-auto px-1 [scrollbar-width:thin]">
            {sheetWeeks.map((w) => {
              const active = w.start === weekStart;
              return (
                <div
                  key={w.start}
                  className={`group/tab relative flex h-9 flex-none items-center transition ${
                    active
                      ? '-mt-px border-x border-b-2 border-slate-200 border-b-indigo-600 bg-white shadow-sm dark:border-[#2A3350] dark:border-b-indigo-400 dark:bg-[#151B2E]'
                      : 'hover:bg-slate-200 dark:hover:bg-[#1B2238]'
                  }`}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setWeekStart(w.start)}
                    title={`${ddmm(w.start)} – ${ddmmyyyy(addDays(w.start, 6))} · ${w.count} khoản${w.totals.due ? ` · chưa trả ${money(w.totals.due)}` : ''}`}
                    className={`flex h-full items-center gap-1.5 whitespace-nowrap pl-3.5 text-[13px] ${active && !readOnly ? 'pr-1' : 'pr-3.5'} ${
                      active ? 'font-bold text-indigo-700 dark:text-indigo-300' : `font-medium ${MUTED}`
                    }`}
                  >
                    Tuần {isoWeek(w.start)}
                    {w.start === startOfWeek(today) && <span className="rounded bg-indigo-100 px-1 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">nay</span>}
                    {w.totals.due > 0 ? (
                      <span className="h-2 w-2 rounded-full bg-orange-500" aria-label="còn khoản chưa trả" />
                    ) : w.count > 0 ? (
                      <span className="h-2 w-2 rounded-full bg-green-500" aria-label="đã trả đủ" />
                    ) : null}
                  </button>
                  {active && !readOnly && (
                    <button
                      type="button"
                      aria-label={`Xóa tuần ${isoWeek(w.start)}`}
                      title={`Xóa tuần ${isoWeek(w.start)}`}
                      onClick={() => setDeleteWeek(w.start)}
                      className={`mr-1.5 flex h-6 w-6 items-center justify-center rounded-md ${FAINT} transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-[#3A1D24] dark:hover:text-red-300`}
                    >
                      <Icon name="x" className="h-3.5 w-3.5" strokeWidth={2.4} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className={`hidden flex-none items-center gap-3 border-l border-slate-200 px-3 text-[11px] sm:flex dark:border-[#2A3350] ${FAINT}`}>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-orange-500" /> Chưa trả
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500" /> Đã trả đủ
            </span>
          </div>
        </div>
      </section>

      {SHOW_WEEK_STATS && (
        <section className={panel('stats', 'xl:col-span-9 xl:row-start-2')}>
          <div className="flex flex-none flex-col gap-2.5 px-4 pb-3 pt-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold">
                Thống kê theo tuần <span className={`ml-1 text-xs font-normal ${FAINT}`}>· bấm một tuần để mở</span>
              </h2>
              <MaxButton on={max === 'stats'} onClick={() => toggleMax('stats')} />
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <div role="group" aria-label="Lọc theo trạng thái" className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-[#1B2238]">
                {(
                  [
                    ['all', 'Tất cả'],
                    ['due', 'Chưa trả'],
                    ['paid', 'Đã trả đủ'],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={weekStatus === v}
                    onClick={() => setWeekStatus(v)}
                    className={`min-h-8 rounded-[9px] px-3 text-xs transition ${
                      weekStatus === v ? 'bg-white font-bold text-[#1E1B4B] shadow-sm dark:bg-indigo-500 dark:text-white' : `font-medium ${MUTED}`
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <select aria-label="Lọc theo tháng" value={weekMonth} onChange={(e) => setWeekMonth(e.target.value)} className={`${FIELD} h-10 text-[13px]`}>
                <option value="all">Mọi tháng</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    Tháng {Number(m.slice(5))}/{m.slice(0, 4)}
                  </option>
                ))}
              </select>
              <select aria-label="Lọc theo người" value={weekPerson} onChange={(e) => setWeekPerson(e.target.value)} className={`${FIELD} h-10 text-[13px]`}>
                <option value="all">Mọi người</option>
                {data.people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {hasWeekFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setWeekStatus('all');
                    setWeekMonth('all');
                    setWeekPerson('all');
                  }}
                  className="h-10 px-2 text-[13px] font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
                >
                  Xóa lọc
                </button>
              )}
            </div>
          </div>

          {weekRows.length === 0 ? (
            <p className={`border-t border-slate-100 px-5 py-10 text-center text-[13px] dark:border-[#232B45] ${MUTED}`}>
              {data.entries.length ? 'Không có tuần nào khớp bộ lọc.' : 'Chưa có khoản nào.'}
            </p>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto border-t border-slate-100 dark:border-[#232B45]">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-white dark:bg-[#151B2E]">
                  <tr className="border-b border-slate-100 dark:border-[#232B45]">
                    <th className={`${th} pl-5 text-left`}>Tuần</th>
                    <th className={th}>Số khoản</th>
                    <th className={`${th} text-right`}>Tổng</th>
                    <th className={`${th} text-right`}>Đã trả</th>
                    <th className={`${th} text-right`}>Chưa trả</th>
                    <th className={`${th} pr-5 text-left`}>Chưa trả nhiều nhất</th>
                  </tr>
                </thead>
                <tbody>
                  {weekRows.map((w) => {
                    const current = w.start === weekStart;
                    return (
                      <tr
                        key={w.start}
                        onClick={() => showWeek(w.start)}
                        className={`cursor-pointer border-b border-slate-100 transition dark:border-[#232B45] ${
                          current ? 'bg-indigo-50 dark:bg-[#2B2F63]/60' : 'hover:bg-slate-50 dark:hover:bg-[#1B2238]'
                        }`}
                      >
                        <td className="py-2.5 pl-5 pr-2">
                          <button type="button" onClick={() => showWeek(w.start)} className="text-left">
                            <span className="block font-bold">
                              Tuần {isoWeek(w.start)}
                              {current && <span className="ml-2 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white dark:bg-indigo-500">đang xem</span>}
                            </span>
                            <span className={`block text-xs ${FAINT}`}>
                              {ddmm(w.start)} – {ddmmyyyy(w.end)}
                            </span>
                          </button>
                        </td>
                        <td className="px-2 text-center tabular-nums">
                          {w.list.length}
                          <span className={`block text-[11px] ${FAINT}`}>{w.people} người</span>
                        </td>
                        <td className="px-2 text-right font-semibold tabular-nums">{money(w.totals.total)}</td>
                        <td className="px-2 text-right tabular-nums text-green-700 dark:text-emerald-300">{w.totals.paid ? money(w.totals.paid) : '–'}</td>
                        <td className={`px-2 text-right font-bold tabular-nums ${w.totals.due ? 'text-orange-700 dark:text-orange-300' : 'text-green-700 dark:text-emerald-300'}`}>
                          {w.totals.due ? money(w.totals.due) : '✓ đủ'}
                        </td>
                        <td className="py-2.5 pl-2 pr-5 text-[13px]">
                          {w.top ? (
                            <>
                              <span className="font-semibold">{names.get(w.top[0]) ?? '?'}</span>
                              <span className={`block text-xs ${FAINT}`}>{money(w.top[1])}</span>
                            </>
                          ) : (
                            <span className={FAINT}>–</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="sticky bottom-0">
                  <tr className="bg-slate-50 font-bold dark:bg-[#1B2238]">
                    <td className="py-3 pl-5 pr-2 text-xs">Cộng {weekRows.length} tuần</td>
                    <td className="px-2 text-center tabular-nums">{weekRows.reduce((n, w) => n + w.list.length, 0)}</td>
                    <td className="px-2 text-right tabular-nums">{money(filteredTotals.total)}</td>
                    <td className="px-2 text-right tabular-nums text-green-700 dark:text-emerald-300">{money(filteredTotals.paid)}</td>
                    <td className="px-2 text-right tabular-nums text-orange-700 dark:text-orange-300">{money(filteredTotals.due)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      )}

      <div className="flex min-h-0 flex-col gap-3 xl:col-span-3 xl:col-start-10 xl:row-span-2 xl:row-start-1">
      <PaymentQR flash={flash} />
      <section className={panel('rank', 'flex-1')}>
        <div className="flex flex-none flex-wrap items-center justify-between gap-1.5 px-3 pb-2 pt-2.5">
          <h2 className="flex-1 text-[15px] font-bold">Xếp hạng</h2>
          <div role="group" aria-label="Phạm vi xếp hạng" className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-[#1B2238]">
            {(
              [
                ['all', 'Tất cả'],
                ...(SHOW_WEEK_STATS ? ([['filtered', 'Theo bộ lọc']] as const) : []),
                ['week', `Tuần ${isoWeek(weekStart)}`],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                aria-pressed={rankScope === v}
                onClick={() => setRankScope(v)}
                className={`min-h-7 rounded-[9px] px-2.5 text-xs transition ${
                  rankScope === v ? 'bg-white font-bold text-[#1E1B4B] shadow-sm dark:bg-indigo-500 dark:text-white' : `font-medium ${MUTED}`
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <MaxButton on={max === 'rank'} onClick={() => toggleMax('rank')} />
        </div>
        {ranking.length === 0 ? (
          <p className={`px-3 py-4 text-center text-[13px] ${MUTED}`}>Mọi người đã trả đủ {rankScope === 'week' ? `trong tuần ${isoWeek(weekStart)}` : rankScope === 'filtered' ? 'trong các tuần đang lọc' : ''} 🎉</p>
        ) : (
          <ol className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-auto px-2 pb-2">
            {ranking.map((r, i) => {
              const rank = ranks[i];
              const medal =
                rank === 1
                  ? 'bg-linear-to-br from-amber-300 to-amber-500 text-amber-950 shadow-[0_2px_8px_rgba(245,158,11,0.35)]'
                  : rank === 2
                    ? 'bg-linear-to-br from-slate-200 to-slate-400 text-slate-800'
                    : rank === 3
                      ? 'bg-linear-to-br from-orange-200 to-orange-400 text-orange-950'
                      : 'bg-slate-100 text-slate-600 dark:bg-[#232B44] dark:text-slate-300';
              const pct = maxDue ? Math.max(6, Math.round((r.due / maxDue) * 100)) : 0;
              return (
                <li
                  key={r.person.id}
                  className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition ${
                    rank === 1 ? 'bg-amber-50/70 dark:bg-amber-950/20' : 'hover:bg-slate-50 dark:hover:bg-[#1B2238]'
                  }`}
                >
                  <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] font-extrabold ${medal}`}>{rank}</span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div
                      className="flex items-baseline justify-between gap-2"
                      title={`${r.unpaid} khoản chưa trả${r.total !== r.due ? ` · tổng ${money(r.total)}` : ''}`}
                    >
                      <p className="min-w-0 truncate text-[13px] font-bold">
                        {r.person.name}
                        <span className={`ml-1.5 text-[11px] font-medium ${FAINT}`}>{r.unpaid} khoản</span>
                      </p>
                      <span className="whitespace-nowrap text-sm font-extrabold tabular-nums text-orange-700 dark:text-orange-300">{money(r.due)}</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-[#232B44]">
                      <div
                        className="h-full rounded-full bg-linear-to-r from-orange-300 to-orange-500 transition-[width] duration-500 dark:from-orange-500/70 dark:to-orange-400"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
      </div>
      </div>

      {deleteWeek && (
        <ConfirmDeleteWeek
          start={deleteWeek}
          entries={data.entries.filter((e) => e.date >= deleteWeek && e.date <= addDays(deleteWeek, 6))}
          people={data.people}
          onCancel={() => setDeleteWeek(null)}
          onConfirm={(ids) => {
            const start = deleteWeek;
            store.deleteEntries(ids);
            setExtraWeeks((w) => w.filter((x) => x !== start));
            // Move to a neighbouring tab (the deleted one disappears unless it is the current week).
            const i = sheetWeeks.findIndex((w) => w.start === start);
            const next = sheetWeeks[i + 1]?.start ?? sheetWeeks[i - 1]?.start ?? startOfWeek(today);
            setWeekStart(start === startOfWeek(today) ? start : next);
            setDeleteWeek(null);
            flash(ids.length ? `Đã xóa tuần ${isoWeek(start)} (${ids.length} khoản)` : `Đã đóng tab tuần ${isoWeek(start)}`);
          }}
        />
      )}

      {eyePerson && (
        <UnpaidWeeksDialog
          person={eyePerson}
          entries={data.entries}
          readOnly={readOnly}
          onToggle={(e) => store.updateEntry(e.id, { paid: true })}
          onPayWeek={(list) => {
            store.setEntriesPaid(
              list.map((e) => e.id),
              true,
            );
            flash(`Đã đánh dấu ${list.length} khoản của ${eyePerson.name} là đã trả`);
          }}
          onGoWeek={(start) => {
            setWeekStart(start);
            setEyeFor(null);
          }}
          onClose={closeEye}
          onEmail={readOnly ? undefined : (email) => store.setPersonEmail(eyePerson.id, email)}
          driveUrl={data.driveUrl}
          onDebt={
            readOnly
              ? undefined
              : (debt, note) => {
                  store.setPersonDebt(eyePerson.id, debt, note);
                  flash(debt ? `Đã lưu nợ trước đó ${money(debt)} cho ${eyePerson.name}` : `Đã xóa nợ trước đó của ${eyePerson.name}`);
                }
          }
        />
      )}

      {open && (!open.personId || openPerson) && (
        <CellDialog
          key={`${open.personId}-${open.date}`}
          person={openPerson}
          people={data.people}
          date={open.date}
          entries={dialogEntries}
          suggestions={suggestions}
          store={store}
          onClose={closeDialog}
          readOnly={readOnly}
        />
      )}
    </>
  );
}
