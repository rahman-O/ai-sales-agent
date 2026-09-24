import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

async function proxy(
  request: NextRequest,
  organizationId: string,
  suffix: string,
): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3001';
  const path = suffix ? `conversations/${suffix}` : 'conversations';
  const url = `${apiUrl}/v1/organizations/${organizationId}/${path}${request.nextUrl.search}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'content-type': request.headers.get('content-type') ?? 'application/json',
  };
  const idem = request.headers.get('idempotency-key');
  if (idem) headers['Idempotency-Key'] = idem;

  const upstream = await fetch(url, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text(),
    cache: 'no-store',
  });
  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ organizationId: string; path?: string[] }> },
) {
  const { organizationId, path = [] } = await context.params;
  return proxy(request, organizationId, path.join('/'));
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ organizationId: string; path?: string[] }> },
) {
  const { organizationId, path = [] } = await context.params;
  return proxy(request, organizationId, path.join('/'));
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ organizationId: string; path?: string[] }> },
) {
  const { organizationId, path = [] } = await context.params;
  return proxy(request, organizationId, path.join('/'));
}
