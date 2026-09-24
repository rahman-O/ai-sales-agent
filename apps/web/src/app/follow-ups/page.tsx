'use client';

import { useCallback, useEffect, useState } from 'react';
import { OperatorNav } from '@/components/OperatorNav';

type FollowUp = {
  id: string;
  status: string;
  triggerType: string;
  scheduledFor: string;
  nextEligibleAt: string;
  resultReasonCode: string | null;
  outboundMessageId: string | null;
  version: number;
  outreachBasis: string;
};

export default function FollowUpsPage() {
  const [orgId, setOrgId] = useState('');
  const [items, setItems] = useState<FollowUp[]>([]);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('SCHEDULED');

  const refresh = useCallback(async () => {
    if (!orgId) return;
    setError('');
    const q = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : '';
    const res = await fetch(`/api/backend/organizations/${orgId}/follow-ups${q}`);
    if (!res.ok) {
      setError(`list_${res.status}`);
      return;
    }
    setItems(await res.json());
  }, [orgId, statusFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function cancel(fu: FollowUp) {
    const res = await fetch(`/api/backend/organizations/${orgId}/follow-ups/${fu.id}/cancel`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expectedVersion: fu.version }),
    });
    if (!res.ok) setError(`cancel_${res.status}`);
    await refresh();
  }

  return (
    <main style={{ fontFamily: 'Georgia, serif', maxWidth: 800, margin: '2rem auto', padding: 16 }}>
      <OperatorNav current="/follow-ups" />
      <h1 style={{ fontSize: '1.75rem' }}>Follow-ups</h1>
      <p style={{ color: '#444' }}>
        DISPATCHED means handed to WhatsApp pipeline — check Message deliveryState for transport truth.
      </p>
      <label style={{ display: 'block', marginBottom: 8 }}>
        Organization id
        <input
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
          style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
        />
      </label>
      <label style={{ display: 'block', marginBottom: 8 }}>
        Status
        <input
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
        />
      </label>
      <button type="button" onClick={() => void refresh()} style={{ marginBottom: 16, padding: '8px 14px' }}>
        Refresh
      </button>
      {error ? <p style={{ color: '#a00' }}>{error}</p> : null}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {items.map((f) => (
          <li key={f.id} style={{ borderBottom: '1px solid #ddd', padding: '10px 0' }}>
            <div>
              <strong>{f.triggerType}</strong> · {f.status}
              {f.resultReasonCode ? ` · ${f.resultReasonCode}` : ''}
            </div>
            <div style={{ fontSize: 13, color: '#555' }}>
              due {new Date(f.scheduledFor).toISOString()} · eligible{' '}
              {new Date(f.nextEligibleAt).toISOString()}
            </div>
            <div style={{ fontSize: 12, color: '#888' }}>
              {f.outreachBasis}
              {f.outboundMessageId ? ` · msg ${f.outboundMessageId.slice(0, 8)}…` : ''}
            </div>
            {f.status === 'SCHEDULED' || f.status === 'PROCESSING' ? (
              <button type="button" onClick={() => void cancel(f)} style={{ marginTop: 6 }}>
                Cancel
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </main>
  );
}
