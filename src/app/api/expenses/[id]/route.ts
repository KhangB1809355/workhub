import { deleteExpense, getExpense, saveExpense } from '@/server/db';
import { handler, notFound, type IdContext } from '@/server/route';
import { expensePatch } from '@/server/validate';

/** Body: any of { title, date, shares, paid }. shares/paid replace the whole map. */
export const PATCH = handler<IdContext>(async (body, { params }) => {
  const { id } = await params;
  const current = getExpense(id);
  if (!current) return notFound();
  const next = { ...current, ...expensePatch(body), id };
  saveExpense(next);
  return next;
});

export const DELETE = handler<IdContext>(async (_body, { params }) => {
  const { id } = await params;
  if (!deleteExpense(id)) return notFound();
});
