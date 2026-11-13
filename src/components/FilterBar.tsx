import { CARD, FIELD, MUTED, PRIORITIES, TAGS, TRACK } from '@/lib/constants';
import type { DashboardView, ViewInput } from '@/lib/selectors';
import type { Priority, StatusFilter, Tag } from '@/lib/types';

interface Props {
  ui: ViewInput;
  stats: DashboardView['stats'];
  hasFilter: boolean;
  onStatus: (s: StatusFilter) => void;
  onPrio: (p: 'all' | Priority) => void;
  onTag: (t: 'all' | Tag) => void;
  onClear: () => void;
}

export function FilterBar({ ui, stats, hasFilter, onStatus, onPrio, onTag, onClear }: Props) {
  const tabs: [StatusFilter, string, number][] = [
    ['all', 'Tất cả', stats.total],
    ['todo', 'Chưa làm', stats.todo],
    ['doing', 'Đang làm', stats.doing],
    ['done', 'Đã xong', stats.done],
    ['late', 'Quá hạn', stats.late],
  ];
  return (
    <section aria-label="Bộ lọc" className={`${CARD} flex flex-wrap items-center gap-2.5 p-3`}>
      <div role="group" aria-label="Trạng thái" className={`flex flex-wrap gap-1 rounded-xl p-1 ${TRACK}`}>
        {tabs.map(([key, label, n]) => {
          const on = ui.statusF === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              onClick={() => onStatus(key)}
              className={`min-h-9 rounded-[9px] px-3 text-[13px] transition ${
                on
                  ? 'bg-white font-bold text-slate-900 shadow-sm dark:bg-[#151B2E] dark:text-slate-100'
                  : `font-medium ${MUTED} hover:text-slate-900 dark:hover:text-slate-100`
              }`}
            >
              {label} <span className="opacity-70">{n}</span>
            </button>
          );
        })}
      </div>
      <label className={`flex items-center gap-2 text-[13px] font-semibold ${MUTED}`}>
        Ưu tiên
        <select value={ui.prioF} onChange={(e) => onPrio(e.target.value as 'all' | Priority)} className={`${FIELD} h-10 text-[13px]`}>
          <option value="all">Tất cả</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <label className={`flex items-center gap-2 text-[13px] font-semibold ${MUTED}`}>
        Nhãn
        <select value={ui.tagF} onChange={(e) => onTag(e.target.value as 'all' | Tag)} className={`${FIELD} h-10 text-[13px]`}>
          <option value="all">Tất cả</option>
          {TAGS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      {hasFilter && (
        <button type="button" onClick={onClear} className="h-10 px-3 text-[13px] font-semibold text-indigo-600 hover:underline dark:text-indigo-300">
          Xóa bộ lọc
        </button>
      )}
    </section>
  );
}
