import 'server-only';
import type { Entry, Person } from '@/lib/finance';
import type { Store } from './store/types';

export { Conflict } from './store/types';

/**
 * Picks the database:
 *   DB_DRIVER=firestore | sqlite   (explicit), otherwise
 *   Firestore when FIREBASE_SERVICE_ACCOUNT or FIREBASE_PROJECT_ID is set, else SQLite (data/workhub.db).
 */
export function driverName(): 'firestore' | 'sqlite' {
  const d = process.env.DB_DRIVER;
  if (d === 'firestore' || d === 'sqlite') return d;
  return process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_PROJECT_ID ? 'firestore' : 'sqlite';
}

const globalForStore = globalThis as unknown as { workhubStore?: Promise<Store> };

/** Loaded lazily so the unused driver (e.g. native SQLite on a serverless host) is never imported. */
export function store(): Promise<Store> {
  return (globalForStore.workhubStore ??=
    driverName() === 'firestore'
      ? import('./store/firestore').then((m) => m.createFirestoreStore())
      : import('./store/sqlite').then((m) => m.createSqliteStore()));
}

type Fn = (...args: never[]) => Promise<unknown>;
const call =
  <K extends { [P in keyof Store]: Store[P] extends Fn ? P : never }[keyof Store]>(key: K, after?: () => void) =>
  (async (...args: unknown[]) => {
    const s = await store();
    const result = await (s[key] as unknown as (...a: unknown[]) => Promise<unknown>)(...args);
    after?.();
    return result;
  }) as unknown as Store[K];

// ----- short cache for the public share page (saves Firestore reads; cleared on every finance write) -----

const CACHE_MS = 20_000;
let financeCache: { at: number; data: { people: Person[]; entries: Entry[] } } | null = null;
const dropFinanceCache = () => {
  financeCache = null;
};

/** People + entries for the read-only share page, cached for a few seconds. */
export async function financeSnapshot(): Promise<{ people: Person[]; entries: Entry[] }> {
  if (financeCache && Date.now() - financeCache.at < CACHE_MS) return financeCache.data;
  const s = await store();
  const [people, entries] = await Promise.all([s.listPeople(), s.listEntries()]);
  financeCache = { at: Date.now(), data: { people, entries } };
  return financeCache.data;
}

// ----- settings -----
export const getSetting = call('getSetting');
export const setSetting = call('setSetting');
export const deleteSetting = call('deleteSetting');

// ----- tasks & goals -----
export const listTasks = call('listTasks');
export const getTask = call('getTask');
export const insertTask = call('insertTask');
export const saveTask = call('saveTask');
export const deleteTask = call('deleteTask');
export const moveTasks = call('moveTasks');
export const listGoals = call('listGoals');
export const insertGoal = call('insertGoal');
export const deleteGoal = call('deleteGoal');
export const replaceWork = call('replaceWork');

// ----- finance (writes clear the share-page cache) -----
export const listPeople = call('listPeople');
export const getPerson = call('getPerson');
export const insertPerson = call('insertPerson', dropFinanceCache);
export const updatePerson = call('updatePerson', dropFinanceCache);
export const removePerson = call('removePerson', dropFinanceCache);
export const listEntries = call('listEntries');
export const getEntry = call('getEntry');
export const insertEntries = call('insertEntries', dropFinanceCache);
export const saveEntry = call('saveEntry', dropFinanceCache);
export const deleteEntry = call('deleteEntry', dropFinanceCache);
export const deleteEntries = call('deleteEntries', dropFinanceCache);
export const replaceFinance = call('replaceFinance', dropFinanceCache);
