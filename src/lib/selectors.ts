import { PRIORITIES, PRIORITY_COLOR } from './constants';
import { addDays, ddmm, getRange, isoWeek, periodKey, shiftAnchor, startOfWeek, weekday, weeksInRange, type Range } from './date';
import type { AppData, Goal, Mode, Priority, Status, StatusFilter, Tag, Task } from './types';

export interface ViewInput {
  mode: Mode;
  anchor: string;
  query: string;
  statusF: StatusFilter;
  prioF: 'all' | Priority;
  tagF: 'all' | Tag;
}

export interface WeekGroupView {
  start: string;
  end: string;
  num: number;
  isCurrent: boolean;
  total: number;
  done: number;
  openIds: string[];
  tasks: Task[];
}

export interface BarView {
  label: string;
  total: number;
  done: number;
  isCurrent: boolean;
}

export interface BreakdownRow {
  name: string;
  color: string;
  total: number;
  done: number;
}

export interface GoalView extends Goal {
  total: number;
  done: number;
  pct: number;
}

export interface NotificationView {
  task: Task;
  when: string;
  late: boolean;
}

export const isLate = (t: Task, today: string) => t.status !== 'done' && t.date < today;

const count = (arr: Task[], s: Status) => arr.filter((t) => t.status === s).length;
const byDate = (a: Task, b: Task) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

export function computeView(data: AppData, ui: ViewInput, today: string) {
  const range = getRange(ui.mode, ui.anchor);
  const prevRange = getRange(ui.mode, shiftAnchor(ui.mode, ui.anchor, -1));
  const q = ui.query.trim().toLowerCase();

  const matches = (t: Task, r: Range) =>
    t.date >= r.start &&
    t.date <= r.end &&
    (!q || t.title.toLowerCase().includes(q)) &&
    (ui.prioF === 'all' || t.priority === ui.prioF) &&
    (ui.tagF === 'all' || t.tag === ui.tagF);

  const inRange = data.tasks.filter((t) => matches(t, range)).sort(byDate);
  const prev = data.tasks.filter((t) => matches(t, prevRange));

  const total = inRange.length;
  const done = count(inRange, 'done');
  const stats = {
    total,
    done,
    doing: count(inRange, 'doing'),
    todo: count(inRange, 'todo'),
    late: inRange.filter((t) => isLate(t, today)).length,
    pct: total ? Math.round((done / total) * 100) : 0,
    prevTotal: prev.length,
    prevDone: count(prev, 'done'),
    prevPct: prev.length ? Math.round((count(prev, 'done') / prev.length) * 100) : 0,
  };

  const statusPass: Record<StatusFilter, (t: Task) => boolean> = {
    all: () => true,
    todo: (t) => t.status === 'todo',
    doing: (t) => t.status === 'doing',
    done: (t) => t.status === 'done',
    late: (t) => isLate(t, today),
  };
  const shown = inRange.filter(statusPass[ui.statusF]);

  const thisWeek = startOfWeek(today);
  const weeks = weeksInRange(range);

  const groups: WeekGroupView[] = weeks
    .map((ws) => {
      const we = addDays(ws, 6);
      const inWeek = (t: Task) => t.date >= ws && t.date <= we;
      const all = inRange.filter(inWeek);
      return {
        start: ws,
        end: we,
        num: isoWeek(ws),
        isCurrent: ws === thisWeek,
        total: all.length,
        done: count(all, 'done'),
        openIds: all.filter((t) => t.status !== 'done').map((t) => t.id),
        tasks: shown.filter(inWeek),
      };
    })
    .filter((g) => g.tasks.length > 0);

  const buckets =
    ui.mode === 'week'
      ? Array.from({ length: 7 }, (_, i) => {
          const d = addDays(range.start, i);
          return { label: weekday(d), from: d, to: d, isCurrent: d === today };
        })
      : weeks.map((ws) => ({ label: String(isoWeek(ws)), from: ws, to: addDays(ws, 6), isCurrent: ws === thisWeek }));

  const chart: BarView[] = buckets.map((b) => {
    const ts = inRange.filter((t) => t.date >= b.from && t.date <= b.to);
    return { label: b.label, total: ts.length, done: count(ts, 'done'), isCurrent: b.isCurrent };
  });

  const breakdown = <K extends 'priority' | 'tag'>(key: K, names: Task[K][], colorOf: (n: Task[K]) => string): BreakdownRow[] =>
    names.map((n) => {
      const ts = inRange.filter((t) => t[key] === n);
      return { name: n, color: colorOf(n), total: ts.length, done: count(ts, 'done') };
    });

  const key = periodKey(ui.mode, ui.anchor);
  const goals: GoalView[] = data.goals
    .filter((g) => g.periodKey === key)
    .map((g) => {
      const ts = data.tasks.filter((t) => t.goalId === g.id);
      const d = count(ts, 'done');
      return { ...g, total: ts.length, done: d, pct: ts.length ? Math.round((d / ts.length) * 100) : 0 };
    });

  const tomorrow = addDays(today, 1);
  const notifications: NotificationView[] = data.tasks
    .filter((t) => t.status !== 'done' && t.date <= tomorrow)
    .sort(byDate)
    .map((t) => ({
      task: t,
      late: t.date < today,
      when: t.date < today ? `Quá hạn · ${weekday(t.date)}, ${ddmm(t.date)}` : t.date === today ? 'Hôm nay' : 'Ngày mai',
    }));

  return {
    range,
    prevRange,
    goalKey: key,
    inRange,
    stats,
    groups,
    chart,
    prioRows: breakdown('priority', PRIORITIES, (p) => PRIORITY_COLOR[p]),
    goals,
    notifications,
    hasFilter: ui.statusF !== 'all' || ui.prioF !== 'all' || ui.tagF !== 'all' || !!q,
  };
}

export type DashboardView = ReturnType<typeof computeView>;
