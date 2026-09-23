import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * BFF: extract verified access token from SSR session and forward to NestJS as Bearer.
 * Nest re-verifies JWT via JWKS — browser userId/organizationId/role are never trusted.
 */
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return NextResponse.json({ error: 'missing_access_token' }, { status: 401 });
  }

  const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3001';
  const orgId = request.headers.get('x-organization-id');
  const upstream = await fetch(`${apiUrl}/v1/auth/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(orgId ? { 'x-organization-id': orgId } : {}),
    },
    cache: 'no-store',
  });

  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
  });
}
