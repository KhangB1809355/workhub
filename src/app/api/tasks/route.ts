import { insertTask } from '@/server/db';
import { handler } from '@/server/route';
import { task } from '@/server/validate';

export const POST = handler(async (body) => {
  const t = task(body);
  await insertTask(t);
  return t;
});
