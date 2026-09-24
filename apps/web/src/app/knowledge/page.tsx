'use client';

import { useCallback, useEffect, useState } from 'react';
import { OperatorNav } from '@/components/OperatorNav';

type Doc = {
  id: string;
  title: string;
  activePublishedVersionId: string | null;
  archivedAt: string | null;
  versions?: Array<{ id: string; pipelineStatus: string; reviewStatus: string; versionNumber: number }>;
};

/**
 * Minimal P05 knowledge curation surface.
 * Uses Next BFF under /api/backend/... (Bearer from session cookie path).
 */
export default function KnowledgePage() {
  const [orgId, setOrgId] = useState('');
  const [docs, setDocs] = useState<Doc[]>([]);
  const [title, setTitle] = useState('Clinic FAQ');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!orgId) return;
    setError('');
    const res = await fetch(`/api/backend/organizations/${orgId}/knowledge/documents`);
    if (!res.ok) {
      setError(`list_failed_${res.status}`);
      return;
    }
    setDocs(await res.json());
  }, [orgId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function uploadAndFinalize() {
    setStatus('uploading');
    setError('');
    const create = await fetch(`/api/backend/organizations/${orgId}/knowledge/uploads`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title, contentType: 'text/plain' }),
    });
    if (!create.ok) {
      setError(`upload_create_${create.status}`);
      setStatus('');
      return;
    }
    const created = await create.json();
    // Local filesystem backend: finalize after client posts bytes through a put helper endpoint.
    const put = await fetch(`/api/backend/organizations/${orgId}/knowledge/blob-put`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        objectKey: created.upload.objectKey,
        contentType: 'text/plain',
        text: body,
      }),
    });
    if (!put.ok) {
      setError(`blob_put_${put.status}`);
      setStatus('');
      return;
    }
    const fin = await fetch(
      `/api/backend/organizations/${orgId}/knowledge/documents/${created.documentId}/finalize`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ versionId: created.versionId }),
      },
    );
    if (!fin.ok) {
      setError(`finalize_${fin.status}`);
      setStatus('');
      return;
    }
    setStatus('finalized — await extract/review');
    setBody('');
    await refresh();
  }

  async function act(documentId: string, versionId: string, action: 'approve' | 'publish') {
    const path =
      action === 'approve'
        ? `/api/backend/organizations/${orgId}/knowledge/documents/${documentId}/versions/${versionId}/approve`
        : `/api/backend/organizations/${orgId}/knowledge/documents/${documentId}/versions/${versionId}/publish`;
    const res = await fetch(path, { method: 'POST' });
    if (!res.ok) setError(`${action}_${res.status}`);
    await refresh();
  }

  return (
    <main style={{ fontFamily: 'Georgia, serif', maxWidth: 720, margin: '2rem auto', padding: 16 }}>
      <OperatorNav current="/knowledge" />
      <h1 style={{ fontSize: '1.75rem', marginBottom: 8 }}>Knowledge</h1>
      <p style={{ color: '#444', marginTop: 0 }}>
        Upload → review → publish. RAG evidence is never authoritative for prices or bookings.
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
        Title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
        />
      </label>
      <label style={{ display: 'block', marginBottom: 12 }}>
        Plain text body
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
        />
      </label>
      <button type="button" onClick={() => void uploadAndFinalize()} disabled={!orgId || !body.trim()}>
        Upload & finalize
      </button>
      {status ? <p>{status}</p> : null}
      {error ? <p style={{ color: '#a30' }}>{error}</p> : null}
      <h2 style={{ marginTop: 32 }}>Documents</h2>
      <ul style={{ paddingLeft: 18 }}>
        {docs.map((d) => {
          const latest = d.versions?.[0];
          return (
            <li key={d.id} style={{ marginBottom: 16 }}>
              <strong>{d.title}</strong>
              <div style={{ fontSize: 14, color: '#555' }}>
                published={d.activePublishedVersionId ? 'yes' : 'no'} · archived=
                {d.archivedAt ? 'yes' : 'no'}
                {latest
                  ? ` · v${latest.versionNumber} ${latest.pipelineStatus}/${latest.reviewStatus}`
                  : ''}
              </div>
              {latest && latest.pipelineStatus === 'AWAITING_REVIEW' ? (
                <button type="button" onClick={() => void act(d.id, latest.id, 'approve')}>
                  Approve
                </button>
              ) : null}
              {latest && latest.pipelineStatus === 'READY' && latest.reviewStatus === 'APPROVED' ? (
                <button type="button" onClick={() => void act(d.id, latest.id, 'publish')}>
                  Publish
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
