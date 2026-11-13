import { NextResponse } from 'next/server';
import { checkCredentials, createSessionToken, SESSION_COOKIE } from '@/server/auth';

export async function POST(req: Request) {
  let username = '';
  let password = '';
  try {
    const b = (await req.json()) as { username?: unknown; password?: unknown };
    username = typeof b.username === 'string' ? b.username : '';
    password = typeof b.password === 'string' ? b.password : '';
  } catch {
    return NextResponse.json({ error: 'Body phải là JSON hợp lệ' }, { status: 400 });
  }
  if (!checkCredentials(username, password)) {
    // Slow down password guessing a little.
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: 'Sai tên đăng nhập hoặc mật khẩu' }, { status: 401 });
  }
  const { token, expires } = createSessionToken(username);
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires,
  });
  return res;
}
