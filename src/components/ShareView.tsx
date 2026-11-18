'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { today as getToday } from '@/lib/date';
import type { Entry, FinanceStore, Person } from '@/lib/finance';
import { FinancePanel } from './FinancePanel';

/** Refresh while the page is visible; the server also caches, so this costs few database reads. */
const REFRESH_MS = 60_000;
const noop = () => undefined;

/** Read-only page for the share link: shows the finance tab and refreshes every minute while visible. */
export function ShareView({ token, initial }: { token: string; initial: { people: Person[]; entries: Entry[]; driveUrl: string | null } }) {
  const [data, setData] = useState(initial);
  const [today, setToday] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setToday(getToday()), []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/public/finance?t=${encodeURIComponent(token)}`, { cache: 'no-store' });
        if (res.status === 404) return setGone(true);
        if (res.ok) setData(await res.json());
      } catch {
        /* offline: keep showing the last data */
      }
    };
    const id = setInterval(() => document.visibilityState === 'visible' && load(), REFRESH_MS);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [token]);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  if (gone) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-center">
        <p className="text-sm font-semibold">Link này đã bị thu hồi. Hãy xin link mới từ người chia sẻ.</p>
      </main>
    );
  }
  if (!today) return <div className="min-h-screen" aria-busy="true" />;

  // Every action is a no-op: the page cannot change data (and the server would refuse anyway).
  const store: FinanceStore = {
    data: { version: 2, people: data.people, entries: data.entries, driveUrl: data.driveUrl },
    error: null,
    clearError: noop,
    addPerson: (name: string) => ({ id: '', name }),
    renamePerson: noop,
    setPersonEmail: noop,
    setPersonDebt: noop,
    setDriveUrl: noop,
    removePerson: noop,
    addEntries: noop,
    updateEntry: noop,
    deleteEntry: noop,
    deleteEntries: noop,
    setEntriesPaid: noop,
  };

  return (
    <div className="min-h-screen px-4 pb-10 pt-5 lg:px-7">
      <main className="mx-auto flex max-w-[2200px] flex-col gap-4">
        <FinancePanel store={store} today={today} flash={flash} readOnly />
      </main>
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
