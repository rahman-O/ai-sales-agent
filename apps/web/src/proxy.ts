import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Next.js 16 Proxy convention (replaces legacy middleware.ts naming).
 * Verifies Supabase SSR session identity before allowing protected routes.
 * NestJS still re-verifies Bearer tokens independently — cookies alone are not API auth.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const isProtected =
    request.nextUrl.pathname.startsWith('/app') ||
    request.nextUrl.pathname.startsWith('/api/backend') ||
    request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/analytics') ||
    request.nextUrl.pathname.startsWith('/inbox') ||
    request.nextUrl.pathname.startsWith('/leads') ||
    request.nextUrl.pathname.startsWith('/bookings') ||
    request.nextUrl.pathname.startsWith('/follow-ups') ||
    request.nextUrl.pathname.startsWith('/knowledge') ||
    request.nextUrl.pathname.startsWith('/schedule') ||
    request.nextUrl.pathname.startsWith('/settings');

  if (isProtected && !data.user) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  matcher: [
    '/app/:path*',
    '/api/backend/:path*',
    '/dashboard',
    '/dashboard/:path*',
    '/analytics',
    '/analytics/:path*',
    '/inbox',
    '/inbox/:path*',
    '/leads',
    '/leads/:path*',
    '/bookings',
    '/bookings/:path*',
    '/follow-ups',
    '/follow-ups/:path*',
    '/knowledge',
    '/knowledge/:path*',
    '/schedule',
    '/schedule/:path*',
    '/settings/:path*',
  ],
};
