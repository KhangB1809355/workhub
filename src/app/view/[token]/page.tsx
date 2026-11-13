import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ShareView } from '@/components/ShareView';
import { financeSnapshot } from '@/server/db';
import { isValidShareToken } from '@/server/share';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Bảng thu chi – WorkHub', robots: { index: false, follow: false } };

/** Public read-only view of the finance table. Anyone with the link can look; nobody can change anything. */
export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!(await isValidShareToken(token))) notFound();
  return <ShareView token={token} initial={await financeSnapshot()} />;
}
