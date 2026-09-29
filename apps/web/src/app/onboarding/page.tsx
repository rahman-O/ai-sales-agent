'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BUSINESS_TYPE_PRESETS,
  DEFAULT_ORGANIZATION_CAPABILITIES,
  ONBOARDING_STEPS,
  type OnboardingReadinessDto,
  type OnboardingStepName,
  type OrganizationCapabilitiesDto,
  type OrganizationOnboardingDto,
  type OrganizationProfileDto,
  type PackPreviewDto,
} from '@ai-sales-agent/contracts';

type StepNumber = 1 | 2 | 3 | 4 | 5;

const STEP_TITLES: Record<StepNumber, { en: string; ar: string; name: OnboardingStepName }> = {
  1: { en: 'Business Identity', ar: 'هوية النشاط التجاري', name: 'IDENTITY' },
  2: { en: 'What Should Your AI Do?', ar: 'ماذا يجب أن يفعل المساعد الذكي؟', name: 'CAPABILITIES' },
  3: { en: 'Basic Setup', ar: 'الإعداد الأساسي', name: 'BASIC_SETUP' },
  4: { en: 'Business Operations', ar: 'العمليات التشغيلية', name: 'OPERATIONS' },
  5: { en: 'Review & Finish', ar: 'المراجعة والإنهاء', name: 'REVIEW' },
};

export default function OnboardingPage() {
  const router = useRouter();
  const [orgId, setOrgId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [langRtl, setLangRtl] = useState(false);

  // Wizard state
  const [currentStep, setCurrentStep] = useState<StepNumber>(1);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [onboardingStatus, setOnboardingStatus] = useState<'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'>('NOT_STARTED');

  // Step 1: Business Identity
  const [displayName, setDisplayName] = useState('');
  const [businessType, setBusinessType] = useState('CLINIC_HEALTHCARE');
  const [description, setDescription] = useState('');
  const [country, setCountry] = useState('IQ');
  const [timezone, setTimezone] = useState('Asia/Baghdad');
  const [defaultLanguage, setDefaultLanguage] = useState('ar');
  const [defaultCurrency, setDefaultCurrency] = useState('IQD');

  // Step 2: Capabilities
  const [capabilities, setCapabilities] = useState({
    ...DEFAULT_ORGANIZATION_CAPABILITIES,
  });

  // Step 5 / Live Readiness
  const [readiness, setReadiness] = useState<OnboardingReadinessDto | null>(null);

  // Business Pack state
  const [packPreview, setPackPreview] = useState<PackPreviewDto | null>(null);
  const [packLoading, setPackLoading] = useState(false);
  const [packApplied, setPackApplied] = useState(false);

  const getPackIdForBusinessType = (type: string): string | null => {
    switch (type) {
      case 'CLINIC_HEALTHCARE':
        return 'CLINIC';
      case 'SALON_BEAUTY':
        return 'SALON';
      case 'REAL_ESTATE':
        return 'REAL_ESTATE';
      case 'RESTAURANT_FOOD':
        return 'RESTAURANT';
      case 'PROFESSIONAL_SERVICES':
        return 'PROFESSIONAL_SERVICES';
      default:
        return null;
    }
  };

  const handlePreviewPack = async (packId: string) => {
    if (!orgId) return;
    setPackLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/backend/organizations/${orgId}/packs/${packId}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'PREVIEW_ONLY' }),
      });
      if (!res.ok) {
        throw new Error(`Failed to preview pack (${res.status})`);
      }
      const data = (await res.json()) as PackPreviewDto;
      setPackPreview(data);
    } catch (e: any) {
      setError(e.message || 'Failed to preview pack');
    } finally {
      setPackLoading(false);
    }
  };

  const handleApplyPack = async (packId: string) => {
    if (!orgId) return;
    setPackLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/backend/organizations/${orgId}/packs/${packId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'INITIAL_SETUP' }),
      });
      if (!res.ok) {
        throw new Error(`Failed to apply pack (${res.status})`);
      }
      const data = await res.json();
      setPackApplied(true);
      setSuccessMsg(
        langRtl ? `تم تطبيق حزمة ${data.packId} بنجاح!` : `Pack ${data.packId} applied successfully!`,
      );
      await loadState(orgId);
    } catch (e: any) {
      setError(e.message || 'Failed to apply pack');
    } finally {
      setPackLoading(false);
    }
  };

  // Load initial organization onboarding state
  const loadState = useCallback(async (targetOrgId: string) => {
    if (!targetOrgId.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/backend/organizations/${targetOrgId}/onboarding`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        setError(`Failed to load onboarding state (${res.status})`);
        return;
      }
      const data = (await res.json()) as {
        onboarding: OrganizationOnboardingDto;
        profile: OrganizationProfileDto | null;
        capabilities: OrganizationCapabilitiesDto;
        readiness: OnboardingReadinessDto;
      };

      setOnboardingStatus(data.onboarding.status);
      setCompletedSteps(data.onboarding.completedSteps || []);
      setReadiness(data.readiness);

      if (data.profile) {
        setDisplayName(data.profile.displayName || '');
        if (data.profile.businessType) setBusinessType(data.profile.businessType);
        setDescription(data.profile.description || '');
        if (data.profile.country) setCountry(data.profile.country);
        if (data.profile.timezone) setTimezone(data.profile.timezone);
        if (data.profile.defaultLanguage) {
          setDefaultLanguage(data.profile.defaultLanguage);
          setLangRtl(data.profile.defaultLanguage === 'ar');
        }
        if (data.profile.defaultCurrency) setDefaultCurrency(data.profile.defaultCurrency);
      }

      if (data.capabilities) {
        setCapabilities({
          supportsLeads: data.capabilities.supportsLeads,
          leadRequiredBeforeBooking: data.capabilities.leadRequiredBeforeBooking,
          autoCreateLeadOnIntent: data.capabilities.autoCreateLeadOnIntent,
          supportsBooking: data.capabilities.supportsBooking,
          supportsOffers: data.capabilities.supportsOffers,
          supportsQuotes: data.capabilities.supportsQuotes,
          supportsOrders: data.capabilities.supportsOrders,
          supportsInventory: data.capabilities.supportsInventory,
          supportsStaff: data.capabilities.supportsStaff,
          supportsLocations: data.capabilities.supportsLocations,
          supportsProducts: data.capabilities.supportsProducts,
          supportsServices: data.capabilities.supportsServices,
          supportsListings: data.capabilities.supportsListings,
        });
      }

      // Resume step
      const stepIndex = ONBOARDING_STEPS.indexOf(data.onboarding.currentStep as OnboardingStepName);
      if (stepIndex >= 0 && stepIndex < 5) {
        setCurrentStep((stepIndex + 1) as StepNumber);
      }
    } catch {
      setError('Network error loading onboarding state');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Check url search params or storage for orgId
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const qOrg = params.get('orgId') || localStorage.getItem('ai_sales_org_id') || '';
      if (qOrg) {
        setOrgId(qOrg);
        void loadState(qOrg);
      }
    }
  }, [loadState]);

  const applyBusinessTypeSuggestion = (typeId: string) => {
    setBusinessType(typeId);
    const preset = BUSINESS_TYPE_PRESETS.find((p) => p.id === typeId);
    if (preset?.suggestedCapabilities) {
      setCapabilities((prev) => ({
        ...prev,
        ...preset.suggestedCapabilities,
      }));
    }
  };

  const saveProgressAndGo = async (nextStep: StepNumber) => {
    if (!orgId.trim()) {
      setError('Please provide an Organization ID');
      return;
    }

    setSaving(true);
    setError('');
    setSuccessMsg('');

    try {
      // 1. Save profile if on step 1
      if (currentStep === 1) {
        const profileRes = await fetch(`/api/backend/organizations/${orgId}/profile`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName,
            businessType,
            description,
            country,
            timezone,
            defaultLanguage,
            defaultCurrency,
          }),
        });
        if (!profileRes.ok) {
          const errData = await profileRes.json().catch(() => ({}));
          throw new Error(errData.message || 'Failed to save business profile');
        }
      }

      // 2. Save capabilities if on step 2
      if (currentStep === 2) {
        const capsRes = await fetch(`/api/backend/organizations/${orgId}/capabilities`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(capabilities),
        });
        if (!capsRes.ok) {
          const errData = await capsRes.json().catch(() => ({}));
          throw new Error(errData.message || 'Failed to save capabilities');
        }
      }

      // 3. Update persistent onboarding progress
      const currentStepName = STEP_TITLES[currentStep].name;
      const nextStepName = STEP_TITLES[nextStep].name;
      const newCompleted = Array.from(new Set([...completedSteps, currentStepName]));

      const progRes = await fetch(`/api/backend/organizations/${orgId}/onboarding-progress`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentStep: nextStepName,
          completedSteps: newCompleted,
          status: 'IN_PROGRESS',
        }),
      });

      if (!progRes.ok) {
        const errData = await progRes.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to update progress');
      }

      setCompletedSteps(newCompleted);
      setCurrentStep(nextStep);

      // Re-fetch state & readiness
      await loadState(orgId);
    } catch (err: any) {
      setError(err.message || 'Failed to save step');
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteOnboarding = async () => {
    if (!orgId.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/backend/organizations/${orgId}/onboarding/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to complete onboarding');
      }

      setOnboardingStatus('COMPLETED');
      setSuccessMsg(langRtl ? 'تم إكمال الإعداد بنجاح! جارٍ التحويل...' : 'Onboarding completed successfully! Redirecting...');
      setTimeout(() => {
        router.push(`/dashboard?orgId=${encodeURIComponent(orgId)}`);
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Onboarding completion error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main
      dir={langRtl ? 'rtl' : 'ltr'}
      style={{
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        maxWidth: 860,
        margin: '0 auto',
        padding: '24px 16px',
        color: '#1e293b',
      }}
    >
      {/* Header */}
      <header
        style={{
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: 16,
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0f172a' }}>
            {langRtl ? 'إعداد النشاط التجاري الذكي' : 'Business AI Onboarding'}
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>
            {langRtl
              ? 'قم بتهيئة مساعدك الذكي لتناسب متطلبات عملك وعملائك بدقة.'
              : 'Configure your multi-business AI sales & booking assistant in minutes.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setLangRtl(!langRtl)}
            style={{
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {langRtl ? 'English' : 'عربي'}
          </button>
        </div>
      </header>

      {/* Org ID input if not pre-loaded */}
      <section
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: 16,
          marginBottom: 20,
        }}
      >
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
          {langRtl ? 'معرف المنظمة (Organization ID)' : 'Organization ID'}
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={orgId}
            placeholder="00000000-0000-0000-0000-000000000000"
            onChange={(e) => setOrgId(e.target.value)}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              fontSize: 14,
            }}
          />
          <button
            type="button"
            disabled={!orgId.trim() || loading}
            onClick={() => {
              if (typeof window !== 'undefined') localStorage.setItem('ai_sales_org_id', orgId);
              void loadState(orgId);
            }}
            style={{
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {loading ? (langRtl ? 'جارٍ التحميل...' : 'Loading...') : langRtl ? 'تحميل' : 'Load'}
          </button>
        </div>
      </section>

      {/* Progress Bar & Step Indicators */}
      <nav
        aria-label="Progress"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 24,
          background: '#f8fafc',
          padding: 12,
          borderRadius: 8,
          border: '1px solid #e2e8f0',
          overflowX: 'auto',
          gap: 8,
        }}
      >
        {([1, 2, 3, 4, 5] as StepNumber[]).map((num) => {
          const stepInfo = STEP_TITLES[num];
          const isCurrent = currentStep === num;
          const isDone = completedSteps.includes(stepInfo.name);

          return (
            <button
              key={num}
              type="button"
              onClick={() => {
                if (orgId.trim()) setCurrentStep(num);
              }}
              style={{
                background: isCurrent ? '#2563eb' : isDone ? '#dbeafe' : 'transparent',
                color: isCurrent ? '#ffffff' : isDone ? '#1e40af' : '#64748b',
                border: 'none',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 13,
                fontWeight: isCurrent ? 700 : 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
              }}
            >
              <span>{isDone && !isCurrent ? '✓' : num}.</span>
              <span>{langRtl ? stepInfo.ar : stepInfo.en}</span>
            </button>
          );
        })}
      </nav>

      {/* Alert Banners */}
      {error && (
        <div
          role="alert"
          style={{
            background: '#fee2e2',
            border: '1px solid #f87171',
            borderRadius: 6,
            padding: '10px 14px',
            color: '#991b1b',
            marginBottom: 16,
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          style={{
            background: '#dcfce7',
            border: '1px solid #86efac',
            borderRadius: 6,
            padding: '10px 14px',
            color: '#166534',
            marginBottom: 16,
            fontSize: 14,
          }}
        >
          {successMsg}
        </div>
      )}

      {/* Wizard Step Content */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: 24,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          marginBottom: 24,
        }}
      >
        {/* STEP 1: Business Identity */}
        {currentStep === 1 && (
          <section>
            <h2 style={{ marginTop: 0, fontSize: 20, color: '#0f172a' }}>
              {langRtl ? 'الخطوة 1: هوية النشاط التجاري' : 'Step 1: Business Identity'}
            </h2>
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>
              {langRtl
                ? 'أدخل المعلومات الأساسية لنشاطك التجاري ليتعرف عليها مساعدك الذكي.'
                : 'Provide core business details so your AI assistant accurately represents your brand.'}
            </p>

            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                  {langRtl ? 'اسم النشاط التجاري *' : 'Business Display Name *'}
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={langRtl ? 'مثال: عيادة بغداد لطب الأسنان' : 'e.g. Al-Mansour Dental Clinic'}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                  {langRtl ? 'نوع النشاط التجاري (لاقتراح الإعدادات المناسبة)' : 'Business Type (Suggests defaults)'}
                </label>
                <select
                  value={businessType}
                  onChange={(e) => applyBusinessTypeSuggestion(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                >
                  {BUSINESS_TYPE_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <small style={{ color: '#64748b', display: 'block', marginTop: 4 }}>
                  {BUSINESS_TYPE_PRESETS.find((p) => p.id === businessType)?.description}
                </small>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                  {langRtl ? 'وصف النشاط التجاري' : 'Business Description'}
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={langRtl ? 'وصف مختصر لنشاطك وما تقدمه لعملائك...' : 'Short summary of what your business offers...'}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                    {langRtl ? 'الدولة' : 'Country'}
                  </label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                    {langRtl ? 'المنطقة الزمنية' : 'Timezone'}
                  </label>
                  <input
                    type="text"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                    {langRtl ? 'اللغة الافتراضية' : 'Default Language'}
                  </label>
                  <select
                    value={defaultLanguage}
                    onChange={(e) => {
                      setDefaultLanguage(e.target.value);
                      setLangRtl(e.target.value === 'ar');
                    }}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                  >
                    <option value="ar">العربية (Arabic)</option>
                    <option value="en">English</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                    {langRtl ? 'العملة الافتراضية' : 'Default Currency'}
                  </label>
                  <input
                    type="text"
                    value={defaultCurrency}
                    onChange={(e) => setDefaultCurrency(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              {/* MB-11: Business Pack Starter / Template Suggestion */}
              {getPackIdForBusinessType(businessType) && (
                <div style={{ marginTop: 20, padding: 16, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#0284c7', background: '#e0f2fe', padding: '2px 8px', borderRadius: 4 }}>
                        {langRtl ? 'حزمة مقترحة' : 'Recommended Pack'}
                      </span>
                      <h4 style={{ margin: '6px 0 2px 0', fontSize: 16, color: '#0f172a' }}>
                        {getPackIdForBusinessType(businessType)} Pack Template
                      </h4>
                      <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                        {langRtl
                          ? 'توفير الوقت عبر تهيئة الإمكانيات، مسودات السياسات، بدايات المعرفة، وبنود الكتالوج المناسبة.'
                          : 'Accelerate onboarding with sensible capability defaults, draft policies, knowledge starters, and catalog templates.'}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => handlePreviewPack(getPackIdForBusinessType(businessType)!)}
                        disabled={packLoading}
                        style={{
                          padding: '6px 12px',
                          fontSize: 13,
                          fontWeight: 600,
                          borderRadius: 6,
                          border: '1px solid #cbd5e1',
                          background: '#fff',
                          color: '#334155',
                          cursor: 'pointer',
                        }}
                      >
                        {packLoading ? (langRtl ? 'جاري المعاينة...' : 'Previewing...') : (langRtl ? 'معاينة الإعدادات' : 'Preview Setup')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPack(getPackIdForBusinessType(businessType)!)}
                        disabled={packLoading || packApplied}
                        style={{
                          padding: '6px 12px',
                          fontSize: 13,
                          fontWeight: 600,
                          borderRadius: 6,
                          border: 'none',
                          background: packApplied ? '#10b981' : '#2563eb',
                          color: '#fff',
                          cursor: packApplied ? 'default' : 'pointer',
                        }}
                      >
                        {packApplied
                          ? (langRtl ? 'تم التطبيق ✓' : 'Applied ✓')
                          : (langRtl ? 'تطبيق الحزمة' : 'Apply Pack')}
                      </button>
                    </div>
                  </div>

                  {packPreview && (
                    <div style={{ marginTop: 12, padding: 12, background: '#fff', borderRadius: 6, border: '1px solid #cbd5e1' }}>
                      <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 12, fontWeight: 600, flexWrap: 'wrap' }}>
                        <span style={{ color: '#16a34a' }}>+ {packPreview.summary.willCreate} Will Create</span>
                        <span style={{ color: '#64748b' }}>- {packPreview.summary.willSkip} Skipped</span>
                        <span style={{ color: '#d97706' }}>! {packPreview.summary.conflicts} Conflicts (Safe DRAFT)</span>
                        <span style={{ color: '#0284c7' }}>= {packPreview.summary.noChange} No Change</span>
                      </div>
                      <div style={{ maxHeight: 180, overflowY: 'auto', fontSize: 12 }}>
                        {packPreview.items.map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                            <div>
                              <strong>[{item.category}]</strong> {item.key}
                              {item.reason && <span style={{ color: '#64748b', marginLeft: 6 }}>({item.reason})</span>}
                            </div>
                            <span
                              style={{
                                padding: '2px 6px',
                                borderRadius: 4,
                                fontSize: 10,
                                fontWeight: 700,
                                background:
                                  item.action === 'WILL_CREATE' ? '#dcfce7' :
                                  item.action === 'WILL_SKIP' ? '#f1f5f9' :
                                  item.action === 'CONFLICT' ? '#fef3c7' : '#e0f2fe',
                                color:
                                  item.action === 'WILL_CREATE' ? '#166534' :
                                  item.action === 'WILL_SKIP' ? '#475569' :
                                  item.action === 'CONFLICT' ? '#92400e' : '#0369a1',
                              }}
                            >
                              {item.action}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p style={{ margin: '8px 0 0 0', fontSize: 11, color: '#94a3b8' }}>
                        * Policy, knowledge, and catalog templates default to non-active DRAFT status and will never enforce rules or display fake prices without review.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* STEP 2: What Should Your AI Do? */}
        {currentStep === 2 && (
          <section>
            <h2 style={{ marginTop: 0, fontSize: 20, color: '#0f172a' }}>
              {langRtl ? 'الخطوة 2: ماذا يجب أن يفعل المساعد الذكي؟' : 'Step 2: What Should Your AI Do?'}
            </h2>
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>
              {langRtl
                ? 'اختر الإمكانيات والخدمات التي تريد من المساعد الذكي تقديمها للعملاء.'
                : 'Select the capabilities your AI sales assistant should perform for your customers.'}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 24 }}>
              {/* Card 1: Appointments */}
              <CapabilityCard
                title={langRtl ? 'حجز المواعيد' : 'Book Appointments'}
                desc={langRtl ? 'حجز مواعيد للعملاء واقتراح الأوقات المتاحة وتأكيد الحجز.' : 'Check availability, propose slots, and finalize customer appointments.'}
                enabled={capabilities.supportsBooking}
                onChange={(val) => setCapabilities((p) => ({ ...p, supportsBooking: val }))}
              />

              {/* Card 2: Sales Leads */}
              <CapabilityCard
                title={langRtl ? 'إدارة العملاء المحتملين' : 'Manage Sales Leads'}
                desc={langRtl ? 'جمع بيانات العملاء المؤهلين ومتابعتهم في مسار المبيعات.' : 'Capture qualified leads and nurture potential buyers in your sales pipeline.'}
                enabled={capabilities.supportsLeads}
                onChange={(val) => setCapabilities((p) => ({
                  ...p,
                  supportsLeads: val,
                  leadRequiredBeforeBooking: val ? p.leadRequiredBeforeBooking : false,
                  autoCreateLeadOnIntent: val ? p.autoCreateLeadOnIntent : false,
                }))}
              />

              {/* Card 3: Staff Members */}
              <CapabilityCard
                title={langRtl ? 'العمل مع الكادر / الموظفين' : 'Work with Staff'}
                desc={langRtl ? 'إسناد الحجوزات والمهام لأعضاء فريق عمل محددين.' : 'Assign bookings and responsibilities to specific team members.'}
                enabled={capabilities.supportsStaff}
                onChange={(val) => setCapabilities((p) => ({ ...p, supportsStaff: val }))}
              />

              {/* Card 4: Locations */}
              <CapabilityCard
                title={langRtl ? 'فروع متعددة' : 'Multiple Locations'}
                desc={langRtl ? 'دعم فروع ومواقع جغرافية متعددة لنشاطك.' : 'Support multiple branches, physical clinics, or service locations.'}
                enabled={capabilities.supportsLocations}
                onChange={(val) => setCapabilities((p) => ({ ...p, supportsLocations: val }))}
              />

              {/* Card 5: Standard Services */}
              <CapabilityCard
                title={langRtl ? 'قائمة الخدمات' : 'Offer Services'}
                desc={langRtl ? 'عرض قائمة الخدمات وأسعارها ومددها الزمنية.' : 'Display service menu with pricing and duration.'}
                enabled={capabilities.supportsServices}
                onChange={(val) => setCapabilities((p) => ({ ...p, supportsServices: val }))}
              />

              {/* Future feature cards (Graceful Coming Soon) */}
              <CapabilityCard
                title={langRtl ? 'بيع المنتجات' : 'Sell Products'}
                desc={langRtl ? 'إدارة كتالوج المنتجات وسلة الشراء.' : 'Product catalog and shopping cart.'}
                enabled={capabilities.supportsProducts}
                badge={langRtl ? 'قريباً في المرحلة القادمة' : 'Coming in next phase'}
                onChange={(val) => setCapabilities((p) => ({ ...p, supportsProducts: val }))}
              />

              <CapabilityCard
                title={langRtl ? 'استقبال الطلبات' : 'Take Orders'}
                desc={langRtl ? 'استلام وتنفيذ طلبات الشراء أوتوماتيكياً.' : 'Order intake and processing.'}
                enabled={capabilities.supportsOrders}
                badge={langRtl ? 'قريباً في المرحلة القادمة' : 'Coming in next phase'}
                onChange={(val) => setCapabilities((p) => ({ ...p, supportsOrders: val }))}
              />

              <CapabilityCard
                title={langRtl ? 'عروض الأسعار' : 'Prepare Quotes'}
                desc={langRtl ? 'إنشاء عروض أسعار مخصصة للعملاء.' : 'Custom quotations for services and projects.'}
                enabled={capabilities.supportsQuotes}
                badge={langRtl ? 'قريباً في المرحلة القادمة' : 'Coming in next phase'}
                onChange={(val) => setCapabilities((p) => ({ ...p, supportsQuotes: val }))}
              />

              <CapabilityCard
                title={langRtl ? 'العروض الترويجية' : 'Show Offers'}
                desc={langRtl ? 'تقديم خصومات وعروض موسمية مخصصة.' : 'Promotional campaigns and special discounts.'}
                enabled={capabilities.supportsOffers}
                badge={langRtl ? 'قريباً في المرحلة القادمة' : 'Coming in next phase'}
                onChange={(val) => setCapabilities((p) => ({ ...p, supportsOffers: val }))}
              />

              <CapabilityCard
                title={langRtl ? 'إدارة المخزون' : 'Manage Inventory'}
                desc={langRtl ? 'متابعة الكميات المتاحة والتنبيه عند النفاد.' : 'Real-time stock tracking and low-stock alerts.'}
                enabled={capabilities.supportsInventory}
                badge={langRtl ? 'قريباً في المرحلة القادمة' : 'Coming in next phase'}
                onChange={(val) => setCapabilities((p) => ({ ...p, supportsInventory: val }))}
              />

              <CapabilityCard
                title={langRtl ? 'القوائم العقارية' : 'Show Listings'}
                desc={langRtl ? 'عرض العقارات أو الوحدات المتاحة للبيع أو الإيجار.' : 'Real estate or itemized property listings.'}
                enabled={capabilities.supportsListings}
                badge={langRtl ? 'قريباً في المرحلة القادمة' : 'Coming in next phase'}
                onChange={(val) => setCapabilities((p) => ({ ...p, supportsListings: val }))}
              />
            </div>

            {/* Human-Friendly Lead Policy Settings */}
            {capabilities.supportsLeads && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  padding: 16,
                  marginTop: 16,
                }}
              >
                <h3 style={{ margin: '0 0 12px', fontSize: 15, color: '#0f172a' }}>
                  {langRtl ? 'سياسة إدارة العملاء المحتملين (Lead Policy)' : 'Lead Intake Preferences'}
                </h3>

                {capabilities.supportsBooking && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                      {langRtl
                        ? 'عندما يرغب العميل في الحجز، هل يجب إضافته كعميل محتمل في مسار المبيعات أولاً؟'
                        : 'When a customer wants to book, should they be added to your sales pipeline first?'}
                    </label>
                    <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="leadReq"
                          checked={!capabilities.leadRequiredBeforeBooking}
                          onChange={() => setCapabilities((p) => ({ ...p, leadRequiredBeforeBooking: false }))}
                        />
                        {langRtl ? 'لا، يمكن الحجز مباشرة' : 'No, booking can happen directly'}
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="leadReq"
                          checked={capabilities.leadRequiredBeforeBooking}
                          onChange={() => setCapabilities((p) => ({ ...p, leadRequiredBeforeBooking: true }))}
                        />
                        {langRtl ? 'نعم، أنشئ عميلاً محتملاً أولاً' : 'Yes, create/require a lead first'}
                      </label>
                    </div>
                  </div>
                )}

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={capabilities.autoCreateLeadOnIntent}
                      onChange={(e) => setCapabilities((p) => ({ ...p, autoCreateLeadOnIntent: e.target.checked }))}
                    />
                    <span>
                      {langRtl
                        ? 'إنشاء عميل محتمل تلقائياً عندما يبدي الزبون اهتماماً بالشراء'
                        : 'Automatically create a lead when a customer shows buying interest'}
                    </span>
                  </label>
                </div>
              </div>
            )}
          </section>
        )}

        {/* STEP 3: Basic Setup */}
        {currentStep === 3 && (
          <section>
            <h2 style={{ marginTop: 0, fontSize: 20, color: '#0f172a' }}>
              {langRtl ? 'الخطوة 3: الإعداد الأساسي' : 'Step 3: Basic Setup'}
            </h2>
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>
              {langRtl
                ? 'مراجعة المكونات الأساسية المتوفرة بناءً على الإمكانيات المحددة.'
                : 'Review baseline business entities configured for your active capabilities.'}
            </p>

            <div style={{ display: 'grid', gap: 12 }}>
              {capabilities.supportsBooking && (
                <div style={{ padding: 14, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>
                    {langRtl ? '🏢 الموقع الأساسي والحجوزات' : '🏢 Primary Location & Appointments'}
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                    {langRtl
                      ? 'تم تهيئة الموقع الافتراضي للمنظمة لاستقبال المواعيد.'
                      : 'Default primary location is active and ready to schedule slots.'}
                  </p>
                </div>
              )}

              {capabilities.supportsServices && (
                <div style={{ padding: 14, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>
                    {langRtl ? '📋 قائمة الخدمات' : '📋 Services Catalog'}
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                    {langRtl
                      ? 'يمكنك إضافة وتعديل الخدمات وتفاصيل الأسعار في أي وقت من لوحة التحكم.'
                      : 'Services can be enriched and customized anytime from your dashboard.'}
                  </p>
                </div>
              )}

              {capabilities.supportsStaff && (
                <div style={{ padding: 14, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>
                    {langRtl ? '👥 فريق العمل والمختصين' : '👥 Staff & Specialists'}
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                    {langRtl
                      ? 'يمكنك تعيين الموظفين وجداول دوامهم لاحقاً حسب الحاجة.'
                      : 'Staff members and working hours can be assigned post-onboarding.'}
                  </p>
                </div>
              )}

              {(capabilities.supportsProducts || capabilities.supportsOrders) && (
                <div style={{ padding: 14, background: '#fefce8', border: '1px solid #fef08a', borderRadius: 6 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#854d0e' }}>
                    {langRtl ? '📦 المنتجات والطلبات' : '📦 Products & Orders'}
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#713f12' }}>
                    {langRtl
                      ? 'سيتوفر إعداد كتالوج المنتجات وإدارة الطلبات بالتفصيل في المرحلة القادمة من المنصة.'
                      : 'Product catalog and detailed order workflows will be fully configurable in the upcoming setup phase.'}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* STEP 4: Business Operations */}
        {currentStep === 4 && (
          <section>
            <h2 style={{ marginTop: 0, fontSize: 20, color: '#0f172a' }}>
              {langRtl ? 'الخطوة 4: العمليات التشغيلية' : 'Step 4: Business Operations'}
            </h2>
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>
              {langRtl
                ? 'ملخص القواعد التشغيلية وسلوك المساعد الذكي أثناء المحادثات.'
                : 'Summary of operational rules and AI behavior during customer conversations.'}
            </p>

            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ padding: 14, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>
                  {langRtl ? '🕒 ساعات العمل والتوفر' : '🕒 Operating Hours & Availability'}
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                  {langRtl
                    ? 'المساعد الذكي يعمل على مدار الساعة (24/7) ويقترح الأوقات المتاحة للحجز بناءً على ساعات عمل المنشأة.'
                    : 'The AI assistant operates 24/7, booking slots strictly within scheduled business hours.'}
                </p>
              </div>

              <div style={{ padding: 14, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>
                  {langRtl ? '🤝 التحويل للموظف البشري (Human Handoff)' : '🤝 Human Takeover & Handoff'}
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                  {langRtl
                    ? 'في حال طلب العميل التحدث مع موظف أو عند الحاجة، يتم تحويل المحادثة لصندوق الوارد الخاص بفريقك.'
                    : 'Conversations are automatically escalated to your human inbox when requested or needed.'}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* STEP 5: Review & Finish */}
        {currentStep === 5 && (
          <section>
            <h2 style={{ marginTop: 0, fontSize: 20, color: '#0f172a' }}>
              {langRtl ? 'الخطوة 5: المراجعة والإنهاء' : 'Step 5: Review & Finish'}
            </h2>
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>
              {langRtl
                ? 'راجع الإعدادات وحالة الجاهزية قبل إتمام الإعداد والانتقال إلى لوحة التحكم.'
                : 'Review your configuration and readiness checks before completing onboarding.'}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
              {/* Summary Card */}
              <div style={{ padding: 16, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6 }}>
                <h3 style={{ margin: '0 0 8px', fontSize: 15, color: '#0f172a' }}>
                  {langRtl ? 'ملخص النشاط' : 'Business Summary'}
                </h3>
                <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
                  <div><strong>{langRtl ? 'الاسم:' : 'Name:'}</strong> {displayName || '—'}</div>
                  <div><strong>{langRtl ? 'النوع:' : 'Type:'}</strong> {BUSINESS_TYPE_PRESETS.find((p) => p.id === businessType)?.label || businessType}</div>
                  <div><strong>{langRtl ? 'المنطقة الزمنية:' : 'Timezone:'}</strong> {timezone}</div>
                  <div><strong>{langRtl ? 'العملة:' : 'Currency:'}</strong> {defaultCurrency}</div>
                  <div><strong>{langRtl ? 'حجز المواعيد:' : 'Bookings:'}</strong> {capabilities.supportsBooking ? 'Enabled' : 'Disabled'}</div>
                  <div><strong>{langRtl ? 'إدارة العملاء:' : 'Leads:'}</strong> {capabilities.supportsLeads ? 'Enabled' : 'Disabled'}</div>
                </div>
              </div>

              {/* Backend Readiness Checklist */}
              <div style={{ padding: 16, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6 }}>
                <h3 style={{ margin: '0 0 8px', fontSize: 15, color: '#0f172a' }}>
                  {langRtl ? 'فحص الجاهزية' : 'Readiness Checks'}
                </h3>
                {!readiness ? (
                  <p style={{ fontSize: 13, color: '#64748b' }}>Loading readiness...</p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 13 }}>
                    {readiness.items.map((item) => {
                      const isReady = item.status === 'READY';
                      const isOpt = item.status === 'OPTIONAL';
                      const isNa = item.status === 'NOT_APPLICABLE';
                      const isIncomplete = item.status === 'INCOMPLETE';

                      return (
                        <li
                          key={item.key}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '6px 0',
                            borderBottom: '1px solid #e2e8f0',
                          }}
                        >
                          <span>{item.label}</span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: isReady ? '#dcfce7' : isOpt ? '#f1f5f9' : isNa ? '#f8fafc' : '#fee2e2',
                              color: isReady ? '#166534' : isOpt ? '#475569' : isNa ? '#94a3b8' : '#991b1b',
                            }}
                          >
                            {item.status}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Navigation / Step Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 24,
            paddingTop: 16,
            borderTop: '1px solid #e2e8f0',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          {currentStep > 1 ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => setCurrentStep((p) => (p - 1) as StepNumber)}
              style={{
                background: '#f1f5f9',
                color: '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                padding: '8px 16px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {langRtl ? '← السابق' : '← Back'}
            </button>
          ) : (
            <div />
          )}

          {currentStep < 5 ? (
            <button
              type="button"
              disabled={saving || !orgId.trim() || (currentStep === 1 && !displayName.trim())}
              onClick={() => void saveProgressAndGo((currentStep + 1) as StepNumber)}
              style={{
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: 6,
                padding: '8px 20px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {saving ? (langRtl ? 'جارٍ الحفظ...' : 'Saving...') : langRtl ? 'التالي ←' : 'Next →'}
            </button>
          ) : (
            <button
              type="button"
              disabled={saving || !orgId.trim() || !readiness?.overallReady}
              onClick={() => void handleCompleteOnboarding()}
              style={{
                background: '#16a34a',
                color: '#ffffff',
                border: 'none',
                borderRadius: 6,
                padding: '10px 24px',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              {saving
                ? (langRtl ? 'جارٍ الإكمال...' : 'Completing...')
                : langRtl
                ? 'إكمال الإعداد وفتح لوحة التحكم ✓'
                : 'Complete Setup & Open Dashboard ✓'}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

function CapabilityCard({
  title,
  desc,
  enabled,
  badge,
  onChange,
}: {
  title: string;
  desc: string;
  enabled: boolean;
  badge?: string;
  onChange: (val: boolean) => void;
}) {
  return (
    <div
      onClick={() => onChange(!enabled)}
      style={{
        border: `2px solid ${enabled ? '#2563eb' : '#e2e8f0'}`,
        background: enabled ? '#eff6ff' : '#ffffff',
        borderRadius: 8,
        padding: 14,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{title}</span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onChange(e.target.checked)}
            onClick={(e) => e.stopPropagation()}
            style={{ width: 16, height: 16, cursor: 'pointer' }}
          />
        </div>
        <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.4 }}>{desc}</p>
      </div>

      {badge && (
        <span
          style={{
            alignSelf: 'flex-start',
            marginTop: 10,
            fontSize: 10,
            fontWeight: 600,
            background: '#fef3c7',
            color: '#92400e',
            padding: '2px 6px',
            borderRadius: 4,
          }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}
