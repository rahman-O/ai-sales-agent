'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { OperatorNav } from '@/client/navigation/OperatorNav';
import {
  BUSINESS_POLICY_STATUSES,
  BUSINESS_POLICY_TYPES,
  type BusinessPolicyDto,
  type BusinessPolicyStatus,
  type BusinessPolicyType,
  type MemberRole,
} from '@ai-sales-agent/contracts';

const bookingTypes = new Set<BusinessPolicyType>(['BOOKING', 'CANCELLATION', 'RESCHEDULING', 'ADVANCE_NOTICE']);

export default function PoliciesPage() {
  const [orgId, setOrgId] = useState('');
  const [role, setRole] = useState<MemberRole | null>(null);
  const [supportsBooking, setSupportsBooking] = useState(true);
  const [items, setItems] = useState<BusinessPolicyDto[]>([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [effectiveView, setEffectiveView] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<BusinessPolicyType>('CANCELLATION');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [cutoffMinutes, setCutoffMinutes] = useState(120);
  const [allowAfterCutoff, setAllowAfterCutoff] = useState(false);
  const [acceptedMethods, setAcceptedMethods] = useState('CASH, CARD');
  const [areas, setAreas] = useState('');
  const [minimumAmountMinor, setMinimumAmountMinor] = useState(0);
  const [currency, setCurrency] = useState('IQD');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveUntil, setEffectiveUntil] = useState('');

  useEffect(() => {
    fetch('/api/backend/me').then((r) => r.ok ? r.json() : null).then((data) => {
      if (data?.activeOrganizationId) {
        setOrgId(data.activeOrganizationId);
        const membership = data.memberships?.find((entry: { organizationId: string }) => entry.organizationId === data.activeOrganizationId);
        setRole(membership?.role ?? null);
      }
    }).catch(() => undefined);
  }, []);

  const refresh = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError('');
    const query = new URLSearchParams();
    if (typeFilter) query.set('policyType', typeFilter);
    if (statusFilter) query.set('status', statusFilter);
    try {
      const [policies, capabilities] = await Promise.all([
        fetch(`/api/backend/organizations/${orgId}/policies?${query}`),
        fetch(`/api/backend/organizations/${orgId}/capabilities`),
      ]);
      if (!policies.ok) throw new Error(`Failed to load policies: HTTP ${policies.status}`);
      setItems((await policies.json()).items ?? []);
      if (capabilities.ok) setSupportsBooking((await capabilities.json()).supportsBooking !== false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [orgId, statusFilter, typeFilter]);

  useEffect(() => { void refresh(); }, [refresh]);

  const orderedTypes = useMemo(() => [...BUSINESS_POLICY_TYPES].sort((a, b) => {
    const ar = supportsBooking && bookingTypes.has(a) ? 0 : 1;
    const br = supportsBooking && bookingTypes.has(b) ? 0 : 1;
    return ar - br || a.localeCompare(b);
  }), [supportsBooking]);

  function rules() {
    if (type === 'CANCELLATION') return { cutoffMinutes, allowAfterCutoff };
    if (type === 'RESCHEDULING') return { cutoffMinutes };
    if (type === 'ADVANCE_NOTICE') return { minimumLeadMinutes: cutoffMinutes };
    if (type === 'PAYMENT') return { acceptedMethods: acceptedMethods.split(',').map((v) => v.trim()).filter(Boolean) };
    if (type === 'SERVICE_AREA') return { supportedAreas: areas.split(',').map((v) => v.trim()).filter(Boolean), excludedAreas: [] };
    if (type === 'MINIMUM_ORDER') return { minimumAmountMinor, currency: currency.toUpperCase() };
    return {};
  }

  function resetForm() {
    setEditingId(null); setTitle(''); setSummary(''); setCutoffMinutes(120); setAllowAfterCutoff(false);
    setAcceptedMethods('CASH, CARD'); setAreas(''); setMinimumAmountMinor(0); setEffectiveFrom(''); setEffectiveUntil('');
  }

  function edit(policy: BusinessPolicyDto) {
    setEditingId(policy.id); setType(policy.policyType); setTitle(policy.title); setSummary(policy.summary);
    setCutoffMinutes(Number(policy.rulesJson.cutoffMinutes ?? policy.rulesJson.minimumLeadMinutes ?? 120));
    setAllowAfterCutoff(Boolean(policy.rulesJson.allowAfterCutoff));
    setAcceptedMethods(Array.isArray(policy.rulesJson.acceptedMethods) ? policy.rulesJson.acceptedMethods.join(', ') : '');
    setAreas(Array.isArray(policy.rulesJson.supportedAreas) ? policy.rulesJson.supportedAreas.join(', ') : '');
    setMinimumAmountMinor(Number(policy.rulesJson.minimumAmountMinor ?? 0));
    setCurrency(String(policy.rulesJson.currency ?? 'IQD'));
    setEffectiveFrom(policy.effectiveFrom ? policy.effectiveFrom.slice(0, 16) : '');
    setEffectiveUntil(policy.effectiveUntil ? policy.effectiveUntil.slice(0, 16) : '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    const body = {
      ...(editingId ? {} : { policyType: type }), title, summary, rulesJson: rules(),
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom).toISOString() : null,
      effectiveUntil: effectiveUntil ? new Date(effectiveUntil).toISOString() : null,
    };
    const response = await fetch(`/api/backend/organizations/${orgId}/policies${editingId ? `/${editingId}` : ''}`, {
      method: editingId ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!response.ok) { setError((await response.text()) || `HTTP ${response.status}`); return; }
    resetForm(); await refresh();
  }

  async function transition(id: string, action: 'activate' | 'archive') {
    const response = await fetch(`/api/backend/organizations/${orgId}/policies/${id}/${action}`, { method: 'POST' });
    if (!response.ok) { setError((await response.text()) || `HTTP ${response.status}`); return; }
    await refresh();
  }

  async function viewEffective(policyType: BusinessPolicyType) {
    const response = await fetch(`/api/backend/organizations/${orgId}/policies/effective/${policyType}`);
    if (!response.ok) { setError((await response.text()) || `HTTP ${response.status}`); return; }
    const data = await response.json();
    setEffectiveView(data.policy
      ? `Effective ${policyType}: ${data.policy.title} (version ${data.policy.version}) — ${data.policy.summary}`
      : `No effective ${policyType} policy is configured.`);
  }

  if (role === 'MEMBER') return <main style={{ maxWidth: 900, margin: '0 auto', padding: 24, fontFamily: 'system-ui' }}>
    <OperatorNav current="/policies" orgId={orgId} role={role} />
    <h1>Policies</h1><p>You need an OWNER or ADMIN role to manage business policies.</p>
  </main>;

  return <main style={{ maxWidth: 1180, margin: '0 auto', padding: 24, fontFamily: 'system-ui' }}>
    <OperatorNav current="/policies" orgId={orgId} role={role ?? undefined} />
    <h1>Business Policies</h1>
    <p style={{ color: '#64748b' }}>Structured rules remain backend authoritative. Descriptions help the assistant explain them naturally.</p>
    {error && <div role="alert" style={{ padding: 12, background: '#fee2e2', color: '#991b1b', marginBottom: 16 }}>{error}</div>}
    {effectiveView && <div style={{ padding: 12, background: '#eff6ff', color: '#1e3a8a', marginBottom: 16 }}>{effectiveView}</div>}
    <form onSubmit={save} style={{ padding: 18, border: '1px solid #dbe3ee', borderRadius: 10, marginBottom: 24, display: 'grid', gap: 12 }}>
      <h2 style={{ margin: 0 }}>{editingId ? 'Edit draft policy' : 'Create policy draft'}</h2>
      <label>Policy type<select disabled={Boolean(editingId)} value={type} onChange={(e) => setType(e.target.value as BusinessPolicyType)} style={{ display: 'block', width: '100%', padding: 8 }}>
        {orderedTypes.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
      </select></label>
      <label>Policy title<input required maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} style={{ display: 'block', width: '100%', padding: 8 }} /></label>
      <label>What should customers know?<textarea required maxLength={4000} rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} style={{ display: 'block', width: '100%', padding: 8 }} /></label>
      {(type === 'CANCELLATION' || type === 'RESCHEDULING' || type === 'ADVANCE_NOTICE') && <label>
        {type === 'ADVANCE_NOTICE' ? 'How many minutes in advance must a booking be made?' : `How many minutes before an appointment can customers ${type === 'CANCELLATION' ? 'cancel' : 'reschedule'}?`}
        <input type="number" min={0} required value={cutoffMinutes} onChange={(e) => setCutoffMinutes(Number(e.target.value))} style={{ display: 'block', width: '100%', padding: 8 }} />
      </label>}
      {type === 'CANCELLATION' && <label><input type="checkbox" checked={allowAfterCutoff} onChange={(e) => setAllowAfterCutoff(e.target.checked)} /> Allow cancellation after the cutoff</label>}
      {type === 'PAYMENT' && <label>Accepted payment methods<input value={acceptedMethods} onChange={(e) => setAcceptedMethods(e.target.value)} placeholder="Cash, card" style={{ display: 'block', width: '100%', padding: 8 }} /></label>}
      {type === 'SERVICE_AREA' && <label>Supported areas<input value={areas} onChange={(e) => setAreas(e.target.value)} placeholder="Baghdad, Karrada" style={{ display: 'block', width: '100%', padding: 8 }} /></label>}
      {type === 'MINIMUM_ORDER' && <div style={{ display: 'flex', gap: 12 }}><label>Minimum amount<input type="number" min={0} value={minimumAmountMinor} onChange={(e) => setMinimumAmountMinor(Number(e.target.value))} /></label><label>Currency<input maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value)} /></label></div>}
      <div style={{ display: 'flex', gap: 12 }}><label>Effective from (UTC)<input type="datetime-local" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} /></label><label>Effective until (UTC)<input type="datetime-local" value={effectiveUntil} onChange={(e) => setEffectiveUntil(e.target.value)} /></label></div>
      <div><button type="submit" disabled={!orgId} style={{ padding: '8px 14px' }}>{editingId ? 'Save draft' : 'Create draft'}</button>{editingId && <button type="button" onClick={resetForm} style={{ marginLeft: 8, padding: '8px 14px' }}>Cancel edit</button>}</div>
    </form>
    <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
      <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="">All types</option>{BUSINESS_POLICY_TYPES.map((v) => <option key={v}>{v}</option>)}</select>
      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">All statuses</option>{BUSINESS_POLICY_STATUSES.map((v) => <option key={v}>{v}</option>)}</select>
    </div>
    {loading ? <p>Loading…</p> : items.map((policy) => <article key={policy.id} style={{ border: '1px solid #dbe3ee', borderRadius: 8, padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}><div><strong>{policy.title}</strong><div style={{ color: '#64748b', fontSize: 13 }}>{policy.policyType} · {policy.status} · version {policy.version} · {policy.enforcementMode}</div></div><div>
        <button onClick={() => void viewEffective(policy.policyType)}>View effective</button>
        {policy.status === 'DRAFT' && <><button onClick={() => edit(policy)} style={{ marginLeft: 6 }}>Edit</button><button onClick={() => void transition(policy.id, 'activate')} style={{ marginLeft: 6 }}>Activate</button></>}
        {policy.status !== 'ARCHIVED' && <button onClick={() => void transition(policy.id, 'archive')} style={{ marginLeft: 6 }}>Archive</button>}
      </div></div>
      <p>{policy.summary}</p>
      <small>{policy.effectiveFrom ? `From ${policy.effectiveFrom}` : 'Effective immediately'}{policy.effectiveUntil ? ` until ${policy.effectiveUntil}` : ''}</small>
    </article>)}
  </main>;
}
