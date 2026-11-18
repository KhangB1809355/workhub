const { createSqliteStore } = await import('./src/server/store/sqlite.ts');
const s = createSqliteStore();
await s.insertPerson({ id: 'p1', name: 'A', email: null });
await s.insertEntries([1,2,3].map((i) => ({ id: 'e'+i, personId: 'p1', content: 'x', date: '2026-11-1'+i, amount: 10, paid: false, paidAt: null })));
console.log('mark 2 paid ->', await s.setEntriesPaid(['e1','e2','nope'], true, '2026-11-15T01:00:00.000Z'));
console.log('again (keeps time) ->', await s.setEntriesPaid(['e1','e3'], true, '2026-11-15T09:00:00.000Z'));
console.log((await s.listEntries()).map((e) => `${e.id}:${e.paid}:${e.paidAt}`).join('  '));
console.log('unpay e1 ->', await s.setEntriesPaid(['e1'], false, 'x'));
console.log((await s.listEntries()).map((e) => `${e.id}:${e.paid}:${e.paidAt}`).join('  '));
