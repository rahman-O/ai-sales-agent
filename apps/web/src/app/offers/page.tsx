'use client';

import { useCallback, useEffect, useState } from 'react';
import { OperatorNav } from '@/client/navigation/OperatorNav';
import { CapabilityGuard } from '@/shared/capabilities/CapabilityGuard';
import type {
  CatalogItemDto,
  OfferDto,
  OfferEligibility,
  OfferType,
} from '@ai-sales-agent/contracts';

export default function OffersPage() {
  const [orgId, setOrgId] = useState('');
  const [offers, setOffers] = useState<OfferDto[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItemDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isArabic, setIsArabic] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formOfferType, setFormOfferType] = useState<OfferType>('PERCENTAGE_DISCOUNT');
  const [formDiscountPercentage, setFormDiscountPercentage] = useState<number>(15);
  const [formDiscountAmountMinor, setFormDiscountAmountMinor] = useState('10000');
  const [formCurrency, setFormCurrency] = useState('IQD');
  const [formStartsAt, setFormStartsAt] = useState('');
  const [formEndsAt, setFormEndsAt] = useState('');
  const [formPriority, setFormPriority] = useState<number>(0);
  const [formStackable, setFormStackable] = useState(false);
  const [formEligibility, setFormEligibility] = useState<OfferEligibility>('ANY_CUSTOMER');
  const [formTargetIds, setFormTargetIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchAuthMe = useCallback(async () => {
    try {
      const res = await fetch('/api/backend/me');
      if (res.ok) {
        const data = await res.json();
        if (data.activeOrganizationId) {
          setOrgId(data.activeOrganizationId);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError('');
    try {
      const [offersRes, catalogRes] = await Promise.all([
        fetch(`/api/backend/organizations/${orgId}/offers`),
        fetch(`/api/backend/organizations/${orgId}/catalog/items`),
      ]);

      if (offersRes.ok) {
        const data = await offersRes.json();
        setOffers(data.items ?? []);
      } else {
        setError(`Failed to load offers: HTTP ${offersRes.status}`);
      }

      if (catalogRes.ok) {
        const data = await catalogRes.json();
        setCatalogItems(data.items ?? []);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void fetchAuthMe();
  }, [fetchAuthMe]);

  useEffect(() => {
    if (orgId) {
      void refresh();
    }
  }, [orgId, refresh]);

  async function handleCreateOffer(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !formName.trim()) return;
    setSubmitting(true);
    setError('');

    try {
      const payload: Record<string, unknown> = {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        offerType: formOfferType,
        priority: Number(formPriority) || 0,
        stackable: formStackable,
        eligibility: formEligibility,
        targetCatalogItemIds: formTargetIds,
      };

      if (formOfferType === 'PERCENTAGE_DISCOUNT') {
        payload.discountPercentage = Number(formDiscountPercentage);
      } else if (formOfferType === 'FIXED_DISCOUNT' || formOfferType === 'FIXED_PRICE') {
        payload.discountAmountMinor = formDiscountAmountMinor;
        payload.currency = formCurrency;
      }

      if (formStartsAt) payload.startsAt = new Date(formStartsAt).toISOString();
      if (formEndsAt) payload.endsAt = new Date(formEndsAt).toISOString();

      const res = await fetch(`/api/backend/organizations/${orgId}/offers`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message ?? `HTTP ${res.status}`);
      }

      setShowCreateModal(false);
      // Reset form
      setFormName('');
      setFormDescription('');
      setFormTargetIds([]);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(offerId: string, action: 'activate' | 'pause' | 'archive') {
    if (!orgId) return;
    try {
      const res = await fetch(`/api/backend/organizations/${orgId}/offers/${offerId}/${action}`, {
        method: 'POST',
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message ?? `Action failed: ${res.status}`);
      }
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'ACTIVE':
        return <span style={{ background: '#059669', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>{isArabic ? 'نشط' : 'ACTIVE'}</span>;
      case 'PAUSED':
        return <span style={{ background: '#d97706', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>{isArabic ? 'متوقف مؤقتاً' : 'PAUSED'}</span>;
      case 'ARCHIVED':
        return <span style={{ background: '#6b7280', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>{isArabic ? 'مؤرشف' : 'ARCHIVED'}</span>;
      case 'DRAFT':
      default:
        return <span style={{ background: '#4b5563', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>{isArabic ? 'مسودة' : 'DRAFT'}</span>;
    }
  }

  function formatDiscount(offer: OfferDto) {
    if (offer.offerType === 'PERCENTAGE_DISCOUNT' && offer.discountPercentage) {
      return `${offer.discountPercentage}% OFF`;
    }
    if (offer.offerType === 'FIXED_DISCOUNT' && offer.discountAmountMinor) {
      return `${Number(offer.discountAmountMinor).toLocaleString()} ${offer.currency ?? ''} OFF`;
    }
    if (offer.offerType === 'FIXED_PRICE' && offer.discountAmountMinor) {
      return `Special Price: ${Number(offer.discountAmountMinor).toLocaleString()} ${offer.currency ?? ''}`;
    }
    return isArabic ? 'عرض ترويجي' : 'Promotional';
  }

  return (
    <CapabilityGuard organizationId={orgId} requiredCapability="supportsOffers" pathname="/offers">
      <main
        dir={isArabic ? 'rtl' : 'ltr'}
        style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          maxWidth: 960,
          margin: '2rem auto',
          padding: '0 1.5rem',
          color: '#111827',
        }}
      >
        <OperatorNav current="/offers" orgId={orgId} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 700, margin: 0 }}>
              {isArabic ? 'العروض والخصومات' : 'Offers & Promotions'}
            </h1>
            <p style={{ color: '#4b5563', margin: '0.25rem 0 0 0', fontSize: '0.95rem' }}>
              {isArabic
                ? 'إدارة العروض الترويجية والخصومات المطبقة على عناصر الكتالوج.'
                : 'Manage structured promotional offers, discounts, and campaigns.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              onClick={() => setIsArabic(!isArabic)}
              style={{
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                padding: '0.5rem 0.85rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              {isArabic ? 'English' : 'العربية'}
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                padding: '0.55rem 1.15rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              }}
            >
              {isArabic ? '+ إنشاء عرض جديد' : '+ Create Offer'}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', border: '1px solid #ef4444', color: '#991b1b', borderRadius: '6px', marginBottom: '1.25rem', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.35rem' }}>
            {isArabic ? 'معرف المنظمة:' : 'Organization ID:'}
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              placeholder="e.g. a0111111-1111-4111-8111-111111111111"
              style={{ flex: 1, padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem' }}
            />
            <button
              onClick={() => void refresh()}
              style={{ background: '#f3f4f6', border: '1px solid #d1d5db', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
            >
              {isArabic ? 'تحديث' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Offers List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
            {isArabic ? 'جاري تحميل العروض...' : 'Loading offers...'}
          </div>
        ) : offers.length === 0 ? (
          <div style={{ background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: '8px', padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
            <p style={{ margin: 0, fontSize: '1rem', fontWeight: 500 }}>
              {isArabic ? 'لا توجد عروض ترويجية نشطة حالياً.' : 'No promotional offers found.'}
            </p>
            <p style={{ margin: '0.5rem 0 1.25rem 0', fontSize: '0.875rem' }}>
              {isArabic ? 'أنشئ أول عرض لتمكين المساعد من اقتراح الخصومات للعملاء.' : 'Create an offer to enable the AI assistant to quote promotional pricing.'}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
            >
              {isArabic ? 'إنشاء عرض الآن' : 'Create Offer Now'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {offers.map((offer) => (
              <div
                key={offer.id}
                style={{
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '1.25rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0, paddingRight: isArabic ? 0 : '1rem', paddingLeft: isArabic ? '1rem' : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{offer.name}</h3>
                    {getStatusBadge(offer.status)}
                    <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>
                      {formatDiscount(offer)}
                    </span>
                  </div>

                  {offer.description && (
                    <p style={{ color: '#4b5563', fontSize: '0.875rem', margin: '0.25rem 0 0.5rem 0' }}>
                      {offer.description}
                    </p>
                  )}

                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8rem', color: '#6b7280', marginTop: '0.5rem' }}>
                    <span>
                      <strong>{isArabic ? 'الأهداف:' : 'Target:'}</strong>{' '}
                      {offer.targetCatalogItems && offer.targetCatalogItems.length > 0
                        ? offer.targetCatalogItems.map((t) => t.catalogItemName ?? t.catalogItemId.slice(0, 8)).join(', ')
                        : isArabic
                        ? 'كافة الكتالوج (عام)'
                        : 'All Catalog (Store-wide)'}
                    </span>
                    {offer.startsAt && (
                      <span>
                        <strong>{isArabic ? 'يبدأ:' : 'Starts:'}</strong> {new Date(offer.startsAt).toLocaleDateString()}
                      </span>
                    )}
                    {offer.endsAt && (
                      <span>
                        <strong>{isArabic ? 'ينتهي:' : 'Ends:'}</strong> {new Date(offer.endsAt).toLocaleDateString()}
                      </span>
                    )}
                    <span>
                      <strong>{isArabic ? 'الأهلية:' : 'Eligibility:'}</strong> {offer.eligibility}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                  {offer.status === 'PAUSED' && (
                    <button
                      onClick={() => void handleStatusChange(offer.id, 'activate')}
                      style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '0.35rem 0.65rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 }}
                    >
                      {isArabic ? 'تفعيل' : 'Activate'}
                    </button>
                  )}
                  {offer.status === 'ACTIVE' && (
                    <button
                      onClick={() => void handleStatusChange(offer.id, 'pause')}
                      style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', padding: '0.35rem 0.65rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 }}
                    >
                      {isArabic ? 'إيقاف مؤقت' : 'Pause'}
                    </button>
                  )}
                  {offer.status !== 'ARCHIVED' && (
                    <button
                      onClick={() => void handleStatusChange(offer.id, 'archive')}
                      style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', padding: '0.35rem 0.65rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 }}
                    >
                      {isArabic ? 'أرشفة' : 'Archive'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              zIndex: 100,
            }}
          >
            <div
              dir={isArabic ? 'rtl' : 'ltr'}
              style={{
                background: '#fff',
                borderRadius: '8px',
                maxWidth: 580,
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: '1.5rem',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700 }}>
                  {isArabic ? 'إنشاء عرض ترويجي جديد' : 'Create New Offer'}
                </h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  style={{ background: 'transparent', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#9ca3af' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateOffer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    {isArabic ? 'اسم العرض *' : 'Offer Name *'}
                  </label>
                  <input
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder={isArabic ? 'مثال: خصم افتتاح العيادة 20%' : 'e.g. Summer Special 20% Off'}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    {isArabic ? 'الوصف' : 'Description'}
                  </label>
                  <textarea
                    rows={2}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder={isArabic ? 'وصف العرض وشروطه...' : 'Offer details and terms...'}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                      {isArabic ? 'نوع الخصم *' : 'Offer Type *'}
                    </label>
                    <select
                      value={formOfferType}
                      onChange={(e) => setFormOfferType(e.target.value as OfferType)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                    >
                      <option value="PERCENTAGE_DISCOUNT">{isArabic ? 'نسبة مئوية (%)' : 'Percentage Discount (%)'}</option>
                      <option value="FIXED_DISCOUNT">{isArabic ? 'مبلغ خصم ثابت' : 'Fixed Discount'}</option>
                      <option value="FIXED_PRICE">{isArabic ? 'سعر خاص محدد' : 'Fixed Special Price'}</option>
                      <option value="INFORMATIONAL">{isArabic ? 'إعلامي فقط' : 'Informational'}</option>
                    </select>
                  </div>

                  {formOfferType === 'PERCENTAGE_DISCOUNT' ? (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                        {isArabic ? 'نسبة الخصم (1-100) *' : 'Discount Percentage (1-100) *'}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        required
                        value={formDiscountPercentage}
                        onChange={(e) => setFormDiscountPercentage(Number(e.target.value))}
                        style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                      />
                    </div>
                  ) : formOfferType === 'FIXED_DISCOUNT' || formOfferType === 'FIXED_PRICE' ? (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                        {isArabic ? 'المبلغ بالوحدات الصغرى *' : 'Amount (Minor units) *'}
                      </label>
                      <input
                        type="text"
                        required
                        value={formDiscountAmountMinor}
                        onChange={(e) => setFormDiscountAmountMinor(e.target.value)}
                        placeholder="e.g. 15000"
                        style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                      />
                    </div>
                  ) : null}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    {isArabic ? 'العناصر المستهدفة بالكتالوج' : 'Targeted Catalog Items'}
                  </label>
                  <select
                    multiple
                    value={formTargetIds}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
                      setFormTargetIds(selected);
                    }}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', minHeight: 80 }}
                  >
                    {catalogItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.kind})
                      </option>
                    ))}
                  </select>
                  <small style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                    {isArabic
                      ? 'اترك بدون تحديد لتطبيق العرض على كامل المتجر/الخدمات.'
                      : 'Leave unselected to apply offer organization-wide.'}
                  </small>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                      {isArabic ? 'تاريخ البدء' : 'Start Date'}
                    </label>
                    <input
                      type="datetime-local"
                      value={formStartsAt}
                      onChange={(e) => setFormStartsAt(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                      {isArabic ? 'تاريخ الانتهاء' : 'End Date'}
                    </label>
                    <input
                      type="datetime-local"
                      value={formEndsAt}
                      onChange={(e) => setFormEndsAt(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                      {isArabic ? 'أهلية العملاء' : 'Customer Eligibility'}
                    </label>
                    <select
                      value={formEligibility}
                      onChange={(e) => setFormEligibility(e.target.value as OfferEligibility)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                    >
                      <option value="ANY_CUSTOMER">{isArabic ? 'كافة العملاء' : 'Any Customer'}</option>
                      <option value="NEW_CUSTOMER">{isArabic ? 'العملاء الجدد فقط' : 'New Customers Only'}</option>
                      <option value="EXISTING_CUSTOMER">{isArabic ? 'العملاء الحاليين فقط' : 'Existing Customers Only'}</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                      {isArabic ? 'الأولوية (0-1000)' : 'Priority (0-1000)'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      value={formPriority}
                      onChange={(e) => setFormPriority(Number(e.target.value))}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <input
                    type="checkbox"
                    id="formStackable"
                    checked={formStackable}
                    onChange={(e) => setFormStackable(e.target.checked)}
                  />
                  <label htmlFor="formStackable" style={{ fontSize: '0.875rem', cursor: 'pointer' }}>
                    {isArabic ? 'قابل للدمج مع عروض أخرى (Stackable)' : 'Can combine with other offers (Stackable)'}
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    style={{ background: '#f3f4f6', border: '1px solid #d1d5db', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
                  >
                    {isArabic ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 1.25rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    {submitting ? (isArabic ? 'جاري الحفظ...' : 'Saving...') : isArabic ? 'حفظ العرض' : 'Save Offer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </CapabilityGuard>
  );
}
