import { getDriveUrl, getSetting, listEntries, listPeople, replaceFinance, setSetting } from '@/server/db';
import { handler } from '@/server/route';
import { financeSnapshot } from '@/server/validate';

export const GET = handler(async () => {
  const [people, entries, driveUrl, initialized] = await Promise.all([listPeople(), listEntries(), getDriveUrl(), getSetting('finance_initialized')]);
  return { people, entries, driveUrl, initialized: initialized === '1' };
});

/** Replaces all people and entries. */
export const PUT = handler(async (body) => {
  const { people, entries } = financeSnapshot(body);
  await replaceFinance(people, entries);
  await setSetting('finance_initialized', '1');
});
