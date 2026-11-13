import { CARD, FAINT, MUTED, NEXT_STATUS, PRIORITY_CHIP, PRIORITY_COLOR, REPEAT_LABEL, ROW, ROW_LATE, SOFT, STATUS_CHIP, STATUS_LABEL, TAG_COLOR, TRACK } from '@/lib/constants';
import { ddmm, weekday } from '@/lib/date';
import { isLate, type WeekGroupView } from '@/lib/selectors';
import type { Goal, Status, Task } from '@/lib/types';
import { Icon } from './Icon';

interface Props {
  group: WeekGroupView;
  today: string;
  open: boolean;
  canMove: boolean;
  goals: Map<string, Goal>;
  onToggle: () => void;
  onMove: () => void;
  onStatus: (id: string, s: Status) => void;
  onEdit: (id: string) => void;
}

export function WeekGroup({ group: g, today, open, canMove, goals, onToggle, onMove, onStatus, onEdit }: Props) {
  const pct = g.total ? Math.round((g.done / g.total) * 100) : 0;
  return (
    <article className={`${CARD} overflow-hidden ${g.isCurrent ? 'outline-2 -outline-offset-2 outline-indigo-600 dark:outline-indigo-400' : ''}`}>
      <div className="flex flex-wrap items-center gap-2 py-2 pr-2.5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-[999_1_300px] items-center gap-4 py-2 pl-4.5 pr-2 text-left"
        >
          <div
            className={`flex h-13.5 w-13.5 flex-none flex-col items-center justify-center gap-0.5 rounded-[14px] ${
              g.isCurrent ? 'bg-indigo-600 text-white' : SOFT
            }`}
          >
            <span className="text-[10px] font-semibold tracking-[0.08em]">TUẦN</span>
            <span className="text-xl font-extrabold leading-none">{g.num}</span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-bold">
                {ddmm(g.start)} – {ddmm(g.end)}
              </span>
              {g.isCurrent && <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${SOFT}`}>Tuần này</span>}
              <span className={`text-[13px] font-semibold ${MUTED}`}>
                · {g.done}/{g.total} xong
              </span>
            </div>
            <div className={`h-1.5 overflow-hidden rounded-full ${TRACK}`}>
              <div className="h-full rounded-full bg-indigo-600 transition-[width] duration-300 dark:bg-indigo-400" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <Icon name="down" className={`h-4.5 w-4.5 flex-none transition-transform ${FAINT} ${open ? 'rotate-180' : ''}`} strokeWidth={2.2} />
        </button>
        {canMove && (
          <button
            type="button"
            onClick={onMove}
            className={`flex h-10 flex-none items-center gap-1.5 rounded-[10px] border border-slate-200 px-3 text-xs font-semibold transition hover:bg-slate-50 dark:border-[#2A3350] dark:hover:bg-[#1B2238] ${MUTED}`}
          >
            <Icon name="arrow" className="h-3.5 w-3.5" strokeWidth={2.2} />
            Dời {g.openIds.length} việc chưa xong sang tuần sau
          </button>
        )}
      </div>
      {open && (
        <ul className="px-2.5 pb-2.5">
          {g.tasks.map((t) => (
            <TaskRow key={t.id} task={t} today={today} goal={t.goalId ? goals.get(t.goalId) : undefined} onStatus={onStatus} onEdit={onEdit} />
          ))}
        </ul>
      )}
    </article>
  );
}

function TaskRow({
  task: t,
  today,
  goal,
  onStatus,
  onEdit,
}: {
  task: Task;
  today: string;
  goal?: Goal;
  onStatus: (id: string, s: Status) => void;
  onEdit: (id: string) => void;
}) {
  const late = isLate(t, today);
  const done = t.status === 'done';
  const subDone = t.subtasks.filter((s) => s.done).length;
  const st = STATUS_CHIP[t.status];
  return (
    <li className={`mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-2.5 rounded-xl px-3 py-2.5 ${late ? ROW_LATE : ROW}`}>
      <input
        type="checkbox"
        checked={done}
        onChange={() => onStatus(t.id, done ? 'todo' : 'done')}
        aria-label={`Hoàn thành: ${t.title}`}
        className="h-5 w-5 flex-none cursor-pointer accent-indigo-600"
      />
      <div className="flex min-w-0 flex-[999_1_200px] flex-col gap-1">
        <button
          type="button"
          onClick={() => onEdit(t.id)}
          className={`text-left text-sm [overflow-wrap:anywhere] hover:underline ${
            done ? `font-medium line-through ${FAINT}` : 'font-semibold text-slate-900 dark:text-slate-100'
          }`}
        >
          {t.title}
        </button>
        <span className={`flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs ${FAINT}`}>
          <span className={late ? 'font-bold text-red-700 dark:text-red-300' : ''}>
            {late ? 'Quá hạn · ' : ''}
            {t.date === today ? 'Hôm nay' : weekday(t.date)}, {ddmm(t.date)}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[3px]" style={{ background: TAG_COLOR[t.tag] }} />
            {t.tag}
          </span>
          {t.repeat !== 'none' && (
            <span className="flex items-center gap-1">
              <Icon name="repeat" className="h-3 w-3" strokeWidth={2.2} />
              {REPEAT_LABEL[t.repeat]}
            </span>
          )}
          {t.subtasks.length > 0 && (
            <span className="flex items-center gap-1">
              <Icon name="subtasks" className="h-3 w-3" strokeWidth={2.2} />
              {subDone}/{t.subtasks.length}
            </span>
          )}
          {goal && (
            <span className="flex items-center gap-1">
              <Icon name="target" className="h-3 w-3" strokeWidth={2.2} />
              {goal.title}
            </span>
          )}
        </span>
      </div>
      <div className="flex flex-none items-center gap-2">
        <button
          type="button"
          onClick={() => onStatus(t.id, NEXT_STATUS[t.status])}
          title="Bấm để đổi trạng thái"
          aria-label={`Trạng thái: ${STATUS_LABEL[t.status]}. Bấm để đổi`}
          className={`flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-semibold transition hover:brightness-95 ${st.chip}`}
        >
          <span className={`h-1.75 w-1.75 rounded-full ${st.dot}`} />
          {STATUS_LABEL[t.status]}
        </button>
        <span className={`flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-semibold ${PRIORITY_CHIP[t.priority]}`}>
          <span className="h-1.75 w-1.75 rounded-full" style={{ background: PRIORITY_COLOR[t.priority] }} />
          {t.priority}
        </span>
      </div>
    </li>
  );
}
