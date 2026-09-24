import Link from 'next/link';

export default function HomePage() {
  return (
    <main>
      <h1>AI Sales Agent</h1>
      <p>Phase 01 foundation — staff shell.</p>
      <p>
        <Link href="/login">Login</Link> · <Link href="/dashboard">Dashboard</Link> ·{' '}
        <Link href="/app">App</Link>
      </p>
    </main>
  );
}
