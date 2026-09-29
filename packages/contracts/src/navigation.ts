import type { OrganizationCapabilitiesDto } from './organization.js';

export type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export type NavModuleId =
  | 'dashboard'
  | 'inbox'
  | 'leads'
  | 'bookings'
  | 'schedule'
  | 'follow-ups'
  | 'knowledge'
  | 'analytics'
  | 'settings-channels'
  | 'settings-templates'
  | 'products'
  | 'orders'
  | 'quotes'
  | 'offers'
  | 'policies'
  | 'settings-ai'
  | 'inventory'
  | 'listings';

export type NavGroup = 'WORKSPACE' | 'OPERATIONS' | 'GROWTH' | 'ADMIN';

export type ModuleImplementationStatus = 'IMPLEMENTED' | 'COMING_SOON' | 'DEFERRED';

export interface DashboardNavItem {
  id: NavModuleId;
  label: string;
  labelAr: string;
  href: string;
  group: NavGroup;
  order: number;
  requiredCapability?: keyof OrganizationCapabilitiesDto;
  requiredRole?: MemberRole[];
  implementationStatus: ModuleImplementationStatus;
  description?: string;
  descriptionAr?: string;
}

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  // WORKSPACE
  {
    id: 'dashboard',
    label: 'Overview',
    labelAr: 'نظرة عامة',
    href: '/dashboard',
    group: 'WORKSPACE',
    order: 10,
    implementationStatus: 'IMPLEMENTED',
    description: 'Operator workspace & operational health overview',
  },
  {
    id: 'inbox',
    label: 'Inbox',
    labelAr: 'صندوق المحادثات',
    href: '/inbox',
    group: 'WORKSPACE',
    order: 20,
    implementationStatus: 'IMPLEMENTED',
    description: 'Real-time conversations & customer messages',
  },
  {
    id: 'leads',
    label: 'Leads',
    labelAr: 'العملاء المحتملين',
    href: '/leads',
    group: 'WORKSPACE',
    order: 30,
    requiredCapability: 'supportsLeads',
    implementationStatus: 'IMPLEMENTED',
    description: 'Sales leads pipeline & qualification',
  },

  // OPERATIONS
  {
    id: 'bookings',
    label: 'Bookings',
    labelAr: 'الحجوزات',
    href: '/bookings',
    group: 'OPERATIONS',
    order: 40,
    requiredCapability: 'supportsBooking',
    implementationStatus: 'IMPLEMENTED',
    description: 'Confirmed customer appointments and schedule',
  },
  {
    id: 'schedule',
    label: 'Schedule',
    labelAr: 'جدول المواعيد',
    href: '/schedule',
    group: 'OPERATIONS',
    order: 50,
    requiredCapability: 'supportsBooking',
    implementationStatus: 'IMPLEMENTED',
    description: 'Staff shifts and availability calendar',
  },
  {
    id: 'follow-ups',
    label: 'Follow-ups',
    labelAr: 'المتابعات التلقائية',
    href: '/follow-ups',
    group: 'OPERATIONS',
    order: 60,
    implementationStatus: 'IMPLEMENTED',
    description: 'Automated patient/customer re-engagement queue',
  },
  {
    id: 'products',
    label: 'Products',
    labelAr: 'المنتجات',
    href: '/products',
    group: 'OPERATIONS',
    order: 70,
    requiredCapability: 'supportsProducts',
    implementationStatus: 'COMING_SOON',
    description: 'Product catalog (Available in upcoming phase)',
  },
  {
    id: 'orders',
    label: 'Orders',
    labelAr: 'الطلبات',
    href: '/orders',
    group: 'OPERATIONS',
    order: 80,
    requiredCapability: 'supportsOrders',
    implementationStatus: 'IMPLEMENTED',
    description: 'Customer order tracking & fulfillment',
    descriptionAr: 'متابعة وإدارة طلبات العملاء',
  },
  {
    id: 'inventory',
    label: 'Inventory',
    labelAr: 'المخزون',
    href: '/inventory',
    group: 'OPERATIONS',
    order: 90,
    requiredCapability: 'supportsInventory',
    implementationStatus: 'COMING_SOON',
    description: 'Stock management (Available in upcoming phase)',
  },
  {
    id: 'listings',
    label: 'Listings',
    labelAr: 'العقارات / القوائم',
    href: '/listings',
    group: 'OPERATIONS',
    order: 100,
    requiredCapability: 'supportsListings',
    implementationStatus: 'COMING_SOON',
    description: 'Property / itemized listings (Available in upcoming phase)',
  },

  // GROWTH
  {
    id: 'knowledge',
    label: 'Knowledge',
    labelAr: 'قاعدة المعرفة',
    href: '/knowledge',
    group: 'GROWTH',
    order: 110,
    implementationStatus: 'IMPLEMENTED',
    description: 'AI knowledge base documents & search embeddings',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    labelAr: 'التحليلات',
    href: '/analytics',
    group: 'GROWTH',
    order: 120,
    implementationStatus: 'IMPLEMENTED',
    description: 'Performance metrics, conversions, and AI telemetry',
  },
  {
    id: 'offers',
    label: 'Offers',
    labelAr: 'العروض والخصومات',
    href: '/offers',
    group: 'GROWTH',
    order: 130,
    requiredCapability: 'supportsOffers',
    implementationStatus: 'IMPLEMENTED',
    description: 'Promotional offers, discounts & special campaigns',
    descriptionAr: 'العروض الترويجية والخصومات والحملات الخاصة',
  },
  {
    id: 'quotes',
    label: 'Quotes',
    labelAr: 'عروض الأسعار',
    href: '/quotes',
    group: 'GROWTH',
    order: 140,
    requiredCapability: 'supportsQuotes',
    implementationStatus: 'IMPLEMENTED',
    description: 'Quotations and commercial proposals',
    descriptionAr: 'عروض الأسعار والمقترحات التجارية',
  },

  {
    id: 'policies',
    label: 'Policies',
    labelAr: 'سياسات العمل',
    href: '/policies',
    group: 'ADMIN',
    order: 145,
    requiredRole: ['OWNER', 'ADMIN'],
    implementationStatus: 'IMPLEMENTED',
    description: 'Structured and informational business policies',
    descriptionAr: 'سياسات العمل المنظمة والتفسيرية',
  },
  {
    id: 'settings-ai',
    label: 'AI Style & Tone',
    labelAr: 'أسلوب ومظهر المساعد',
    href: '/settings/ai',
    group: 'ADMIN',
    order: 148,
    requiredRole: ['OWNER', 'ADMIN'],
    implementationStatus: 'IMPLEMENTED',
    description: 'Assistant personality, language dialect, tone, and conversation style',
    descriptionAr: 'شخصية المساعد، اللهجة، النبرة، وأسلوب المحادثة',
  },

  // ADMIN
  {
    id: 'settings-channels',
    label: 'Channels',
    labelAr: 'القنوات والربط',
    href: '/settings/channels',
    group: 'ADMIN',
    order: 150,
    requiredRole: ['OWNER', 'ADMIN'],
    implementationStatus: 'IMPLEMENTED',
    description: 'WhatsApp / Meta messaging connection configuration',
  },
  {
    id: 'settings-templates',
    label: 'Templates',
    labelAr: 'قوالب الرسائل',
    href: '/settings/templates',
    group: 'ADMIN',
    order: 160,
    requiredRole: ['OWNER', 'ADMIN'],
    implementationStatus: 'IMPLEMENTED',
    description: 'Follow-up and system message template versions',
  },
];

export const ALWAYS_AVAILABLE_MODULE_IDS: NavModuleId[] = [
  'dashboard',
  'inbox',
  'follow-ups',
  'knowledge',
  'analytics',
  'settings-ai',
];

export interface NavigationFilterOptions {
  includeComingSoon?: boolean;
}

export function filterNavItems(
  items: DashboardNavItem[],
  capabilities: Partial<OrganizationCapabilitiesDto>,
  userRole?: MemberRole,
  options?: NavigationFilterOptions,
): DashboardNavItem[] {
  return items.filter((item) => {
    // 1. Implementation status check
    if (item.implementationStatus !== 'IMPLEMENTED') {
      if (!options?.includeComingSoon) return false;
    }

    // 2. Role requirement check
    if (item.requiredRole && userRole && !item.requiredRole.includes(userRole)) {
      return false;
    }

    // 3. Capability requirement check
    if (item.requiredCapability) {
      const capValue = capabilities[item.requiredCapability];
      if (capValue === false) {
        return false;
      }
    }

    return true;
  });
}

export function evaluateRouteAccess(
  pathname: string,
  capabilities: Partial<OrganizationCapabilitiesDto>,
  userRole?: MemberRole,
): { allowed: boolean; reason?: string; item?: DashboardNavItem } {
  // Normalize pathname (e.g. /bookings/123 -> /bookings)
  const item = DASHBOARD_NAV_ITEMS.find((nav) => {
    if (pathname === nav.href) return true;
    if (nav.href !== '/dashboard' && pathname.startsWith(nav.href + '/')) return true;
    return false;
  });

  if (!item) {
    // Route not governed by central nav
    return { allowed: true };
  }

  // Check capability
  if (item.requiredCapability) {
    const hasCap = capabilities[item.requiredCapability];
    if (hasCap === false) {
      return {
        allowed: false,
        reason: `CAPABILITY_DISABLED: This organization does not have the '${item.requiredCapability}' capability enabled.`,
        item,
      };
    }
  }

  // Check role
  if (item.requiredRole && userRole && !item.requiredRole.includes(userRole)) {
    return {
      allowed: false,
      reason: `FORBIDDEN: Requires one of [${item.requiredRole.join(', ')}] roles.`,
      item,
    };
  }

  return { allowed: true, item };
}
