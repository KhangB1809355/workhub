import { REPEAT_LABEL, STATUS_LABEL } from './constants';
import { ddmmyyyy, isoWeek } from './date';
import type { Goal, Task } from './types';

function cell(v: string | number): string {
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Downloads the given tasks as a CSV file that Excel opens with Vietnamese characters intact. */
export function downloadCsv(tasks: Task[], goals: Goal[], periodLabel: string) {
  const goalName = new Map(goals.map((g) => [g.id, g.title]));
  const header = ['Ngày', 'Tuần', 'Công việc', 'Trạng thái', 'Ưu tiên', 'Nhãn', 'Lặp lại', 'Mục tiêu', 'Việc con', 'Ghi chú'];
  const rows = tasks.map((t) => [
    ddmmyyyy(t.date),
    isoWeek(t.date),
    t.title,
    STATUS_LABEL[t.status],
    t.priority,
    t.tag,
    REPEAT_LABEL[t.repeat],
    t.goalId ? (goalName.get(t.goalId) ?? '') : '',
    t.subtasks.length ? `${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}` : '',
    t.note,
  ]);
  const csv = '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `workhub-${periodLabel.toLowerCase().replace(/[^a-z0-9à-ỹ]+/gi, '-').replace(/^-|-$/g, '')}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
