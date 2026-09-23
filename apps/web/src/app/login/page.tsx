'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(error.message);
        return;
      }
      window.location.href = '/app';
    } catch (err) {
      setMessage(
        'Supabase Auth is not configured for this environment (provider integration blocked until project credentials exist).',
      );
      console.error(err);
    }
  }

  async function onLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setMessage('Signed out');
  }

  return (
    <main>
      <h1>Login</h1>
      <p>Session lifecycle is owned by Next.js + Supabase SSR. NestJS receives Bearer tokens only.</p>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 8, maxWidth: 360 }}>
        <input
          type="email"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Sign in</button>
      </form>
      <button type="button" onClick={onLogout} style={{ marginTop: 12 }}>
        Logout
      </button>
      {message ? <p>{message}</p> : null}
    </main>
  );
}
