import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { Entry, Person } from '@/lib/finance';
import type { Goal, Task } from '@/lib/types';
import { Conflict, type PersonPatch, type Store } from './types';

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
    CREATE TABLE IF NOT EXISTS finance_entries (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      paid INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS finance_entries_date ON finance_entries(date);
  `);
  migrateExpenses(db);
  addColumn(db, 'people', 'email', 'TEXT');
  addColumn(db, 'people', 'debt', 'REAL NOT NULL DEFAULT 0');
  addColumn(db, 'people', 'debt_note', 'TEXT');
  addColumn(db, 'finance_entries', 'paid_at', 'TEXT');
  return db;
}

/**
 * Earlier versions stored one row per expense with a { personId: amount } map.
 * Convert each amount into its own entry, then keep the old table as expenses_legacy.
 */
/** Adds a column to an existing table when an older database does not have it yet. */
function addColumn(db: Database.Database, table: string, column: string, type: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}

function migrateExpenses(db: Database.Database) {
  const old = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'expenses'").get();
  if (!old) return;
  db.transaction(() => {
    const people = new Set((db.prepare('SELECT id FROM people').all() as { id: string }[]).map((p) => p.id));
    const rows = db.prepare('SELECT * FROM expenses').all() as { id: string; title: string; date: string; shares: string; paid: string }[];
    const ins = db.prepare('INSERT OR IGNORE INTO finance_entries (id, person_id, content, date, amount, paid) VALUES (?, ?, ?, ?, ?, ?)');
    for (const r of rows) {
      const shares = JSON.parse(r.shares) as Record<string, number>;
      const paid = JSON.parse(r.paid) as Record<string, boolean>;
      for (const [pid, amount] of Object.entries(shares)) {
        if (people.has(pid) && amount > 0) ins.run(`${r.id}-${pid}`, pid, r.title, r.date, amount, paid[pid] ? 1 : 0);
      }
    }
    db.exec('ALTER TABLE expenses RENAME TO expenses_legacy');
  })();
}

// Reuse one connection across hot reloads in development.
const db = globalForDb.workhubDb ?? open();
if (process.env.NODE_ENV !== 'production') globalForDb.workhubDb = db;

// ---------- settings ----------

function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

function setSetting(key: string, value: string) {
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

function listTasks(): Task[] {
  return (db.prepare('SELECT * FROM tasks ORDER BY date, rowid').all() as TaskRow[]).map(toTask);
}

function getTask(id: string): Task | null {
  const r = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined;
  return r ? toTask(r) : null;
}

function insertTask(t: Task) {
  insertTaskStmt().run(taskParams(t));
}

function saveTask(t: Task) {
  db.prepare(
    `UPDATE tasks SET title=@title, date=@date, priority=@priority, status=@status, tag=@tag, repeat=@repeat,
       goal_id=@goal_id, subtasks=@subtasks, note=@note WHERE id=@id`,
  ).run(taskParams(t));
}

function deleteTask(id: string): boolean {
  return db.prepare('DELETE FROM tasks WHERE id = ?').run(id).changes > 0;
}

const moveTasks = db.transaction((dates: Record<string, string>) => {
  const stmt = db.prepare('UPDATE tasks SET date = ? WHERE id = ?');
  for (const [id, date] of Object.entries(dates)) stmt.run(date, id);
});

function listGoals(): Goal[] {
  return (db.prepare('SELECT id, period_key AS periodKey, title FROM goals ORDER BY rowid').all() as Goal[]);
}

function insertGoal(g: Goal) {
  db.prepare('INSERT INTO goals (id, period_key, title) VALUES (?, ?, ?)').run(g.id, g.periodKey, g.title);
}

function deleteGoal(id: string): boolean {
  return db.prepare('DELETE FROM goals WHERE id = ?').run(id).changes > 0; // tasks.goal_id is cleared by ON DELETE SET NULL
}

/** Replaces all tasks and goals (used by "load sample", "clear all" and the one-time import from the browser). */
const replaceWork = db.transaction((tasks: Task[], goals: Goal[]) => {
  db.prepare('DELETE FROM tasks').run();
  db.prepare('DELETE FROM goals').run();
  for (const g of goals) insertGoal(g);
  const stmt = insertTaskStmt();
  for (const t of tasks) stmt.run(taskParams(t));
});

// ---------- finance ----------

interface EntryRow {
  id: string;
  person_id: string;
  content: string;
  date: string;
  amount: number;
  paid: number;
  paid_at: string | null;
}

const toEntry = (r: EntryRow): Entry => ({
  id: r.id,
  personId: r.person_id,
  content: r.content,
  date: r.date,
  amount: r.amount,
  paid: !!r.paid,
  paidAt: r.paid ? (r.paid_at ?? null) : null,
});

const PERSON_COLS = 'id, name, email, debt, debt_note AS debtNote';

function listPeople(): Person[] {
  return db.prepare(`SELECT ${PERSON_COLS} FROM people ORDER BY position, rowid`).all() as Person[];
}

function getPerson(id: string): Person | null {
  return (db.prepare(`SELECT ${PERSON_COLS} FROM people WHERE id = ?`).get(id) as Person | undefined) ?? null;
}

function insertPerson(p: Person) {
  const { n } = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS n FROM people').get() as { n: number };
  db.prepare('INSERT INTO people (id, name, email, debt, debt_note, position) VALUES (?, ?, ?, ?, ?, ?)').run(p.id, p.name, p.email ?? null, p.debt ?? 0, p.debtNote ?? null, n);
}

/** Updates any of name, email, opening debt and its note. */
function updatePerson(id: string, patch: PersonPatch): boolean {
  const cur = getPerson(id);
  if (!cur) return false;
  const pick = <K extends keyof PersonPatch>(k: K, fallback: PersonPatch[K]) => (patch[k] !== undefined ? patch[k] : fallback);
  db.prepare('UPDATE people SET name = ?, email = ?, debt = ?, debt_note = ? WHERE id = ?').run(
    pick('name', cur.name),
    pick('email', cur.email ?? null),
    pick('debt', cur.debt ?? 0),
    pick('debtNote', cur.debtNote ?? null),
    id,
  );
  return true;
}

/** Removes a person; their entries are deleted by ON DELETE CASCADE. */
function removePerson(id: string): boolean {
  return db.prepare('DELETE FROM people WHERE id = ?').run(id).changes > 0;
}

function listEntries(): Entry[] {
  return (db.prepare('SELECT * FROM finance_entries ORDER BY date, rowid').all() as EntryRow[]).map(toEntry);
}

function getEntry(id: string): Entry | null {
  const r = db.prepare('SELECT * FROM finance_entries WHERE id = ?').get(id) as EntryRow | undefined;
  return r ? toEntry(r) : null;
}

const entryParams = (e: Entry) => ({ id: e.id, person_id: e.personId, content: e.content, date: e.date, amount: e.amount, paid: e.paid ? 1 : 0, paid_at: e.paid ? (e.paidAt ?? null) : null });

const insertEntries = db.transaction((entries: Entry[]) => {
  const stmt = db.prepare(
    'INSERT INTO finance_entries (id, person_id, content, date, amount, paid, paid_at) VALUES (@id, @person_id, @content, @date, @amount, @paid, @paid_at)',
  );
  for (const e of entries) stmt.run(entryParams(e));
});

function saveEntry(e: Entry) {
  db.prepare(
    'UPDATE finance_entries SET person_id = @person_id, content = @content, date = @date, amount = @amount, paid = @paid, paid_at = @paid_at WHERE id = @id',
  ).run(entryParams(e));
}

/** Deletes several entries at once (e.g. a whole week). Returns how many were removed. */
const deleteEntries = db.transaction((ids: string[]): number => {
  const stmt = db.prepare('DELETE FROM finance_entries WHERE id = ?');
  let n = 0;
  for (const id of ids) n += stmt.run(id).changes;
  return n;
});

const setEntriesPaid = db.transaction((ids: string[], paid: boolean, at: string): number => {
  const stmt = paid
    ? db.prepare('UPDATE finance_entries SET paid = 1, paid_at = ? WHERE id = ? AND paid = 0')
    : db.prepare('UPDATE finance_entries SET paid = 0, paid_at = NULL WHERE id = ? AND paid = 1');
  let n = 0;
  for (const id of new Set(ids)) n += (paid ? stmt.run(at, id) : stmt.run(id)).changes;
  return n;
});

function deleteEntry(id: string): boolean {
  return db.prepare('DELETE FROM finance_entries WHERE id = ?').run(id).changes > 0;
}

/** Replaces all people and entries (first-time setup / import from the browser). */
const replaceFinance = db.transaction((people: Person[], entries: Entry[]) => {
  db.prepare('DELETE FROM finance_entries').run();
  db.prepare('DELETE FROM people').run();
  const stmt = db.prepare('INSERT INTO people (id, name, email, debt, debt_note, position) VALUES (?, ?, ?, ?, ?, ?)');
  people.forEach((p, i) => stmt.run(p.id, p.name, p.email ?? null, p.debt ?? 0, p.debtNote ?? null, i));
  insertEntries(entries);
});

function deleteSetting(key: string) {
  db.prepare('DELETE FROM settings WHERE key = ?').run(key);
}

/** Runs a synchronous SQLite call, turning constraint errors into Conflict. */
function wrap<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => Promise<R> {
  return async (...args: A) => {
    try {
      return fn(...args);
    } catch (e) {
      if (String((e as { code?: string }).code ?? '').startsWith('SQLITE_CONSTRAINT')) throw new Conflict('Dữ liệu bị trùng hoặc tham chiếu không tồn tại');
      throw e;
    }
  };
}

/** Local single-file database (data/workhub.db or DATABASE_PATH). */
export function createSqliteStore(): Store {
  return {
    driver: 'sqlite',
    getSetting: wrap(getSetting),
    setSetting: wrap(setSetting),
    deleteSetting: wrap(deleteSetting),
    listTasks: wrap(listTasks),
    getTask: wrap(getTask),
    insertTask: wrap(insertTask),
    saveTask: wrap(saveTask),
    deleteTask: wrap(deleteTask),
    moveTasks: wrap((dates: Record<string, string>) => moveTasks(dates)),
    listGoals: wrap(listGoals),
    insertGoal: wrap(insertGoal),
    deleteGoal: wrap(deleteGoal),
    replaceWork: wrap((tasks: Task[], goals: Goal[]) => replaceWork(tasks, goals)),
    listPeople: wrap(listPeople),
    getPerson: wrap(getPerson),
    insertPerson: wrap(insertPerson),
    updatePerson: wrap(updatePerson),
    removePerson: wrap(removePerson),
    listEntries: wrap(listEntries),
    getEntry: wrap(getEntry),
    insertEntries: wrap((entries: Entry[]) => insertEntries(entries)),
    saveEntry: wrap(saveEntry),
    deleteEntry: wrap(deleteEntry),
    deleteEntries: wrap((ids: string[]) => deleteEntries(ids)),
    setEntriesPaid: wrap((ids: string[], paid: boolean, at: string) => setEntriesPaid(ids, paid, at)),
    replaceFinance: wrap((people: Person[], entries: Entry[]) => replaceFinance(people, entries)),
  };
}
