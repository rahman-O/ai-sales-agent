'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { OperatorNav } from '@/components/OperatorNav';

type Conversation = {
  id: string;
  mode: string;
  ownerMemberId: string | null;
  ownershipEpoch: number;
  lastMessageAt: string | null;
  pauseReasonCode: string | null;
  aiEligibleAfterSequence: number;
};

type Message = {
  id: string;
  direction: string;
  origin: string;
  contentText: string;
  deliveryState: string;
  timelineSequence: number;
  authorityEpoch: number | null;
  createdAt: string;
};

/** P09 operator inbox — claim, composer, resume; SSE is refetch-only. */
export default function InboxPage() {
  const [orgId, setOrgId] = useState('');
  const [filter, setFilter] = useState<'paused' | 'mine' | 'unassigned' | 'all'>('paused');
  const [items, setItems] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const listQuery = () => {
    if (filter === 'paused') return '?mode=AI_PAUSED';
    if (filter === 'unassigned') return '?unassignedOnly=true';
    if (filter === 'mine') return '?assignedToMe=true';
    return '';
  };

  const refreshList = useCallback(async () => {
    if (!orgId) return;
    setError('');
    const res = await fetch(`/api/backend/organizations/${orgId}/conversations${listQuery()}`);
    if (!res.ok) {
      setError(`list_${res.status}`);
      return;
    }
    const data = (await res.json()) as { items: Conversation[] };
    setItems(data.items ?? []);
  }, [orgId, filter]);

  const openConversation = useCallback(
    async (id: string) => {
      if (!orgId) return;
      setSelectedId(id);
      setError('');
      const [d, m] = await Promise.all([
        fetch(`/api/backend/organizations/${orgId}/conversations/${id}`),
        fetch(`/api/backend/organizations/${orgId}/conversations/${id}/messages`),
      ]);
      if (!d.ok) {
        setError(`detail_${d.status}`);
        return;
      }
      setDetail(await d.json());
      if (m.ok) {
        const body = (await m.json()) as { items: Message[] };
        setMessages(body.items ?? []);
      }
    },
    [orgId],
  );

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    if (!orgId) return;
    esRef.current?.close();
    const es = new EventSource(`/api/backend/organizations/${orgId}/conversations/events`);
    esRef.current = es;
    es.addEventListener('refetch', () => {
      void refreshList();
      if (selectedId) void openConversation(selectedId);
    });
    es.onerror = () => {
      /* browser will retry */
    };
    return () => es.close();
  }, [orgId, refreshList, openConversation, selectedId]);

  async function postControl(path: string, body: Record<string, unknown>) {
    if (!orgId || !detail) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/backend/organizations/${orgId}/conversations/${detail.id}/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(`${path}_${res.status}`);
        return;
      }
      const next = (await res.json()) as Conversation;
      setDetail(next);
      await refreshList();
      await openConversation(next.id);
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    if (!orgId || !detail || !reply.trim()) return;
    setBusy(true);
    setError('');
    try {
      const key = crypto.randomUUID();
      const res = await fetch(
        `/api/backend/organizations/${orgId}/conversations/${detail.id}/replies`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'Idempotency-Key': key,
          },
          body: JSON.stringify({
            text: reply.trim(),
            expectedOwnershipEpoch: detail.ownershipEpoch,
          }),
        },
      );
      if (!res.ok) {
        setError(`reply_${res.status}`);
        return;
      }
      setReply('');
      await openConversation(detail.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ fontFamily: 'Georgia, serif', maxWidth: 960, margin: '2rem auto', padding: 16 }}>
      <OperatorNav current="/inbox" />
      <h1 style={{ fontSize: '1.75rem', marginBottom: 8 }}>Inbox</h1>
      <p style={{ color: '#444', marginTop: 0 }}>
        Human takeover — claim, reply, resume. Delivery states DISPATCHING / UNKNOWN are visible;
        already-started sends are not recalled.
      </p>

      <label style={{ display: 'block', marginBottom: 12 }}>
        Organization id
        <input
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
          style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
        />
      </label>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {(
          [
            ['paused', 'Paused'],
            ['unassigned', 'Unassigned'],
            ['mine', 'Assigned to me'],
            ['all', 'All'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            style={{
              padding: '6px 12px',
              background: filter === k ? '#1a1a1a' : '#eee',
              color: filter === k ? '#fff' : '#111',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
        <button type="button" onClick={() => void refreshList()} style={{ padding: '6px 12px' }}>
          Refresh
        </button>
      </div>

      {error ? <p style={{ color: '#a00' }}>{error}</p> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 24 }}>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {items.map((c) => (
            <li key={c.id} style={{ borderBottom: '1px solid #ddd', padding: '10px 0' }}>
              <button
                type="button"
                onClick={() => void openConversation(c.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  textAlign: 'left',
                  cursor: 'pointer',
                  width: '100%',
                  font: 'inherit',
                }}
              >
                <div style={{ fontWeight: selectedId === c.id ? 700 : 400 }}>
                  {c.mode}
                  {c.ownerMemberId ? ' · owned' : ' · open'}
                </div>
                <div style={{ fontSize: 13, color: '#666' }}>
                  epoch {c.ownershipEpoch}
                  {c.pauseReasonCode ? ` · ${c.pauseReasonCode}` : ''}
                </div>
                <div style={{ fontSize: 12, color: '#888' }}>{c.id.slice(0, 8)}…</div>
              </button>
            </li>
          ))}
          {!items.length ? <li style={{ color: '#888' }}>No conversations</li> : null}
        </ul>

        <section>
          {!detail ? (
            <p style={{ color: '#888' }}>Select a conversation</p>
          ) : (
            <>
              <h2 style={{ fontSize: '1.2rem', marginTop: 0 }}>
                {detail.mode} · epoch {detail.ownershipEpoch}
              </h2>
              <p style={{ fontSize: 13, color: '#555' }}>
                Owner: {detail.ownerMemberId ?? 'unassigned'}
                {detail.pauseReasonCode ? ` · ${detail.pauseReasonCode}` : ''}
              </p>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void postControl('claim', {
                      expectedOwnershipEpoch: detail.ownershipEpoch,
                    })
                  }
                >
                  Claim
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void postControl('takeover', {
                      expectedOwnershipEpoch: detail.ownershipEpoch,
                      reasonCode: 'OPERATOR_MANUAL_TAKEOVER',
                    })
                  }
                >
                  Takeover
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void postControl('release', {
                      expectedOwnershipEpoch: detail.ownershipEpoch,
                    })
                  }
                >
                  Release
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void postControl('resume-ai', {
                      expectedOwnershipEpoch: detail.ownershipEpoch,
                    })
                  }
                >
                  Resume AI
                </button>
              </div>

              <div
                style={{
                  border: '1px solid #ddd',
                  padding: 12,
                  maxHeight: 360,
                  overflow: 'auto',
                  marginBottom: 12,
                  background: '#fafafa',
                }}
              >
                {messages.map((m) => (
                  <div key={m.id} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      {m.origin} · {m.direction} · {m.deliveryState}
                      {m.deliveryState === 'DISPATCHING' || m.deliveryState === 'UNKNOWN'
                        ? ' ⚠ in-flight'
                        : ''}
                      {m.deliveryState === 'SUPPRESSED' ? ' (suppressed)' : ''}
                    </div>
                    <div>{m.contentText}</div>
                  </div>
                ))}
                {!messages.length ? <div style={{ color: '#888' }}>No messages</div> : null}
              </div>

              <label style={{ display: 'block' }}>
                Reply
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={3}
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
                  disabled={detail.mode !== 'AI_PAUSED'}
                />
              </label>
              <button
                type="button"
                disabled={busy || detail.mode !== 'AI_PAUSED' || !reply.trim()}
                onClick={() => void sendReply()}
                style={{ marginTop: 8, padding: '8px 14px' }}
              >
                Send reply
              </button>
              {detail.mode === 'AI_ACTIVE' ? (
                <p style={{ fontSize: 13, color: '#666' }}>Takeover required before human reply.</p>
              ) : null}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
