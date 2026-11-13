import { insertEntries } from '@/server/db';
import { handler } from '@/server/route';
import { entryList } from '@/server/validate';

/** Body: { entries: Entry[] } — several rows at once, e.g. the same content for several people. */
export const POST = handler(async (body) => {
  const entries = entryList(body);
  await insertEntries(entries);
  return { entries };
});
