'use client';
import { useState } from 'react';
import {
  PageHeader,
  SectionHeader,
  StatCard,
  Metric,
  TrendMetric,
  StatusBadge,
  CapabilityBadge,
  EmptyState,
  ErrorState,
  PermissionDeniedState,
  SettingsSection,
  SettingsRow,
  DataList,
  InfoRow,
  AuditEventRow,
  SearchField,
  FilterBar,
  DataTable,
  type ColumnDef,
  Button,
  Switch,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@ai-sales-agent/design-system';
import { Activity, Users, DollarSign, Plus, Download } from 'lucide-react';

interface SampleRow {
  id: string;
  name: string;
  category: string;
  status: 'success' | 'warning' | 'danger';
  amount: string;
}

export function PatternsPreview() {
  const [searchValue, setSearchValue] = useState('');
  const [filterType, setFilterType] = useState('all');

  const sampleData: SampleRow[] = [
    { id: '1', name: 'VIP Consultation / استشارة خاصة', category: 'Premium', status: 'success', amount: '250 SAR' },
    { id: '2', name: 'Standard Follow-up / متابعة دورية', category: 'Standard', status: 'warning', amount: '120 SAR' },
    { id: '3', name: 'Express Diagnosis / تشخيص سريع', category: 'Priority', status: 'danger', amount: '350 SAR' },
  ];

  const columns: ColumnDef<SampleRow>[] = [
    {
      key: 'name',
      header: 'Service / الخدمة',
      cell: (row) => <span className="tw:font-medium">{row.name}</span>,
      sortable: true,
    },
    {
      key: 'category',
      header: 'Category / الفئة',
      cell: (row) => <span className="tw:text-muted-foreground">{row.category}</span>,
    },
    {
      key: 'status',
      header: 'Status / الحالة',
      cell: (row) => <StatusBadge status={row.status} label={row.status.toUpperCase()} />,
    },
    {
      key: 'amount',
      header: 'Amount / المبلغ',
      cell: (row) => <span className="tw:font-mono">{row.amount}</span>,
      align: 'end',
      sortable: true,
    },
  ];

  return (
    <section aria-label="Product Components & Patterns" className="tw:mt-12 tw:grid tw:gap-8">
      <div className="tw:border-b tw:border-border tw:pb-2">
        <h2 className="ds-text-section-title">DS-05 Product Patterns / أنماط منتجات النظام</h2>
        <p className="ds-text-helper">Reusable SaaS patterns with strict domain neutrality</p>
      </div>

      {/* PageHeader Pattern */}
      <PageHeader
        title="Operations Overview / نظرة عامة على العمليات"
        description="Monitor organization metrics, agent throughput and customer activity in real time."
        badge={<StatusBadge status="success" label="Live / مباشر" />}
        actions={
          <>
            <Button variant="outline" size="sm">
              <Download className="tw:me-1.5 tw:h-4 tw:w-4" /> Export Report
            </Button>
            <Button size="sm">
              <Plus className="tw:me-1.5 tw:h-4 tw:w-4" /> New Operation
            </Button>
          </>
        }
      />

      {/* Stat Cards & Metrics */}
      <div>
        <SectionHeader
          title="Performance Metrics / مؤشرات الأداء"
          description="High-level operational stats and trend analysis"
        />
        <div className="tw:grid tw:gap-4 sm:tw:grid-cols-2 lg:tw:grid-cols-4 tw:mt-3">
          <StatCard
            title="Total Revenue / إجمالي الإيرادات"
            value="48,250"
            unit="SAR"
            icon={<DollarSign className="tw:h-5 tw:w-5" />}
            trend={{ value: '+14.2%', direction: 'up', label: 'vs last week' }}
          />
          <StatCard
            title="Active Conversations / المحادثات النشطة"
            value="1,280"
            icon={<Users className="tw:h-5 tw:w-5" />}
            trend={{ value: '+5.8%', direction: 'up', label: 'vs yesterday' }}
          />
          <StatCard
            title="Response Latency / زمن الاستجابة"
            value="420"
            unit="ms"
            icon={<Activity className="tw:h-5 tw:w-5" />}
            trend={{ value: '-8.1%', direction: 'down', label: 'improvement' }}
          />
          <StatCard
            title="Escalation Rate / معدل التحويل"
            value="2.4%"
            trend={{ value: '0.0%', direction: 'neutral', label: 'steady' }}
          />
        </div>
      </div>

      {/* FilterBar & SearchField & DataTable */}
      <div>
        <SectionHeader
          title="Data Exploration & Table / استعراض البيانات"
          description="Generic searchable, filterable table pattern"
        />
        <div className="tw:mt-3 tw:flex tw:flex-col tw:gap-3">
          <FilterBar
            searchSlot={
              <SearchField
                value={searchValue}
                onChange={setSearchValue}
                placeholder="Search transactions..."
                size="sm"
              />
            }
            filtersSlot={
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="tw:h-9 tw:text-xs tw:w-40">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                </SelectContent>
              </Select>
            }
            activeFilterCount={searchValue || filterType !== 'all' ? 1 : 0}
            onResetFilters={() => {
              setSearchValue('');
              setFilterType('all');
            }}
          />

          <DataTable columns={columns} data={sampleData} />
        </div>
      </div>

      {/* Settings Section & Rows */}
      <div>
        <SectionHeader
          title="Settings Section / قسم الإعدادات"
          description="Standard key-value configuration rows"
        />
        <SettingsSection
          title="Notification Preferences / تفضيلات الإشعارات"
          description="Configure how and when system alerts are delivered."
        >
          <SettingsRow
            label="Email Summaries / تقارير البريد"
            description="Receive daily digest of unhandled client requests."
            control={<Switch defaultChecked />}
          />
          <SettingsRow
            label="Real-time Webhook / إشعارات فورية"
            description="Send webhook events on agent state transitions."
            control={<Switch />}
          />
        </SettingsSection>
      </div>

      {/* DataList & InfoRows */}
      <div>
        <SectionHeader title="Entity Metadata / بيانات تفصيلية" />
        <div className="tw:p-4 tw:rounded-lg tw:border tw:border-border tw:bg-card">
          <DataList columns={3}>
            <InfoRow label="Organization ID" value="org_98234a" copyable />
            <InfoRow label="Primary Currency" value="SAR (Saudi Riyal)" />
            <InfoRow label="Timezone" value="Asia/Riyadh (UTC+3)" />
            <InfoRow label="Capabilities" value={<CapabilityBadge name="AI Agent" enabled />} />
            <InfoRow label="Booking Engine" value={<CapabilityBadge name="Booking" enabled />} />
            <InfoRow label="Quotes Module" value={<CapabilityBadge name="Quotes" enabled={false} />} />
          </DataList>
        </div>
      </div>

      {/* Audit Event Row */}
      <div>
        <SectionHeader title="Audit Log Row / سجل العمليات" />
        <div className="tw:flex tw:flex-col tw:gap-2">
          <AuditEventRow
            actor="Admin User (admin@company.com)"
            action="updated policy parameter"
            target="Booking Cancellation Window"
            timestamp={new Date()}
            status="info"
            statusLabel="Audit"
            metadata={{ windowHours: 24, previous: 48 }}
          />
        </div>
      </div>

      {/* Empty / Error / Permission States */}
      <div>
        <SectionHeader title="State Containers (Empty, Error, Denied)" />
        <div className="tw:grid tw:gap-4 md:tw:grid-cols-3">
          <EmptyState
            title="No Conversations Yet / لا توجد محادثات بعد"
            description="When customers message your business channel, conversations will appear here."
            action={<Button size="sm">Connect Channel</Button>}
          />

          <ErrorState
            title="Connection Failed / فشل الاتصال"
            message="Could not reach the real-time event pipeline."
            correlationId="err_sync_409a"
            onRetry={() => alert('Retrying...')}
          />

          <PermissionDeniedState
            title="Restricted Access / وصول مقيّد"
            message="You need Organization Administrator rights to manage business rules."
          />
        </div>
      </div>
    </section>
  );
}
