'use client';

import { useCallback, useEffect, useState } from 'react';
import { OperatorNav } from '@/components/OperatorNav';

type Rule = {
  id: string;
  staffMemberId: string;
  dayOfWeek: number;
  localStartTime: string;
  localEndTime: string;
  isActive: boolean;
};

export default function SchedulePage() {
  const [orgId, setOrgId] = useState('');
  const [staffMemberId, setStaffMemberId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [localStartTime, setLocalStartTime] = useState('09:00');
  const [localEndTime, setLocalEndTime] = useState('17:00');
  const [rules, setRules] = useState<Rule[]>([]);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!orgId) return;
    const q = staffMemberId ? `?staffMemberId=${encodeURIComponent(staffMemberId)}` : '';
    const res = await fetch(`/api/backend/organizations/${orgId}/schedule/rules${q}`);
    if (!res.ok) {
      setError(`list_${res.status}`);
      return;
    }
    setRules(await res.json());
  }, [orgId, staffMemberId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createRule() {
    setError('');
    const res = await fetch(`/api/backend/organizations/${orgId}/schedule/rules`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        staffMemberId,
        locationId,
        dayOfWeek,
        localStartTime,
        localEndTime,
      }),
    });
    if (!res.ok) {
      setError(`create_${res.status}`);
      return;
    }
    await refresh();
  }

  return (
    <main style={{ fontFamily: 'Georgia, serif', maxWidth: 720, margin: '2rem auto', padding: 16 }}>
      <OperatorNav current="/schedule" />
      <h1 style={{ fontSize: '1.75rem' }}>Schedule</h1>
      <p style={{ color: '#444' }}>Weekly staff availability rules (ISO DOW 1=Mon … 7=Sun).</p>
      <label style={{ display: 'block', marginBottom: 8 }}>
        Organization id
        <input value={orgId} onChange={(e) => setOrgId(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }} />
      </label>
      <label style={{ display: 'block', marginBottom: 8 }}>
        Staff member id
        <input value={staffMemberId} onChange={(e) => setStaffMemberId(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }} />
      </label>
      <label style={{ display: 'block', marginBottom: 8 }}>
        Location id
        <input value={locationId} onChange={(e) => setLocationId(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }} />
      </label>
      <label style={{ display: 'block', marginBottom: 8 }}>
        Day of week
        <input type="number" min={1} max={7} value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }} />
      </label>
      <label style={{ display: 'block', marginBottom: 8 }}>
        Local start
        <input value={localStartTime} onChange={(e) => setLocalStartTime(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }} />
      </label>
      <label style={{ display: 'block', marginBottom: 8 }}>
        Local end
        <input value={localEndTime} onChange={(e) => setLocalEndTime(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }} />
      </label>
      <button type="button" onClick={() => void createRule()} style={{ padding: '8px 14px', marginRight: 8 }}>
        Add rule
      </button>
      <button type="button" onClick={() => void refresh()} style={{ padding: '8px 14px' }}>
        Refresh
      </button>
      {error ? <p style={{ color: '#a00' }}>{error}</p> : null}
      <ul style={{ marginTop: 20, paddingLeft: 18 }}>
        {rules.map((r) => (
          <li key={r.id}>
            DOW {r.dayOfWeek}: {String(r.localStartTime).slice(0, 8)}–{String(r.localEndTime).slice(0, 8)} ·{' '}
            {r.staffMemberId.slice(0, 8)}…
          </li>
        ))}
      </ul>
    </main>
  );
}
