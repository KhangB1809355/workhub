import { setSetting } from '@/server/db';
import { handler } from '@/server/route';
import { BadRequest, obj } from '@/server/validate';

/** Body: { dark: boolean } */
export const PATCH = handler(async (body) => {
  const { dark } = obj(body);
  if (typeof dark !== 'boolean') throw new BadRequest('dark phải là true/false');
  await setSetting('dark', dark ? '1' : '0');
});
