import * as React from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '#lib/utils';

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon, title, description, action, secondaryAction, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="empty-state"
        className={cn(
          'tw:flex tw:min-h-[16rem] tw:w-full tw:flex-col tw:items-center tw:justify-center tw:rounded-lg tw:border tw:border-dashed tw:border-border tw:bg-card/50 tw:p-8 tw:text-center tw:animate-in tw:fade-in-50',
          className,
        )}
        {...props}
      >
        <div className="tw:mx-auto tw:flex tw:h-12 tw:w-12 tw:items-center tw:justify-center tw:rounded-full tw:bg-muted tw:text-muted-foreground tw:mb-4">
          {icon ?? <Inbox className="ds-icon-empty tw:h-6 tw:w-6" />}
        </div>
        <h3 className="ds-text-card-title tw:text-lg tw:font-semibold tw:text-foreground">
          {title}
        </h3>
        {description && (
          <p className="ds-text-helper tw:mt-1.5 tw:max-w-sm tw:text-sm tw:text-muted-foreground">
            {description}
          </p>
        )}
        {(action || secondaryAction) && (
          <div className="tw:mt-6 tw:flex tw:flex-wrap tw:items-center tw:justify-center tw:gap-3">
            {action}
            {secondaryAction}
          </div>
        )}
      </div>
    );
  },
);
EmptyState.displayName = 'EmptyState';

export { EmptyState };
