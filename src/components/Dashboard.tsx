'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CARD, FAINT, MUTED, TAGS } from '@/lib/constants';
import { addDays, ddmm, ddmmyyyy, isoWeek, shiftAnchor, startOfWeek, today as getToday } from '@/lib/date';
import { downloadCsv } from '@/lib/export';
import { computeView, type ViewInput } from '@/lib/selectors';
import { useFinance } from '@/lib/finance';
import type { AppData, Mode, Priority, Status, StatusFilter, Tab, Tag } from '@/lib/types';
import { useWorkHub } from '@/lib/useWorkHub';
import { Composer } from './Composer';
import { EditDrawer } from './EditDrawer';
import { FinancePanel } from './FinancePanel';
import { FilterBar } from './FilterBar';
import { Hero } from './Hero';
import { Icon } from './Icon';
import { BreakdownCard, ChartCard, GoalsCard } from './SideCards';
import { Sidebar } from './Sidebar';
import { StatCards } from './StatCards';
import { WeekGroup } from './WeekGroup';

// Tạm đóng chức năng "Quản lý công việc" (dữ liệu vẫn giữ nguyên). Đổi thành true để mở lại.
export const SHOW_WORK = false;

const EMPTY_WORK: AppData = { version: 1, tasks: [], goals: [], dark: false };

const TAB_KEY = 'workhub:tab';
const TABS: [Tab, string][] = [
  ['work', 'Quản lý công việc'],
  ['finance', 'Quản lý thu chi'],
];

export default function Dashboard() {
  const store = useWorkHub();
  const finance = useFinance();
  const [tabState, setTabState] = useState<Tab>(SHOW_WORK ? 'work' : 'finance');
  const tab: Tab = SHOW_WORK ? tabState : 'finance';
  const [today, setToday] = useState('');
  const [mode, setMode] = useState<Mode>('month');
  const [anchor, setAnchor] = useState('');
  const [query, setQuery] = useState('');
  const [statusF, setStatusF] = useState<StatusFilter>('all');
  const [prioF, setPrioF] = useState<'all' | Priority>('all');
  const [tagF, setTagF] = useState<'all' | Tag>('all');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // "today" is only known on the client; refresh it when the tab regains focus (e.g. after midnight).
  useEffect(() => {
    const t = getToday();
    setToday(t);
    setAnchor(t);
    try {
      if (localStorage.getItem(TAB_KEY) === 'finance') setTabState('finance');
    } catch {
      /* storage unavailable: stay on the work tab */
    }
    const onFocus = () => setToday(getToday());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  const flash = useCallback((msg: string, ms = 2800) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  }, []);

  // Surface save/load errors and one-time import notices from the API-backed stores.
  const apiMessage = store.error ?? finance.error ?? store.notice;
  useEffect(() => {
    if (!apiMessage) return;
    flash(apiMessage, 5000);
    store.clearMessages();
    finance.clearError();
  }, [apiMessage]); // eslint-disable-line react-hooks/exhaustive-deps

  const ui: ViewInput = { mode, anchor, query, statusF, prioF, tagF };
  // With work management turned off, the finance tab must not wait for (or break on) the work data.
  const workData = store.data ?? (SHOW_WORK ? null : EMPTY_WORK);
  const view = useMemo(
    () => (workData && anchor ? computeView(workData, ui, today) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workData, mode, anchor, query, statusF, prioF, tagF, today],
  );
  const goalMap = useMemo(() => new Map((store.data?.goals ?? []).map((g) => [g.id, g])), [store.data?.goals]);
  const closeEdit = useCallback(() => setEditId(null), []);

  if (!workData || !view) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4" aria-busy={!toast}>
        {toast && (
          <p role="alert" className={`${CARD} px-5 py-4 text-sm font-semibold`}>
            {toast}
          </p>
        )}
      </div>
    );
  }

  const data = workData;
  const editing = editId ? data.tasks.find((t) => t.id === editId) : undefined;
  const thisWeek = startOfWeek(today);

  const setStatus = (id: string, status: Status) => {
    const spawned = store.updateTask(id, { status });
    if (spawned) flash(`Việc lặp lại: đã tạo lần tiếp theo vào ${ddmm(spawned)}`);
  };

  const range = view.range;
  const atCurrentPeriod = today >= range.start && today <= range.end;
  const noFilters = !view.hasFilter;
  const tagCounts = Object.fromEntries(
    TAGS.map((t) => [t, data.tasks.filter((x) => x.tag === t && x.status !== 'done' && x.date >= range.start && x.date <= range.end).length]),
  ) as Record<Tag, number>;
  const clearFilters = () => {
    setStatusF('all');
    setPrioF('all');
    setTagF('all');
    setQuery('');
  };
  const confirmLoadSample = () => {
    if (confirm('Thay toàn bộ dữ liệu hiện tại bằng dữ liệu mẫu?')) {
      store.loadSample();
      flash('Đã tải dữ liệu mẫu');
    }
  };
  const confirmClearAll = () => {
    if (confirm('Xóa toàn bộ công việc và mục tiêu? Không thể hoàn tác.')) {
      store.clearAll();
      flash('Đã xóa toàn bộ dữ liệu');
    }
  };
  const sidebarProps = {
    tab,
    onTab: setTab,
    showWork: SHOW_WORK,
    mode,
    atCurrentPeriod,
    noFilters,
    statusF,
    tagF,
    counts: { doing: view.stats.doing, late: view.stats.late, done: view.stats.done },
    tagCounts,
    dark: data.dark,
    onHome: () => {
      clearFilters();
      setMode('month');
      setAnchor(today);
    },
    onPeriod: (m: Mode) => {
      setMode(m);
      setAnchor(today);
    },
    onStatus: setStatusF,
    onTag: setTagF,
    onToggleDark: store.toggleDark,
    onLoadSample: confirmLoadSample,
    onClearAll: confirmClearAll,
    onLogout: async () => {
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
      window.location.href = '/login';
    },
  };

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 flex-none lg:block">
        <Sidebar {...sidebarProps} />
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Đóng menu" onClick={() => setMenuOpen(false)} className="absolute inset-0 cursor-default bg-slate-900/45 dark:bg-black/60" />
          <div className="relative h-full w-72 max-w-[85vw] shadow-[12px_0_40px_rgba(15,23,42,0.2)]">
            <Sidebar {...sidebarProps} onNavigate={() => setMenuOpen(false)} onClose={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1 px-4 pb-12 pt-7 lg:px-7">
      <main className={`mx-auto flex flex-col ${tab === 'finance' ? 'max-w-[2200px] gap-4' : 'max-w-[1180px] gap-5.5'}`}>
        {SHOW_WORK && (
        <div role="tablist" aria-label="Chọn mục quản lý" className="flex gap-1 self-start rounded-xl bg-slate-200/70 p-1 dark:bg-[#151B2E]">
          {TABS.map(([t, label]) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`flex min-h-9 items-center gap-2 rounded-[9px] px-4 text-sm transition ${
                tab === t
                  ? 'bg-white font-bold text-[#1E1B4B] shadow-sm dark:bg-indigo-500 dark:text-white'
                  : `font-medium ${MUTED} hover:text-slate-900 dark:hover:text-slate-100`
              }`}
            >
              <Icon name={t === 'work' ? 'grid' : 'wallet'} className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
        )}

        {tab === 'finance' ? (
          <FinancePanel store={finance} today={today} onMenu={() => setMenuOpen(true)} flash={flash} />
        ) : (
          <>
            <Hero
              onMenu={() => setMenuOpen(true)}
              label={view.range.label}
              rangeText={`${ddmmyyyy(view.range.start)} – ${ddmmyyyy(view.range.end)}${query.trim() ? ` · tìm “${query.trim()}”` : ''}`}
              prevShort={view.prevRange.short}
              mode={mode}
              onMode={setMode}
              onPrev={() => setAnchor((a) => shiftAnchor(mode, a, -1))}
              onNext={() => setAnchor((a) => shiftAnchor(mode, a, 1))}
              onToday={() => setAnchor(today)}
              query={query}
              onQuery={setQuery}
              pct={view.stats.pct}
              prevPct={view.stats.prevPct}
              prevDone={view.stats.prevDone}
              prevTotal={view.stats.prevTotal}
              notifications={view.notifications}
              notifOpen={notifOpen}
              setNotifOpen={setNotifOpen}
              onOpenTask={(id) => {
                setNotifOpen(false);
                setEditId(id);
              }}
              dark={data.dark}
              onToggleDark={store.toggleDark}
              onExport={() => {
                if (view.inRange.length === 0) return flash('Kỳ này chưa có công việc để xuất');
                downloadCsv(view.inRange, data.goals, view.range.label);
                flash(`Đã xuất ${view.inRange.length} công việc của ${view.range.short}`);
              }}
            />

            <StatCards stats={view.stats} prevShort={view.prevRange.short} />

            <FilterBar
              ui={ui}
              stats={view.stats}
              hasFilter={view.hasFilter}
              onStatus={setStatusF}
              onPrio={setPrioF}
              onTag={setTagF}
              onClear={clearFilters}
            />

            <div className="flex flex-wrap items-start gap-5.5">
              <section aria-label="Công việc theo tuần" className="flex min-w-0 flex-[999_1_580px] flex-col gap-4">
                <Composer
                  defaultDate={today}
                  onAdd={(t) => {
                    store.addTask(t);
                    flash(`Đã thêm vào tuần ${isoWeek(t.date)} (${ddmm(t.date)})`);
                  }}
                />

                {view.groups.length === 0 && (
                  <div className={`${CARD} flex flex-col items-center gap-2 px-5 py-12 text-center`}>
                    <Icon name="empty" className={`h-10 w-10 ${FAINT}`} strokeWidth={1.6} />
                    <p className="text-[15px] font-semibold">Không có công việc nào</p>
                    <p className={`text-[13px] ${MUTED}`}>Thử chọn kỳ khác, bỏ bớt bộ lọc hoặc thêm việc mới.</p>
                  </div>
                )}

                {view.groups.map((g) => (
                  <WeekGroup
                    key={g.start}
                    group={g}
                    today={today}
                    open={!collapsed[g.start]}
                    canMove={g.openIds.length > 0 && g.start <= thisWeek}
                    goals={goalMap}
                    onToggle={() => setCollapsed((c) => ({ ...c, [g.start]: !c[g.start] }))}
                    onMove={() => {
                      store.moveTasks(g.openIds, 7);
                      flash(`Đã dời ${g.openIds.length} việc sang tuần ${isoWeek(addDays(g.start, 7))}`);
                    }}
                    onStatus={setStatus}
                    onEdit={setEditId}
                  />
                ))}
              </section>

              <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-5.5">
                <GoalsCard
                  scope={view.range.short}
                  goals={view.goals}
                  onAdd={(title) => store.addGoal(view.goalKey, title)}
                  onRemove={store.removeGoal}
                />
                <ChartCard
                  title={mode === 'week' ? 'Công việc theo ngày' : 'Công việc theo tuần'}
                  axis={mode === 'week' ? 'Ngày trong tuần' : 'Số tuần trong năm'}
                  bars={view.chart}
                />
                <BreakdownCard prioRows={view.prioRows} />
              </aside>
            </div>
          </>
        )}
      </main>
      </div>

      {editing && (
        <EditDrawer
          key={editing.id}
          task={editing}
          goals={data.goals}
          onClose={closeEdit}
          onSave={(patch) => {
            const spawned = store.updateTask(editing.id, patch);
            setEditId(null);
            flash(spawned ? `Đã lưu · tạo lần lặp tiếp theo vào ${ddmm(spawned)}` : 'Đã lưu thay đổi');
          }}
          onDelete={() => {
            store.deleteTask(editing.id);
            setEditId(null);
            flash('Đã xóa công việc');
          }}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-7 left-1/2 z-50 max-w-[calc(100%-32px)] -translate-x-1/2 rounded-xl bg-slate-900 px-4.5 py-3 text-sm font-medium text-white shadow-[0_12px_30px_rgba(15,23,42,0.3)] dark:bg-slate-100 dark:text-slate-900"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
