import { z } from 'zod';

export interface OrganizationProfileDto {
  organizationId: string;
  displayName: string | null;
  businessType: string | null;
  description: string | null;
  country: string | null;
  timezone: string;
  defaultLanguage: string;
  defaultCurrency: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateOrganizationProfileRequest {
  displayName?: string | null;
  businessType?: string | null;
  description?: string | null;
  country?: string | null;
  timezone?: string;
  defaultLanguage?: string;
  defaultCurrency?: string;
}

export interface OrganizationCapabilitiesDto {
  organizationId: string;
  supportsLeads: boolean;
  leadRequiredBeforeBooking: boolean;
  autoCreateLeadOnIntent: boolean;
  supportsBooking: boolean;
  supportsOffers: boolean;
  supportsQuotes: boolean;
  supportsOrders: boolean;
  supportsInventory: boolean;
  supportsStaff: boolean;
  supportsLocations: boolean;
  supportsProducts: boolean;
  supportsServices: boolean;
  supportsListings: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateOrganizationCapabilitiesRequest {
  supportsLeads?: boolean;
  leadRequiredBeforeBooking?: boolean;
  autoCreateLeadOnIntent?: boolean;
  supportsBooking?: boolean;
  supportsOffers?: boolean;
  supportsQuotes?: boolean;
  supportsOrders?: boolean;
  supportsInventory?: boolean;
  supportsStaff?: boolean;
  supportsLocations?: boolean;
  supportsProducts?: boolean;
  supportsServices?: boolean;
  supportsListings?: boolean;
}

export const DEFAULT_ORGANIZATION_CAPABILITIES: Omit<
  OrganizationCapabilitiesDto,
  'organizationId' | 'createdAt' | 'updatedAt'
> = {
  supportsLeads: true,
  leadRequiredBeforeBooking: false,
  autoCreateLeadOnIntent: true,
  supportsBooking: true,
  supportsOffers: false,
  supportsQuotes: false,
  supportsOrders: false,
  supportsInventory: false,
  supportsStaff: true,
  supportsLocations: true,
  supportsProducts: false,
  supportsServices: true,
  supportsListings: false,
};

export const UpdateOrganizationProfileSchema = z.object({
  displayName: z.string().max(200).nullable().optional(),
  businessType: z.string().max(100).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  country: z.string().max(10).nullable().optional(),
  timezone: z.string().max(100).optional(),
  defaultLanguage: z.string().max(10).optional(),
  defaultCurrency: z.string().max(10).optional(),
});

export const UpdateOrganizationCapabilitiesSchema = z.object({
  supportsLeads: z.boolean().optional(),
  leadRequiredBeforeBooking: z.boolean().optional(),
  autoCreateLeadOnIntent: z.boolean().optional(),
  supportsBooking: z.boolean().optional(),
  supportsOffers: z.boolean().optional(),
  supportsQuotes: z.boolean().optional(),
  supportsOrders: z.boolean().optional(),
  supportsInventory: z.boolean().optional(),
  supportsStaff: z.boolean().optional(),
  supportsLocations: z.boolean().optional(),
  supportsProducts: z.boolean().optional(),
  supportsServices: z.boolean().optional(),
  supportsListings: z.boolean().optional(),
});

export function validateCapabilitiesCombination(
  current: typeof DEFAULT_ORGANIZATION_CAPABILITIES,
  patch: Partial<typeof DEFAULT_ORGANIZATION_CAPABILITIES>,
): { valid: boolean; errors: string[]; resolved: typeof DEFAULT_ORGANIZATION_CAPABILITIES } {
  const errors: string[] = [];
  const merged = { ...current, ...patch };

  if (merged.leadRequiredBeforeBooking) {
    if (!merged.supportsLeads) {
      errors.push('leadRequiredBeforeBooking=true requires supportsLeads=true');
    }
    if (!merged.supportsBooking) {
      errors.push('leadRequiredBeforeBooking=true requires supportsBooking=true');
    }
  }

  if (merged.autoCreateLeadOnIntent && !merged.supportsLeads) {
    errors.push('autoCreateLeadOnIntent=true requires supportsLeads=true');
  }

  return {
    valid: errors.length === 0,
    errors,
    resolved: merged,
  };
}

// ==========================================
// MB-02: Organization Onboarding Contracts
// ==========================================

export type OnboardingStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export type OnboardingStepName =
  | 'IDENTITY'
  | 'CAPABILITIES'
  | 'BASIC_SETUP'
  | 'OPERATIONS'
  | 'REVIEW';

export const ONBOARDING_STEPS: OnboardingStepName[] = [
  'IDENTITY',
  'CAPABILITIES',
  'BASIC_SETUP',
  'OPERATIONS',
  'REVIEW',
];

export interface OrganizationOnboardingDto {
  organizationId: string;
  status: OnboardingStatus;
  currentStep: OnboardingStepName | string;
  completedSteps: string[];
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateOnboardingProgressRequest {
  currentStep?: OnboardingStepName | string;
  completedSteps?: string[];
  status?: OnboardingStatus;
}

export const UpdateOnboardingProgressSchema = z.object({
  currentStep: z.string().max(50).optional(),
  completedSteps: z.array(z.string().max(50)).optional(),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']).optional(),
});

export type ReadinessItemStatus = 'READY' | 'OPTIONAL' | 'INCOMPLETE' | 'NOT_APPLICABLE';

export interface ReadinessItem {
  key: string;
  label: string;
  status: ReadinessItemStatus;
  detail?: string;
}

export interface OnboardingReadinessDto {
  overallReady: boolean;
  items: ReadinessItem[];
}

export interface OnboardingStateResponse {
  onboarding: OrganizationOnboardingDto;
  profile: OrganizationProfileDto | null;
  capabilities: OrganizationCapabilitiesDto;
  readiness: OnboardingReadinessDto;
}

export interface CompleteOnboardingResponse {
  onboarding: OrganizationOnboardingDto;
  readiness: OnboardingReadinessDto;
}

export interface BusinessTypePreset {
  id: string;
  label: string;
  description: string;
  suggestedCapabilities: Partial<typeof DEFAULT_ORGANIZATION_CAPABILITIES>;
}

export const BUSINESS_TYPE_PRESETS: BusinessTypePreset[] = [
  {
    id: 'CLINIC_HEALTHCARE',
    label: 'Clinic / Healthcare',
    description: 'Medical and dental practices offering appointments and specialist treatments.',
    suggestedCapabilities: {
      supportsBooking: true,
      supportsServices: true,
      supportsStaff: true,
      supportsLocations: true,
      supportsLeads: true,
      leadRequiredBeforeBooking: false,
      autoCreateLeadOnIntent: true,
    },
  },
  {
    id: 'SALON_BEAUTY',
    label: 'Salon / Beauty & Spa',
    description: 'Hair salons, spas, and aesthetic centers with staff-based bookings.',
    suggestedCapabilities: {
      supportsBooking: true,
      supportsServices: true,
      supportsStaff: true,
      supportsLocations: true,
      supportsLeads: true,
      leadRequiredBeforeBooking: false,
    },
  },
  {
    id: 'REAL_ESTATE',
    label: 'Real Estate / Property',
    description: 'Property agencies capturing high-value buyer/renter leads and listings.',
    suggestedCapabilities: {
      supportsLeads: true,
      supportsListings: true,
      supportsQuotes: true,
      supportsBooking: false,
      leadRequiredBeforeBooking: false,
      autoCreateLeadOnIntent: true,
    },
  },
  {
    id: 'RESTAURANT_FOOD',
    label: 'Restaurant / Food & Beverage',
    description: 'Dining venues and catering businesses taking table reservations and orders.',
    suggestedCapabilities: {
      supportsBooking: true,
      supportsOrders: true,
      supportsServices: true,
      supportsLeads: true,
    },
  },
  {
    id: 'RETAIL_ECOMMERCE',
    label: 'Retail / E-commerce',
    description: 'Online or physical stores selling physical products with inventory.',
    suggestedCapabilities: {
      supportsProducts: true,
      supportsOrders: true,
      supportsInventory: true,
      supportsBooking: false,
      supportsLeads: true,
    },
  },
  {
    id: 'PROFESSIONAL_SERVICES',
    label: 'Professional Services',
    description: 'Legal, financial, consulting, and agency advisory services.',
    suggestedCapabilities: {
      supportsLeads: true,
      supportsBooking: true,
      supportsQuotes: true,
      supportsServices: true,
      leadRequiredBeforeBooking: true,
      autoCreateLeadOnIntent: true,
    },
  },
  {
    id: 'REPAIR_MAINTENANCE',
    label: 'Repair / Home & Auto Services',
    description: 'Maintenance, mechanics, technicians, and on-site repair jobs.',
    suggestedCapabilities: {
      supportsLeads: true,
      supportsBooking: true,
      supportsQuotes: true,
      supportsServices: true,
      supportsStaff: true,
    },
  },
  {
    id: 'TRAINING_EDUCATION',
    label: 'Training / Education & Coaching',
    description: 'Courses, tutoring, academies, and private coaching sessions.',
    suggestedCapabilities: {
      supportsBooking: true,
      supportsServices: true,
      supportsLeads: true,
      supportsStaff: true,
    },
  },
  {
    id: 'TRAVEL_HOSPITALITY',
    label: 'Travel / Hospitality & Tours',
    description: 'Travel agencies, hotels, excursion organizers, and tour bookings.',
    suggestedCapabilities: {
      supportsBooking: true,
      supportsOffers: true,
      supportsLeads: true,
      supportsQuotes: true,
    },
  },
  {
    id: 'OTHER',
    label: 'Other Business',
    description: 'Custom business model with full flexibility.',
    suggestedCapabilities: {
      supportsBooking: true,
      supportsServices: true,
      supportsLeads: true,
      supportsStaff: true,
      supportsLocations: true,
    },
  },
];

