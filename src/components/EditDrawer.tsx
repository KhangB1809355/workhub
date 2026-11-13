'use client';

import { useEffect, useRef, useState } from 'react';
import { FAINT, FIELD, LABEL, MUTED, PRIORITIES, REPEATS, REPEAT_LABEL, ROW, SOFT, STATUSES, STATUS_LABEL, TAGS, TRACK } from '@/lib/constants';
import { uid } from '@/lib/useWorkHub';
import type { Goal, Priority, Repeat, Tag, Task, TaskPatch } from '@/lib/types';
import { Icon } from './Icon';

interface Props {
  task: Task;
  goals: Goal[];
  onClose: () => void;
  onSave: (patch: TaskPatch) => void;
  onDelete: () => void;
}

export function EditDrawer({ task, goals, onClose, onSave, onDelete }: Props) {
  const [d, setD] = useState<Task>(() => structuredClone(task));
  const [subDraft, setSubDraft] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);
  const patch = (p: Partial<Task>) => setD((x) => ({ ...x, ...p }));

  useEffect(() => {
    titleRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const addSub = () => {
    const text = subDraft.trim();
    if (!text) return;
    patch({ subtasks: [...d.subtasks, { id: uid(), text, done: false }] });
    setSubDraft('');
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!d.title.trim()) return;
    const { id: _id, ...rest } = d;
    onSave({ ...rest, title: d.title.trim() });
  };

  const subDone = d.subtasks.filter((s) => s.done).length;
  const chip = (on: boolean) =>
    `min-h-9 rounded-full border px-3.5 text-[13px] transition ${
      on ? `border-indigo-600 font-bold ${SOFT}` : `border-slate-200 font-medium dark:border-[#2A3350] ${MUTED}`
    }`;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" aria-label="Đóng" onClick={onClose} className="absolute inset-0 cursor-default bg-slate-900/45 dark:bg-black/60" />
      <form
        onSubmit={save}
        role="dialog"
        aria-modal="true"
        aria-label="Chi tiết công việc"
        className="relative flex h-full w-[460px] max-w-full flex-col gap-4.5 overflow-y-auto bg-white p-6 text-slate-900 shadow-[-12px_0_40px_rgba(15,23,42,0.2)] dark:bg-[#151B2E] dark:text-slate-100"
      >
        <div className="flex items-center gap-2.5">
          <h2 className="flex-1 text-lg font-bold">Chi tiết công việc</h2>
          <button type="button" onClick={onClose} aria-label="Đóng" className={`flex h-10 w-10 items-center justify-center rounded-[10px] ${ROW} ${MUTED}`}>
            <Icon name="x" strokeWidth={2.2} />
          </button>
        </div>

        <label className={LABEL}>
          Tên công việc
          <input ref={titleRef} value={d.title} onChange={(e) => patch({ title: e.target.value })} className={`${FIELD} h-11.5 text-[15px] font-semibold`} />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className={`text-xs font-semibold ${MUTED}`}>Trạng thái</span>
          <div role="group" aria-label="Trạng thái" className={`flex gap-1 rounded-xl p-1 ${TRACK}`}>
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={d.status === s}
                onClick={() => patch({ status: s })}
                className={`min-h-9.5 flex-1 rounded-[9px] px-3.5 text-[13px] transition ${
                  d.status === s ? 'bg-white font-bold shadow-sm dark:bg-[#151B2E]' : `font-medium ${MUTED}`
                }`}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className={LABEL}>
            Ngày
            <input type="date" required value={d.date} onChange={(e) => patch({ date: e.target.value })} className={FIELD} />
          </label>
          <label className={LABEL}>
            Ưu tiên
            <select value={d.priority} onChange={(e) => patch({ priority: e.target.value as Priority })} className={FIELD}>
              {PRIORITIES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className={LABEL}>
            Nhãn
            <select value={d.tag} onChange={(e) => patch({ tag: e.target.value as Tag })} className={FIELD}>
              {(TAGS.includes(d.tag) ? TAGS : [...TAGS, d.tag]).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className={LABEL}>
            Lặp lại
            <select value={d.repeat} onChange={(e) => patch({ repeat: e.target.value as Repeat })} className={FIELD}>
              {REPEATS.map((r) => (
                <option key={r} value={r}>
                  {REPEAT_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <span className={`text-xs font-semibold ${MUTED}`}>Gắn với mục tiêu</span>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" aria-pressed={!d.goalId} onClick={() => patch({ goalId: null })} className={chip(!d.goalId)}>
              Không gắn
            </button>
            {goals.map((g) => (
              <button key={g.id} type="button" aria-pressed={d.goalId === g.id} onClick={() => patch({ goalId: g.id })} className={chip(d.goalId === g.id)}>
                {g.title}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className={`text-xs font-semibold ${MUTED}`}>
            Việc con · {subDone}/{d.subtasks.length} xong
          </span>
          {d.subtasks.map((s) => (
            <div key={s.id} className={`flex items-center gap-2.5 rounded-[10px] py-1.5 pl-3 pr-2 ${ROW}`}>
              <input
                type="checkbox"
                checked={s.done}
                onChange={() => patch({ subtasks: d.subtasks.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)) })}
                aria-label={`Xong: ${s.text}`}
                className="h-4.5 w-4.5 accent-indigo-600"
              />
              <span className={`flex-1 text-sm ${s.done ? `line-through ${FAINT}` : ''}`}>{s.text}</span>
              <button
                type="button"
                onClick={() => patch({ subtasks: d.subtasks.filter((x) => x.id !== s.id) })}
                aria-label={`Xóa việc con: ${s.text}`}
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${FAINT}`}
              >
                <Icon name="x" className="h-3.5 w-3.5" strokeWidth={2.2} />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              aria-label="Việc con mới"
              value={subDraft}
              onChange={(e) => setSubDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSub();
                }
              }}
              placeholder="Thêm việc con…"
              className={`${FIELD} h-10.5 min-w-0 flex-1 text-[13px]`}
            />
            <button type="button" onClick={addSub} aria-label="Thêm việc con" className={`flex h-10.5 w-10.5 items-center justify-center rounded-[10px] ${SOFT}`}>
              <Icon name="plus" strokeWidth={2.6} />
            </button>
          </div>
        </div>

        <label className={LABEL}>
          Ghi chú
          <textarea
            value={d.note}
            onChange={(e) => patch({ note: e.target.value })}
            rows={4}
            placeholder="Thêm ghi chú, đường dẫn…"
            className={`${FIELD} h-auto resize-y py-3 text-sm`}
          />
        </label>

        <div className="mt-auto flex flex-wrap gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => {
              if (confirm(`Xóa công việc "${task.title}"?`)) onDelete();
            }}
            className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-red-700 hover:bg-red-50 dark:border-[#2A3350] dark:text-red-300 dark:hover:bg-[#3A1D24]"
          >
            Xóa công việc
          </button>
          <span className="flex-1" />
          <button type="button" onClick={onClose} className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold dark:border-[#2A3350]">
            Hủy
          </button>
          <button type="submit" className="h-11 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white hover:bg-indigo-700">
            Lưu thay đổi
          </button>
        </div>
      </form>
    </div>
  );
}
