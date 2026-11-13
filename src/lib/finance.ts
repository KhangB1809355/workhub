'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from './api';
import { uid } from './useWorkHub';

export interface Person {
  id: string;
  name: string;
}

/** A shared expense. Amounts are in thousands of VND (90 = 90.000đ). */
export interface Expense {
  id: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  /** personId -> amount that person owes for this expense */
  shares: Record<string, number>;
  /** personId -> whether that person has paid their share */
  paid: Record<string, boolean>;
}

export interface FinanceData {
  version: 1;
  people: Person[];
  expenses: Expense[];
}

export type NewExpense = Pick<Expense, 'title' | 'date' | 'shares'>;

export const FINANCE_KEY = 'workhub:finance:v1';
export const DEFAULT_PEOPLE = ['A Q.Hội', 'Anh Lợi', 'A.Phong', 'A.Nam', 'Sẹn', 'Lộc', 'Hưng', 'Trí', 'Hằng'];

function freshFinance(): FinanceData {
  return { version: 1, people: DEFAULT_PEOPLE.map((name) => ({ id: uid(), name })), expenses: [] };
}

/** Old browser-only data, imported into the server the first time. */
function readLegacy(): FinanceData | null {
  try {
    const raw = localStorage.getItem(FINANCE_KEY);
    if (raw) {
      const d = JSON.parse(raw) as FinanceData;
      if (d && d.version === 1 && Array.isArray(d.people) && Array.isArray(d.expenses)) return d;
    }
  } catch {
    /* unreadable: start with the default people */
  }
  return null;
}

/** 90 -> "90.000đ" */
export function money(k: number): string {
  return `${Math.round(k * 1000).toLocaleString('vi-VN')}đ`;
}

export interface PersonSummary {
  person: Person;
  owed: number;
  paid: number;
  due: number;
}

export function summarize(data: FinanceData): { rows: PersonSummary[]; owed: number; paid: number; due: number } {
  const rows = data.people.map((person) => {
    let owed = 0;
    let paid = 0;
    for (const e of data.expenses) {
      const amt = e.shares[person.id] ?? 0;
      owed += amt;
      if (e.paid[person.id]) paid += amt;
    }
    return { person, owed, paid, due: owed - paid };
  });
  const sum = (k: 'owed' | 'paid' | 'due') => rows.reduce((s, r) => s + r[k], 0);
  return { rows, owed: sum('owed'), paid: sum('paid'), due: sum('due') };
}

/**
 * Shared-expense ledger backed by the server API. Changes show immediately, then are saved;
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
      const r = await api<{ people: Person[]; expenses: Expense[]; initialized: boolean }>('GET', '/api/finance');
      setData({ version: 1, people: r.people, expenses: r.expenses });
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
      const start = readLegacy() ?? freshFinance();
      try {
        await api('PUT', '/api/finance', { people: start.people, expenses: start.expenses });
        await reload();
      } catch (e) {
        setError(errorMessage(e));
      }
    })();
  }, [reload]);

  const commit = useCallback(
    (fn: (d: FinanceData) => FinanceData, save: (next: FinanceData) => Promise<unknown>) => {
      const d = ref.current;
      if (!d) return;
      const next = fn(d);
      ref.current = next;
      setData(next);
      queue.current = queue.current.then(() =>
        save(next).catch((e) => {
          setError(`Chưa lưu được: ${errorMessage(e)}`);
          return reload();
        }),
      );
    },
    [reload],
  );

  const mapExpense = (id: string, fn: (e: Expense) => Expense) => (d: FinanceData) => ({
    ...d,
    expenses: d.expenses.map((e) => (e.id === id ? fn(e) : e)),
  });
  const saveExpense = (id: string, pick: (e: Expense) => Partial<Expense>) => (next: FinanceData) => {
    const e = next.expenses.find((x) => x.id === id);
    return e ? api('PATCH', `/api/expenses/${id}`, pick(e)) : Promise.resolve();
  };

  const addPerson = useCallback(
    (name: string) => {
      const p: Person = { id: uid(), name };
      commit((d) => ({ ...d, people: [...d.people, p] }), () => api('POST', '/api/people', p));
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

  const removePerson = useCallback(
    (id: string) =>
      commit(
        (d) => ({
          ...d,
          people: d.people.filter((p) => p.id !== id),
          expenses: d.expenses.map((e) => {
            const { [id]: _s, ...shares } = e.shares;
            const { [id]: _p, ...paid } = e.paid;
            return { ...e, shares, paid };
          }),
        }),
        () => api('DELETE', `/api/people/${id}`),
      ),
    [commit],
  );

  const addExpense = useCallback(
    (e: NewExpense) => {
      const x: Expense = { ...e, id: uid(), paid: {} };
      commit((d) => ({ ...d, expenses: [...d.expenses, x] }), () => api('POST', '/api/expenses', x));
    },
    [commit],
  );

  const updateExpense = useCallback(
    (id: string, patch: Partial<Pick<Expense, 'title' | 'date'>>) =>
      commit(mapExpense(id, (e) => ({ ...e, ...patch })), () => api('PATCH', `/api/expenses/${id}`, patch)),
    [commit], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const setShare = useCallback(
    (id: string, personId: string, amount: number) =>
      commit(
        mapExpense(id, (e) => {
          const shares = { ...e.shares };
          const paid = { ...e.paid };
          if (amount > 0) shares[personId] = amount;
          else {
            delete shares[personId];
            delete paid[personId];
          }
          return { ...e, shares, paid };
        }),
        saveExpense(id, (e) => ({ shares: e.shares, paid: e.paid })),
      ),
    [commit], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const togglePaid = useCallback(
    (id: string, personId: string) =>
      commit(
        mapExpense(id, (e) => ({ ...e, paid: { ...e.paid, [personId]: !e.paid[personId] } })),
        saveExpense(id, (e) => ({ paid: e.paid })),
      ),
    [commit], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const deleteExpense = useCallback(
    (id: string) => commit((d) => ({ ...d, expenses: d.expenses.filter((e) => e.id !== id) }), () => api('DELETE', `/api/expenses/${id}`)),
    [commit],
  );

  return {
    data,
    error,
    clearError: () => setError(null),
    addPerson,
    renamePerson,
    removePerson,
    addExpense,
    updateExpense,
    setShare,
    togglePaid,
    deleteExpense,
  };
}

export type FinanceStore = ReturnType<typeof useFinance>;
