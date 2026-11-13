'use client';

import { useState } from 'react';
import { CARD, FIELD, LABEL, PRIORITIES, REPEATS, REPEAT_LABEL, TAGS } from '@/lib/constants';
import type { NewTask, Priority, Repeat, Tag } from '@/lib/types';
import { Icon } from './Icon';

export function Composer({ defaultDate, onAdd }: { defaultDate: string; onAdd: (t: NewTask) => void }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [priority, setPriority] = useState<Priority>('Trung bình');
  const [tag, setTag] = useState<Tag>('Công việc');
  const [repeat, setRepeat] = useState<Repeat>('none');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t || !date) return;
    onAdd({ title: t, date, priority, tag, repeat });
    setTitle('');
  };

  return (
    <form onSubmit={submit} className={`${CARD} flex flex-wrap items-end gap-2.5 p-3.5`}>
      <label className={`${LABEL} min-w-0 flex-[999_1_240px]`}>
        Công việc mới
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bạn cần làm gì?" className={`${FIELD} h-11.5`} />
      </label>
      <label className={`${LABEL} flex-[1_1_140px]`}>
        Ngày
        <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={`${FIELD} h-11.5`} />
      </label>
      <label className={`${LABEL} flex-[1_1_110px]`}>
        Ưu tiên
        <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className={`${FIELD} h-11.5`}>
          {PRIORITIES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </label>
      <label className={`${LABEL} flex-[1_1_120px]`}>
        Nhãn
        <select value={tag} onChange={(e) => setTag(e.target.value as Tag)} className={`${FIELD} h-11.5`}>
          {TAGS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label className={`${LABEL} flex-[1_1_120px]`}>
        Lặp lại
        <select value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat)} className={`${FIELD} h-11.5`}>
          {REPEATS.map((r) => (
            <option key={r} value={r}>
              {REPEAT_LABEL[r]}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="flex h-11.5 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
        disabled={!title.trim()}
      >
        <Icon name="plus" strokeWidth={2.6} />
        Thêm việc
      </button>
    </form>
  );
}
