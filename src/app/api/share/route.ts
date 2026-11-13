import { handler } from '@/server/route';
import { disableShare, getShareToken, rotateShareToken } from '@/server/share';

/** Owner only: current read-only share token (null = sharing off). */
export const GET = handler(async () => ({ token: await getShareToken() }));

/** Owner only: create a new link (the old one stops working). Body: {} */
export const POST = handler(async () => ({ token: await rotateShareToken() }));

/** Owner only: turn sharing off. */
export const DELETE = handler(async () => {
  await disableShare();
});
