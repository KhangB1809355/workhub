'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from './api';
import { addDays, nextOccurrence, today } from './date';
import { makeSample } from './seed';
import type { AppData, Goal, NewTask, Task, TaskPatch } from './types';

/** Old browser-only storage. Read once to import existing data into the server. */
export const STORAGE_KEY = 'workhub:v1';
/** Theme cache so layout.tsx can apply dark mode before the first paint. */
export const THEME_KEY = 'workhub:theme';

export function uid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

interface WorkResponse {
  tasks: Task[];
  goals: Goal[];
  dark: boolean;
  initialized: boolean;
}

function readLegacy(): { tasks: Task[]; goals: Goal[] } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as AppData;
    if (d && d.version === 1 && Array.isArray(d.tasks) && Array.isArray(d.goals) && (d.tasks.length || d.goals.length)) {
      return { tasks: d.tasks, goals: d.goals };
    }
  } catch {
    /* unreadable: nothing to import */
  }
  return null;
}

/**
 * Task/goal state backed by the server API.
 * Every action updates the screen immediately, then saves to the server; if saving fails the
 * error is reported and the data is reloaded from the server.
 */
export function useWorkHub() {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const ref = useRef<AppData | null>(null);
  ref.current = data;
  /** Saves run one after another so the server sees changes in the order they were made. */
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const reload = useCallback(async () => {
    try {
      const r = await api<WorkResponse>('GET', '/api/work');
      setData({ version: 1, tasks: r.tasks, goals: r.goals, dark: r.dark });
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
      // First run against this server: import what the browser had before, otherwise start empty.
      const legacy = readLegacy();
      try {
        await api('PUT', '/api/work', legacy ?? { tasks: [], goals: [] });
        if (legacy) {
          setNotice(`Đã chuyển ${legacy.tasks.length} công việc từ trình duyệt lên máy chủ`);
          await reload();
        }
      } catch (e) {
        setError(errorMessage(e));
      }
    })();
  }, [reload]);

  useEffect(() => {
    if (!data) return;
    document.documentElement.classList.toggle('dark', data.dark);
    try {
      localStorage.setItem(THEME_KEY, data.dark ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  }, [data?.dark]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Applies a change locally right away, then runs the API call(s). */
  const commit = useCallback(
    (fn: (d: AppData) => AppData, save: () => Promise<unknown>) => {
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

  const addTask = useCallback(
    (t: NewTask) => {
      const task: Task = { ...t, id: uid(), status: 'todo', goalId: null, subtasks: [], note: '' };
      commit((d) => ({ ...d, tasks: [...d.tasks, task] }), () => api('POST', '/api/tasks', task));
    },
    [commit],
  );

  /**
   * Updates a task. When a repeating task becomes done, the next occurrence is created.
   * Returns the date of the spawned occurrence, if any.
   */
  const updateTask = useCallback(
    (id: string, patch: TaskPatch): string | null => {
      const d = ref.current;
      const t = d?.tasks.find((x) => x.id === id);
      if (!d || !t) return null;
      const next = { ...t, ...patch };
      let spawned: Task | null = null;
      if (next.status === 'done' && t.status !== 'done' && next.repeat !== 'none') {
        spawned = {
          ...next,
          id: uid(),
          date: nextOccurrence(next.date, next.repeat),
          status: 'todo',
          subtasks: next.subtasks.map((s) => ({ ...s, id: uid(), done: false })),
        };
      }
      const s = spawned;
      commit(
        (cur) => {
          const tasks = cur.tasks.map((x) => (x.id === id ? next : x));
          return { ...cur, tasks: s ? [...tasks, s] : tasks };
        },
        async () => {
          await api('PATCH', `/api/tasks/${id}`, patch);
          if (s) await api('POST', '/api/tasks', s);
        },
      );
      return s ? s.date : null;
    },
    [commit],
  );

  const deleteTask = useCallback(
    (id: string) => commit((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }), () => api('DELETE', `/api/tasks/${id}`)),
    [commit],
  );

  const moveTasks = useCallback(
    (ids: string[], days: number) => {
      const d = ref.current;
      if (!d) return;
      const dates = Object.fromEntries(d.tasks.filter((t) => ids.includes(t.id)).map((t) => [t.id, addDays(t.date, days)]));
      commit(
        (cur) => ({ ...cur, tasks: cur.tasks.map((t) => (dates[t.id] ? { ...t, date: dates[t.id] } : t)) }),
        () => api('POST', '/api/tasks/move', { dates }),
      );
    },
    [commit],
  );

  const addGoal = useCallback(
    (periodKey: string, title: string) => {
      const g: Goal = { id: uid(), periodKey, title };
      commit((d) => ({ ...d, goals: [...d.goals, g] }), () => api('POST', '/api/goals', g));
    },
    [commit],
  );

  const removeGoal = useCallback(
    (id: string) =>
      commit(
        (d) => ({
          ...d,
          goals: d.goals.filter((g) => g.id !== id),
          tasks: d.tasks.map((t) => (t.goalId === id ? { ...t, goalId: null } : t)),
        }),
        () => api('DELETE', `/api/goals/${id}`),
      ),
    [commit],
  );

  const toggleDark = useCallback(() => {
    const dark = !ref.current?.dark;
    commit((d) => ({ ...d, dark }), () => api('PATCH', '/api/settings', { dark }));
  }, [commit]);

  const loadSample = useCallback(() => {
    const sample = makeSample(today());
    commit((d) => ({ ...d, ...sample }), () => api('PUT', '/api/work', sample));
  }, [commit]);

  const clearAll = useCallback(
    () => commit((d) => ({ ...d, tasks: [], goals: [] }), () => api('PUT', '/api/work', { tasks: [], goals: [] })),
    [commit],
  );

  return {
    data,
    error,
    notice,
    clearMessages: () => {
      setError(null);
      setNotice(null);
    },
    addTask,
    updateTask,
    deleteTask,
    moveTasks,
    addGoal,
    removeGoal,
    toggleDark,
    loadSample,
    clearAll,
  };
}

export type WorkHubStore = ReturnType<typeof useWorkHub>;
