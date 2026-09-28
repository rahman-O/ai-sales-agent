'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  DASHBOARD_NAV_ITEMS,
  DEFAULT_ORGANIZATION_CAPABILITIES,
  filterNavItems,
  type DashboardNavItem,
  type MemberRole,
  type OrganizationCapabilitiesDto,
} from '@ai-sales-agent/contracts';

interface OperatorNavProps {
  current?: string;
  orgId?: string;
  role?: MemberRole;
  lang?: 'en' | 'ar';
}

/**
 * Authoritative dynamic navigation for the multi-business operator dashboard.
 * Evaluates active organization capabilities and user role to display only
 * relevant, enabled modules.
 */
export function OperatorNav({ current, orgId: propOrgId, role, lang = 'en' }: OperatorNavProps) {
  const [orgId, setOrgId] = useState(propOrgId || '');
  const [capabilities, setCapabilities] = useState<OrganizationCapabilitiesDto>(
    DEFAULT_ORGANIZATION_CAPABILITIES as OrganizationCapabilitiesDto,
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isRtl, setIsRtl] = useState(lang === 'ar');

  // Sync orgId from prop, URL search param, or local storage
  useEffect(() => {
    if (propOrgId) {
      setOrgId(propOrgId);
      return;
    }
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlOrg = params.get('orgId') || localStorage.getItem('ai_sales_org_id') || '';
      if (urlOrg && urlOrg !== orgId) {
        setOrgId(urlOrg);
      }
    }
  }, [propOrgId, orgId]);

  // Fetch organization capabilities whenever orgId changes
  useEffect(() => {
    if (!orgId.trim()) return;

    let active = true;
    fetch(`/api/backend/organizations/${orgId}/capabilities`, { cache: 'no-store' })
      .then(async (res) => {
        if (!active || !res.ok) return;
        const data = await res.json();
        setCapabilities(data);
      })
      .catch(() => {
        // Fallback to default capabilities
      });

    return () => {
      active = false;
    };
  }, [orgId]);

  const visibleItems = filterNavItems(DASHBOARD_NAV_ITEMS, capabilities, role, {
    includeComingSoon: false,
  });

  // Group items
  const groups: Array<{ name: string; nameAr: string; items: DashboardNavItem[] }> = [
    {
      name: 'Workspace',
      nameAr: 'مساحة العمل',
      items: visibleItems.filter((i) => i.group === 'WORKSPACE'),
    },
    {
      name: 'Operations',
      nameAr: 'العمليات',
      items: visibleItems.filter((i) => i.group === 'OPERATIONS'),
    },
    {
      name: 'Growth',
      nameAr: 'النمو والذكاء',
      items: visibleItems.filter((i) => i.group === 'GROWTH'),
    },
    {
      name: 'Admin',
      nameAr: 'الإدارة',
      items: visibleItems.filter((i) => i.group === 'ADMIN'),
    },
  ].filter((g) => g.items.length > 0);

  return (
    <header
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        marginBottom: 20,
        borderBottom: '1px solid #e2e8f0',
        paddingBottom: 12,
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link
            href={orgId ? `/dashboard?orgId=${encodeURIComponent(orgId)}` : '/dashboard'}
            style={{
              fontWeight: 800,
              fontSize: 16,
              color: '#0f172a',
              textDecoration: 'none',
              letterSpacing: '-0.02em',
            }}
          >
            {isRtl ? 'المنصة الذكية' : 'AI Sales Agent'}
          </Link>

          {/* Desktop Navigation */}
          <nav
            aria-label="Main Navigation"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: 'center',
            }}
          >
            {groups.map((group) => (
              <div
                key={group.name}
                style={{
                  display: 'flex',
                  gap: 4,
                  alignItems: 'center',
                  background: '#f8fafc',
                  padding: '3px 6px',
                  borderRadius: 6,
                  border: '1px solid #f1f5f9',
                }}
              >
                {group.items.map((item) => {
                  const isActive = current === item.href;
                  const hrefWithOrg = orgId
                    ? `${item.href}?orgId=${encodeURIComponent(orgId)}`
                    : item.href;

                  return (
                    <Link
                      key={item.id}
                      href={hrefWithOrg}
                      aria-current={isActive ? 'page' : undefined}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 4,
                        fontSize: 13,
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? '#1d4ed8' : '#475569',
                        background: isActive ? '#dbeafe' : 'transparent',
                        textDecoration: 'none',
                        transition: 'background 0.15s ease',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {isRtl ? item.labelAr : item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Right side controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link
            href={orgId ? `/onboarding?orgId=${encodeURIComponent(orgId)}` : '/onboarding'}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#64748b',
              textDecoration: 'none',
              padding: '4px 8px',
              borderRadius: 4,
              border: '1px solid #e2e8f0',
              background: '#ffffff',
            }}
          >
            {isRtl ? 'إعدادات الإطلاق' : 'Onboarding'}
          </Link>

          <button
            type="button"
            onClick={() => setIsRtl(!isRtl)}
            style={{
              background: 'transparent',
              border: '1px solid #cbd5e1',
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: 12,
              cursor: 'pointer',
              color: '#475569',
            }}
          >
            {isRtl ? 'EN' : 'عربي'}
          </button>
        </div>
      </div>
    </header>
  );
}
