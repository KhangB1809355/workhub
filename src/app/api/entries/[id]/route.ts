import { deleteEntry, getEntry, saveEntry } from '@/server/db';
import { handler, notFound, type IdContext } from '@/server/route';
import { entryPatch } from '@/server/validate';

/** Body: any of { personId, content, date, amount, paid }. paidAt is set here when paid changes. */
export const PATCH = handler<IdContext>(async (body, { params }) => {
  const { id } = await params;
  const current = await getEntry(id);
  if (!current) return notFound();
  const patch = entryPatch(body);
  const next = { ...current, ...patch, id };
  // Record when it was paid; keep the first time if it is marked paid again, clear it when unpaid.
  if (patch.paid === true && !current.paid) next.paidAt = new Date().toISOString();
  else if (patch.paid === false) next.paidAt = null;
  await saveEntry(next);
  return next;
});

export const DELETE = handler<IdContext>(async (_body, { params }) => {
  const { id } = await params;
  if (!(await deleteEntry(id))) return notFound();
});
