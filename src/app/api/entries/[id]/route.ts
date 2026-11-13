import { deleteEntry, getEntry, saveEntry } from '@/server/db';
import { handler, notFound, type IdContext } from '@/server/route';
import { entryPatch } from '@/server/validate';

/** Body: any of { personId, content, date, amount, paid }. */
export const PATCH = handler<IdContext>(async (body, { params }) => {
  const { id } = await params;
  const current = await getEntry(id);
  if (!current) return notFound();
  const next = { ...current, ...entryPatch(body), id };
  await saveEntry(next);
  return next;
});

export const DELETE = handler<IdContext>(async (_body, { params }) => {
  const { id } = await params;
  if (!(await deleteEntry(id))) return notFound();
});
