import { moveTasks } from '@/server/db';
import { handler } from '@/server/route';
import { moveRequest } from '@/server/validate';

/** Body: { dates: { [taskId]: "YYYY-MM-DD" } } */
export const POST = handler(async (body) => {
  const { dates } = moveRequest(body);
  await moveTasks(dates);
});
