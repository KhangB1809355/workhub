import { setEntriesPaid } from '@/server/db';
import { handler } from '@/server/route';
import { paidList } from '@/server/validate';

/**
 * Body: { ids: string[], paid: boolean } — mark several entries paid or unpaid in one all-or-nothing write.
 * paidAt is stamped with the server time for entries that become paid. Login required.
 */
export const POST = handler(async (body) => {
  const { ids, paid } = paidList(body);
  return { changed: await setEntriesPaid(ids, paid, new Date().toISOString()) };
});
