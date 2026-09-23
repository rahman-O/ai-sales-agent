import { createSupabaseServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

/**
 * Minimum read-only inbox shell (P03).
 * Timeline data is fetched from Nest via authenticated BFF; SSE is a refetch hint only.
 */
export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');

  const params = await searchParams;
  const organizationId = params.organizationId?.trim();

  return (
    <main style={{ fontFamily: 'system-ui', padding: '1.5rem', maxWidth: 720 }}>
      <p>
        <Link href="/app">App</Link>
      </p>
      <h1>Inbox</h1>
      <p>
        Read-only conversation inbox (Phase 03). PostgreSQL is the source of truth; SSE only
        invalidates.
      </p>
      {!organizationId ? (
        <p>
          Pass <code>?organizationId=…</code> to load a tenant inbox.
        </p>
      ) : (
        <div>
          <p>
            Organization: <code>{organizationId}</code>
          </p>
          <p>
            Use authenticated API:
            <br />
            <code>GET /v1/organizations/{organizationId}/conversations</code>
            <br />
            <code>GET /v1/organizations/{organizationId}/conversations/[id]/messages</code>
            <br />
            <code>GET /api/backend/organizations/{organizationId}/conversations/events</code> (SSE
            BFF)
          </p>
          <p>
            Client refetch should call the BFF with the session cookie / Bearer access token — never
            put JWTs in the SSE query string.
          </p>
        </div>
      )}
    </main>
  );
}
