'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from './api';
import { addDays, startOfWeek } from './date';
import { uid } from './useWorkHub';

export interface Person {
  id: string;
  name: string;
  /** Where payment reminders are sent (optional). */
  email?: string | null;
}

/** One amount for one person. Amounts are in thousands of VND (90 = 90.000đ). */
export interface Entry {
  id: string;
  personId: string;
  content: string;
  /** YYYY-MM-DD; the week is derived from it */
  date: string;
  amount: number;
  paid: boolean;
}

export interface FinanceData {
  version: 2;
  people: Person[];
  entries: Entry[];
}

export type NewEntry = Omit<Entry, 'id' | 'paid'>;
export type EntryPatch = Partial<Omit<Entry, 'id'>>;

export const FINANCE_KEY = 'workhub:finance:v1';
/** Names created on first run. Empty: add people from the “+ Thêm tên” row. */
export const DEFAULT_PEOPLE: string[] = [];

function freshFinance(): Omit<FinanceData, 'version'> {
  return { people: DEFAULT_PEOPLE.map((name) => ({ id: uid(), name })), entries: [] };
}

/** Old browser-only data (one row per expense with a per-person map), converted to entries. */
function readLegacy(): Omit<FinanceData, 'version'> | null {
  try {
    const raw = localStorage.getItem(FINANCE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as {
      people?: Person[];
      expenses?: { id: string; title: string; date: string; shares: Record<string, number>; paid: Record<string, boolean> }[];
    };
    if (!Array.isArray(d.people) || !Array.isArray(d.expenses)) return null;
    const entries: Entry[] = d.expenses.flatMap((x) =>
      Object.entries(x.shares)
        .filter(([, amount]) => amount > 0)
        .map(([personId, amount]) => ({ id: uid(), personId, content: x.title, date: x.date, amount, paid: !!x.paid[personId] })),
    );
    return { people: d.people, entries };
  } catch {
    return null;
  }
}

/** 90 -> "90.000đ" */
export function money(k: number): string {
  return `${Math.round(k * 1000).toLocaleString('vi-VN')}đ`;
}

export interface Totals {
  total: number;
  paid: number;
  due: number;
}

export function totals(entries: Entry[]): Totals {
  let total = 0;
  let paid = 0;
  for (const e of entries) {
    total += e.amount;
    if (e.paid) paid += e.amount;
  }
  return { total, paid, due: total - paid };
}

export interface WeekGroupView {
  start: string;
  end: string;
  entries: Entry[];
  totals: Totals;
  /** Per person who has entries this week, in the people order. */
  byPerson: { person: Person; totals: Totals }[];
}

/** Groups entries by ISO week (Monday start), newest week first; entries newest first inside a week. */
export function groupByWeek(people: Person[], entries: Entry[]): WeekGroupView[] {
  const weeks = new Map<string, Entry[]>();
  for (const e of entries) {
    const k = startOfWeek(e.date);
    const list = weeks.get(k);
    if (list) list.push(e);
    else weeks.set(k, [e]);
  }
  const order = new Map(people.map((p, i) => [p.id, i]));
  return [...weeks.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([start, list]) => {
      const sorted = [...list].sort((a, b) =>
        a.date === b.date ? (order.get(a.personId) ?? 0) - (order.get(b.personId) ?? 0) : a.date < b.date ? 1 : -1,
      );
      const byPerson = people
        .map((person) => ({ person, list: list.filter((e) => e.personId === person.id) }))
        .filter((x) => x.list.length)
        .map((x) => ({ person: x.person, totals: totals(x.list) }));
      return { start, end: addDays(start, 6), entries: sorted, totals: totals(list), byPerson };
    });
}

/**
 * Finance state backed by the server API. Changes show immediately, then are saved in order;
 * if saving fails the error is reported and the data is reloaded from the server.
 */
export function useFinance() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<FinanceData | null>(null);
  ref.current = data;
  /** Saves run one after another so the server sees changes in the order they were made. */
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const reload = useCallback(async () => {
    try {
      const r = await api<{ people: Person[]; entries: Entry[]; initialized: boolean }>('GET', '/api/finance');
      setData({ version: 2, people: r.people, entries: r.entries });
      return r;
    } catch (e) {
      setError(errorMessage(e));
      return null;
    }
  }, []);

  useEffect(() => {
    (async () => {
      const r = await reload();
      if (!r || r.initialized) return;
      // First run against this server: import the browser's data, or start with the default people.
      try {
        await api('PUT', '/api/finance', readLegacy() ?? freshFinance());
        await reload();
      } catch (e) {
        setError(errorMessage(e));
      }
    })();
  }, [reload]);

  const commit = useCallback(
    (fn: (d: FinanceData) => FinanceData, save: () => Promise<unknown>) => {
      const d = ref.current;
      if (!d) return;
      const next = fn(d);
      ref.current = next;
      setData(next);
      queue.current = queue.current.then(() =>
        save().catch((e) => {
          setError(`Chưa lưu được: ${errorMessage(e)}`);
          return reload();
        }),
      );
    },
    [reload],
  );

  /** Returns the new person so callers can add entries for them right away (saves stay in order). */
  const addPerson = useCallback(
    (name: string, email?: string | null): Person => {
      const p: Person = { id: uid(), name, email: email || null };
      commit((d) => ({ ...d, people: [...d.people, p] }), () => api('POST', '/api/people', p));
      return p;
    },
    [commit],
  );

  const renamePerson = useCallback(
    (id: string, name: string) =>
      commit(
        (d) => ({ ...d, people: d.people.map((p) => (p.id === id ? { ...p, name } : p)) }),
        () => api('PATCH', `/api/people/${id}`, { name }),
      ),
    [commit],
  );

  const setPersonEmail = useCallback(
    (id: string, email: string | null) =>
      commit(
        (d) => ({ ...d, people: d.people.map((p) => (p.id === id ? { ...p, email } : p)) }),
        () => api('PATCH', `/api/people/${id}`, { email: email ?? '' }),
      ),
    [commit],
  );

  /** Also deletes that person's entries. */
  const removePerson = useCallback(
    (id: string) =>
      commit(
        (d) => ({ ...d, people: d.people.filter((p) => p.id !== id), entries: d.entries.filter((e) => e.personId !== id) }),
        () => api('DELETE', `/api/people/${id}`),
      ),
    [commit],
  );

  /** Adds the given entries (e.g. the same content for several people) in one request. */
  const addEntries = useCallback(
    (list: NewEntry[]) => {
      const created: Entry[] = list.map((e) => ({ ...e, id: uid(), paid: false }));
      commit((d) => ({ ...d, entries: [...d.entries, ...created] }), () => api('POST', '/api/entries', { entries: created }));
    },
    [commit],
  );

  const updateEntry = useCallback(
    (id: string, patch: EntryPatch) =>
      commit(
        (d) => ({ ...d, entries: d.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) }),
        () => api('PATCH', `/api/entries/${id}`, patch),
      ),
    [commit],
  );

  const deleteEntry = useCallback(
    (id: string) => commit((d) => ({ ...d, entries: d.entries.filter((e) => e.id !== id) }), () => api('DELETE', `/api/entries/${id}`)),
    [commit],
  );

  /** Deletes many entries in one request (used to delete a whole week). */
  const deleteEntries = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      const drop = new Set(ids);
      commit((d) => ({ ...d, entries: d.entries.filter((e) => !drop.has(e.id)) }), () => api('POST', '/api/entries/delete', { ids }));
    },
    [commit],
  );

  return {
    data,
    error,
    clearError: () => setError(null),
    addPerson,
    renamePerson,
    setPersonEmail,
    removePerson,
    addEntries,
    updateEntry,
    deleteEntry,
    deleteEntries,
  };
}

export type FinanceStore = ReturnType<typeof useFinance>;
