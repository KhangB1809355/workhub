import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/LoginForm';
import { isAuthenticated } from '@/server/auth';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Đăng nhập – WorkHub' };

export default async function LoginPage() {
  if (await isAuthenticated()) redirect('/');
  return <LoginForm />;
}
