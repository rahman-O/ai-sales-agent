'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  type OrganizationCapabilitiesDto,
  DEFAULT_ORGANIZATION_CAPABILITIES,
  evaluateRouteAccess,
} from '@ai-sales-agent/contracts';

interface CapabilityGuardProps {
  organizationId: string;
  requiredCapability?: keyof OrganizationCapabilitiesDto;
  pathname: string;
  children: React.ReactNode;
}

export function CapabilityGuard({
  organizationId,
  requiredCapability,
  pathname,
  children,
}: CapabilityGuardProps) {
  const [capabilities, setCapabilities] = useState<OrganizationCapabilitiesDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!organizationId?.trim()) {
      setCapabilities(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError('');

    fetch(`/api/backend/organizations/${organizationId}/capabilities`, { cache: 'no-store' })
      .then(async (res) => {
        if (!active) return;
        if (!res.ok) {
          setError(`Failed to load capabilities (${res.status})`);
          return;
        }
        const data = await res.json();
        setCapabilities(data);
      })
      .catch(() => {
        if (active) setError('Network error loading capabilities');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [organizationId]);

  if (!organizationId?.trim()) {
    // If no org selected yet, render children so org input field is visible
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div style={{ padding: '24px 0', color: '#64748b', fontSize: 14 }}>
        Checking organization capability access...
      </div>
    );
  }

  const effectiveCaps: OrganizationCapabilitiesDto =
    capabilities ?? (DEFAULT_ORGANIZATION_CAPABILITIES as unknown as OrganizationCapabilitiesDto);
  const access = evaluateRouteAccess(pathname, effectiveCaps);

  const directCapCheck = requiredCapability
    ? (effectiveCaps as unknown as Record<string, unknown>)[requiredCapability] !== false
    : true;

  if (!access.allowed || !directCapCheck) {
    return (
      <div
        role="alert"
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: 24,
          margin: '20px 0',
          textAlign: 'center',
          maxWidth: 600,
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 8 }}>🔒</div>
        <h2 style={{ fontSize: 18, color: '#0f172a', margin: '0 0 8px' }}>
          Feature Not Enabled
        </h2>
        <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 16px', lineHeight: 1.5 }}>
          {access.reason ||
            `This organization does not have the '${requiredCapability}' capability enabled.`}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Link
            href={`/dashboard?orgId=${encodeURIComponent(organizationId)}`}
            style={{
              display: 'inline-block',
              background: '#2563eb',
              color: '#ffffff',
              padding: '8px 16px',
              borderRadius: 6,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            ← Return to Dashboard
          </Link>
          <Link
            href={`/onboarding?orgId=${encodeURIComponent(organizationId)}`}
            style={{
              display: 'inline-block',
              background: '#f1f5f9',
              color: '#334155',
              border: '1px solid #cbd5e1',
              padding: '8px 16px',
              borderRadius: 6,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Configure in Onboarding
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
