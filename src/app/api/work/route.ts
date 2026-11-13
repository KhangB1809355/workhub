import { getSetting, listGoals, listTasks, replaceWork, setSetting } from '@/server/db';
import { handler } from '@/server/route';
import { workSnapshot } from '@/server/validate';

/** Everything the work tab needs in one request. */
export const GET = handler(() => ({
  tasks: listTasks(),
  goals: listGoals(),
  dark: getSetting('dark') === '1',
  initialized: getSetting('work_initialized') === '1',
}));

/** Replaces all tasks and goals. */
export const PUT = handler((body) => {
  const { tasks, goals } = workSnapshot(body);
  replaceWork(tasks, goals);
  setSetting('work_initialized', '1');
});
