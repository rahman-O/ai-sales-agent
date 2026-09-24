'use client';

import { useCallback, useEffect, useState } from 'react';

type Lead = {
  id: string;
  customerId: string;
  status: string;
  primaryServiceId: string | null;
  needSummary: string | null;
  preferredContactChannel: string | null;
  qualificationState: string;
  version: number;
  updatedAt: string;
};

type Activity = {
  id: string;
  type: string;
  actorType: string;
  createdAt: string;
  metadataJson: Record<string, unknown>;
};

/** Minimal P06 leads surface — list + detail + note. */
export default function LeadsPage() {
  const [orgId, setOrgId] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const refresh = useCallback(async () => {
    if (!orgId) return;
    setError('');
    const q = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : '';
    const res = await fetch(`/api/backend/organizations/${orgId}/leads${q}`);
    if (!res.ok) {
      setError(`list_failed_${res.status}`);
      return;
    }
    setLeads(await res.json());
  }, [orgId, statusFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function openLead(id: string) {
    setSelectedId(id);
    setError('');
    const [d, a] = await Promise.all([
      fetch(`/api/backend/organizations/${orgId}/leads/${id}`),
      fetch(`/api/backend/organizations/${orgId}/leads/${id}/activities`),
    ]);
    if (!d.ok) {
      setError(`detail_${d.status}`);
      return;
    }
    setDetail(await d.json());
    if (a.ok) setActivities(await a.json());
  }

  async function addNote() {
    if (!selectedId || !note.trim()) return;
    const res = await fetch(`/api/backend/organizations/${orgId}/leads/${selectedId}/notes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: note }),
    });
    if (!res.ok) {
      setError(`note_${res.status}`);
      return;
    }
    setNote('');
    await openLead(selectedId);
  }

  return (
    <main style={{ fontFamily: 'Georgia, serif', maxWidth: 800, margin: '2rem auto', padding: 16 }}>
      <h1 style={{ fontSize: '1.75rem', marginBottom: 8 }}>Leads</h1>
      <p style={{ color: '#444', marginTop: 0 }}>
        Open opportunities only — no BOOKED/WON in this phase. Qualification is derived.
      </p>
      <label style={{ display: 'block', marginBottom: 12 }}>
        Organization id
        <input
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
          style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
        />
      </label>
      <label style={{ display: 'block', marginBottom: 12 }}>
        Status filter
        <input
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          placeholder="NEW, ENGAGED, …"
          style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
        />
      </label>
      <button type="button" onClick={() => void refresh()} style={{ marginBottom: 16, padding: '8px 14px' }}>
        Refresh
      </button>
      {error ? <p style={{ color: '#a00' }}>{error}</p> : null}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {leads.map((l) => (
          <li key={l.id} style={{ borderBottom: '1px solid #ddd', padding: '10px 0' }}>
            <button
              type="button"
              onClick={() => void openLead(l.id)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                textAlign: 'left',
                cursor: 'pointer',
                font: 'inherit',
                width: '100%',
              }}
            >
              <strong>{l.status}</strong> · {l.qualificationState} · v{l.version}
              <br />
              <span style={{ color: '#555', fontSize: '0.9rem' }}>
                {l.needSummary || '(no summary)'} — {l.id.slice(0, 8)}…
              </span>
            </button>
          </li>
        ))}
      </ul>
      {detail ? (
        <section style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: '1.25rem' }}>Detail</h2>
          <p>
            {detail.status} / {detail.qualificationState} / v{detail.version}
          </p>
          <p style={{ whiteSpace: 'pre-wrap' }}>{detail.needSummary}</p>
          <label style={{ display: 'block', marginTop: 12 }}>
            Add note
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
            />
          </label>
          <button type="button" onClick={() => void addNote()} style={{ marginTop: 8, padding: '8px 14px' }}>
            Save note
          </button>
          <h3 style={{ marginTop: 20, fontSize: '1.1rem' }}>Activity</h3>
          <ol style={{ paddingLeft: 20 }}>
            {activities.map((a) => (
              <li key={a.id} style={{ marginBottom: 6 }}>
                {a.type} · {a.actorType} · {new Date(a.createdAt).toLocaleString()}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </main>
  );
}
