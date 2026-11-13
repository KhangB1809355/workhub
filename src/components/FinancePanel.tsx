'use client';

import { useState } from 'react';
import { CARD, FAINT, FIELD, LABEL, MUTED } from '@/lib/constants';
import { ddmmyyyy } from '@/lib/date';
import { money, summarize, type Expense, type FinanceStore, type Person } from '@/lib/finance';
import { Icon } from './Icon';

const ghostBtn =
  'flex h-11 items-center justify-center rounded-xl border border-white/20 text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white';

function parseK(s: string): number {
  const n = Number(s.replace(',', '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Amount input that keeps its own text while typing and commits on blur / Enter. */
function AmountInput({ value, onCommit, label, className }: { value: number; onCommit: (n: number) => void; label: string; className: string }) {
  const [text, setText] = useState(value ? String(value) : '');
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setText(value ? String(value) : '');
  }
  const commit = () => {
    const n = parseK(text);
    if (n !== value) onCommit(n);
    else setText(value ? String(value) : '');
  };
  return (
    <input
      inputMode="decimal"
      aria-label={label}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      placeholder="–"
      className={className}
    />
  );
}

function AddExpense({ people, today, onAdd }: { people: Person[]; today: string; onAdd: (title: string, date: string, shares: Record<string, number>) => void }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState('');
  const [picked, setPicked] = useState<Set<string> | null>(null); // null = everyone
  const selected = picked ?? new Set(people.map((p) => p.id));

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    const n = parseK(amount);
    if (!t || !date) return;
    const shares: Record<string, number> = {};
    if (n > 0) for (const p of people) if (selected.has(p.id)) shares[p.id] = n;
    onAdd(t, date, shares);
    setTitle('');
    setAmount('');
  };

  return (
    <form onSubmit={submit} className={`${CARD} flex flex-col gap-3 p-3.5`}>
      <div className="flex flex-wrap items-end gap-2.5">
        <label className={`${LABEL} min-w-0 flex-[999_1_240px]`}>
          Khoản chi mới
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Bún sáng 21/09" className={`${FIELD} h-11.5`} />
        </label>
        <label className={`${LABEL} flex-[1_1_140px]`}>
          Ngày
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={`${FIELD} h-11.5`} />
        </label>
        <label className={`${LABEL} flex-[1_1_130px]`}>
          Mỗi người (nghìn đ)
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="VD: 90" className={`${FIELD} h-11.5`} />
        </label>
        <button
          type="submit"
          className="flex h-11.5 flex-none items-center gap-2 rounded-xl bg-indigo-600 px-4.5 text-sm font-bold text-white transition hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          <Icon name="plus" strokeWidth={2.4} />
          Thêm khoản
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`mr-1 text-xs font-semibold ${MUTED}`}>Áp dụng cho:</span>
        {people.map((p) => {
          const on = selected.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(p.id)}
              className={`min-h-8 rounded-full border px-3 text-xs font-semibold transition ${
                on
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-800 dark:border-indigo-400 dark:bg-[#2B2F63] dark:text-indigo-200'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-[#2A3350] dark:text-slate-400'
              }`}
            >
              {p.name}
            </button>
          );
        })}
        <button type="button" onClick={() => setPicked(selected.size === people.length ? new Set() : null)} className="ml-1 text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-300">
          {selected.size === people.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
        </button>
      </div>
    </form>
  );
}

function LedgerTable({ store, expenses, people }: { store: FinanceStore; expenses: Expense[]; people: Person[] }) {
  const summary = summarize({ version: 1, people, expenses });
  const th = `whitespace-nowrap px-2 py-2.5 text-center text-xs font-bold ${MUTED}`;
  const sticky = 'sticky left-0 z-10 bg-white dark:bg-[#151B2E]';

  return (
    <section className={`${CARD} overflow-hidden`}>
      <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
        <h2 className="text-base font-bold">Bảng thu chi</h2>
        <span className={`text-xs ${FAINT}`}>Đơn vị: nghìn đồng · bấm ✓ khi người đó đã trả</span>
      </div>
      {expenses.length === 0 ? (
        <div className="flex flex-col items-center gap-2 border-t border-slate-100 px-5 py-12 text-center dark:border-[#232B45]">
          <Icon name="wallet" className={`h-10 w-10 ${FAINT}`} strokeWidth={1.6} />
          <p className="text-[15px] font-semibold">Chưa có khoản chi nào</p>
          <p className={`text-[13px] ${MUTED}`}>Thêm khoản đầu tiên ở ô phía trên.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border-t border-slate-100 dark:border-[#232B45]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-[#232B45]">
                <th className={`${th} ${sticky} min-w-52 text-left`}>Khoản chi</th>
                {people.map((p) => (
                  <th key={p.id} className={`${th} min-w-24`}>
                    {p.name}
                  </th>
                ))}
                <th className={`${th} min-w-24`}>Tổng</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => {
                const total = Object.values(e.shares).reduce((s, n) => s + n, 0);
                return (
                  <tr key={e.id} className="border-b border-slate-100 dark:border-[#232B45]">
                    <td className={`${sticky} px-2 py-1.5`}>
                      <input
                        aria-label="Tên khoản chi"
                        defaultValue={e.title}
                        onBlur={(ev) => {
                          const t = ev.target.value.trim();
                          if (t && t !== e.title) store.updateExpense(e.id, { title: t });
                          else ev.target.value = e.title;
                        }}
                        className="w-full rounded-lg bg-transparent px-2 py-1 font-semibold outline-none focus:bg-slate-50 dark:focus:bg-[#0F1527]"
                      />
                      <input
                        type="date"
                        aria-label="Ngày"
                        value={e.date}
                        onChange={(ev) => ev.target.value && store.updateExpense(e.id, { date: ev.target.value })}
                        className={`w-full rounded-lg bg-transparent px-2 text-xs outline-none ${FAINT}`}
                      />
                    </td>
                    {people.map((p) => {
                      const amt = e.shares[p.id] ?? 0;
                      const paid = !!e.paid[p.id];
                      return (
                        <td key={p.id} className={`px-1.5 py-1.5 ${amt && paid ? 'bg-green-50 dark:bg-emerald-950/40' : ''}`}>
                          <div className="flex items-center justify-center gap-1">
                            <AmountInput
                              value={amt}
                              label={`${p.name} – ${e.title}`}
                              onCommit={(n) => store.setShare(e.id, p.id, n)}
                              className={`w-12 rounded-lg bg-transparent px-1 py-1 text-center font-semibold tabular-nums outline-none focus:bg-slate-50 dark:focus:bg-[#0F1527] ${
                                amt && paid ? 'text-green-700 line-through dark:text-emerald-300' : ''
                              }`}
                            />
                            {amt > 0 && (
                              <button
                                type="button"
                                onClick={() => store.togglePaid(e.id, p.id)}
                                aria-pressed={paid}
                                aria-label={`${p.name} ${paid ? 'đã trả' : 'chưa trả'} – ${e.title}`}
                                title={paid ? 'Đã trả · bấm để bỏ' : 'Đánh dấu đã trả'}
                                className={`flex h-6 w-6 flex-none items-center justify-center rounded-full border transition ${
                                  paid
                                    ? 'border-green-600 bg-green-600 text-white dark:border-emerald-500 dark:bg-emerald-500'
                                    : 'border-slate-300 text-transparent hover:border-green-600 hover:text-green-600 dark:border-slate-600'
                                }`}
                              >
                                <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-2 text-center font-bold tabular-nums">{total || '–'}</td>
                    <td className="pr-2">
                      <button
                        type="button"
                        aria-label={`Xóa ${e.title}`}
                        onClick={() => confirm(`Xóa khoản “${e.title}” (${ddmmyyyy(e.date)})?`) && store.deleteExpense(e.id)}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${FAINT} hover:bg-red-50 hover:text-red-600 dark:hover:bg-[#3A1D24] dark:hover:text-red-300`}
                      >
                        <Icon name="trash" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-b border-slate-100 dark:border-[#232B45]">
                <th className={`${sticky} px-4 py-2.5 text-left text-xs font-bold ${MUTED}`}>Tổng phải trả</th>
                {summary.rows.map((r) => (
                  <td key={r.person.id} className="px-2 text-center font-semibold tabular-nums">
                    {r.owed || '–'}
                  </td>
                ))}
                <td className="px-2 text-center font-bold tabular-nums">{summary.owed}</td>
                <td />
              </tr>
              <tr>
                <th className={`${sticky} px-4 py-2.5 text-left text-xs font-bold text-orange-700 dark:text-orange-300`}>Còn nợ</th>
                {summary.rows.map((r) => (
                  <td key={r.person.id} className={`px-2 text-center font-bold tabular-nums ${r.due ? 'text-orange-700 dark:text-orange-300' : FAINT}`}>
                    {r.due || '✓'}
                  </td>
                ))}
                <td className="px-2 text-center font-extrabold tabular-nums text-orange-700 dark:text-orange-300">{summary.due}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

function PeopleCard({ store, people, expenses }: { store: FinanceStore; people: Person[]; expenses: Expense[] }) {
  const [name, setName] = useState('');
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    store.addPerson(n);
    setName('');
  };
  const remove = (p: Person) => {
    const used = expenses.some((e) => e.shares[p.id]);
    const msg = used ? `Xóa “${p.name}”? Các số tiền của người này trong bảng cũng sẽ bị xóa.` : `Xóa “${p.name}” khỏi danh sách?`;
    if (confirm(msg)) store.removePerson(p.id);
  };

  return (
    <section className={`${CARD} flex flex-col gap-3 p-5`}>
      <div className="flex items-center gap-2">
        <Icon name="users" className={`h-4.5 w-4.5 ${MUTED}`} />
        <h2 className="text-base font-bold">Thành viên</h2>
        <span className={`text-xs ${FAINT}`}>({people.length})</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {people.map((p) => (
          <div key={p.id} className="flex items-center rounded-xl border border-slate-200 bg-slate-50 pl-1 dark:border-[#2A3350] dark:bg-[#0F1527]">
            <input
              aria-label="Tên thành viên"
              defaultValue={p.name}
              size={Math.max(p.name.length, 4)}
              onBlur={(ev) => {
                const n = ev.target.value.trim();
                if (n && n !== p.name) store.renamePerson(p.id, n);
                else ev.target.value = p.name;
              }}
              onKeyDown={(ev) => ev.key === 'Enter' && (ev.target as HTMLInputElement).blur()}
              className="h-9 rounded-lg bg-transparent px-2 text-sm font-semibold outline-none focus:bg-white dark:focus:bg-[#151B2E]"
            />
            <button
              type="button"
              aria-label={`Xóa ${p.name}`}
              onClick={() => remove(p)}
              className={`flex h-9 w-8 items-center justify-center rounded-r-xl ${FAINT} hover:text-red-600 dark:hover:text-red-300`}
            >
              <Icon name="x" className="h-3.5 w-3.5" strokeWidth={2.4} />
            </button>
          </div>
        ))}
      </div>
      <form onSubmit={add} className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên thành viên mới" aria-label="Tên thành viên mới" className={`${FIELD} min-w-0 flex-1`} />
        <button type="submit" className="flex h-11 flex-none items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 text-sm font-semibold hover:bg-slate-50 dark:border-[#2A3350] dark:hover:bg-[#1B2238]">
          <Icon name="plus" strokeWidth={2.4} />
          Thêm
        </button>
      </form>
      <p className={`text-xs ${FAINT}`}>Bấm vào tên để đổi tên.</p>
    </section>
  );
}

export function FinancePanel({ store, today, onMenu, flash }: { store: FinanceStore; today: string; onMenu: () => void; flash: (msg: string) => void }) {
  const data = store.data;
  if (!data) return <div aria-busy="true" />;

  const expenses = [...data.expenses].sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
  const s = summarize(data);
  const stats = [
    { label: 'Tổng phải thu', value: money(s.owed), cls: 'text-white' },
    { label: 'Đã thu', value: money(s.paid), cls: 'text-green-300' },
    { label: 'Còn nợ', value: money(s.due), cls: 'text-orange-300' },
  ];

  return (
    <>
      <section className="flex flex-col gap-5 rounded-[22px] bg-[#1E1B4B] px-7 pb-7 pt-5.5 text-white dark:bg-[#1A1745]">
        <div className="flex items-center gap-2.5 lg:hidden">
          <button type="button" onClick={onMenu} aria-label="Mở menu" className={`${ghostBtn} w-11`}>
            <Icon name="menu" className="h-4.5 w-4.5" />
          </button>
          <span className="text-base font-bold">WorkHub</span>
        </div>
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-indigo-200">Quản lý thu chi</p>
          <h1 className="mt-1.5 text-[34px] font-extrabold leading-tight">Chi tiêu chung</h1>
          <p className="mt-1.5 text-sm text-indigo-200">
            {data.expenses.length} khoản · {data.people.length} thành viên
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.map((x) => (
            <div key={x.label} className="rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-xs text-indigo-200">{x.label}</p>
              <p className={`mt-1 text-[22px] font-extrabold tabular-nums ${x.cls}`}>{x.value}</p>
            </div>
          ))}
        </div>
      </section>

      <AddExpense
        people={data.people}
        today={today}
        onAdd={(title, date, shares) => {
          store.addExpense({ title, date, shares });
          const n = Object.keys(shares).length;
          flash(n ? `Đã thêm “${title}” cho ${n} người` : `Đã thêm “${title}” · nhập số tiền từng người trong bảng`);
        }}
      />

      <LedgerTable store={store} expenses={expenses} people={data.people} />

      <PeopleCard store={store} people={data.people} expenses={data.expenses} />
    </>
  );
}
