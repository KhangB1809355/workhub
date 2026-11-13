import 'server-only';
import { NextResponse } from 'next/server';
import { requireAuth } from './auth';
import { Conflict } from './store/types';
import { BadRequest } from './validate';

export type IdContext = { params: Promise<{ id: string }> };

/** Wraps a route handler: requires login, parses the JSON body, and maps errors to HTTP responses. */
export function handler<C = unknown>(fn: (body: unknown, ctx: C) => unknown | Promise<unknown>) {
  return async (req: Request, ctx: C) => {
    const denied = await requireAuth();
    if (denied) return denied;
    try {
      let body: unknown = undefined;
      if (req.method !== 'GET' && req.method !== 'DELETE') {
        try {
          body = await req.json();
        } catch {
          throw new BadRequest('Body phải là JSON hợp lệ');
        }
      }
      const result = await fn(body, ctx);
      if (result instanceof Response) return result;
      return result === undefined ? new NextResponse(null, { status: 204 }) : NextResponse.json(result);
    } catch (e) {
      if (e instanceof BadRequest) return NextResponse.json({ error: e.message }, { status: 400 });
      if (e instanceof Conflict) return NextResponse.json({ error: e.message || 'Dữ liệu bị trùng hoặc tham chiếu không tồn tại' }, { status: 409 });
      const code = (e as { code?: unknown }).code;
      // Firestore (gRPC): 5 NOT_FOUND = database not created, 7 PERMISSION_DENIED = API disabled / no access
      if (code === 5 || code === 7) {
        console.error('Firestore chưa sẵn sàng:', (e as Error).message);
        return NextResponse.json(
          { error: 'Database Firebase chưa sẵn sàng (chưa tạo Firestore hoặc chưa bật API). Xem log máy chủ.' },
          { status: 503 },
        );
      }
      if (String(code ?? '').startsWith('SQLITE_CONSTRAINT')) {
        return NextResponse.json({ error: 'Dữ liệu bị trùng hoặc tham chiếu không tồn tại' }, { status: 409 });
      }
      console.error(e);
      return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 });
    }
  };
}

export const notFound = () => NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 });
