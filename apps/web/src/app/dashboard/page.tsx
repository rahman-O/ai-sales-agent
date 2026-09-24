'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { OperatorNav } from '@/components/OperatorNav';
import { createRefreshController } from '@/lib/dashboard-refresh';

type AttentionItem = {
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  actionRoute: string;
  occurredAt: string | null;
  dueAt: string | null;
};

type DashboardPayload = {
  asOf: string;
  attention: AttentionItem[];
  summary: {
    unassignedHandoffs: number;
    unassignedPaused: number;
    myActiveConversations: number;
    openLeads: number;
    qualifiedLeads: number;
    leadsNeedingQualification: number;
    leadStatusCounts: { NEW: number; ENGAGED: number; QUALIFIED: number; NURTURE: number };
    todaysBookings: number;
    pendingFollowUps: number;
    failedFollowUps: number;
    channelHealthy: number;
    channelUnhealthy: number;
    channelDisabled: number;
  };
  upcomingBookings: Array<{
    id: string;
    customerDisplayName: string | null;
    serviceName: string;
    staffDisplayName: string;
    locationName: string;
    localStartsAt: string;
    timezone: string;
    status: string;
  }>;
  recentFollowUps: Array<{
    id: string;
    status: string;
    triggerType: string;
    nextEligibleAt: string;
    resultReasonCode: string | null;
    messageDeliveryState: string | null;
  }>;
  channelHealth: Array<{
    id: string;
    healthStatus: string;
    displayPhoneNumber: string | null;
    lastVerifiedAt: string | null;
  }>;
  knowledgeHealth: {
    awaitingReview: number;
    processing: number;
    failed: number;
    publishedDocuments: number;
  } | null;
  sectionErrors: Record<string, string>;
};

const DEBOUNCE_MS = 500;
const INTERVAL_MS = 45_000;

export default function DashboardPage() {
  const [orgId, setOrgId] = useState('');
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const refreshRef = useRef<ReturnType<typeof createRefreshController> | null>(null);

  const loadImmediate = useCallback(async () => {
    if (!orgId.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/backend/organizations/${orgId}/dashboard`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        setError(`Dashboard failed (${res.status})`);
        setData(null);
        return;
      }
      const json = (await res.json()) as DashboardPayload;
      setData(json);
    } catch {
      setError('Network error loading dashboard');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    refreshRef.current?.dispose();
    if (!orgId.trim()) {
      refreshRef.current = null;
      setData(null);
      return;
    }
    const controller = createRefreshController({
      debounceMs: DEBOUNCE_MS,
      run: loadImmediate,
    });
    refreshRef.current = controller;
    void loadImmediate();
    return () => controller.dispose();
  }, [orgId, loadImmediate]);

  useEffect(() => {
    if (!orgId.trim()) return;
    const id = setInterval(() => {
      void loadImmediate();
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [orgId, loadImmediate]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && orgId.trim()) void loadImmediate();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [orgId, loadImmediate]);

  useEffect(() => {
    if (!orgId.trim()) return;
    esRef.current?.close();
    const es = new EventSource(`/api/backend/organizations/${orgId}/conversations/events`);
    esRef.current = es;
    es.addEventListener('refetch', () => {
      refreshRef.current?.request();
    });
    es.onerror = () => {
      /* browser retries */
    };
    return () => {
      es.close();
    };
  }, [orgId]);

  const s = data?.summary;

  return (
    <main style={{ fontFamily: 'Georgia, serif', maxWidth: 1100 }}>
      <OperatorNav current="/dashboard" />
      <h1>Dashboard</h1>
      <p style={{ color: '#555', marginTop: 0 }}>Operator workspace — current state only.</p>

      <label style={{ display: 'block', marginBottom: 16 }}>
        Organization id
        <input
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
          style={{ display: 'block', width: '100%', maxWidth: 420, marginTop: 4 }}
        />
      </label>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <button type="button" onClick={() => void loadImmediate()} disabled={!orgId.trim() || loading}>
          Refresh
        </button>
        {loading ? <span>Loading…</span> : null}
        {data?.asOf ? (
          <span style={{ fontSize: 13, color: '#666' }}>as of {data.asOf}</span>
        ) : null}
      </div>

      {error ? <p style={{ color: '#a00' }}>{error}</p> : null}

      {!orgId.trim() ? <p>Enter an organization id to load the workspace.</p> : null}

      {s ? (
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 12,
            marginBottom: 24,
          }}
        >
          <SummaryCard label="Unassigned handoffs" value={s.unassignedHandoffs} href="/inbox" />
          <SummaryCard label="My active" value={s.myActiveConversations} href="/inbox" />
          <SummaryCard label="Open leads" value={s.openLeads} href="/leads" />
          <SummaryCard label="Needs qualification" value={s.leadsNeedingQualification} href="/leads" />
          <SummaryCard label="Today bookings" value={s.todaysBookings} href="/bookings" />
          <SummaryCard label="Pending follow-ups" value={s.pendingFollowUps} href="/follow-ups" />
          <SummaryCard label="Failed follow-ups" value={s.failedFollowUps} href="/follow-ups" />
          <SummaryCard
            label="Channels healthy / unhealthy / disabled"
            value={`${s.channelHealthy}/${s.channelUnhealthy}/${s.channelDisabled}`}
            href="/settings/channels"
          />
        </section>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
          gap: 24,
          marginBottom: 24,
        }}
      >
        <section>
          <h2 style={{ marginTop: 0 }}>Needs attention</h2>
          {!data ? null : data.attention.length === 0 ? (
            <p>Nothing needs attention right now.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {data.attention.map((item) => (
                <li
                  key={item.id}
                  style={{
                    padding: '10px 0',
                    borderBottom: '1px solid #eee',
                  }}
                >
                  <div style={{ fontSize: 12, color: '#888' }}>
                    {item.severity} · {item.type}
                  </div>
                  <Link href={item.actionRoute} style={{ fontWeight: 600, color: '#222' }}>
                    {item.title}
                  </Link>
                  <div style={{ fontSize: 13, color: '#444' }}>{item.description}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 style={{ marginTop: 0 }}>Upcoming bookings</h2>
          {!data ? null : data.upcomingBookings.length === 0 ? (
            <p>No upcoming bookings.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {data.upcomingBookings.map((b) => (
                <li key={b.id} style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>
                  <div style={{ fontWeight: 600 }}>
                    {b.customerDisplayName ?? 'Customer'} · {b.serviceName}
                  </div>
                  <div style={{ fontSize: 13 }}>
                    {b.localStartsAt} ({b.timezone}) · {b.staffDisplayName} · {b.locationName}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {data ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 20,
          }}
        >
          <section>
            <h2>Follow-ups</h2>
            {data.recentFollowUps.length === 0 ? (
              <p>No recent follow-ups.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {data.recentFollowUps.map((f) => (
                  <li key={f.id} style={{ marginBottom: 8, fontSize: 13 }}>
                    <Link href={`/follow-ups?id=${f.id}`}>
                      {f.status} · {f.triggerType}
                    </Link>
                    {f.resultReasonCode ? ` · ${f.resultReasonCode}` : ''}
                    {f.messageDeliveryState ? ` · message ${f.messageDeliveryState}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2>Channel health</h2>
            {data.channelHealth.length === 0 ? (
              <p>WhatsApp is not connected.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {data.channelHealth.map((c) => (
                  <li key={c.id} style={{ marginBottom: 8, fontSize: 13 }}>
                    {c.displayPhoneNumber ?? c.id} · {c.healthStatus}
                    {c.lastVerifiedAt ? ` · verified ${c.lastVerifiedAt}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {data.knowledgeHealth ? (
            <section>
              <h2>Knowledge health</h2>
              {data.sectionErrors.knowledgeHealth ? (
                <p style={{ color: '#a00' }}>Knowledge unavailable (QUERY_FAILED)</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, fontSize: 13 }}>
                  <li>Awaiting review: {data.knowledgeHealth.awaitingReview}</li>
                  <li>Processing: {data.knowledgeHealth.processing}</li>
                  <li>Failed: {data.knowledgeHealth.failed}</li>
                  <li>Published: {data.knowledgeHealth.publishedDocuments}</li>
                </ul>
              )}
            </section>
          ) : null}

          <section>
            <h2>Lead pipeline</h2>
            {s ? (
              <ul style={{ listStyle: 'none', padding: 0, fontSize: 13 }}>
                <li>NEW: {s.leadStatusCounts.NEW}</li>
                <li>ENGAGED: {s.leadStatusCounts.ENGAGED}</li>
                <li>QUALIFIED: {s.leadStatusCounts.QUALIFIED}</li>
                <li>NURTURE: {s.leadStatusCounts.NURTURE}</li>
              </ul>
            ) : null}
          </section>
        </div>
      ) : null}
    </main>
  );
}

function SummaryCard({
  label,
  value,
  href,
}: {
  label: string;
  value: string | number;
  href: string;
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'block',
        padding: '12px 14px',
        border: '1px solid #ddd',
        textDecoration: 'none',
        color: '#222',
      }}
    >
      <div style={{ fontSize: 12, color: '#666' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
    </Link>
  );
}
