'use client';

import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { CARD, FAINT, FIELD, MUTED } from '@/lib/constants';
import { Icon } from './Icon';

/** Owner-only button + dialog to create, copy, rotate or turn off the read-only share link. */
export function ShareControl({ flash }: { flash: (msg: string) => void }) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    api<{ token: string | null }>('GET', '/api/share')
      .then((r) => setToken(r.token))
      .catch((e) => flash(errorMessage(e)));
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, flash]);

  const link = token ? `${window.location.origin}/view/${token}` : '';

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      flash(errorMessage(e));
    }
    setBusy(false);
  };
  const create = () =>
    run(async () => {
      const r = await api<{ token: string }>('POST', '/api/share', {});
      setToken(r.token);
      flash(token ? 'Đã đổi link · link cũ không dùng được nữa' : 'Đã tạo link chia sẻ');
    });
  const disable = () => {
    if (!confirm('Tắt chia sẻ? Người đang giữ link sẽ không xem được nữa.')) return;
    run(async () => {
      await api('DELETE', '/api/share');
      setToken(null);
      flash('Đã tắt chia sẻ');
    });
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      flash('Đã sao chép link');
    } catch {
      flash('Không sao chép được, hãy chọn và sao chép thủ công');
    }
  };

  const btn = 'flex h-10 items-center justify-center gap-1.5 rounded-xl px-3.5 text-sm font-bold transition disabled:opacity-60';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 items-center gap-2 rounded-xl bg-white px-3.5 text-[13px] font-bold text-[#1E1B4B] transition hover:bg-indigo-50"
      >
        <Icon name="share" strokeWidth={2.2} />
        Chia sẻ
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center text-slate-900 sm:items-center dark:text-slate-100">
          <button type="button" aria-label="Đóng" onClick={() => setOpen(false)} className="absolute inset-0 cursor-default bg-slate-900/45 dark:bg-black/60" />
          <div role="dialog" aria-modal="true" aria-label="Chia sẻ bảng thu chi" className={`${CARD} relative flex w-full max-w-lg flex-col gap-4 rounded-b-none p-5 sm:rounded-b-[18px]`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold">Chia sẻ bảng thu chi</h2>
                <p className={`text-[13px] ${MUTED}`}>Ai có link đều xem được, không cần đăng nhập, và không sửa được gì.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Đóng" className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg ${FAINT} hover:bg-slate-100 dark:hover:bg-[#1B2238]`}>
                <Icon name="x" strokeWidth={2.2} />
              </button>
            </div>

            {token === undefined ? (
              <p className={`text-sm ${MUTED}`}>Đang tải…</p>
            ) : token ? (
              <>
                <div className="flex gap-2">
                  <input readOnly value={link} aria-label="Link chia sẻ" onFocus={(e) => e.target.select()} className={`${FIELD} min-w-0 flex-1 text-[13px]`} />
                  <button type="button" onClick={copy} className={`${btn} flex-none bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500`}>
                    Sao chép
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a href={link} target="_blank" rel="noreferrer" className={`${btn} border border-slate-200 hover:bg-slate-50 dark:border-[#2A3350] dark:hover:bg-[#1B2238]`}>
                    Mở thử
                  </a>
                  <button type="button" disabled={busy} onClick={create} className={`${btn} border border-slate-200 hover:bg-slate-50 dark:border-[#2A3350] dark:hover:bg-[#1B2238]`}>
                    <Icon name="refresh" /> Đổi link
                  </button>
                  <button type="button" disabled={busy} onClick={disable} className={`${btn} text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-[#3A1D24]`}>
                    Tắt chia sẻ
                  </button>
                </div>
                <p className={`text-xs ${FAINT}`}>“Đổi link” tạo link mới và vô hiệu hóa link cũ ngay lập tức.</p>
              </>
            ) : (
              <button type="button" disabled={busy} onClick={create} className={`${btn} bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500`}>
                <Icon name="share" strokeWidth={2.2} /> Tạo link chỉ xem
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
