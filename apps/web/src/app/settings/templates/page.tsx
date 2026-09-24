'use client';

import { useCallback, useEffect, useState } from 'react';
import { OperatorNav } from '@/components/OperatorNav';

type Template = {
  id: string;
  internalName: string;
  internalStatus: string;
  activeVersion: {
    id: string;
    providerTemplateName: string;
    providerLanguageCode: string;
    providerStatus: string;
    version: number;
  } | null;
};

export default function TemplatesSettingsPage() {
  const [orgId, setOrgId] = useState('');
  const [rows, setRows] = useState<Template[]>([]);
  const [error, setError] = useState('');
  const [internalName, setInternalName] = useState('');
  const [providerName, setProviderName] = useState('');

  const refresh = useCallback(async () => {
    if (!orgId) return;
    setError('');
    const res = await fetch(`/api/backend/organizations/${orgId}/message-templates`);
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
    const res = await fetch(`/api/backend/organizations/${orgId}/message-templates`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        internalName,
        providerTemplateName: providerName,
        providerStatus: 'UNKNOWN',
        parameterSchema: { customerFirstName: 'string' },
        bodyPreview: 'Hello {{customerFirstName}}',
      }),
    });
    if (!res.ok) setError(`create_${res.status}`);
    setInternalName('');
    setProviderName('');
    await refresh();
  }

  async function approve(id: string) {
    const res = await fetch(`/api/backend/organizations/${orgId}/message-templates/${id}/status`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ internalStatus: 'APPROVED' }),
    });
    if (!res.ok) setError(`status_${res.status}`);
    await refresh();
  }

  return (
    <main style={{ fontFamily: 'Georgia, serif', maxWidth: 720, margin: '2rem auto', padding: 16 }}>
      <OperatorNav current="/settings/templates" />
      <h1 style={{ fontSize: '1.75rem' }}>Message templates</h1>
      <p style={{ color: '#444' }}>
        Internal APPROVED ≠ Meta provider approval. LIVE_TEMPLATE_ACCEPTANCE remains NOT_RUN without
        sandbox.
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
        Internal name
        <input
          value={internalName}
          onChange={(e) => setInternalName(e.target.value)}
          style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
        />
      </label>
      <label style={{ display: 'block', marginBottom: 8 }}>
        Provider template name
        <input
          value={providerName}
          onChange={(e) => setProviderName(e.target.value)}
          style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
        />
      </label>
      <button type="button" onClick={() => void create()} style={{ marginRight: 8, padding: '8px 14px' }}>
        Create
      </button>
      <button type="button" onClick={() => void refresh()} style={{ padding: '8px 14px' }}>
        Refresh
      </button>
      {error ? <p style={{ color: '#a00' }}>{error}</p> : null}
      <ul style={{ listStyle: 'none', padding: 0, marginTop: 16 }}>
        {rows.map((t) => (
          <li key={t.id} style={{ borderBottom: '1px solid #ddd', padding: '10px 0' }}>
            <div>
              <strong>{t.internalName}</strong> · internal {t.internalStatus}
            </div>
            {t.activeVersion ? (
              <div style={{ fontSize: 13, color: '#555' }}>
                v{t.activeVersion.version} · {t.activeVersion.providerTemplateName} · provider{' '}
                {t.activeVersion.providerStatus}
              </div>
            ) : null}
            {t.internalStatus !== 'APPROVED' ? (
              <button type="button" onClick={() => void approve(t.id)} style={{ marginTop: 6 }}>
                Mark internal APPROVED
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </main>
  );
}
