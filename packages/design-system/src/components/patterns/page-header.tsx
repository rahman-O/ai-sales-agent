import * as React from 'react';
import { cn } from '#lib/utils';

export interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode;
  description?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}

const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ className, title, description, breadcrumbs, badge, actions, children, ...props }, ref) => {
    return (
      <header
        ref={ref}
        data-slot="page-header"
        className={cn('tw:flex tw:flex-col tw:gap-4 tw:pb-6 tw:border-b tw:border-border', className)}
        {...props}
      >
        {breadcrumbs && <div className="tw:w-full">{breadcrumbs}</div>}
        <div className="tw:flex tw:flex-col tw:gap-4 sm:tw:flex-row sm:tw:items-center sm:tw:justify-between">
          <div className="tw:grid tw:gap-1.5 min-w-0">
            <div className="tw:flex tw:items-center tw:gap-3">
              <h1 className="ds-text-page-title tw:text-2xl sm:tw:text-3xl tw:font-semibold tw:tracking-tight tw:truncate">
                {title}
              </h1>
              {badge && <div className="tw:shrink-0">{badge}</div>}
            </div>
            {description && (
              <p className="ds-text-helper tw:text-sm tw:text-muted-foreground tw:break-words">
                {description}
              </p>
            )}
          </div>
          {actions && (
            <div className="tw:flex tw:items-center tw:gap-2 tw:shrink-0 tw:flex-wrap">
              {actions}
            </div>
          )}
        </div>
        {children}
      </header>
    );
  },
);
PageHeader.displayName = 'PageHeader';

export { PageHeader };
