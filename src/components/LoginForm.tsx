'use client';

import { useState } from 'react';
import { CARD, FIELD, LABEL } from '@/lib/constants';
import { Icon } from './Icon';

export function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        window.location.href = '/';
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? `Lỗi ${res.status}`);
    } catch {
      setError('Không kết nối được tới máy chủ');
    }
    setBusy(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className={`${CARD} flex w-full max-w-sm flex-col gap-4 p-7`}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#1E1B4B] text-white dark:bg-indigo-500">
            <Icon name="check" strokeWidth={2.6} />
          </div>
          <span className="text-lg font-bold">WorkHub</span>
        </div>
        <h1 className="text-xl font-extrabold">Đăng nhập</h1>
        <label className={LABEL}>
          Tên đăng nhập
          <input autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} className={FIELD} />
        </label>
        <label className={LABEL}>
          Mật khẩu
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={FIELD} />
        </label>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-700 dark:bg-[#3A1D24] dark:text-red-300">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="h-11.5 rounded-xl bg-indigo-600 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>
    </main>
  );
}
