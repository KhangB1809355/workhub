import 'server-only';
import fs from 'node:fs';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type DocumentReference, type Firestore, type WriteBatch } from 'firebase-admin/firestore';
import type { Entry, Person } from '@/lib/finance';
import type { Goal, Task } from '@/lib/types';
import { Conflict, type PersonPatch, type Store } from './types';

/*
 * Collections (one document per row, document id = our id):
 *   settings/{key}            { value }
 *   tasks/{id}                Task fields + seq
 *   goals/{id}                { periodKey, title, seq }
 *   people/{id}               { name, email, debt, debtNote, position }
 *   finance_entries/{id}      { personId, content, date, amount, paid, paidAt, seq }
 *
 * `seq` keeps insertion order for rows on the same date. Lists are sorted in memory,
 * so no composite indexes have to be created in the Firebase console.
 */

const APP_NAME = 'workhub';
const BATCH_LIMIT = 450; // Firestore allows 500 writes per batch

interface Credentials {
  projectId: string;
  clientEmail?: string;
  privateKey?: string;
}

/** Reads the service account from FIREBASE_SERVICE_ACCOUNT (path to the JSON key) or the 3 separate variables. */
function credentials(): Credentials {
  const file = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (file) {
    const json = JSON.parse(fs.readFileSync(file, 'utf8')) as { project_id: string; client_email: string; private_key: string };
    return { projectId: json.project_id, clientEmail: json.client_email, privateKey: json.private_key };
  }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('Thiếu FIREBASE_SERVICE_ACCOUNT hoặc FIREBASE_PROJECT_ID trong .env.local');
  return {
    projectId,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // Keys pasted into .env usually have literal "\n"
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };
}

const globalForFs = globalThis as unknown as { workhubFirestore?: Firestore };

function open(): Firestore {
  if (globalForFs.workhubFirestore) return globalForFs.workhubFirestore;
  const c = credentials();
  const emulator = !!process.env.FIRESTORE_EMULATOR_HOST;
  if (!emulator && (!c.clientEmail || !c.privateKey)) throw new Error('Thiếu khóa service account Firebase (client_email / private_key)');
  const app: App =
    getApps().find((a) => a.name === APP_NAME) ??
    initializeApp(
      emulator ? { projectId: c.projectId } : { projectId: c.projectId, credential: cert({ projectId: c.projectId, clientEmail: c.clientEmail, privateKey: c.privateKey }) },
      APP_NAME,
    );
  const db = getFirestore(app);
  db.settings({ ignoreUndefinedProperties: true });
  globalForFs.workhubFirestore = db;
  return db;
}

let seqCounter = 0;
/** Monotonic number used to keep insertion order. */
const nextSeq = () => Date.now() * 1000 + (seqCounter++ % 1000);

const byDateThenSeq = (a: { date: string; seq: number }, b: { date: string; seq: number }) =>
  a.date === b.date ? a.seq - b.seq : a.date < b.date ? -1 : 1;

/** gRPC ALREADY_EXISTS */
const isAlreadyExists = (e: unknown) => (e as { code?: number }).code === 6;

/** Commits writes in chunks of BATCH_LIMIT. */
async function inBatches<T>(db: Firestore, items: T[], add: (batch: WriteBatch, item: T) => void) {
  for (let i = 0; i < items.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const item of items.slice(i, i + BATCH_LIMIT)) add(batch, item);
    await batch.commit();
  }
}

async function deleteAll(db: Firestore, collection: string) {
  const refs = (await db.collection(collection).select().get()).docs.map((d) => d.ref);
  await inBatches(db, refs, (b, ref) => b.delete(ref));
}

// ----- converters -----

type Stored<T> = Omit<T, 'id'> & { seq: number };

const taskData = (t: Task, seq: number): Stored<Task> => ({
  title: t.title,
  date: t.date,
  priority: t.priority,
  status: t.status,
  tag: t.tag,
  repeat: t.repeat,
  goalId: t.goalId ?? null,
  subtasks: t.subtasks,
  note: t.note,
  seq,
});
const toTask = (id: string, d: Stored<Task>): Task => ({
  id,
  title: d.title,
  date: d.date,
  priority: d.priority,
  status: d.status,
  tag: d.tag,
  repeat: d.repeat,
  goalId: d.goalId ?? null,
  subtasks: d.subtasks ?? [],
  note: d.note ?? '',
});

const entryData = (e: Entry, seq: number): Stored<Entry> => ({
  personId: e.personId,
  content: e.content,
  date: e.date,
  amount: e.amount,
  paid: !!e.paid,
  paidAt: e.paid ? (e.paidAt ?? null) : null,
  seq,
});
const toEntry = (id: string, d: Stored<Entry>): Entry => ({
  id,
  personId: d.personId,
  content: d.content,
  date: d.date,
  amount: d.amount,
  paid: !!d.paid,
  paidAt: d.paid ? (d.paidAt ?? null) : null,
});

type PersonDoc = { name: string; email: string | null; debt?: number; debtNote?: string | null; position: number };
const toPerson = (id: string, d: PersonDoc): Person => ({ id, name: d.name, email: d.email ?? null, debt: d.debt ?? 0, debtNote: d.debtNote ?? null });
const personData = (p: Person, position: number): PersonDoc => ({ name: p.name, email: p.email ?? null, debt: p.debt ?? 0, debtNote: p.debtNote ?? null, position });

export function createFirestoreStore(): Store {
  const db = open();
  const col = {
    settings: db.collection('settings'),
    tasks: db.collection('tasks'),
    goals: db.collection('goals'),
    people: db.collection('people'),
    entries: db.collection('finance_entries'),
  };

  async function exists(ref: DocumentReference) {
    return (await ref.get()).exists;
  }
  async function assertGoal(goalId: string | null) {
    if (goalId && !(await exists(col.goals.doc(goalId)))) throw new Conflict('Mục tiêu không tồn tại');
  }
  async function assertPeople(ids: string[]) {
    const unique = [...new Set(ids)];
    if (!unique.length) return;
    const snaps = await db.getAll(...unique.map((id) => col.people.doc(id)));
    if (snaps.some((s) => !s.exists)) throw new Conflict('Người không tồn tại');
  }
  async function create(ref: DocumentReference, data: object) {
    try {
      await ref.create(data);
    } catch (e) {
      if (isAlreadyExists(e)) throw new Conflict('Dữ liệu bị trùng');
      throw e;
    }
  }

  return {
    driver: 'firestore',

    // ----- settings -----
    async getSetting(key) {
      const s = await col.settings.doc(key).get();
      return s.exists ? ((s.data() as { value: string }).value ?? null) : null;
    },
    async setSetting(key, value) {
      await col.settings.doc(key).set({ value });
    },
    async deleteSetting(key) {
      await col.settings.doc(key).delete();
    },

    // ----- tasks & goals -----
    async listTasks() {
      const snap = await col.tasks.get();
      return snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Stored<Task>) }))
        .sort(byDateThenSeq)
        .map((d) => toTask(d.id, d));
    },
    async getTask(id) {
      const s = await col.tasks.doc(id).get();
      return s.exists ? toTask(s.id, s.data() as Stored<Task>) : null;
    },
    async insertTask(t) {
      await assertGoal(t.goalId);
      await create(col.tasks.doc(t.id), taskData(t, nextSeq()));
    },
    async saveTask(t) {
      await assertGoal(t.goalId);
      const ref = col.tasks.doc(t.id);
      const cur = await ref.get();
      if (!cur.exists) return;
      await ref.set(taskData(t, (cur.data() as Stored<Task>).seq ?? nextSeq()));
    },
    async deleteTask(id) {
      const ref = col.tasks.doc(id);
      if (!(await exists(ref))) return false;
      await ref.delete();
      return true;
    },
    async moveTasks(dates) {
      const ids = Object.keys(dates);
      if (!ids.length) return;
      const snaps = await db.getAll(...ids.map((id) => col.tasks.doc(id)));
      await inBatches(
        db,
        snaps.filter((s) => s.exists),
        (b, s) => b.update(s.ref, { date: dates[s.id] }),
      );
    },
    async listGoals() {
      const snap = await col.goals.get();
      return snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Stored<Goal>) }))
        .sort((a, b) => a.seq - b.seq)
        .map((d) => ({ id: d.id, periodKey: d.periodKey, title: d.title }));
    },
    async insertGoal(g) {
      await create(col.goals.doc(g.id), { periodKey: g.periodKey, title: g.title, seq: nextSeq() });
    },
    async deleteGoal(id) {
      const ref = col.goals.doc(id);
      if (!(await exists(ref))) return false;
      const linked = await col.tasks.where('goalId', '==', id).select().get();
      await inBatches(db, linked.docs, (b, d) => b.update(d.ref, { goalId: null }));
      await ref.delete();
      return true;
    },
    async replaceWork(tasks, goals) {
      await deleteAll(db, 'tasks');
      await deleteAll(db, 'goals');
      const base = nextSeq();
      await inBatches(db, goals.map((g, i) => [g, i] as const), (b, [g, i]) => b.set(col.goals.doc(g.id), { periodKey: g.periodKey, title: g.title, seq: base + i }));
      await inBatches(db, tasks.map((t, i) => [t, i] as const), (b, [t, i]) => b.set(col.tasks.doc(t.id), taskData(t, base + i)));
    },

    // ----- people -----
    async listPeople() {
      const snap = await col.people.get();
      return snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as PersonDoc) }))
        .sort((a, b) => a.position - b.position)
        .map((d) => toPerson(d.id, d));
    },
    async getPerson(id) {
      const s = await col.people.doc(id).get();
      return s.exists ? toPerson(s.id, s.data() as PersonDoc) : null;
    },
    async insertPerson(p) {
      const last = await col.people.orderBy('position', 'desc').limit(1).get();
      const position = last.empty ? 0 : (last.docs[0].data() as PersonDoc).position + 1;
      await create(col.people.doc(p.id), personData(p, position));
    },
    async updatePerson(id: string, patch: PersonPatch) {
      const ref = col.people.doc(id);
      if (!(await exists(ref))) return false;
      const data: Partial<PersonDoc> = {};
      if (patch.name !== undefined) data.name = patch.name;
      if (patch.email !== undefined) data.email = patch.email;
      if (patch.debt !== undefined) data.debt = patch.debt;
      if (patch.debtNote !== undefined) data.debtNote = patch.debtNote;
      if (Object.keys(data).length) await ref.update(data);
      return true;
    },
    async removePerson(id) {
      const ref = col.people.doc(id);
      if (!(await exists(ref))) return false;
      const own = await col.entries.where('personId', '==', id).select().get();
      await inBatches(db, own.docs, (b, d) => b.delete(d.ref));
      await ref.delete();
      return true;
    },

    // ----- finance entries -----
    async listEntries() {
      const snap = await col.entries.get();
      return snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Stored<Entry>) }))
        .sort(byDateThenSeq)
        .map((d) => toEntry(d.id, d));
    },
    async getEntry(id) {
      const s = await col.entries.doc(id).get();
      return s.exists ? toEntry(s.id, s.data() as Stored<Entry>) : null;
    },
    async insertEntries(entries) {
      await assertPeople(entries.map((e) => e.personId));
      const base = nextSeq();
      try {
        // One batch (≤ 500 entries, enforced by validation) so it is all-or-nothing like the SQLite version.
        const batch = db.batch();
        entries.forEach((e, i) => batch.create(col.entries.doc(e.id), entryData(e, base + i)));
        await batch.commit();
      } catch (e) {
        if (isAlreadyExists(e)) throw new Conflict('Dữ liệu bị trùng');
        throw e;
      }
    },
    async saveEntry(e) {
      await assertPeople([e.personId]);
      const ref = col.entries.doc(e.id);
      const cur = await ref.get();
      if (!cur.exists) return;
      await ref.set(entryData(e, (cur.data() as Stored<Entry>).seq ?? nextSeq()));
    },
    async deleteEntry(id) {
      const ref = col.entries.doc(id);
      if (!(await exists(ref))) return false;
      await ref.delete();
      return true;
    },
    async deleteEntries(ids) {
      const unique = [...new Set(ids)];
      if (!unique.length) return 0;
      const snaps = await db.getAll(...unique.map((id) => col.entries.doc(id)));
      const found = snaps.filter((s) => s.exists);
      await inBatches(db, found, (b, s) => b.delete(s.ref));
      return found.length;
    },
    async setEntriesPaid(ids, paid, at) {
      const unique = [...new Set(ids)];
      if (!unique.length) return 0;
      const snaps = await db.getAll(...unique.map((id) => col.entries.doc(id)));
      const change = snaps.filter((s) => s.exists && !!(s.data() as Stored<Entry>).paid !== paid);
      if (!change.length) return 0;
      // ids are capped at BATCH_LIMIT by the route, so this is a single atomic batch.
      const batch = db.batch();
      for (const s of change) batch.update(s.ref, { paid, paidAt: paid ? at : null });
      await batch.commit();
      return change.length;
    },
    async replaceFinance(people, entries) {
      const known = new Set(people.map((p) => p.id));
      if (entries.some((e) => !known.has(e.personId))) throw new Conflict('Người không tồn tại');
      await deleteAll(db, 'finance_entries');
      await deleteAll(db, 'people');
      await inBatches(db, people.map((p, i) => [p, i] as const), (b, [p, i]) => b.set(col.people.doc(p.id), personData(p, i)));
      const base = nextSeq();
      await inBatches(db, entries.map((e, i) => [e, i] as const), (b, [e, i]) => b.set(col.entries.doc(e.id), entryData(e, base + i)));
    },
  };
}
