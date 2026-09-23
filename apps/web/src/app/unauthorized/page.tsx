import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <main>
      <h1>Unauthorized</h1>
      <p>You do not have access to this organization or session.</p>
      <Link href="/login">Back to login</Link>
    </main>
  );
}
