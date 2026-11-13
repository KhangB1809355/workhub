import { redirect } from 'next/navigation';
import Dashboard from '@/components/Dashboard';
import { isAuthenticated } from '@/server/auth';

export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!(await isAuthenticated())) redirect('/login');
  return <Dashboard />;
}
