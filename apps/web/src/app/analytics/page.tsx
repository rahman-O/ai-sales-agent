'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { OperatorNav } from '@/client/navigation/OperatorNav';
import type { AnalyticsOverviewDto, WorkflowFunnelDto } from '@ai-sales-agent/contracts';

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export default function AnalyticsPage() {
  const now = new Date();
  const [orgId, setOrgId] = useState('');
  const [from, setFrom] = useState(isoDate(new Date(now.getTime() - 30 * 86400000)));
  const [to, setTo] = useState(isoDate(new Date(now.getTime() + 86400000)));
  const [timezone, setTimezone] = useState('Asia/Baghdad');
  const [data, setData] = useState<AnalyticsOverviewDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'funnels' | 'catalog' | 'intents' | 'operational'>('overview');

  // Sync active organization from local storage or session
  useEffect(() => {
    const stored = localStorage.getItem('last_active_organization_id');
    if (stored) setOrgId(stored);
  }, []);

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ from, to, timezone });
      const res = await fetch(`/api/backend/organizations/${orgId}/analytics/overview?${params}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        setError(`Analytics unavailable (${res.status})`);
        setData(null);
        return;
      }
      const json = (await res.json()) as AnalyticsOverviewDto;
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [orgId, from, to, timezone]);

  useEffect(() => {
    if (orgId) {
      void loadData();
    }
  }, [orgId, loadData]);

  const setShortcut = (days: number) => {
    const today = new Date();
    setTo(isoDate(new Date(today.getTime() + 86400000)));
    setFrom(isoDate(new Date(today.getTime() - days * 86400000)));
  };

  const formatMinor = (minorStr: string, currency: string) => {
    try {
      const val = Number(BigInt(minorStr || '0'));
      if (currency === 'IQD') {
        return `${val.toLocaleString()} د.ع`;
      }
      return `${(val / 100).toFixed(2)} ${currency}`;
    } catch {
      return `${minorStr} ${currency}`;
    }
  };

  return (
    <main style={{ fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: 1200, margin: '0 auto', padding: '16px' }}>
      <OperatorNav current="/analytics" />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#111827' }}>Multi-Business Analytics</h1>
          <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: 14 }}>
            Authoritative, tenant-scoped structured outcomes and business metrics.
          </p>
        </div>

        {/* Date Filter & Range Controls */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            id="org-id-input"
            placeholder="Organization ID"
            value={orgId}
            onChange={e => {
              setOrgId(e.target.value);
              localStorage.setItem('last_active_organization_id', e.target.value);
            }}
            style={{ padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13, width: 220 }}
          />
          <input
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13 }}
          />
          <span style={{ color: '#9CA3AF' }}>→</span>
          <input
            type="date"
            value={to}
            onChange={e => setTo(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13 }}
          />
          <button
            onClick={() => void loadData()}
            disabled={!orgId || loading}
            style={{
              padding: '7px 14px',
              backgroundColor: '#2563EB',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: orgId ? 'pointer' : 'not-allowed',
            }}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Range Presets */}
      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        <button onClick={() => setShortcut(1)} style={presetBtnStyle}>Today</button>
        <button onClick={() => setShortcut(7)} style={presetBtnStyle}>Last 7 Days</button>
        <button onClick={() => setShortcut(30)} style={presetBtnStyle}>Last 30 Days</button>
        <button onClick={() => setShortcut(90)} style={presetBtnStyle}>Last 90 Days</button>
      </div>

      {error && (
        <div style={{ marginTop: 16, padding: '12px 16px', backgroundColor: '#FEE2E2', color: '#991B1B', borderRadius: 6, fontSize: 14 }}>
          {error}
        </div>
      )}

      {data && (
        <div style={{ marginTop: 20 }}>
          {/* Metadata Banner */}
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6B7280', fontSize: 13, padding: '6px 0', borderBottom: '1px solid #E5E7EB', marginBottom: 16 }}>
            <span>As of: {new Date(data.asOf).toLocaleString()}</span>
            <span>Timezone: <strong>{data.range.timezone}</strong> (Half-open [from, to))</span>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: 8, borderBottom: '2px solid #E5E7EB', marginBottom: 20 }}>
            {(['overview', 'funnels', 'catalog', 'intents', 'operational'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  background: 'none',
                  borderBottom: activeTab === tab ? '2px solid #2563EB' : '2px solid transparent',
                  color: activeTab === tab ? '#2563EB' : '#4B5563',
                  fontWeight: activeTab === tab ? 700 : 500,
                  fontSize: 14,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  marginBottom: -2,
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div>
              {/* Primary KPI Grid */}
              <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                <MetricCard
                  title="Total Conversations"
                  value={data.conversations.total}
                  subtitle={`${data.conversations.aiHandled} AI / ${data.conversations.humanTakeover} Takeover`}
                />
                <MetricCard
                  title="Handoff Rate"
                  value={data.conversations.handoffRate === null ? 'N/A' : `${(data.conversations.handoffRate * 100).toFixed(1)}%`}
                  subtitle={data.conversations.humanTakeover > 0 ? `${data.conversations.humanTakeover} escalations` : 'Zero human takeover'}
                />

                {/* Commercial Values by Currency */}
                {data.commercialValues.map(cv => (
                  <MetricCard
                    key={cv.currency}
                    title={`Commercial Value (${cv.currency})`}
                    value={formatMinor(cv.totalCommercialValueMinor, cv.currency)}
                    subtitle={`Quotes: ${formatMinor(cv.acceptedQuoteValueMinor, cv.currency)} · Orders: ${formatMinor(cv.confirmedOrderValueMinor, cv.currency)}`}
                    highlight
                  />
                ))}

                {/* Capability Gated Cards */}
                {data.capabilities.supportsQuotes && data.quotes && (
                  <MetricCard
                    title="Accepted Quotes"
                    value={data.quotes.accepted}
                    subtitle={`Acceptance: ${data.quotes.acceptanceRate.rate === null ? 'N/A' : `${(data.quotes.acceptanceRate.rate * 100).toFixed(1)}%`} (${data.quotes.accepted}/${data.quotes.presented})`}
                  />
                )}

                {data.capabilities.supportsOrders && data.orders && (
                  <MetricCard
                    title="Confirmed Orders"
                    value={data.orders.confirmed}
                    subtitle={`Confirmation: ${data.orders.confirmationRate.rate === null ? 'N/A' : `${(data.orders.confirmationRate.rate * 100).toFixed(1)}%`} (${data.orders.confirmed}/${data.orders.total})`}
                  />
                )}

                {data.capabilities.supportsBooking && data.bookings && (
                  <MetricCard
                    title="Confirmed Bookings"
                    value={data.bookings.confirmed}
                    subtitle={`Cancelled: ${data.bookings.cancelled} · Total: ${data.bookings.total}`}
                  />
                )}

                {data.capabilities.supportsLeads && data.leads && (
                  <MetricCard
                    title="Leads Created"
                    value={data.leads.created}
                    subtitle={`Direct Conversion: ${data.leads.directBookingConversion.rate === null ? 'N/A' : `${(data.leads.directBookingConversion.rate * 100).toFixed(1)}%`}`}
                  />
                )}
              </section>

              {/* Messages & Turn Volume */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 20 }}>
                <div style={panelStyle}>
                  <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>Message Turn Volume</h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F3F4F6' }}>
                    <span style={{ color: '#6B7280' }}>Inbound Customer Messages:</span>
                    <strong>{data.conversations.inboundMessages}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F3F4F6' }}>
                    <span style={{ color: '#6B7280' }}>Outbound AI Responses:</span>
                    <strong>{data.conversations.aiResponses}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F3F4F6' }}>
                    <span style={{ color: '#6B7280' }}>Outbound Operator Responses:</span>
                    <strong>{data.conversations.operatorResponses}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                    <span style={{ color: '#6B7280' }}>Median AI Latency:</span>
                    <strong>{data.conversations.averageResponseLatencyMs ? `${Math.round(data.conversations.averageResponseLatencyMs)} ms` : 'N/A'}</strong>
                  </div>
                </div>

                <div style={panelStyle}>
                  <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>Enabled Capabilities</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {Object.entries(data.capabilities).map(([k, v]) => (
                      <span
                        key={k}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 500,
                          backgroundColor: v ? '#DEF7EC' : '#F3F4F6',
                          color: v ? '#03543F' : '#9CA3AF',
                        }}
                      >
                        {k}: {v ? 'ENABLED' : 'DISABLED'}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: FUNNELS */}
          {activeTab === 'funnels' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {data.funnels.booking && <FunnelView funnel={data.funnels.booking} />}
              {data.funnels.quote && <FunnelView funnel={data.funnels.quote} />}
              {data.funnels.order && <FunnelView funnel={data.funnels.order} />}
              {data.funnels.lead && <FunnelView funnel={data.funnels.lead} />}

              {!data.funnels.booking && !data.funnels.quote && !data.funnels.order && !data.funnels.lead && (
                <div style={{ padding: 32, textAlign: 'center', color: '#6B7280' }}>
                  No active transaction funnels enabled for this organization profile.
                </div>
              )}
            </div>
          )}

          {/* Tab 3: CATALOG ANALYTICS */}
          {activeTab === 'catalog' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
              {data.capabilities.supportsBooking && (
                <div style={panelStyle}>
                  <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>Most Booked Services</h3>
                  {data.catalog.mostBookedServices.length === 0 ? (
                    <p style={{ color: '#9CA3AF', fontSize: 13 }}>No bookings recorded in this range.</p>
                  ) : (
                    data.catalog.mostBookedServices.map(item => (
                      <div key={item.catalogItemId} style={catalogItemStyle}>
                        <div>
                          <strong>{item.name}</strong>
                          <span style={badgeStyle}>{item.itemType}</span>
                        </div>
                        <strong>{item.count} bookings</strong>
                      </div>
                    ))
                  )}
                </div>
              )}

              {data.capabilities.supportsQuotes && (
                <div style={panelStyle}>
                  <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>Most Quoted Catalog Items</h3>
                  {data.catalog.mostQuotedItems.length === 0 ? (
                    <p style={{ color: '#9CA3AF', fontSize: 13 }}>No quote line items in this range.</p>
                  ) : (
                    data.catalog.mostQuotedItems.map(item => (
                      <div key={item.catalogItemId} style={catalogItemStyle}>
                        <div>
                          <strong>{item.name}</strong>
                          <span style={badgeStyle}>{item.itemType}</span>
                        </div>
                        <div>
                          <strong>{item.count} quotes</strong>
                          {item.totalMinor && item.currency && (
                            <div style={{ fontSize: 12, color: '#059669' }}>
                              {formatMinor(item.totalMinor, item.currency)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {data.capabilities.supportsOrders && (
                <div style={panelStyle}>
                  <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>Most Ordered Catalog Items</h3>
                  {data.catalog.mostOrderedItems.length === 0 ? (
                    <p style={{ color: '#9CA3AF', fontSize: 13 }}>No order line items in this range.</p>
                  ) : (
                    data.catalog.mostOrderedItems.map(item => (
                      <div key={item.catalogItemId} style={catalogItemStyle}>
                        <div>
                          <strong>{item.name}</strong>
                          <span style={badgeStyle}>{item.itemType}</span>
                        </div>
                        <div>
                          <strong>{item.count} orders</strong>
                          {item.totalMinor && item.currency && (
                            <div style={{ fontSize: 12, color: '#059669' }}>
                              {formatMinor(item.totalMinor, item.currency)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tab 4: INTENTS */}
          {activeTab === 'intents' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
              <div style={panelStyle}>
                <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>Customer Intent Distribution</h3>
                <div style={{ marginBottom: 12, fontSize: 13, color: '#6B7280' }}>
                  Total Inquiries: <strong>{data.intents.totalDetections}</strong> · Unknown Rate:{' '}
                  <strong>{data.intents.unknownIntentRate === null ? 'N/A' : `${(data.intents.unknownIntentRate * 100).toFixed(1)}%`}</strong>
                </div>
                {Object.entries(data.intents.byIntent).length === 0 ? (
                  <p style={{ color: '#9CA3AF', fontSize: 13 }}>No intent data captured in this window.</p>
                ) : (
                  Object.entries(data.intents.byIntent).map(([intent, count]) => (
                    <div key={intent} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F3F4F6', fontSize: 13 }}>
                      <span><code>{intent}</code></span>
                      <strong>{count}</strong>
                    </div>
                  ))
                )}
              </div>

              <div style={panelStyle}>
                <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>Top Inquiries</h3>
                {data.intents.topIntents.map(item => (
                  <div key={item.intent} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
                    <div>
                      <strong>{item.intent}</strong>
                    </div>
                    <div>
                      <strong>{item.count}</strong>
                      {item.percentage !== null && (
                        <span style={{ fontSize: 12, color: '#6B7280', marginLeft: 6 }}>
                          ({(item.percentage * 100).toFixed(1)}%)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 5: OPERATIONAL */}
          {activeTab === 'operational' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={panelStyle}>
                <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>AI Token & System Usage</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  <MetricCard title="Model Calls" value={data.operational.modelCalls} />
                  <MetricCard title="Input Tokens" value={data.operational.inputTokens.toLocaleString()} />
                  <MetricCard title="Output Tokens" value={data.operational.outputTokens.toLocaleString()} />
                  <MetricCard title="Total Tokens" value={data.operational.totalTokens.toLocaleString()} />
                </div>
              </div>

              <div style={panelStyle}>
                <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>Tool Executions & Results</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                  {data.operational.toolCalls.map((tc, idx) => (
                    <div key={idx} style={{ padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                      <span><code>{tc.toolName}</code> ({tc.resultCode})</span>
                      <strong>{tc.count}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function MetricCard({ title, value, subtitle, highlight }: { title: string; value: string | number; subtitle?: string; highlight?: boolean }) {
  return (
    <div
      style={{
        border: highlight ? '1px solid #93C5FD' : '1px solid #E5E7EB',
        borderRadius: 8,
        padding: 16,
        backgroundColor: highlight ? '#EFF6FF' : '#FFFFFF',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      }}
    >
      <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 500 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: highlight ? '#1E40AF' : '#111827', marginTop: 4 }}>{value}</div>
      {subtitle && <div style={{ fontSize: 12, color: '#4B5563', marginTop: 4 }}>{subtitle}</div>}
    </div>
  );
}

function FunnelView({ funnel }: { funnel: WorkflowFunnelDto }) {
  const maxCount = Math.max(1, ...(funnel.stages.map(s => s.count)));

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{funnel.title}</h3>
        <span style={{ fontSize: 13, color: '#6B7280' }}>
          Overall Conversion:{' '}
          <strong>
            {funnel.overallConversionRate === null ? 'N/A' : `${(funnel.overallConversionRate * 100).toFixed(1)}%`}
          </strong>
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {funnel.stages.map((stg, idx) => {
          const pctWidth = Math.max(8, (stg.count / maxCount) * 100);
          return (
            <div key={stg.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{idx + 1}. {stg.name}</span>
                <span>
                  <strong>{stg.count}</strong>
                  {stg.conversionFromPrevious !== null && idx > 0 && (
                    <span style={{ color: '#059669', fontSize: 12, marginLeft: 6 }}>
                      ({(stg.conversionFromPrevious * 100).toFixed(1)}% from step {idx})
                    </span>
                  )}
                  {stg.dropOffFromPrevious !== null && stg.dropOffFromPrevious > 0 && (
                    <span style={{ color: '#DC2626', fontSize: 12, marginLeft: 6 }}>
                      [-{stg.dropOffFromPrevious} drop-off]
                    </span>
                  )}
                </span>
              </div>
              <div style={{ height: 12, backgroundColor: '#F3F4F6', borderRadius: 6, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${pctWidth}%`,
                    backgroundColor: idx === 0 ? '#3B82F6' : idx === funnel.stages.length - 1 ? '#10B981' : '#60A5FA',
                    borderRadius: 6,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  backgroundColor: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: 8,
  padding: 16,
  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
};

const presetBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  backgroundColor: '#F3F4F6',
  border: '1px solid #D1D5DB',
  borderRadius: 4,
  fontSize: 12,
  cursor: 'pointer',
  color: '#374151',
};

const catalogItemStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 0',
  borderBottom: '1px solid #F3F4F6',
  fontSize: 13,
};

const badgeStyle: React.CSSProperties = {
  marginLeft: 8,
  padding: '2px 6px',
  borderRadius: 4,
  fontSize: 11,
  backgroundColor: '#F3F4F6',
  color: '#4B5563',
};
