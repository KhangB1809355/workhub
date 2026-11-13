import { insertGoal } from '@/server/db';
import { handler } from '@/server/route';
import { goal } from '@/server/validate';

export const POST = handler((body) => {
  const g = goal(body);
  insertGoal(g);
  return g;
});
