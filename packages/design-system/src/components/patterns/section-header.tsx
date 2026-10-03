import * as React from 'react';
import { cn } from '#lib/utils';

export interface SectionHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

const SectionHeader = React.forwardRef<HTMLDivElement, SectionHeaderProps>(
  ({ className, title, description, actions, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="section-header"
        className={cn('tw:flex tw:flex-col tw:gap-2 sm:tw:flex-row sm:tw:items-center sm:tw:justify-between tw:pb-3', className)}
        {...props}
      >
        <div className="tw:grid tw:gap-1">
          <h2 className="ds-text-section-title tw:text-lg tw:font-semibold tw:text-foreground">
            {title}
          </h2>
          {description && (
            <p className="ds-text-helper tw:text-sm tw:text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="tw:flex tw:items-center tw:gap-2 tw:shrink-0">
            {actions}
          </div>
        )}
      </div>
    );
  },
);
SectionHeader.displayName = 'SectionHeader';

export { SectionHeader };
