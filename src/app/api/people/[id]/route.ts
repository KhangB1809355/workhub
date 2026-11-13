import { removePerson, renamePerson } from '@/server/db';
import { handler, notFound, type IdContext } from '@/server/route';
import { personName } from '@/server/validate';

/** Body: { name } */
export const PATCH = handler<IdContext>(async (body, { params }) => {
  const { id } = await params;
  const name = personName(body);
  if (!renamePerson(id, name)) return notFound();
  return { id, name };
});

/** Also removes the person's amounts from every expense. */
export const DELETE = handler<IdContext>(async (_body, { params }) => {
  const { id } = await params;
  if (!removePerson(id)) return notFound();
});
