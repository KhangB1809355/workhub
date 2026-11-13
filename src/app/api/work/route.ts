import { getSetting, listGoals, listTasks, replaceWork, setSetting } from '@/server/db';
import { handler } from '@/server/route';
import { workSnapshot } from '@/server/validate';

/** Everything the work tab needs in one request. */
export const GET = handler(async () => {
  const [tasks, goals, dark, initialized] = await Promise.all([listTasks(), listGoals(), getSetting('dark'), getSetting('work_initialized')]);
  return { tasks, goals, dark: dark === '1', initialized: initialized === '1' };
});

/** Replaces all tasks and goals. */
export const PUT = handler(async (body) => {
  const { tasks, goals } = workSnapshot(body);
  await replaceWork(tasks, goals);
  await setSetting('work_initialized', '1');
});
