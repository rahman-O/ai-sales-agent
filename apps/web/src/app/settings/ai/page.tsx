'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { OperatorNav } from '@/client/navigation/OperatorNav';
import type {
  ConversationProfileDto,
  CustomerNameUsage,
  Dialect,
  EmojiUsage,
  Formality,
  GreetingStyle,
  HandoffStyle,
  MemberRole,
  ResponseLength,
  SalesStyle,
  Tone,
  UpdateConversationProfileRequest,
} from '@ai-sales-agent/contracts';

const TONE_OPTIONS: Array<{ value: Tone; labelEn: string; labelAr: string; desc: string }> = [
  { value: 'PROFESSIONAL', labelEn: 'Professional', labelAr: 'مهني واحترافي', desc: 'Direct, clear, and business-focused.' },
  { value: 'WARM', labelEn: 'Warm & Welcoming', labelAr: 'دافئ ومرحب', desc: 'Friendly, courteous, and hospitable.' },
  { value: 'FRIENDLY', labelEn: 'Friendly', labelAr: 'ودود وبسيط', desc: 'Approachable, cheerful, and conversational.' },
  { value: 'DIRECT', labelEn: 'Direct & Concise', labelAr: 'مباشر ومختصر', desc: 'Gets straight to the point without pleasantries.' },
  { value: 'NEUTRAL', labelEn: 'Neutral', labelAr: 'محايد', desc: 'Standard factual and objective tone.' },
];

const DIALECT_OPTIONS: Array<{ value: Dialect; labelEn: string; labelAr: string }> = [
  { value: 'IRAQI', labelEn: 'Iraqi Arabic (اللهجة العراقية)', labelAr: 'لهجة عراقية طبيعية' },
  { value: 'MSA', labelEn: 'Modern Standard Arabic (الفصحى)', labelAr: 'اللغة العربية الفصحى' },
  { value: 'AUTO', labelEn: 'Automatic / User Dialect Match', labelAr: 'تلقائي حسب لغة العميل' },
];

const FORMALITY_OPTIONS: Array<{ value: Formality; labelEn: string; labelAr: string }> = [
  { value: 'CASUAL', labelEn: 'Casual', labelAr: 'عفوي وبسيط' },
  { value: 'BALANCED', labelEn: 'Balanced', labelAr: 'متوازن' },
  { value: 'FORMAL', labelEn: 'Formal', labelAr: 'رسمي' },
];

const RESPONSE_LENGTH_OPTIONS: Array<{ value: ResponseLength; labelEn: string; labelAr: string }> = [
  { value: 'SHORT', labelEn: 'Short & Direct', labelAr: 'قصير وموجز' },
  { value: 'BALANCED', labelEn: 'Balanced', labelAr: 'متوسط ومعتدل' },
  { value: 'DETAILED', labelEn: 'Detailed', labelAr: 'مفصل وغني بالمعلومات' },
];

const SALES_STYLE_OPTIONS: Array<{ value: SalesStyle; labelEn: string; labelAr: string; desc: string }> = [
  { value: 'LOW_PRESSURE', labelEn: 'Low Pressure', labelAr: 'هادئ وغير ملح', desc: 'Answers questions first; only suggests next steps when clearly asked.' },
  { value: 'BALANCED', labelEn: 'Balanced Consultant', labelAr: 'مستشار متوازن', desc: 'Helpful and guides the customer to the next natural step.' },
  { value: 'PROACTIVE', labelEn: 'Proactive Advisor', labelAr: 'استباقي ونشط', desc: 'Actively highlights available catalog options and active offers.' },
];

const EMOJI_OPTIONS: Array<{ value: EmojiUsage; labelEn: string; labelAr: string }> = [
  { value: 'NEVER', labelEn: 'None (Zero Emojis)', labelAr: 'بدون إيموجي نهائياً' },
  { value: 'MINIMAL', labelEn: 'Minimal (Occasional, polite)', labelAr: 'خفيف ومقنن (عند الضرورة)' },
  { value: 'NORMAL', labelEn: 'Normal (Standard friendly)', labelAr: 'طبيعي ومعتدل' },
];

const CUSTOMER_NAME_OPTIONS: Array<{ value: CustomerNameUsage; labelEn: string; labelAr: string }> = [
  { value: 'WHEN_KNOWN', labelEn: 'When Known (Respectful)', labelAr: 'عند معرفة الاسم (بشكل طبيعي)' },
  { value: 'OCCASIONAL', labelEn: 'Occasional (Subtle)', labelAr: 'نادراً / عند الضرورة فقط' },
  { value: 'NEVER', labelEn: 'Never (Do not use name)', labelAr: 'عدم استخدام الاسم' },
];

const GREETING_OPTIONS: Array<{ value: GreetingStyle; labelEn: string; labelAr: string }> = [
  { value: 'BRIEF', labelEn: 'Brief & Direct', labelAr: 'ترحيب سريع ومباشر' },
  { value: 'WARM', labelEn: 'Warm & Hospitable', labelAr: 'ترحيب دافئ ومهذب' },
  { value: 'FORMAL', labelEn: 'Formal & Dignified', labelAr: 'ترحيب رسمي ووقور' },
  { value: 'CUSTOM', labelEn: 'Custom / Standard', labelAr: 'مخصص' },
];

const HANDOFF_OPTIONS: Array<{ value: HandoffStyle; labelEn: string; labelAr: string }> = [
  { value: 'PROFESSIONAL', labelEn: 'Professional Notice', labelAr: 'إشعار مهني' },
  { value: 'WARM', labelEn: 'Warm & Reassuring', labelAr: 'ودود ومطمئن' },
  { value: 'DIRECT', labelEn: 'Direct Transfer', labelAr: 'تحويل مباشر ومختصر' },
];

const SAMPLE_SCENARIOS = [
  { id: 'services', label: 'استفسار عن الخدمات', prompt: 'هلا، شنو الخدمات والأسعار اللي عندكم؟' },
  { id: 'objection', label: 'اعتراض على السعر', prompt: 'السعر أشوفه غالي شوي، ماكو مجال خصم؟' },
  { id: 'booking', label: 'طلب حجز موعد', prompt: 'أريد أحجز موعد باجر العصر' },
  { id: 'policy', label: 'سياسة الإلغاء والتعديل', prompt: 'إذا حجزت واضطريت ألغي شنو سياستكم؟' },
  { id: 'handoff', label: 'طلب التحدث مع موظف', prompt: 'أريد أحجي ويا أحد من خدمة العملاء' },
];

export default function AISettingsPage() {
  const [orgId, setOrgId] = useState('');
  const [role, setRole] = useState<MemberRole | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [profile, setProfile] = useState<ConversationProfileDto | null>(null);

  // Form State
  const [assistantName, setAssistantName] = useState('');
  const [primaryLanguage, setPrimaryLanguage] = useState('ar');
  const [dialect, setDialect] = useState<Dialect>('IRAQI');
  const [tone, setTone] = useState<Tone>('PROFESSIONAL');
  const [formality, setFormality] = useState<Formality>('BALANCED');
  const [responseLength, setResponseLength] = useState<ResponseLength>('BALANCED');
  const [salesStyle, setSalesStyle] = useState<SalesStyle>('BALANCED');
  const [emojiUsage, setEmojiUsage] = useState<EmojiUsage>('MINIMAL');
  const [customerNameUsage, setCustomerNameUsage] = useState<CustomerNameUsage>('WHEN_KNOWN');
  const [questionsPerTurn, setQuestionsPerTurn] = useState(1);
  const [greetingStyle, setGreetingStyle] = useState<GreetingStyle>('BRIEF');
  const [handoffStyle, setHandoffStyle] = useState<HandoffStyle>('PROFESSIONAL');
  const [customInstructions, setCustomInstructions] = useState('');

  // Preview State
  const [activeScenario, setActiveScenario] = useState('services');

  useEffect(() => {
    fetch('/api/backend/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.activeOrganizationId) {
          setOrgId(data.activeOrganizationId);
          const membership = data.memberships?.find(
            (entry: { organizationId: string }) => entry.organizationId === data.activeOrganizationId,
          );
          setRole(membership?.role ?? null);
        }
      })
      .catch(() => undefined);
  }, []);

  const loadProfile = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/backend/organizations/${orgId}/conversation-profile`);
      if (!res.ok) throw new Error(`Failed to load style settings: HTTP ${res.status}`);
      const data: ConversationProfileDto = await res.json();
      setProfile(data);
      setAssistantName(data.assistantName ?? '');
      setPrimaryLanguage(data.primaryLanguage ?? 'ar');
      setDialect(data.dialect ?? 'IRAQI');
      setTone(data.tone ?? 'PROFESSIONAL');
      setFormality(data.formality ?? 'BALANCED');
      setResponseLength(data.responseLength ?? 'BALANCED');
      setSalesStyle(data.salesStyle ?? 'BALANCED');
      setEmojiUsage(data.emojiUsage ?? 'MINIMAL');
      setCustomerNameUsage(data.customerNameUsage ?? 'WHEN_KNOWN');
      setQuestionsPerTurn(data.questionsPerTurn ?? 1);
      setGreetingStyle(data.greetingStyle ?? 'BRIEF');
      setHandoffStyle(data.handoffStyle ?? 'PROFESSIONAL');
      setCustomInstructions(data.customInstructions ?? '');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    if (role !== 'OWNER' && role !== 'ADMIN') {
      setError('Only owners and admins can modify assistant style settings.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');

    const body: UpdateConversationProfileRequest = {
      assistantName: assistantName.trim() || null,
      primaryLanguage,
      dialect,
      tone,
      formality,
      responseLength,
      salesStyle,
      emojiUsage,
      customerNameUsage,
      questionsPerTurn: Number(questionsPerTurn),
      greetingStyle,
      handoffStyle,
      customInstructions: customInstructions.trim() || null,
    };

    try {
      const res = await fetch(`/api/backend/organizations/${orgId}/conversation-profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Save failed' }));
        throw new Error(err.message || `HTTP ${res.status}`);
      }
      const saved: ConversationProfileDto = await res.json();
      setProfile(saved);
      setSuccess('تم حفظ إعدادات أسلوب المساعد بنجاح! / Settings saved successfully.');
      setTimeout(() => setSuccess(''), 4000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Safe deterministic local preview generator (demonstrates style without executing mutations)
  const previewResponse = useMemo(() => {
    const isIraqi = dialect === 'IRAQI';
    const isMsa = dialect === 'MSA';
    const emoji = emojiUsage === 'NEVER' ? '' : emojiUsage === 'MINIMAL' ? ' ✨' : ' 😊✨';
    const namePrefix = assistantName ? (isIraqi ? `أني ${assistantName} من الفريق. ` : `معك ${assistantName}. `) : '';

    if (activeScenario === 'services') {
      if (isIraqi) {
        if (tone === 'WARM' || tone === 'FRIENDLY') {
          return `${namePrefix}يا هلا بيك! عدنا باقة خدمات متكاملة تشمل الفحص والاستشارة والتنظيف. تحب أعرضلك تفاصيل وأسعار خدمة معينة؟${emoji}`;
        }
        if (tone === 'DIRECT') {
          return `${namePrefix}أهلاً. متوفر فحص واستشارة، تنظيف، وعلاجات مخصصة. الأسعار تبدأ من 35,000 د.ع. أي خدمة تناسبك؟`;
        }
        return `${namePrefix}أهلاً وسهلاً بحضرتك. نوفر عدة خدمات معتمدة مع تفاصيل الأسعار حسب طلبك. شنو الخدمة اللي حاب تستفسر عنها؟${emoji}`;
      } else if (isMsa) {
        return `${namePrefix}أهلاً ومرحباً بك. تتوفر لدينا قائمة متكاملة من الخدمات المعتمدة. كيف يمكنني مساعدتك اليوم؟${emoji}`;
      }
      return `${namePrefix}Hello! We offer a full range of verified services. Which service would you like to know more about?${emoji}`;
    }

    if (activeScenario === 'objection') {
      if (isIraqi) {
        if (salesStyle === 'PROACTIVE') {
          return `أقدر وجهة نظرك تماماً. أسعارنا محددة حسب جودة الخدمة، وحالياً متوفرة عروض وباقات مميزة أگدر أشاركها وياك إذا تحب.${emoji}`;
        }
        return `أتفهم اهتمامك بالأسعار. خدماتنا تشمل ضمان الجودة والتقييم الدقيق، والأسعار رسمية ومعتمدة. تحب نراجع تفاصيل الخدمة معاً؟`;
      }
      return `نقدّر اهتمامكم، الأسعار معتمدة وفق أعلى معايير الجودة، مع توفر خيارات متعددة تناسب احتياجاتكم.${emoji}`;
    }

    if (activeScenario === 'booking') {
      if (isIraqi) {
        if (responseLength === 'SHORT') {
          return `أكيد، شنو الخدمة المطلوبة حتى أطلعلك المواعيد المتاحة لباجر؟`;
        }
        return `تدلل، أگدر أساعدك بالحجز بكل سهولة. يا خدمة تحب تحجز عليها لباجر حتى أعرضلك الأوقات المتوفرة؟${emoji}`;
      }
      return `يسعدنا خدمتك. يرجى تحديد الخدمة المطلوبة لعرض المواعيد المتاحة غداً.${emoji}`;
    }

    if (activeScenario === 'policy') {
      if (isIraqi) {
        return `سياستنا مرنة وواضحة: تگدر تلغي أو تعدل الموعد مجاناً قبل ساعتين من موعدك. التعديل يتم مباشرة وبكل سهولة.`;
      }
      return `وفق سياستنا المعتمدة، يمكن إلغاء أو إعادة جدولة الموعد قبل ساعتين من الموعد المحدد بكل يسر.`;
    }

    if (activeScenario === 'handoff') {
      if (handoffStyle === 'WARM') {
        return `صار وتدلل، راح أحول المحادثة هسة لأحد زملائي بالفريق حتى يتواصل وياك مباشرة.${emoji}`;
      }
      if (handoffStyle === 'DIRECT') {
        return `تم تحويلك إلى موظف خدمة العملاء، سيتواصل معك قريباً.`;
      }
      return `أكيد، تم تحويل طلبك لفريق العمل وسيقوم أحد الزملاء بمتابعة استفسارك في أقرب وقت.`;
    }

    return 'مرحباً بك، كيف يمكنني مساعدتك؟';
  }, [activeScenario, assistantName, dialect, emojiUsage, handoffStyle, responseLength, salesStyle, tone]);

  const canEdit = role === 'OWNER' || role === 'ADMIN';

  return (
    <div style={{ minHeight: '100vh', background: '#0a0d14', color: '#f0f4f8', fontFamily: 'system-ui, sans-serif' }}>
      <OperatorNav current="settings-ai" orgId={orgId} role={role ?? undefined} />

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#ffffff', margin: 0 }}>
              AI Style & Assistant Personality / أسلوب وشخصية المساعد
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '6px' }}>
              Configure your AI sales assistant&apos;s tone, dialect, and communication personality. Backend rules and factual authority remain strict and protected.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => void loadProfile()}
              disabled={loading}
              style={{
                background: '#1e293b',
                color: '#cbd5e1',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '8px 16px',
                cursor: 'pointer',
              }}
            >
              {loading ? 'Refreshing...' : 'تحديث / Refresh'}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: '#7f1d1d40', border: '1px solid #ef4444', color: '#fca5a5', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px' }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ background: '#064e3b40', border: '1px solid #10b981', color: '#6ee7b7', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px' }}>
            {success}
          </div>
        )}

        {!canEdit && (
          <div style={{ background: '#1e293b', border: '1px solid #3b82f6', color: '#93c5fd', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px' }}>
            ℹ️ You have viewer access. Only organization Owners and Admins can save personality changes.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
          {/* Settings Form */}
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* 1. Identity & Language */}
            <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '20px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#60a5fa', marginTop: 0, marginBottom: '16px' }}>
                1. Identity & Dialect / الهوية واللهجة
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>
                    Assistant Display Name / اسم المساعد (اختياري)
                  </label>
                  <input
                    type="text"
                    value={assistantName}
                    onChange={(e) => setAssistantName(e.target.value)}
                    placeholder="e.g. سارة، مساعد المبيعات"
                    disabled={!canEdit}
                    style={{
                      width: '100%',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: '#fff',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>
                    Arabic Dialect / اللهجة العربية
                  </label>
                  <select
                    value={dialect}
                    onChange={(e) => setDialect(e.target.value as Dialect)}
                    disabled={!canEdit}
                    style={{
                      width: '100%',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: '#fff',
                    }}
                  >
                    {DIALECT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.labelAr} — {opt.labelEn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 2. Tone & Formality */}
            <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '20px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#60a5fa', marginTop: 0, marginBottom: '16px' }}>
                2. Tone & Formality / النبرة ومستوى الرسمية
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>
                    Overall Tone / النبرة العامة
                  </label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value as Tone)}
                    disabled={!canEdit}
                    style={{
                      width: '100%',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: '#fff',
                    }}
                  >
                    {TONE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.labelAr} ({opt.labelEn})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>
                    Formality Level / مستوى الرسمية
                  </label>
                  <select
                    value={formality}
                    onChange={(e) => setFormality(e.target.value as Formality)}
                    disabled={!canEdit}
                    style={{
                      width: '100%',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: '#fff',
                    }}
                  >
                    {FORMALITY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.labelAr} ({opt.labelEn})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 3. Response Length & Sales Approach */}
            <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '20px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#60a5fa', marginTop: 0, marginBottom: '16px' }}>
                3. Response Length & Sales Style / طول الإجابة والأسلوب البيعي
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>
                    Response Length / حجم الرد
                  </label>
                  <select
                    value={responseLength}
                    onChange={(e) => setResponseLength(e.target.value as ResponseLength)}
                    disabled={!canEdit}
                    style={{
                      width: '100%',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: '#fff',
                    }}
                  >
                    {RESPONSE_LENGTH_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.labelAr} ({opt.labelEn})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>
                    Sales Style / الأسلوب البيعي والاستشاري
                  </label>
                  <select
                    value={salesStyle}
                    onChange={(e) => setSalesStyle(e.target.value as SalesStyle)}
                    disabled={!canEdit}
                    style={{
                      width: '100%',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: '#fff',
                    }}
                  >
                    {SALES_STYLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.labelAr} ({opt.labelEn})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 4. Presentation & Interaction Details */}
            <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '20px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#60a5fa', marginTop: 0, marginBottom: '16px' }}>
                4. Interaction Details / تفاصيل التفاعل
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>
                    Emoji Usage / الإيموجي
                  </label>
                  <select
                    value={emojiUsage}
                    onChange={(e) => setEmojiUsage(e.target.value as EmojiUsage)}
                    disabled={!canEdit}
                    style={{
                      width: '100%',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: '#fff',
                    }}
                  >
                    {EMOJI_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.labelAr}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>
                    Customer Name / اسم العميل
                  </label>
                  <select
                    value={customerNameUsage}
                    onChange={(e) => setCustomerNameUsage(e.target.value as CustomerNameUsage)}
                    disabled={!canEdit}
                    style={{
                      width: '100%',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: '#fff',
                    }}
                  >
                    {CUSTOMER_NAME_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.labelAr}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>
                    Questions / أسئلة في الرد
                  </label>
                  <select
                    value={questionsPerTurn}
                    onChange={(e) => setQuestionsPerTurn(Number(e.target.value))}
                    disabled={!canEdit}
                    style={{
                      width: '100%',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: '#fff',
                    }}
                  >
                    <option value={1}>1 سؤال (مستحسن لعدم إرباك العميل)</option>
                    <option value={2}>2 سؤال كحد أقصى</option>
                    <option value={3}>3 أسئلة كحد أقصى</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>
                    Handoff Style / أسلوب التحويل
                  </label>
                  <select
                    value={handoffStyle}
                    onChange={(e) => setHandoffStyle(e.target.value as HandoffStyle)}
                    disabled={!canEdit}
                    style={{
                      width: '100%',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: '#fff',
                    }}
                  >
                    {HANDOFF_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.labelAr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 5. Custom Style Guidance */}
            <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '20px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#60a5fa', marginTop: 0, marginBottom: '8px' }}>
                5. Custom Tone Guidance / تعليمات أسلوب إضافية (محدودة النطاق)
              </h2>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 10px 0' }}>
                Strictly style-scoped (e.g. &quot;Use simple wording&quot;, &quot;Be polite&quot;). Cannot alter prices, discount policies, booking confirmations, or backend authority.
              </p>
              <textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                maxLength={500}
                rows={3}
                disabled={!canEdit}
                placeholder="e.g. استخدم أسلوباً مبسطاً مع التركيز على التحية اللطيفة."
                style={{
                  width: '100%',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  color: '#fff',
                  fontSize: '13px',
                }}
              />
              <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'right', marginTop: '4px' }}>
                {customInstructions.length} / 500
              </div>
            </div>

            {canEdit && (
              <button
                type="submit"
                disabled={saving}
                style={{
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                {saving ? 'Saving changes...' : 'حفظ التعديلات / Save Personality Settings'}
              </button>
            )}
          </form>

          {/* Live Preview Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '20px', position: 'sticky', top: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#34d399', margin: 0 }}>
                  ✨ Live Style Preview / معاينة أسلوب الردود
                </h2>
                <span style={{ fontSize: '11px', background: '#064e3b', color: '#6ee7b7', padding: '2px 8px', borderRadius: '12px' }}>
                  Deterministic Simulation
                </span>
              </div>

              <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '14px' }}>
                اختر سيناريو لتجربة كيف تتغير صياغة ونبرة المساعد فورياً بناءً على إعداداتك:
              </p>

              {/* Scenario selector */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '18px' }}>
                {SAMPLE_SCENARIOS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveScenario(s.id)}
                    style={{
                      background: activeScenario === s.id ? '#1e40af' : '#1e293b',
                      color: activeScenario === s.id ? '#ffffff' : '#94a3b8',
                      border: activeScenario === s.id ? '1px solid #3b82f6' : '1px solid #334155',
                      borderRadius: '6px',
                      padding: '6px 10px',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Chat Simulation Bubble */}
              <div style={{ background: '#0b1120', borderRadius: '8px', padding: '16px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* User Message */}
                <div style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '3px' }}>العميل (Customer)</div>
                  <div style={{ background: '#1e293b', color: '#f1f5f9', padding: '10px 14px', borderRadius: '12px 12px 12px 2px', fontSize: '14px' }}>
                    {SAMPLE_SCENARIOS.find((s) => s.id === activeScenario)?.prompt}
                  </div>
                </div>

                {/* Assistant Message */}
                <div style={{ alignSelf: 'flex-end', maxWidth: '85%' }}>
                  <div style={{ fontSize: '11px', color: '#60a5fa', marginBottom: '3px', textAlign: 'right' }}>
                    {assistantName ? assistantName : 'المساعد الذكي (AI Assistant)'}
                  </div>
                  <div style={{ background: '#1e3a8a', color: '#ffffff', padding: '10px 14px', borderRadius: '12px 12px 2px 12px', fontSize: '14px', lineHeight: '1.5' }}>
                    {previewResponse}
                  </div>
                </div>
              </div>

              {/* Safety & Invariance Note */}
              <div style={{ marginTop: '16px', padding: '10px 12px', background: '#0f172a', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '12px', color: '#64748b' }}>
                🛡️ <strong>حماية وتأكيد الموثوقية:</strong> تغيير الأسلوب أو اللهجة لا يؤثر إطلاقاً على دقة الأسعار أو السياسات الملزمة أو شروط الحجز المؤكدة.
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
