// Copies everything from the SQLite file (data/workhub.db) into Firestore.
// Usage: npm run db:to-firestore            (refuses if Firestore already has data)
//        npm run db:to-firestore -- --force (overwrites the Firestore data)
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { COLLECTIONS, openFirestore, sqlitePath } from './firebase.mjs';

const force = process.argv.includes('--force');
const file = sqlitePath();
if (!fs.existsSync(file)) {
  console.error(`Không tìm thấy ${file}`);
  process.exit(1);
}
const sql = new Database(file, { readonly: true });
const { db, projectId } = openFirestore();

const has = (t) => !!sql.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(t);
const rows = (q) => sql.prepare(q).all();

let existing = 0;
for (const c of COLLECTIONS) existing += (await db.collection(c).limit(1).get()).size;
if (existing && !force) {
  console.error(`Firestore (${projectId}) đã có dữ liệu. Dừng lại để không ghi đè. Chạy lại với --force nếu chắc chắn.`);
  process.exit(1);
}

const writes = [];
const put = (col, id, data) => writes.push([col, id, data]);
const base = Date.now() * 1000;

if (has('settings')) for (const r of rows('SELECT key, value FROM settings')) put('settings', r.key, { value: r.value });
if (has('goals')) rows('SELECT * FROM goals ORDER BY rowid').forEach((r, i) => put('goals', r.id, { periodKey: r.period_key, title: r.title, seq: base + i }));
if (has('tasks'))
  rows('SELECT * FROM tasks ORDER BY date, rowid').forEach((r, i) =>
    put('tasks', r.id, {
      title: r.title, date: r.date, priority: r.priority, status: r.status, tag: r.tag, repeat: r.repeat,
      goalId: r.goal_id ?? null, subtasks: JSON.parse(r.subtasks || '[]'), note: r.note ?? '', seq: base + i,
    }),
  );
if (has('people')) {
  const cols = rows('PRAGMA table_info(people)').map((c) => c.name);
  rows('SELECT * FROM people ORDER BY position, rowid').forEach((r, i) => put('people', r.id, {
    name: r.name,
    email: cols.includes('email') ? (r.email ?? null) : null,
    debt: cols.includes('debt') ? (r.debt ?? 0) : 0,
    debtNote: cols.includes('debt_note') ? (r.debt_note ?? null) : null,
    position: i,
  }));
}
if (has('finance_entries'))
  rows('SELECT * FROM finance_entries ORDER BY date, rowid').forEach((r, i) =>
    put('finance_entries', r.id, { personId: r.person_id, content: r.content, date: r.date, amount: r.amount, paid: !!r.paid, paidAt: r.paid ? (r.paid_at ?? null) : null, seq: base + i }),
  );

if (force) {
  for (const c of COLLECTIONS) {
    const refs = (await db.collection(c).select().get()).docs.map((d) => d.ref);
    for (let i = 0; i < refs.length; i += 450) {
      const b = db.batch();
      refs.slice(i, i + 450).forEach((r) => b.delete(r));
      await b.commit();
    }
  }
}
for (let i = 0; i < writes.length; i += 450) {
  const b = db.batch();
  for (const [c, id, data] of writes.slice(i, i + 450)) b.set(db.collection(c).doc(id), data);
  await b.commit();
}
const count = (c) => writes.filter((w) => w[0] === c).length;
console.log(`Đã chuyển từ ${file} sang Firestore (${projectId}):`);
for (const c of COLLECTIONS) console.log(`  ${c.padEnd(16)} ${count(c)}`);

// firebase-admin keeps a gRPC connection open; exit explicitly when done.
process.exit(0);
