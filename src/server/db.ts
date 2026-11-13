import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { Expense, Person } from '@/lib/finance';
import type { Goal, Task } from '@/lib/types';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'workhub.db');

const globalForDb = globalThis as unknown as { workhubDb?: Database.Database };

function open(): Database.Database {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      period_key TEXT NOT NULL,
      title TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      priority TEXT NOT NULL,
      status TEXT NOT NULL,
      tag TEXT NOT NULL,
      repeat TEXT NOT NULL,
      goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
      subtasks TEXT NOT NULL DEFAULT '[]',
      note TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS tasks_date ON tasks(date);
    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      position INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      shares TEXT NOT NULL DEFAULT '{}',
      paid TEXT NOT NULL DEFAULT '{}'
    );
  `);
  return db;
}

// Reuse one connection across hot reloads in development.
export const db = globalForDb.workhubDb ?? open();
if (process.env.NODE_ENV !== 'production') globalForDb.workhubDb = db;

// ---------- settings ----------

export function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function setSetting(key: string, value: string) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

// ---------- tasks & goals ----------

interface TaskRow {
  id: string;
  title: string;
  date: string;
  priority: string;
  status: string;
  tag: string;
  repeat: string;
  goal_id: string | null;
  subtasks: string;
  note: string;
}

const toTask = (r: TaskRow): Task =>
  ({
    id: r.id,
    title: r.title,
    date: r.date,
    priority: r.priority,
    status: r.status,
    tag: r.tag,
    repeat: r.repeat,
    goalId: r.goal_id,
    subtasks: JSON.parse(r.subtasks),
    note: r.note,
  }) as Task;

const taskParams = (t: Task) => ({
  id: t.id,
  title: t.title,
  date: t.date,
  priority: t.priority,
  status: t.status,
  tag: t.tag,
  repeat: t.repeat,
  goal_id: t.goalId,
  subtasks: JSON.stringify(t.subtasks),
  note: t.note,
});

const insertTaskStmt = () =>
  db.prepare(
    `INSERT INTO tasks (id, title, date, priority, status, tag, repeat, goal_id, subtasks, note)
     VALUES (@id, @title, @date, @priority, @status, @tag, @repeat, @goal_id, @subtasks, @note)`,
  );

export function listTasks(): Task[] {
  return (db.prepare('SELECT * FROM tasks ORDER BY date, rowid').all() as TaskRow[]).map(toTask);
}

export function getTask(id: string): Task | null {
  const r = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined;
  return r ? toTask(r) : null;
}

export function insertTask(t: Task) {
  insertTaskStmt().run(taskParams(t));
}

export function saveTask(t: Task) {
  db.prepare(
    `UPDATE tasks SET title=@title, date=@date, priority=@priority, status=@status, tag=@tag, repeat=@repeat,
       goal_id=@goal_id, subtasks=@subtasks, note=@note WHERE id=@id`,
  ).run(taskParams(t));
}

export function deleteTask(id: string): boolean {
  return db.prepare('DELETE FROM tasks WHERE id = ?').run(id).changes > 0;
}

export const moveTasks = db.transaction((ids: string[], dates: Record<string, string>) => {
  const stmt = db.prepare('UPDATE tasks SET date = ? WHERE id = ?');
  for (const id of ids) if (dates[id]) stmt.run(dates[id], id);
});

export function listGoals(): Goal[] {
  return (db.prepare('SELECT id, period_key AS periodKey, title FROM goals ORDER BY rowid').all() as Goal[]);
}

export function insertGoal(g: Goal) {
  db.prepare('INSERT INTO goals (id, period_key, title) VALUES (?, ?, ?)').run(g.id, g.periodKey, g.title);
}

export function deleteGoal(id: string): boolean {
  return db.prepare('DELETE FROM goals WHERE id = ?').run(id).changes > 0; // tasks.goal_id is cleared by ON DELETE SET NULL
}

/** Replaces all tasks and goals (used by "load sample", "clear all" and the one-time import from the browser). */
export const replaceWork = db.transaction((tasks: Task[], goals: Goal[]) => {
  db.prepare('DELETE FROM tasks').run();
  db.prepare('DELETE FROM goals').run();
  for (const g of goals) insertGoal(g);
  const stmt = insertTaskStmt();
  for (const t of tasks) stmt.run(taskParams(t));
});

// ---------- finance ----------

export function listPeople(): Person[] {
  return db.prepare('SELECT id, name FROM people ORDER BY position, rowid').all() as Person[];
}

export function insertPerson(p: Person) {
  const { n } = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS n FROM people').get() as { n: number };
  db.prepare('INSERT INTO people (id, name, position) VALUES (?, ?, ?)').run(p.id, p.name, n);
}

export function renamePerson(id: string, name: string): boolean {
  return db.prepare('UPDATE people SET name = ? WHERE id = ?').run(name, id).changes > 0;
}

interface ExpenseRow {
  id: string;
  title: string;
  date: string;
  shares: string;
  paid: string;
}

const toExpense = (r: ExpenseRow): Expense => ({ id: r.id, title: r.title, date: r.date, shares: JSON.parse(r.shares), paid: JSON.parse(r.paid) });

export function listExpenses(): Expense[] {
  return (db.prepare('SELECT * FROM expenses ORDER BY date, rowid').all() as ExpenseRow[]).map(toExpense);
}

export function getExpense(id: string): Expense | null {
  const r = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as ExpenseRow | undefined;
  return r ? toExpense(r) : null;
}

export function insertExpense(e: Expense) {
  db.prepare('INSERT INTO expenses (id, title, date, shares, paid) VALUES (?, ?, ?, ?, ?)').run(
    e.id,
    e.title,
    e.date,
    JSON.stringify(e.shares),
    JSON.stringify(e.paid),
  );
}

export function saveExpense(e: Expense) {
  db.prepare('UPDATE expenses SET title = ?, date = ?, shares = ?, paid = ? WHERE id = ?').run(
    e.title,
    e.date,
    JSON.stringify(e.shares),
    JSON.stringify(e.paid),
    e.id,
  );
}

export function deleteExpense(id: string): boolean {
  return db.prepare('DELETE FROM expenses WHERE id = ?').run(id).changes > 0;
}

/** Removes a person and their amounts from every expense. */
export const removePerson = db.transaction((id: string): boolean => {
  const removed = db.prepare('DELETE FROM people WHERE id = ?').run(id).changes > 0;
  for (const e of listExpenses()) {
    if (id in e.shares || id in e.paid) {
      delete e.shares[id];
      delete e.paid[id];
      saveExpense(e);
    }
  }
  return removed;
});

/** Replaces all people and expenses (first-time setup / import from the browser). */
export const replaceFinance = db.transaction((people: Person[], expenses: Expense[]) => {
  db.prepare('DELETE FROM expenses').run();
  db.prepare('DELETE FROM people').run();
  people.forEach((p, i) => db.prepare('INSERT INTO people (id, name, position) VALUES (?, ?, ?)').run(p.id, p.name, i));
  for (const e of expenses) insertExpense(e);
});
