import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/shared/auth/supabase/server';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ organizationId: string; packId: string }> },
): Promise<NextResponse> {
  const { organizationId, packId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3001';
  const url = `${apiUrl}/v1/organizations/${organizationId}/packs/${packId}/preview`;
  const bodyText = await request.text();
  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: bodyText || JSON.stringify({}),
    cache: 'no-store',
  });
  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
  });
}
