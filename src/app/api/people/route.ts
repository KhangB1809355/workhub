import { insertPerson } from '@/server/db';
import { handler } from '@/server/route';
import { person } from '@/server/validate';

export const POST = handler(async (body) => {
  const p = person(body);
  await insertPerson(p);
  return p;
});
