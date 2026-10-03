import * as React from 'react';
import { cn } from '#lib/utils';
import { StatusBadge, type StatusCategory } from '#components/patterns/status-badge';

export interface AuditEventRowProps extends React.HTMLAttributes<HTMLDivElement> {
  actor: React.ReactNode;
  action: React.ReactNode;
  target?: React.ReactNode;
  timestamp: string | Date;
  status?: StatusCategory;
  statusLabel?: React.ReactNode;
  metadata?: Record<string, string | number | boolean>;
}

const AuditEventRow = React.forwardRef<HTMLDivElement, AuditEventRowProps>(
  ({ className, actor, action, target, timestamp, status = 'neutral', statusLabel, metadata, ...props }, ref) => {
    const formattedDate = typeof timestamp === 'string'
      ? timestamp
      : timestamp.toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        });

    return (
      <div
        ref={ref}
        data-slot="audit-event-row"
        className={cn(
          'tw:flex tw:flex-col sm:tw:flex-row sm:tw:items-center sm:tw:justify-between tw:gap-3 tw:p-4 tw:rounded-md tw:border tw:border-border tw:bg-card tw:text-sm',
          className,
        )}
        {...props}
      >
        <div className="tw:flex tw:items-start tw:gap-3">
          <StatusBadge status={status} label={statusLabel} />
          <div className="tw:grid tw:gap-0.5">
            <div className="tw:font-medium tw:text-foreground">
              <span className="tw:font-semibold">{actor}</span>{' '}
              <span className="tw:text-muted-foreground">{action}</span>{' '}
              {target && <span className="tw:font-medium">{target}</span>}
            </div>
            {metadata && (
              <div className="tw:flex tw:flex-wrap tw:gap-2 tw:pt-1">
                {Object.entries(metadata).map(([key, val]) => (
                  <span
                    key={key}
                    className="tw:font-mono tw:text-xs tw:bg-muted tw:px-1.5 tw:py-0.5 tw:rounded-xs tw:text-muted-foreground"
                  >
                    {key}: {String(val)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="tw:text-xs tw:text-muted-foreground tw:shrink-0 sm:tw:text-end">
          <time dateTime={typeof timestamp === 'string' ? timestamp : timestamp.toISOString()}>
            {formattedDate}
          </time>
        </div>
      </div>
    );
  },
);
AuditEventRow.displayName = 'AuditEventRow';

export { AuditEventRow };
