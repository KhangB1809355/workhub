'use client';

import { useState } from 'react';
import { CARD, FAINT, FIELD, MUTED, ROW, SOFT, TRACK } from '@/lib/constants';
import type { BarView, BreakdownRow, GoalView } from '@/lib/selectors';
import { Icon } from './Icon';

export function GoalsCard({
  scope,
  goals,
  onAdd,
  onRemove,
}: {
  scope: string;
  goals: GoalView[];
  onAdd: (title: string) => void;
  onRemove: (id: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    onAdd(draft.trim());
    setDraft('');
  };
  return (
    <section className={`${CARD} flex flex-col gap-3.5 p-5`}>
      <div className="flex items-center gap-2.5">
        <div className={`flex h-9 w-9 items-center justify-center rounded-[10px] ${SOFT}`}>
          <Icon name="target" className="h-4.5 w-4.5" />
        </div>
        <h2 className="text-base font-bold">Mục tiêu {scope}</h2>
      </div>
      {goals.length === 0 && <p className={`text-[13px] ${MUTED}`}>Chưa có mục tiêu cho kỳ này. Đặt 1–3 mục tiêu để tập trung hơn.</p>}
      {goals.map((g) => (
        <div key={g.id} className={`flex flex-col gap-2 rounded-xl p-3 ${ROW}`}>
          <div className="flex items-start gap-2">
            <span className="flex-1 text-sm font-semibold leading-snug">{g.title}</span>
            <button
              type="button"
              onClick={() => onRemove(g.id)}
              aria-label={`Xóa mục tiêu: ${g.title}`}
              className={`-mr-1.5 -mt-1.5 flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-200/60 dark:hover:bg-white/5 ${FAINT}`}
            >
              <Icon name="x" className="h-3.5 w-3.5" strokeWidth={2.2} />
            </button>
          </div>
          <div className={`h-1.5 overflow-hidden rounded-full ${TRACK}`}>
            <div className={`h-full rounded-full ${g.pct === 100 ? 'bg-green-600' : 'bg-indigo-600 dark:bg-indigo-400'}`} style={{ width: `${g.pct}%` }} />
          </div>
          <span className={`text-xs ${MUTED}`}>{g.total ? `${g.done}/${g.total} việc xong · ${g.pct}%` : 'Chưa gắn công việc nào'}</span>
        </div>
      ))}
      <form onSubmit={submit} className="flex gap-2">
        <input
          aria-label="Mục tiêu mới"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Thêm mục tiêu…"
          className={`${FIELD} h-10.5 min-w-0 flex-1 text-[13px]`}
        />
        <button type="submit" aria-label="Thêm mục tiêu" className={`flex h-10.5 w-10.5 items-center justify-center rounded-[10px] ${SOFT}`}>
          <Icon name="plus" strokeWidth={2.6} />
        </button>
      </form>
    </section>
  );
}

export function ChartCard({ title, axis, bars }: { title: string; axis: string; bars: BarView[] }) {
  const max = Math.max(1, ...bars.map((b) => b.total));
  return (
    <section className={`${CARD} p-5`}>
      <h2 className="mb-1 text-base font-bold">{title}</h2>
      <div className={`mb-4.5 flex gap-3.5 text-xs ${MUTED}`}>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-indigo-600 dark:bg-indigo-400" />
          Đã xong
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-indigo-200 dark:bg-[#3B3F7A]" />
          Chưa xong
        </span>
      </div>
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-4.5 border-t border-dashed border-slate-200 dark:border-[#2A3350]" />
        <div className="pointer-events-none absolute inset-x-0 top-[73px] border-t border-dashed border-slate-200 dark:border-[#2A3350]" />
        <div className="relative flex h-32 items-end gap-1.25 border-b border-slate-200 dark:border-[#2A3350]">
          {bars.map((b, i) => (
            <div
              key={i}
              title={`${b.done}/${b.total} đã xong`}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
            >
              <span className={`text-[10px] font-semibold ${MUTED}`}>{b.total}</span>
              <div
                className="flex w-full max-w-7 flex-col justify-end overflow-hidden rounded-t-[7px] rounded-b-[3px] bg-indigo-200 dark:bg-[#3B3F7A]"
                style={{ height: Math.max(3, Math.round((b.total / max) * 104)) }}
              >
                <div className="w-full bg-indigo-600 dark:bg-indigo-400" style={{ height: `${b.total ? Math.round((b.done / b.total) * 100) : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-1.25">
          {bars.map((b, i) => (
            <span
              key={i}
              className={`min-w-0 flex-1 whitespace-nowrap text-center text-[11px] ${b.isCurrent ? 'font-extrabold text-indigo-600 dark:text-indigo-300' : FAINT}`}
            >
              {b.label}
            </span>
          ))}
        </div>
      </div>
      <p className={`mt-3.5 text-center text-[11px] ${FAINT}`}>{axis}</p>
    </section>
  );
}

function Breakdown({ title, rows }: { title: string; rows: BreakdownRow[] }) {
  return (
    <>
      <h2 className="text-base font-bold">{title}</h2>
      {rows.map((r) => (
        <div key={r.name} className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-[13px]">
            <span className="flex items-center gap-2 font-semibold">
              <span className="h-2.25 w-2.25 rounded-full" style={{ background: r.color }} />
              {r.name}
            </span>
            <span className={MUTED}>
              {r.done}/{r.total} xong
            </span>
          </div>
          <div className={`h-2 overflow-hidden rounded-full ${TRACK}`}>
            <div className="h-full rounded-full" style={{ background: r.color, width: `${r.total ? Math.round((r.done / r.total) * 100) : 0}%` }} />
          </div>
        </div>
      ))}
    </>
  );
}

export function BreakdownCard({ prioRows }: { prioRows: BreakdownRow[] }) {
  return (
    <section className={`${CARD} flex flex-col gap-3.5 p-5`}>
      <Breakdown title="Theo mức ưu tiên" rows={prioRows} />
    </section>
  );
}
