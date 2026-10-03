import * as React from 'react';
import { cn } from '#lib/utils';
import { Badge } from '#components/ui/badge';
import { CheckCircle2, AlertCircle, Clock, PauseCircle, HelpCircle, Info, ShieldCheck, ShieldAlert } from 'lucide-react';

export type StatusCategory =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'pending'
  | 'paused';

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: StatusCategory;
  label?: React.ReactNode;
  showIcon?: boolean;
}

function StatusBadge({
  status,
  label,
  showIcon = true,
  className,
  ...props
}: StatusBadgeProps) {
  const config = React.useMemo(() => {
    switch (status) {
      case 'success':
        return {
          variant: 'success' as const,
          icon: <CheckCircle2 className="tw:h-3 tw:w-3" />,
          defaultLabel: 'Success',
        };
      case 'warning':
        return {
          variant: 'warning' as const,
          icon: <AlertCircle className="tw:h-3 tw:w-3" />,
          defaultLabel: 'Warning',
        };
      case 'danger':
        return {
          variant: 'danger' as const,
          icon: <AlertCircle className="tw:h-3 tw:w-3" />,
          defaultLabel: 'Danger',
        };
      case 'info':
        return {
          variant: 'info' as const,
          icon: <Info className="tw:h-3 tw:w-3" />,
          defaultLabel: 'Info',
        };
      case 'pending':
        return {
          variant: 'warning' as const,
          icon: <Clock className="tw:h-3 tw:w-3" />,
          defaultLabel: 'Pending',
        };
      case 'paused':
        return {
          variant: 'secondary' as const,
          icon: <PauseCircle className="tw:h-3 tw:w-3" />,
          defaultLabel: 'Paused',
        };
      case 'neutral':
      default:
        return {
          variant: 'outline' as const,
          icon: <HelpCircle className="tw:h-3 tw:w-3" />,
          defaultLabel: 'Unknown',
        };
    }
  }, [status]);

  return (
    <Badge
      variant={config.variant}
      data-slot="status-badge"
      className={cn('tw:inline-flex tw:items-center tw:gap-1.5', className)}
      {...props}
    >
      {showIcon && config.icon}
      <span>{label ?? config.defaultLabel}</span>
    </Badge>
  );
}

export interface CapabilityBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  name: React.ReactNode;
  enabled?: boolean;
}

function CapabilityBadge({ name, enabled = true, className, ...props }: CapabilityBadgeProps) {
  return (
    <Badge
      variant={enabled ? 'secondary' : 'outline'}
      data-slot="capability-badge"
      className={cn(
        'tw:inline-flex tw:items-center tw:gap-1.5 tw:font-normal',
        !enabled && 'tw:opacity-60 tw:line-through',
        className,
      )}
      {...props}
    >
      {enabled ? (
        <ShieldCheck className="tw:h-3 tw:w-3 tw:text-[var(--success)]" />
      ) : (
        <ShieldAlert className="tw:h-3 tw:w-3 tw:text-muted-foreground" />
      )}
      <span>{name}</span>
    </Badge>
  );
}

export { StatusBadge, CapabilityBadge };
