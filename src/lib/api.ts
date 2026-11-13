'use client';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Calls the app's own API. Sends the user to /login when the session has expired. */
export async function api<T = void>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('Không kết nối được tới máy chủ', 0);
  }
  if (res.status === 401) {
    window.location.href = '/login';
    throw new ApiError('Phiên đăng nhập đã hết hạn', 401);
  }
  if (!res.ok) {
    let msg = `Lỗi ${res.status}`;
    try {
      msg = ((await res.json()) as { error?: string }).error ?? msg;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(msg, res.status);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
