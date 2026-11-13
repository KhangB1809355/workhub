import { insertPerson } from '@/server/db';
import { handler } from '@/server/route';
import { person } from '@/server/validate';

export const POST = handler((body) => {
  const p = person(body);
  insertPerson(p);
  return p;
});
