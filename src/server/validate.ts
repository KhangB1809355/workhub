import 'server-only';
import type { Expense, Person } from '@/lib/finance';
import type { Goal, Priority, Repeat, Status, Subtask, Tag, Task } from '@/lib/types';

/** Thrown for bad request bodies; route handlers turn it into a 400 response. */
export class BadRequest extends Error {}

const STATUSES: Status[] = ['todo', 'doing', 'done'];
const PRIORITIES: Priority[] = ['Cao', 'Trung bình', 'Thấp'];
const REPEATS: Repeat[] = ['none', 'daily', 'weekly', 'monthly'];
const TAGS: Tag[] = ['Công việc', 'Học tập', 'Cá nhân', 'Sức khỏe'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

type Obj = Record<string, unknown>;

export function obj(v: unknown, what = 'body'): Obj {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new BadRequest(`${what} phải là object`);
  return v as Obj;
}

function str(v: unknown, field: string, max = 500): string {
  if (typeof v !== 'string') throw new BadRequest(`${field} phải là chuỗi`);
  if (v.length > max) throw new BadRequest(`${field} quá dài`);
  return v;
}

function text(v: unknown, field: string, max = 500): string {
  const s = str(v, field, max).trim();
  if (!s) throw new BadRequest(`${field} không được để trống`);
  return s;
}

function id(v: unknown, field = 'id'): string {
  const s = str(v, field, 100);
  if (!/^[\w-]+$/.test(s)) throw new BadRequest(`${field} không hợp lệ`);
  return s;
}

function date(v: unknown, field = 'date'): string {
  const s = str(v, field, 10);
  if (!DATE.test(s)) throw new BadRequest(`${field} phải có dạng YYYY-MM-DD`);
  return s;
}

function oneOf<T extends string>(v: unknown, list: T[], field: string): T {
  if (!list.includes(v as T)) throw new BadRequest(`${field} không hợp lệ`);
  return v as T;
}

function arr(v: unknown, field: string): unknown[] {
  if (!Array.isArray(v)) throw new BadRequest(`${field} phải là mảng`);
  return v;
}

function subtasks(v: unknown): Subtask[] {
  return arr(v, 'subtasks').map((s) => {
    const o = obj(s, 'subtask');
    if (typeof o.done !== 'boolean') throw new BadRequest('subtask.done phải là true/false');
    return { id: id(o.id), text: text(o.text, 'subtask.text'), done: o.done };
  });
}

/** Validates the editable fields of a task; every field is optional so it also works for PATCH. */
export function taskPatch(v: unknown): Partial<Omit<Task, 'id'>> {
  const o = obj(v);
  const out: Partial<Omit<Task, 'id'>> = {};
  if ('title' in o) out.title = text(o.title, 'title');
  if ('date' in o) out.date = date(o.date);
  if ('priority' in o) out.priority = oneOf(o.priority, PRIORITIES, 'priority');
  if ('status' in o) out.status = oneOf(o.status, STATUSES, 'status');
  if ('tag' in o) out.tag = oneOf(o.tag, TAGS, 'tag');
  if ('repeat' in o) out.repeat = oneOf(o.repeat, REPEATS, 'repeat');
  if ('goalId' in o) out.goalId = o.goalId === null ? null : id(o.goalId, 'goalId');
  if ('subtasks' in o) out.subtasks = subtasks(o.subtasks);
  if ('note' in o) out.note = str(o.note, 'note', 5000);
  return out;
}

export function task(v: unknown): Task {
  const o = obj(v);
  const p = taskPatch(o);
  for (const k of ['title', 'date', 'priority', 'status', 'tag', 'repeat'] as const) {
    if (p[k] === undefined) throw new BadRequest(`Thiếu ${k}`);
  }
  return { id: id(o.id), goalId: null, subtasks: [], note: '', ...p } as Task;
}

export function goal(v: unknown): Goal {
  const o = obj(v);
  return { id: id(o.id), periodKey: text(o.periodKey, 'periodKey', 40), title: text(o.title, 'title') };
}

/** tasks + goals for a full replace; drops goal links that point at goals not in the list. */
export function workSnapshot(v: unknown): { tasks: Task[]; goals: Goal[] } {
  const o = obj(v);
  const goals = arr(o.goals, 'goals').map(goal);
  const known = new Set(goals.map((g) => g.id));
  const tasks = arr(o.tasks, 'tasks').map(task).map((t) => (t.goalId && !known.has(t.goalId) ? { ...t, goalId: null } : t));
  return { tasks, goals };
}

export function moveRequest(v: unknown): { dates: Record<string, string> } {
  const o = obj(v);
  const dates: Record<string, string> = {};
  for (const [k, d] of Object.entries(obj(o.dates, 'dates'))) dates[id(k)] = date(d);
  return { dates };
}

export function person(v: unknown): Person {
  const o = obj(v);
  return { id: id(o.id), name: text(o.name, 'name', 80) };
}

export function personName(v: unknown): string {
  return text(obj(v).name, 'name', 80);
}

function amounts(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(obj(v, 'shares'))) {
    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0 || n > 1e9) throw new BadRequest('Số tiền không hợp lệ');
    out[id(k, 'personId')] = n;
  }
  return out;
}

function flags(v: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [k, b] of Object.entries(obj(v, 'paid'))) {
    if (typeof b !== 'boolean') throw new BadRequest('paid phải là true/false');
    out[id(k, 'personId')] = b;
  }
  return out;
}

export function expensePatch(v: unknown): Partial<Omit<Expense, 'id'>> {
  const o = obj(v);
  const out: Partial<Omit<Expense, 'id'>> = {};
  if ('title' in o) out.title = text(o.title, 'title');
  if ('date' in o) out.date = date(o.date);
  if ('shares' in o) out.shares = amounts(o.shares);
  if ('paid' in o) out.paid = flags(o.paid);
  return out;
}

export function expense(v: unknown): Expense {
  const o = obj(v);
  const p = expensePatch(o);
  if (p.title === undefined || p.date === undefined) throw new BadRequest('Thiếu title hoặc date');
  return { id: id(o.id), shares: {}, paid: {}, ...p } as Expense;
}

export function financeSnapshot(v: unknown): { people: Person[]; expenses: Expense[] } {
  const o = obj(v);
  return { people: arr(o.people, 'people').map(person), expenses: arr(o.expenses, 'expenses').map(expense) };
}
