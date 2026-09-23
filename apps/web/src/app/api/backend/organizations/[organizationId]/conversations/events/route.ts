import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Authenticated BFF proxy for conversation SSE.
 * Forwards Authorization Bearer from the Supabase session — never accepts JWT via query string.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001';
  const upstream = await fetch(
    `${apiUrl}/v1/organizations/${organizationId}/conversations/events`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'text/event-stream',
      },
    },
  );

  if (!upstream.ok || !upstream.body) {
    return new Response('Upstream unavailable', { status: upstream.status || 502 });
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
