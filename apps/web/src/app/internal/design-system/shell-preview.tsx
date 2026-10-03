'use client';
import { useState } from 'react';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarSection,
  SidebarItem,
  SidebarFooter,
  Topbar,
  TopbarLeading,
  TopbarTrailing,
  TopbarTitle,
  OrgSwitcher,
  AccountMenu,
  PageContainer,
  StatCard,
  StatusBadge,
} from '@ai-sales-agent/design-system';
import {
  LayoutDashboard,
  Users,
  Settings,
  ShieldAlert,
  Inbox,
  Bell,
  Search,
} from 'lucide-react';

export function ShellPreview() {
  const [activeItem, setActiveItem] = useState('dashboard');
  const [currentOrgId, setCurrentOrgId] = useState('org-1');

  const orgs = [
    { id: 'org-1', name: 'Acme Corp / شركة القمة' },
    { id: 'org-2', name: 'Global Logistics / اللوجستيات العالمية' },
  ];

  const currentOrg = orgs.find((o) => o.id === currentOrgId) || orgs[0];

  return (
    <section aria-label="Application Shell Preview" className="tw:mt-8 tw:space-y-6">
      <div className="tw:border-b tw:border-border tw:pb-2">
        <h2 className="tw:text-xl tw:font-semibold">DS-06: Application Shell Preview / هيكل التطبيق</h2>
        <p className="tw:text-sm tw:text-muted-foreground">
          Composable domain-neutral layout with accessible landmarks, keyboard navigation, and tenant-switching primitives.
        </p>
      </div>

      <div className="tw:border tw:border-border tw:rounded-lg tw:overflow-hidden tw:h-[500px] tw:flex tw:flex-col tw:bg-background">
        {/* Topbar */}
        <Topbar>
          <TopbarLeading>
            <TopbarTitle>Workspace Console / لوحة التحكم</TopbarTitle>
          </TopbarLeading>
          <TopbarTrailing>
            <button
              type="button"
              className="tw:flex tw:items-center tw:gap-2 tw:px-2 tw:py-1 tw:text-xs tw:rounded tw:border tw:border-border tw:text-muted-foreground hover:tw:bg-accent"
              aria-label="Search"
            >
              <Search className="tw:h-3.5 tw:w-3.5" />
              <span>Search... (⌘K)</span>
            </button>
            <button
              type="button"
              className="tw:p-2 tw:rounded-md tw:text-muted-foreground hover:tw:bg-accent"
              aria-label="Notifications"
            >
              <Bell className="tw:h-4 tw:w-4" />
            </button>
            <AccountMenu
              user={{
                name: 'Sarah Connor',
                email: 'sarah@example.com',
                role: 'Administrator',
              }}
              onLogout={() => {}}
            />
          </TopbarTrailing>
        </Topbar>

        {/* Body (Sidebar + Content) */}
        <div className="tw:flex tw:flex-1 tw:overflow-hidden">
          {/* Sidebar */}
          <Sidebar>
            <SidebarHeader>
              <OrgSwitcher
                currentOrg={currentOrg}
                organizations={orgs}
                onSelectOrg={setCurrentOrgId}
              />
            </SidebarHeader>
            <SidebarContent>
              <SidebarSection label="Main / الرئيسي">
                <SidebarItem
                  icon={<LayoutDashboard className="tw:h-4 tw:w-4" />}
                  label="Dashboard / الرئيسية"
                  active={activeItem === 'dashboard'}
                  onClick={() => setActiveItem('dashboard')}
                />
                <SidebarItem
                  icon={<Inbox className="tw:h-4 tw:w-4" />}
                  label="Inbox / البريد"
                  badge={<StatusBadge status="info" label="3" showIcon={false} />}
                  active={activeItem === 'inbox'}
                  onClick={() => setActiveItem('inbox')}
                />
                <SidebarItem
                  icon={<Users className="tw:h-4 tw:w-4" />}
                  label="Team / الفريق"
                  active={activeItem === 'team'}
                  onClick={() => setActiveItem('team')}
                />
              </SidebarSection>
              <SidebarSection label="System / النظام">
                <SidebarItem
                  icon={<Settings className="tw:h-4 tw:w-4" />}
                  label="Settings / الإعدادات"
                  active={activeItem === 'settings'}
                  onClick={() => setActiveItem('settings')}
                />
                <SidebarItem
                  icon={<ShieldAlert className="tw:h-4 tw:w-4" />}
                  label="Audit Log / سجل التدقيق"
                  active={activeItem === 'audit'}
                  onClick={() => setActiveItem('audit')}
                />
              </SidebarSection>
            </SidebarContent>
            <SidebarFooter>
              <div className="tw:flex tw:items-center tw:gap-2 tw:text-xs tw:text-muted-foreground">
                <span className="tw:h-2 tw:w-2 tw:rounded-full tw:bg-emerald-500" />
                <span>System Operational</span>
              </div>
            </SidebarFooter>
          </Sidebar>

          {/* Main Area */}
          <main className="tw:flex-1 tw:overflow-y-auto tw:bg-muted/20">
            <PageContainer maxWidth="xl">
              <div className="tw:grid tw:grid-cols-1 sm:tw:grid-cols-3 tw:gap-4">
                <StatCard
                  title="Active Conversations"
                  value="1,420"
                  trend={{ direction: 'up', value: '+14%', label: 'vs last week' }}
                />
                <StatCard
                  title="Resolution Rate"
                  value="98.2%"
                  trend={{ direction: 'up', value: '+0.8%', label: 'vs target' }}
                />
                <StatCard
                  title="Pending Reviews"
                  value="4"
                  trend={{ direction: 'neutral', value: '0', label: 'steady' }}
                />
              </div>
            </PageContainer>
          </main>
        </div>
      </div>
    </section>
  );
}
