'use client';

import { useCallback, useEffect, useState } from 'react';

type Booking = {
  id: string;
  customerId: string;
  serviceId: string;
  staffMemberId: string;
  startsAt: string;
  endsAt: string;
  status: string;
  version: number;
  serviceNameSnapshot?: string | null;
  staffDisplayNameSnapshot?: string | null;
};

export default function BookingsPage() {
  const [orgId, setOrgId] = useState('');
  const [rows, setRows] = useState<Booking[]>([]);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!orgId) return;
    setError('');
    const res = await fetch(`/api/backend/organizations/${orgId}/bookings`);
    if (!res.ok) {
      setError(`list_${res.status}`);
      return;
    }
    setRows(await res.json());
  }, [orgId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function cancel(b: Booking) {
    const res = await fetch(`/api/backend/organizations/${orgId}/bookings/${b.id}/cancel`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expectedVersion: b.version, reasonCode: 'CLINIC_REQUEST' }),
    });
    if (!res.ok) setError(`cancel_${res.status}`);
    await refresh();
  }

  return (
    <main style={{ fontFamily: 'Georgia, serif', maxWidth: 800, margin: '2rem auto', padding: 16 }}>
      <h1 style={{ fontSize: '1.75rem' }}>Bookings</h1>
      <p style={{ color: '#444' }}>Confirmed appointments — backend is source of truth.</p>
      <label style={{ display: 'block', marginBottom: 12 }}>
        Organization id
        <input
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
          style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
        />
      </label>
      <button type="button" onClick={() => void refresh()} style={{ marginBottom: 16, padding: '8px 14px' }}>
        Refresh
      </button>
      {error ? <p style={{ color: '#a00' }}>{error}</p> : null}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {rows.map((b) => (
          <li key={b.id} style={{ borderBottom: '1px solid #ddd', padding: '10px 0' }}>
            <strong>{b.status}</strong> · {b.serviceNameSnapshot || b.serviceId.slice(0, 8)} ·{' '}
            {b.staffDisplayNameSnapshot || b.staffMemberId.slice(0, 8)}
            <br />
            <span style={{ color: '#555', fontSize: '0.9rem' }}>
              {new Date(b.startsAt).toLocaleString()} – {new Date(b.endsAt).toLocaleString()}
            </span>
            {b.status === 'CONFIRMED' ? (
              <div>
                <button type="button" onClick={() => void cancel(b)} style={{ marginTop: 6, padding: '4px 10px' }}>
                  Cancel
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </main>
  );
}
