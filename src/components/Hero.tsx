'use client';

import { useEffect, useRef } from 'react';
import type { Mode } from '@/lib/types';
import type { NotificationView } from '@/lib/selectors';
import { Icon } from './Icon';

// Tạm ẩn vòng tỉ lệ hoàn thành + so sánh kỳ trước. Đổi thành true để hiện lại.
const SHOW_PROGRESS_RING = false;
// Tạm ẩn nút thông báo và nút Xuất báo cáo. Đổi thành true để hiện lại.
const SHOW_NOTIFICATIONS = false;
const SHOW_EXPORT = false;

const MODES: [Mode, string][] = [
  ['week', 'Tuần'],
  ['month', 'Tháng'],
  ['quarter', 'Quý'],
];
const RING = 2 * Math.PI * 62;

const ghostBtn =
  'flex h-11 items-center justify-center rounded-xl border border-white/20 text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white';

interface Props {
  label: string;
  rangeText: string;
  prevShort: string;
  mode: Mode;
  onMode: (m: Mode) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  query: string;
  onQuery: (q: string) => void;
  pct: number;
  prevPct: number;
  prevDone: number;
  prevTotal: number;
  notifications: NotificationView[];
  notifOpen: boolean;
  setNotifOpen: (open: boolean) => void;
  onOpenTask: (id: string) => void;
  dark: boolean;
  onToggleDark: () => void;
  onExport: () => void;
  onMenu: () => void;
}

export function Hero(p: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { notifOpen, setNotifOpen } = p;

  useEffect(() => {
    if (!notifOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNotifOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [notifOpen, setNotifOpen]);

  const delta = p.pct - p.prevPct;
  const hasPrev = p.prevTotal > 0;

  return (
    <section className="relative flex flex-col gap-5.5 rounded-[22px] bg-[#1E1B4B] px-7 pb-7 pt-5.5 text-white dark:bg-[#1A1745]">
      <div className="flex flex-wrap items-center gap-2.5">
        <button type="button" onClick={p.onMenu} aria-label="Mở menu" className={`${ghostBtn} w-11 lg:hidden`}>
          <Icon name="menu" className="h-4.5 w-4.5" />
        </button>
        <span className="text-base font-bold lg:hidden">WorkHub</span>
        <span className="flex-1" />

        {SHOW_NOTIFICATIONS && (
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setNotifOpen(!notifOpen)}
              aria-label={`Thông báo: ${p.notifications.length} việc cần chú ý`}
              aria-expanded={notifOpen}
              className={`${ghostBtn} relative w-11`}
            >
              <Icon name="bell" className="h-4.5 w-4.5" />
              {p.notifications.length > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[11px] font-extrabold text-[#1E1B4B]">
                  {p.notifications.length}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-13 z-20 w-[340px] max-w-[calc(100vw-48px)] rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-900 shadow-[0_12px_40px_rgba(15,23,42,0.25)] dark:border-[#2A3350] dark:bg-[#151B2E] dark:text-slate-100">
                <p className="mx-2.5 mb-2 mt-1.5 text-[13px] font-bold">Cần chú ý</p>
                {p.notifications.length === 0 && (
                  <p className="px-2.5 py-3 text-[13px] text-slate-600 dark:text-slate-400">Không có việc nào sắp đến hạn.</p>
                )}
                <div className="max-h-80 overflow-y-auto">
                  {p.notifications.map((n) => (
                    <button
                      key={n.task.id}
                      type="button"
                      onClick={() => p.onOpenTask(n.task.id)}
                      className="flex min-h-11 w-full flex-col gap-0.5 rounded-[10px] p-2.5 text-left hover:bg-slate-50 dark:hover:bg-[#1B2238]"
                    >
                      <span className="text-sm font-semibold">{n.task.title}</span>
                      <span className={`text-xs font-semibold ${n.late ? 'text-red-700 dark:text-red-300' : 'text-slate-600 dark:text-slate-400'}`}>
                        {n.when}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={p.onToggleDark}
          aria-label={p.dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
          className={`${ghostBtn} w-11`}
        >
          <Icon name={p.dark ? 'sun' : 'moon'} className="h-4.5 w-4.5" />
        </button>
        {SHOW_EXPORT && (
          <button
            type="button"
            onClick={p.onExport}
            className="flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-[13px] font-bold text-[#1E1B4B] transition hover:bg-indigo-50"
          >
            <Icon name="download" strokeWidth={2.2} />
            Xuất báo cáo
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-7">
        <div className="flex min-w-0 flex-[999_1_460px] flex-col gap-4.5">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-indigo-200">Dashboard công việc</p>
            <h1 className="mt-1.5 text-[34px] font-extrabold leading-tight">{p.label}</h1>
            <p className="mt-1.5 text-sm text-indigo-200">{p.rangeText}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div role="group" aria-label="Xem theo" className="flex gap-1 rounded-xl bg-white/10 p-1">
              {MODES.map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={p.mode === m}
                  onClick={() => p.onMode(m)}
                  className={`min-h-9 rounded-[9px] px-4.5 text-sm transition ${
                    p.mode === m ? 'bg-white font-bold text-[#1E1B4B]' : 'font-medium text-indigo-100 hover:bg-white/10'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <button type="button" onClick={p.onPrev} aria-label="Kỳ trước" className={`${ghostBtn} w-11`}>
                <Icon name="left" strokeWidth={2.2} />
              </button>
              <button type="button" onClick={p.onNext} aria-label="Kỳ sau" className={`${ghostBtn} w-11`}>
                <Icon name="right" strokeWidth={2.2} />
              </button>
              <button type="button" onClick={p.onToday} className={`${ghostBtn} px-4 text-[13px] font-semibold`}>
                Hôm nay
              </button>
            </div>
            <label className="flex h-11 min-w-0 flex-[1_1_220px] items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5">
              <Icon name="search" className="h-4 w-4 text-indigo-200" />
              <input
                type="search"
                aria-label="Tìm công việc"
                value={p.query}
                onChange={(e) => p.onQuery(e.target.value)}
                placeholder="Tìm công việc trong kỳ…"
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-indigo-200/80"
              />
            </label>
          </div>
        </div>

        {SHOW_PROGRESS_RING && (
          <div className="flex flex-[1_1_280px] items-center justify-center gap-6">
            <div className="relative h-37 w-37 flex-none">
              <svg width="148" height="148" viewBox="0 0 148 148" role="img" aria-label={`Tỉ lệ hoàn thành ${p.pct}%`}>
                <circle cx="74" cy="74" r="62" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="14" />
                <circle
                  cx="74"
                  cy="74"
                  r="62"
                  fill="none"
                  stroke="#A5B4FC"
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeDasharray={`${(RING * p.pct) / 100} ${RING}`}
                  transform="rotate(-90 74 74)"
                  className="transition-[stroke-dasharray] duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[32px] font-extrabold">{p.pct}%</span>
                <span className="text-xs text-indigo-200">hoàn thành</span>
              </div>
            </div>
            <div className="flex max-w-[190px] flex-col gap-1.5">
              <span className="text-[13px] text-indigo-200">So với {p.prevShort}</span>
              <span className={`text-[22px] font-extrabold ${!hasPrev ? 'text-white' : delta >= 0 ? 'text-green-300' : 'text-orange-300'}`}>
                {hasPrev ? `${delta > 0 ? '↑ ' : delta < 0 ? '↓ ' : ''}${Math.abs(delta)} điểm %` : 'Chưa có dữ liệu'}
              </span>
              <span className="text-xs leading-relaxed text-indigo-200">
                {hasPrev ? `Kỳ trước: ${p.prevDone}/${p.prevTotal} việc xong (${p.prevPct}%)` : 'Kỳ trước không có công việc'}
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
