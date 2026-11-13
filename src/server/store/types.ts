import type { Entry, Person } from '@/lib/finance';
import type { Goal, Task } from '@/lib/types';

/** Duplicate id or a reference to something that does not exist (mapped to HTTP 409). */
export class Conflict extends Error {}

export type PersonPatch = { name?: string; email?: string | null };

/** Everything the app stores. Implemented by SQLite (local file) and Firestore (Firebase). */
export interface Store {
  readonly driver: 'sqlite' | 'firestore';

  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  deleteSetting(key: string): Promise<void>;

  listTasks(): Promise<Task[]>;
  getTask(id: string): Promise<Task | null>;
  insertTask(t: Task): Promise<void>;
  saveTask(t: Task): Promise<void>;
  deleteTask(id: string): Promise<boolean>;
  /** taskId -> new date; unknown ids are ignored. */
  moveTasks(dates: Record<string, string>): Promise<void>;
  listGoals(): Promise<Goal[]>;
  insertGoal(g: Goal): Promise<void>;
  /** Tasks linked to the goal keep existing with goalId = null. */
  deleteGoal(id: string): Promise<boolean>;
  replaceWork(tasks: Task[], goals: Goal[]): Promise<void>;

  listPeople(): Promise<Person[]>;
  getPerson(id: string): Promise<Person | null>;
  insertPerson(p: Person): Promise<void>;
  updatePerson(id: string, patch: PersonPatch): Promise<boolean>;
  /** Also deletes the person's entries. */
  removePerson(id: string): Promise<boolean>;

  listEntries(): Promise<Entry[]>;
  getEntry(id: string): Promise<Entry | null>;
  insertEntries(entries: Entry[]): Promise<void>;
  saveEntry(e: Entry): Promise<void>;
  deleteEntry(id: string): Promise<boolean>;
  deleteEntries(ids: string[]): Promise<number>;
  replaceFinance(people: Person[], entries: Entry[]): Promise<void>;
}
