// Exports every collection/table to backups/workhub-YYYY-MM-DD-HHMM.json (works for Firestore and SQLite).
// Usage: npm run db:export
import fs from 'node:fs';
import path from 'node:path';
import { COLLECTIONS, openFirestore, sqlitePath } from './firebase.mjs';

const useFirestore = process.env.DB_DRIVER === 'firestore' || (process.env.DB_DRIVER !== 'sqlite' && (process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_PROJECT_ID));
const out = { exportedAt: new Date().toISOString(), source: useFirestore ? 'firestore' : 'sqlite', data: {} };

if (useFirestore) {
  const { db, projectId } = openFirestore();
  out.project = projectId;
  for (const c of COLLECTIONS) out.data[c] = (await db.collection(c).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
} else {
  const { default: Database } = await import('better-sqlite3');
  const sql = new Database(sqlitePath(), { readonly: true });
  for (const c of COLLECTIONS) {
    const exists = sql.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(c);
    out.data[c] = exists ? sql.prepare(`SELECT * FROM ${c}`).all() : [];
  }
}

const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
fs.mkdirSync('backups', { recursive: true });
const file = path.join('backups', `workhub-${stamp}.json`);
fs.writeFileSync(file, JSON.stringify(out, null, 2));
console.log(`Đã xuất (${out.source}) → ${file}`);
for (const c of COLLECTIONS) console.log(`  ${c.padEnd(16)} ${out.data[c].length}`);

// firebase-admin keeps a gRPC connection open; exit explicitly when done.
process.exit(0);
