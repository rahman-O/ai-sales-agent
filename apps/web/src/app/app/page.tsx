import { createSupabaseServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function AppHomePage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect('/login');
  }

  return (
    <main>
      <h1>Authenticated</h1>
      <p>Verified subject: {data.user.id}</p>
      <p>
        Use the BFF at <code>/api/backend/me</code> to call Nest <code>GET /v1/auth/me</code> with a
        Bearer access token.
      </p>
      <p>
        <Link href="/unauthorized">Unauthorized</Link> · <Link href="/login">Logout via login page</Link>
      </p>
    </main>
  );
}
