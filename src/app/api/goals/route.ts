import { insertGoal } from '@/server/db';
import { handler } from '@/server/route';
import { goal } from '@/server/validate';

export const POST = handler(async (body) => {
  const g = goal(body);
  await insertGoal(g);
  return g;
});
