import { setDriveUrl, setSetting } from '@/server/db';
import { handler } from '@/server/route';
import { BadRequest, driveUrl, obj } from '@/server/validate';

/** Body: any of { dark: boolean, driveUrl: string ('' removes the Google Drive link) } */
export const PATCH = handler(async (body) => {
  const o = obj(body);
  if (!('dark' in o) && !('driveUrl' in o)) throw new BadRequest('Cần dark hoặc driveUrl');
  if ('dark' in o) {
    if (typeof o.dark !== 'boolean') throw new BadRequest('dark phải là true/false');
    await setSetting('dark', o.dark ? '1' : '0');
  }
  if ('driveUrl' in o) await setDriveUrl(driveUrl(o.driveUrl));
});
