'use client';

import { useCallback, useEffect, useState } from 'react';

type Channel = {
  id: string;
  provider: string;
  phoneNumberId: string;
  status: string;
  healthStatus: string;
  displayPhoneNumber: string | null;
  lastVerifiedAt: string | null;
  hasCredentialRef: boolean;
};

export default function ChannelsSettingsPage() {
  const [orgId, setOrgId] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [displayPhone, setDisplayPhone] = useState('');
  const [rows, setRows] = useState<Channel[]>([]);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!orgId) return;
    setError('');
    const res = await fetch(`/api/backend/organizations/${orgId}/channels`);
    if (!res.ok) {
      setError(`list_${res.status}`);
      return;
    }
    setRows(await res.json());
  }, [orgId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function create() {
    setError('');
    const res = await fetch(`/api/backend/organizations/${orgId}/channels`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        phoneNumberId,
        displayPhoneNumber: displayPhone || undefined,
      }),
    });
    if (!res.ok) {
      setError(`create_${res.status}`);
      return;
    }
    setPhoneNumberId('');
    await refresh();
  }

  async function verify(id: string) {
    const res = await fetch(`/api/backend/organizations/${orgId}/channels/${id}/verify`, {
      method: 'POST',
    });
    if (!res.ok) setError(`verify_${res.status}`);
    await refresh();
  }

  async function disable(id: string) {
    const res = await fetch(`/api/backend/organizations/${orgId}/channels/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'DISABLED', healthStatus: 'DISABLED' }),
    });
    if (!res.ok) setError(`disable_${res.status}`);
    await refresh();
  }

  return (
    <main style={{ fontFamily: 'Georgia, serif', maxWidth: 720, margin: '2rem auto', padding: 16 }}>
      <h1 style={{ fontSize: '1.75rem' }}>Channels</h1>
      <p style={{ color: '#444' }}>WhatsApp Cloud API connections — secrets never shown here.</p>
      <label style={{ display: 'block', marginBottom: 8 }}>
        Organization id
        <input
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
          style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
        />
      </label>
      <label style={{ display: 'block', marginBottom: 8 }}>
        Phone number id
        <input
          value={phoneNumberId}
          onChange={(e) => setPhoneNumberId(e.target.value)}
          style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
        />
      </label>
      <label style={{ display: 'block', marginBottom: 8 }}>
        Display phone
        <input
          value={displayPhone}
          onChange={(e) => setDisplayPhone(e.target.value)}
          style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
        />
      </label>
      <button type="button" onClick={() => void create()} style={{ padding: '8px 14px', marginRight: 8 }}>
        Add connection
      </button>
      <button type="button" onClick={() => void refresh()} style={{ padding: '8px 14px' }}>
        Refresh
      </button>
      {error ? <p style={{ color: '#a00' }}>{error}</p> : null}
      <ul style={{ listStyle: 'none', padding: 0, marginTop: 20 }}>
        {rows.map((c) => (
          <li key={c.id} style={{ borderBottom: '1px solid #ddd', padding: '12px 0' }}>
            <strong>{c.displayPhoneNumber || c.phoneNumberId}</strong>
            <br />
            <span style={{ color: '#555', fontSize: '0.9rem' }}>
              {c.provider} · {c.status} · health {c.healthStatus}
              {c.lastVerifiedAt ? ` · verified ${new Date(c.lastVerifiedAt).toLocaleString()}` : ''}
            </span>
            <div style={{ marginTop: 8 }}>
              <button type="button" onClick={() => void verify(c.id)} style={{ marginRight: 8, padding: '4px 10px' }}>
                Verify config
              </button>
              {c.status === 'ACTIVE' ? (
                <button type="button" onClick={() => void disable(c.id)} style={{ padding: '4px 10px' }}>
                  Disable
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
