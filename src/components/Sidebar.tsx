'use client';

import { FAINT, MUTED, SOFT, TAG_COLOR, TAGS } from '@/lib/constants';
import type { Mode, StatusFilter, Tab, Tag } from '@/lib/types';
import { Icon, type IconName } from './Icon';

// Tạm ẩn mục Tuần/Tháng/Quý này, Lọc nhanh và Nhãn. Đổi thành true để hiện lại.
const SHOW_EXTRA_NAV = false;

interface Props {
  tab: Tab;
  onTab: (t: Tab) => void;
  /** false = work management is turned off (only the finance tab is shown). */
  showWork: boolean;
  mode: Mode;
  /** The anchor is inside the current week/month/quarter. */
  atCurrentPeriod: boolean;
  noFilters: boolean;
  statusF: StatusFilter;
  tagF: 'all' | Tag;
  counts: { doing: number; late: number; done: number };
  tagCounts: Record<Tag, number>;
  dark: boolean;
  onHome: () => void;
  onPeriod: (m: Mode) => void;
  onStatus: (s: StatusFilter) => void;
  onTag: (t: 'all' | Tag) => void;
  onToggleDark: () => void;
  onLoadSample: () => void;
  onClearAll: () => void;
  onLogout: () => void;
  /** Called after any navigation, used to close the mobile drawer. */
  onNavigate?: () => void;
  onClose?: () => void;
}

function Item({
  icon,
  dot,
  label,
  count,
  countClass,
  active,
  onClick,
}: {
  icon?: IconName;
  dot?: string;
  label: string;
  count?: number;
  countClass?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-10 w-full items-center gap-3 rounded-[10px] px-3 text-left text-sm transition ${
        active ? `${SOFT} font-semibold` : `${MUTED} hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-[#1B2238] dark:hover:text-slate-100`
      }`}
    >
      {icon && <Icon name={icon} className="h-4.5 w-4.5 flex-none" />}
      {dot && <span className="ml-1 mr-0.5 h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: dot }} />}
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span className={`min-w-6 rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold ${countClass ?? 'bg-slate-100 text-slate-700 dark:bg-[#232B44] dark:text-slate-300'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className={`px-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] ${FAINT}`}>{title}</p>
      {children}
    </div>
  );
}

export function Sidebar(p: Props) {
  const go = (fn: () => void) => () => {
    fn();
    p.onNavigate?.();
  };

  return (
    <nav aria-label="Menu chính" className="flex h-full flex-col gap-6 overflow-y-auto border-r border-slate-200 bg-white px-3 py-5 dark:border-[#232B45] dark:bg-[#111729]">
      <div className="flex items-center gap-2.5 px-3">
        <div className="flex h-8.5 w-8.5 items-center justify-center rounded-[10px] bg-[#1E1B4B] text-white dark:bg-indigo-500">
          <Icon name="check" strokeWidth={2.6} />
        </div>
        <span className="flex-1 text-base font-bold">WorkHub</span>
        {p.onClose && (
          <button type="button" onClick={p.onClose} aria-label="Đóng menu" className={`flex h-10 w-10 items-center justify-center rounded-[10px] ${MUTED}`}>
            <Icon name="x" strokeWidth={2.2} />
          </button>
        )}
      </div>

      <Section title="Tổng quan">
        {p.showWork && (
          <Item
            icon="grid"
            label="Quản lý công việc"
            active={p.tab === 'work'}
            onClick={go(() => {
              p.onTab('work');
              p.onHome();
            })}
          />
        )}
        <Item icon="wallet" label="Quản lý thu chi" active={p.tab === 'finance'} onClick={go(() => p.onTab('finance'))} />
        {SHOW_EXTRA_NAV && (
          <>
            <Item icon="calendarWeek" label="Tuần này" active={p.mode === 'week' && p.atCurrentPeriod} onClick={go(() => p.onPeriod('week'))} />
            <Item icon="calendar" label="Tháng này" active={!p.noFilters && p.mode === 'month' && p.atCurrentPeriod} onClick={go(() => p.onPeriod('month'))} />
            <Item icon="layers" label="Quý này" active={p.mode === 'quarter' && p.atCurrentPeriod} onClick={go(() => p.onPeriod('quarter'))} />
          </>
        )}
      </Section>

      {SHOW_EXTRA_NAV && (
        <>
          <Section title="Lọc nhanh">
            <Item
              icon="clock"
              label="Đang làm"
              count={p.counts.doing}
              countClass="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
              active={p.statusF === 'doing'}
              onClick={go(() => p.onStatus(p.statusF === 'doing' ? 'all' : 'doing'))}
            />
            <Item
              icon="alert"
              label="Quá hạn"
              count={p.counts.late}
              countClass="bg-red-100 text-red-800 dark:bg-[#3A1D24] dark:text-red-300"
              active={p.statusF === 'late'}
              onClick={go(() => p.onStatus(p.statusF === 'late' ? 'all' : 'late'))}
            />
            <Item
              icon="checkCircle"
              label="Đã xong"
              count={p.counts.done}
              active={p.statusF === 'done'}
              onClick={go(() => p.onStatus(p.statusF === 'done' ? 'all' : 'done'))}
            />
          </Section>

          <Section title="Nhãn">
            {TAGS.map((t) => (
              <Item
                key={t}
                dot={TAG_COLOR[t]}
                label={t}
                count={p.tagCounts[t]}
                active={p.tagF === t}
                onClick={go(() => p.onTag(p.tagF === t ? 'all' : t))}
              />
            ))}
          </Section>
        </>
      )}

      <div className="mt-auto flex flex-col gap-0.5 border-t border-slate-200 pt-4 dark:border-[#232B45]">
        <Item icon={p.dark ? 'sun' : 'moon'} label={p.dark ? 'Giao diện sáng' : 'Giao diện tối'} onClick={p.onToggleDark} />
        {p.showWork && (
          <>
            <Item icon="refresh" label="Tải dữ liệu mẫu" onClick={go(p.onLoadSample)} />
            <Item icon="trash" label="Xóa toàn bộ dữ liệu" onClick={go(p.onClearAll)} />
          </>
        )}
        <Item icon="logout" label="Đăng xuất" onClick={p.onLogout} />
      </div>
    </nav>
  );
}
