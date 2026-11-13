import { getPerson, removePerson, updatePerson } from '@/server/db';
import { handler, notFound, type IdContext } from '@/server/route';
import { personPatch } from '@/server/validate';

/** Body: any of { name, email } (email '' or null clears it). */
export const PATCH = handler<IdContext>(async (body, { params }) => {
  const { id } = await params;
  if (!(await updatePerson(id, personPatch(body)))) return notFound();
  return await getPerson(id);
});

/** Also deletes the person's entries. */
export const DELETE = handler<IdContext>(async (_body, { params }) => {
  const { id } = await params;
  if (!(await removePerson(id))) return notFound();
});
