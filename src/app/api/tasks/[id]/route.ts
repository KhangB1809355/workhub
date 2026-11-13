import { deleteTask, getTask, saveTask } from '@/server/db';
import { handler, notFound, type IdContext } from '@/server/route';
import { taskPatch } from '@/server/validate';

export const PATCH = handler<IdContext>(async (body, { params }) => {
  const { id } = await params;
  const current = await getTask(id);
  if (!current) return notFound();
  const next = { ...current, ...taskPatch(body), id };
  await saveTask(next);
  return next;
});

export const DELETE = handler<IdContext>(async (_body, { params }) => {
  const { id } = await params;
  if (!(await deleteTask(id))) return notFound();
});
