import Link from 'next/link';

const LINKS: Array<{ href: string; label: string }> = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/inbox', label: 'Inbox' },
  { href: '/leads', label: 'Leads' },
  { href: '/bookings', label: 'Bookings' },
  { href: '/follow-ups', label: 'Follow-ups' },
  { href: '/knowledge', label: 'Knowledge' },
  { href: '/settings/channels', label: 'Channels' },
  { href: '/settings/templates', label: 'Templates' },
];

/** Minimal shared operator chrome — matches existing inline-style pages. */
export function OperatorNav({ current }: { current?: string }) {
  return (
    <nav
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20,
        paddingBottom: 12,
        borderBottom: '1px solid #ddd',
        fontFamily: 'Georgia, serif',
        fontSize: 14,
      }}
    >
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          style={{
            fontWeight: current === l.href ? 700 : 400,
            textDecoration: current === l.href ? 'underline' : 'none',
            color: '#222',
          }}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
