import type { Metadata } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import { cookies } from 'next/headers';
import { THEME_COOKIE } from '@/lib/theme';
import './globals.css';

const font = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-be-vietnam',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'WorkHub – Quản lý công việc',
  description: 'Quản lý công việc cá nhân theo tuần, tháng và quý',
};

/**
 * The saved theme comes from a cookie, so the server renders <html class="dark"> directly:
 * no inline script (React 19 warns about those) and no light/dark flash on load.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const dark = (await cookies()).get(THEME_COOKIE)?.value === 'dark';
  return (
    <html lang="vi" className={`${font.variable}${dark ? ' dark' : ''}`} suppressHydrationWarning>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
