'use client';

import { useCallback, useEffect, useState } from 'react';
import { OperatorNav } from '@/client/navigation/OperatorNav';

type DocVersion = {
  id: string;
  versionNumber: number;
  pipelineStatus: string;
  reviewStatus: string;
  extractedText: string | null;
  failureReason: string | null;
  expectedChunkCount: number | null;
  createdAt: string;
};

type Doc = {
  id: string;
  title: string;
  sourceType?: 'TEXT' | 'FAQ' | 'FILE' | 'URL' | 'MANUAL_NOTE';
  visibility?: 'CUSTOMER_VISIBLE' | 'INTERNAL_ONLY';
  activePublishedVersionId: string | null;
  archivedAt: string | null;
  metadataJson?: Record<string, unknown> | null;
  createdAt: string;
  versions?: DocVersion[];
};

type SearchResult = {
  chunkId: string;
  documentId: string;
  title: string;
  excerpt: string;
  similarity: number;
  distance: number;
};

export default function KnowledgePage() {
  const [orgId, setOrgId] = useState('');
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'text' | 'faq' | 'file' | 'test'>('text');

  // Form states: Plain Text
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [textVisibility, setTextVisibility] = useState<'CUSTOMER_VISIBLE' | 'INTERNAL_ONLY'>('CUSTOMER_VISIBLE');

  // Form states: FAQ
  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');
  const [faqTags, setFaqTags] = useState('');
  const [faqVisibility, setFaqVisibility] = useState<'CUSTOMER_VISIBLE' | 'INTERNAL_ONLY'>('CUSTOMER_VISIBLE');

  // Form states: File
  const [fileTitle, setFileTitle] = useState('');
  const [fileContent, setFileContent] = useState('');

  // Knowledge Search / Test Box
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/backend/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.activeOrganizationId) {
          setOrgId(data.activeOrganizationId);
        }
      })
      .catch(() => undefined);
  }, []);

  const refresh = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/backend/organizations/${orgId}/knowledge/documents`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDocs(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(`Failed to load knowledge documents: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleCreateText(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !textTitle.trim() || !textContent.trim()) return;
    setStatusMessage('Creating text guide...');
    setError('');
    try {
      const res = await fetch(`/api/backend/organizations/${orgId}/knowledge/text`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: textTitle.trim(),
          content: textContent.trim(),
          visibility: textVisibility,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTextTitle('');
      setTextContent('');
      setStatusMessage('Text source added. Please review and approve.');
      await refresh();
    } catch (e) {
      setError(`Failed to add text source: ${(e as Error).message}`);
      setStatusMessage('');
    }
  }

  async function handleCreateFaq(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !faqQuestion.trim() || !faqAnswer.trim()) return;
    setStatusMessage('Creating FAQ entry...');
    setError('');
    const tags = faqTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    try {
      const res = await fetch(`/api/backend/organizations/${orgId}/knowledge/faq`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          question: faqQuestion.trim(),
          answer: faqAnswer.trim(),
          tags,
          visibility: faqVisibility,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setFaqQuestion('');
      setFaqAnswer('');
      setFaqTags('');
      setStatusMessage('FAQ added. Please review and approve.');
      await refresh();
    } catch (e) {
      setError(`Failed to add FAQ: ${(e as Error).message}`);
      setStatusMessage('');
    }
  }

  async function handleFileUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !fileTitle.trim() || !fileContent.trim()) return;
    setStatusMessage('Uploading document...');
    setError('');
    try {
      const createRes = await fetch(`/api/backend/organizations/${orgId}/knowledge/uploads`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: fileTitle.trim(), contentType: 'text/plain' }),
      });
      if (!createRes.ok) throw new Error(`Upload create HTTP ${createRes.status}`);
      const created = await createRes.json();

      const putRes = await fetch(`/api/backend/organizations/${orgId}/knowledge/blob-put`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          objectKey: created.upload.objectKey,
          contentType: 'text/plain',
          text: fileContent,
        }),
      });
      if (!putRes.ok) throw new Error(`Blob put HTTP ${putRes.status}`);

      const finRes = await fetch(
        `/api/backend/organizations/${orgId}/knowledge/documents/${created.documentId}/finalize`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ versionId: created.versionId }),
        },
      );
      if (!finRes.ok) throw new Error(`Finalize HTTP ${finRes.status}`);

      setFileTitle('');
      setFileContent('');
      setStatusMessage('Document uploaded and queued for processing.');
      await refresh();
    } catch (e) {
      setError(`File ingestion failed: ${(e as Error).message}`);
      setStatusMessage('');
    }
  }

  async function actOnVersion(documentId: string, versionId: string, action: 'approve' | 'publish') {
    setError('');
    try {
      const res = await fetch(
        `/api/backend/organizations/${orgId}/knowledge/documents/${documentId}/versions/${versionId}/${action}`,
        { method: 'POST' },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refresh();
    } catch (e) {
      setError(`Action ${action} failed: ${(e as Error).message}`);
    }
  }

  async function actOnDoc(documentId: string, action: 'unpublish' | 'archive' | 'reprocess') {
    setError('');
    try {
      const res = await fetch(
        `/api/backend/organizations/${orgId}/knowledge/documents/${documentId}/${action}`,
        { method: 'POST' },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refresh();
    } catch (e) {
      setError(`Action ${action} failed: ${(e as Error).message}`);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !searchQuery.trim()) return;
    setSearchLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/backend/organizations/${orgId}/knowledge/search`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: searchQuery.trim(), limit: 5 }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSearchResults(data.results ?? []);
    } catch (e) {
      setError(`Search preview failed: ${(e as Error).message}`);
    } finally {
      setSearchLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 960, margin: '2rem auto', padding: '0 1.5rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <OperatorNav current="/knowledge" />

      <header style={{ marginBottom: '2rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#111827' }}>
              Knowledge Base · مركز المعرفة
            </h1>
            <p style={{ margin: 0, color: '#4b5563', fontSize: '0.95rem', maxWidth: 680 }}>
              Teach your assistant approved business explanations, FAQs, and preparation guides.
              Knowledge provides explanatory context only; structured catalog prices, offers, and policies strictly govern.
            </p>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: '#6b7280', display: 'block', marginBottom: 4 }}>
              Organization ID
            </label>
            <input
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              placeholder="UUID"
              style={{
                fontSize: '0.875rem',
                padding: '0.4rem 0.6rem',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontFamily: 'monospace',
                width: 260,
              }}
            />
          </div>
        </div>
      </header>

      {error ? (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          {error}
        </div>
      ) : null}

      {statusMessage ? (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          {statusMessage}
        </div>
      ) : null}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e5e7eb', marginBottom: '1.5rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('text')}
          style={{
            padding: '0.6rem 1.2rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'text' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'text' ? '#2563eb' : '#4b5563',
            fontWeight: activeTab === 'text' ? 600 : 400,
            cursor: 'pointer',
          }}
        >
          ✍️ Add Text Guide
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('faq')}
          style={{
            padding: '0.6rem 1.2rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'faq' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'faq' ? '#2563eb' : '#4b5563',
            fontWeight: activeTab === 'faq' ? 600 : 400,
            cursor: 'pointer',
          }}
        >
          ❓ Add FAQ
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('file')}
          style={{
            padding: '0.6rem 1.2rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'file' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'file' ? '#2563eb' : '#4b5563',
            fontWeight: activeTab === 'file' ? 600 : 400,
            cursor: 'pointer',
          }}
        >
          📄 Upload Document
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('test')}
          style={{
            padding: '0.6rem 1.2rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'test' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'test' ? '#2563eb' : '#4b5563',
            fontWeight: activeTab === 'test' ? 600 : 400,
            cursor: 'pointer',
          }}
        >
          🔍 Test Search / Preview
        </button>
      </div>

      {/* Form Area */}
      <section style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1.25rem', marginBottom: '2rem' }}>
        {activeTab === 'text' && (
          <form onSubmit={handleCreateText}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#111827' }}>Add Plain Text Guide</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Title</label>
                <input
                  value={textTitle}
                  onChange={(e) => setTextTitle(e.target.value)}
                  placeholder="e.g. Preparation & Arrival Instructions"
                  required
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 6 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Visibility</label>
                <select
                  value={textVisibility}
                  onChange={(e) => setTextVisibility(e.target.value as 'CUSTOMER_VISIBLE' | 'INTERNAL_ONLY')}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 6 }}
                >
                  <option value="CUSTOMER_VISIBLE">Customer Visible</option>
                  <option value="INTERNAL_ONLY">Internal Only</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Content</label>
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={6}
                placeholder="Enter detailed guide, directions, or explanatory content..."
                required
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit' }}
              />
            </div>
            <button
              type="submit"
              disabled={!orgId || !textTitle.trim() || !textContent.trim()}
              style={{
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                padding: '0.5rem 1.25rem',
                borderRadius: 6,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Save Text Source
            </button>
          </form>
        )}

        {activeTab === 'faq' && (
          <form onSubmit={handleCreateFaq}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#111827' }}>Add Frequently Asked Question</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Question</label>
                <input
                  value={faqQuestion}
                  onChange={(e) => setFaqQuestion(e.target.value)}
                  placeholder="e.g. Do you have on-site parking?"
                  required
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 6 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Tags (comma-separated)</label>
                <input
                  value={faqTags}
                  onChange={(e) => setFaqTags(e.target.value)}
                  placeholder="parking, location, facilities"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 6 }}
                />
              </div>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Answer</label>
              <textarea
                value={faqAnswer}
                onChange={(e) => setFaqAnswer(e.target.value)}
                rows={4}
                placeholder="e.g. Yes, customer parking is free behind the clinic..."
                required
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit' }}
              />
            </div>
            <button
              type="submit"
              disabled={!orgId || !faqQuestion.trim() || !faqAnswer.trim()}
              style={{
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                padding: '0.5rem 1.25rem',
                borderRadius: 6,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Save FAQ
            </button>
          </form>
        )}

        {activeTab === 'file' && (
          <form onSubmit={handleFileUpload}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#111827' }}>Upload Text Document</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Document Title</label>
              <input
                value={fileTitle}
                onChange={(e) => setFileTitle(e.target.value)}
                placeholder="e.g. Aftercare Policy & Manual"
                required
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 6 }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Document Content</label>
              <textarea
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                rows={6}
                placeholder="Paste raw text or document content..."
                required
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit' }}
              />
            </div>
            <button
              type="submit"
              disabled={!orgId || !fileTitle.trim() || !fileContent.trim()}
              style={{
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                padding: '0.5rem 1.25rem',
                borderRadius: 6,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Upload & Ingest
            </button>
          </form>
        )}

        {activeTab === 'test' && (
          <div>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#111827' }}>Test Knowledge Base Retrieval</h3>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0 0 1rem 0' }}>
              Execute semantic similarity search over active published knowledge to verify retrieved chunks and confidence scores.
            </p>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ask a question (e.g. هل يوجد موقف سيارات؟)..."
                required
                style={{ flex: 1, padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 6 }}
              />
              <button
                type="submit"
                disabled={searchLoading || !searchQuery.trim()}
                style={{
                  background: '#059669',
                  color: '#fff',
                  border: 'none',
                  padding: '0.5rem 1.25rem',
                  borderRadius: 6,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {searchLoading ? 'Searching...' : 'Search'}
              </button>
            </form>

            {searchResults.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>
                  Found {searchResults.length} matching published chunks:
                </div>
                {searchResults.map((r) => (
                  <div key={r.chunkId} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.8rem' }}>
                      <span style={{ fontWeight: 600, color: '#1f2937' }}>{r.title}</span>
                      <span style={{ color: '#059669', fontWeight: 600 }}>
                        Similarity: {(r.similarity * 100).toFixed(1)}% (Distance: {r.distance.toFixed(4)})
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#4b5563', whiteSpace: 'pre-wrap' }}>{r.excerpt}</p>
                  </div>
                ))}
              </div>
            ) : searchQuery && !searchLoading ? (
              <p style={{ fontSize: '0.875rem', color: '#6b7280', fontStyle: 'italic' }}>
                No published chunks matched the query above minimum relevance threshold.
              </p>
            ) : null}
          </div>
        )}
      </section>

      {/* Document Library Table */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0, color: '#111827' }}>
            Knowledge Documents ({docs.length})
          </h2>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            style={{
              background: 'none',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              padding: '0.35rem 0.75rem',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            {loading ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>

        {docs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#f9fafb', borderRadius: 8, color: '#6b7280', border: '1px dashed #d1d5db' }}>
            No knowledge sources added yet. Use the tabs above to add text guides, FAQs, or upload documents.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {docs.map((d) => {
              const latest = d.versions?.[0];
              const isPublished = !!d.activePublishedVersionId;
              const isArchived = !!d.archivedAt;
              const isExpanded = expandedDocId === d.id;

              return (
                <div
                  key={d.id}
                  style={{
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: '1rem 1.25rem',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: '1rem', color: '#111827' }}>{d.title}</span>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: '#e0e7ff',
                            color: '#3730a3',
                          }}
                        >
                          {d.sourceType ?? 'FILE'}
                        </span>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: isPublished ? '#dcfce7' : isArchived ? '#f3f4f6' : '#fef9c3',
                            color: isPublished ? '#166534' : isArchived ? '#4b5563' : '#854d0e',
                          }}
                        >
                          {isPublished ? '● PUBLISHED' : isArchived ? 'ARCHIVED' : latest?.pipelineStatus ?? 'DRAFT'}
                        </span>
                        {d.visibility === 'INTERNAL_ONLY' && (
                          <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: '#fee2e2', color: '#991b1b' }}>
                            INTERNAL ONLY
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 4 }}>
                        Created: {new Date(d.createdAt).toLocaleDateString()}
                        {latest ? ` · Version ${latest.versionNumber} (Review: ${latest.reviewStatus})` : ''}
                        {latest?.expectedChunkCount ? ` · ${latest.expectedChunkCount} chunks` : ''}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {latest && latest.pipelineStatus === 'AWAITING_REVIEW' && latest.reviewStatus === 'PENDING' && (
                        <button
                          type="button"
                          onClick={() => void actOnVersion(d.id, latest.id, 'approve')}
                          style={{
                            background: '#2563eb',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                          }}
                        >
                          Approve Review
                        </button>
                      )}

                      {latest && latest.pipelineStatus === 'READY' && latest.reviewStatus === 'APPROVED' && !isPublished && !isArchived && (
                        <button
                          type="button"
                          onClick={() => void actOnVersion(d.id, latest.id, 'publish')}
                          style={{
                            background: '#059669',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                          }}
                        >
                          Publish to Assistant
                        </button>
                      )}

                      {isPublished && (
                        <button
                          type="button"
                          onClick={() => void actOnDoc(d.id, 'unpublish')}
                          style={{
                            background: '#fff',
                            color: '#b45309',
                            border: '1px solid #fcd34d',
                            borderRadius: 6,
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                          }}
                        >
                          Unpublish
                        </button>
                      )}

                      {latest?.pipelineStatus === 'FAILED' && (
                        <button
                          type="button"
                          onClick={() => void actOnDoc(d.id, 'reprocess')}
                          style={{
                            background: '#fff',
                            color: '#2563eb',
                            border: '1px solid #93c5fd',
                            borderRadius: 6,
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                          }}
                        >
                          Reprocess
                        </button>
                      )}

                      {!isArchived && (
                        <button
                          type="button"
                          onClick={() => void actOnDoc(d.id, 'archive')}
                          style={{
                            background: '#fff',
                            color: '#dc2626',
                            border: '1px solid #fca5a5',
                            borderRadius: 6,
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                          }}
                        >
                          Archive
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setExpandedDocId(isExpanded ? null : d.id)}
                        style={{
                          background: 'none',
                          color: '#4b5563',
                          border: '1px solid #d1d5db',
                          borderRadius: 6,
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                        }}
                      >
                        {isExpanded ? 'Hide Details' : 'View Details'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded text content preview */}
                  {isExpanded && latest?.extractedText && (
                    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #f3f4f6' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>
                        Extracted / Normalized Content:
                      </div>
                      <pre
                        style={{
                          background: '#f8fafc',
                          padding: '0.75rem',
                          borderRadius: 6,
                          fontSize: '0.8rem',
                          color: '#334155',
                          overflowX: 'auto',
                          whiteSpace: 'pre-wrap',
                          maxHeight: 200,
                          margin: 0,
                          fontFamily: 'monospace',
                        }}
                      >
                        {latest.extractedText}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
