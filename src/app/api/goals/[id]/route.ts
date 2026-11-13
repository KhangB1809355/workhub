import { deleteGoal } from '@/server/db';
import { handler, notFound, type IdContext } from '@/server/route';

/** Tasks linked to the goal keep existing; their goalId becomes null. */
export const DELETE = handler<IdContext>(async (_body, { params }) => {
  const { id } = await params;
  if (!(await deleteGoal(id))) return notFound();
});
