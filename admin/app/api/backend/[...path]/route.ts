import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_URL = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

type Context = {
  params: { path: string[] };
};

async function proxy(request: Request, context: Context) {
  const token = cookies().get('admin_token')?.value;
  if (!token) {
    return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
  }

  const path = `/${context.params.path.join('/')}`;
  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text();
  const response = await fetch(`${API_URL}${path}`, {
    method: request.method,
    headers: {
      'Content-Type': request.headers.get('Content-Type') || 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body,
  });
  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('Content-Type') || 'application/json',
    },
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
