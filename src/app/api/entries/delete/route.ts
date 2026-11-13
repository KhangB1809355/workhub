import { deleteEntries } from '@/server/db';
import { handler } from '@/server/route';
import { idList } from '@/server/validate';

/** Body: { ids: string[] } — delete several entries at once (e.g. a whole week). Login required. */
export const POST = handler(async (body) => ({ deleted: await deleteEntries(idList(body)) }));
