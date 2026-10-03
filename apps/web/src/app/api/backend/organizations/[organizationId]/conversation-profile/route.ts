import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/shared/auth/supabase/server';

async function proxy(request: NextRequest, organizationId: string, method: string): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3001';
  const url = `${apiUrl}/v1/organizations/${organizationId}/conversation-profile`;
  const bodyText = method === 'GET' ? undefined : await request.text();
  const upstream = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: bodyText,
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
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params;
  return proxy(request, organizationId, 'GET');
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params;
  return proxy(request, organizationId, 'PATCH');
}
