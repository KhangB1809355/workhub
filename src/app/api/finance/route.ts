import { getSetting, listExpenses, listPeople, replaceFinance, setSetting } from '@/server/db';
import { handler } from '@/server/route';
import { financeSnapshot } from '@/server/validate';

export const GET = handler(() => ({
  people: listPeople(),
  expenses: listExpenses(),
  initialized: getSetting('finance_initialized') === '1',
}));

/** Replaces all people and expenses. */
export const PUT = handler((body) => {
  const { people, expenses } = financeSnapshot(body);
  replaceFinance(people, expenses);
  setSetting('finance_initialized', '1');
});
