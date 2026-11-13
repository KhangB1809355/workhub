import { insertExpense } from '@/server/db';
import { handler } from '@/server/route';
import { expense } from '@/server/validate';

export const POST = handler((body) => {
  const e = expense(body);
  insertExpense(e);
  return e;
});
