import * as React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '#lib/utils';
import { Button } from '#components/ui/button';

export interface ErrorStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: React.ReactNode;
  title?: React.ReactNode;
  message: React.ReactNode;
  correlationId?: string;
  onRetry?: () => void;
  retryLabel?: React.ReactNode;
  action?: React.ReactNode;
}

const ErrorState = React.forwardRef<HTMLDivElement, ErrorStateProps>(
  ({
    className,
    icon,
    title = 'Something went wrong',
    message,
    correlationId,
    onRetry,
    retryLabel = 'Try again',
    action,
    ...props
  }, ref) => {
    return (
      <div
        ref={ref}
        role="alert"
        data-slot="error-state"
        className={cn(
          'tw:flex tw:min-h-[14rem] tw:w-full tw:flex-col tw:items-center tw:justify-center tw:rounded-lg tw:border tw:border-destructive/30 tw:bg-destructive/5 tw:p-8 tw:text-center tw:animate-in tw:fade-in-50',
          className,
        )}
        {...props}
      >
        <div className="tw:mx-auto tw:flex tw:h-12 tw:w-12 tw:items-center tw:justify-center tw:rounded-full tw:bg-destructive/10 tw:text-destructive tw:mb-4">
          {icon ?? <AlertTriangle className="tw:h-6 tw:w-6" />}
        </div>
        <h3 className="ds-text-card-title tw:text-lg tw:font-semibold tw:text-foreground">
          {title}
        </h3>
        <p className="ds-text-helper tw:mt-1.5 tw:max-w-md tw:text-sm tw:text-muted-foreground">
          {message}
        </p>
        {correlationId && (
          <p className="tw:mt-2 tw:font-mono tw:text-xs tw:text-muted-foreground">
            Ref: {correlationId}
          </p>
        )}
        {(onRetry || action) && (
          <div className="tw:mt-6 tw:flex tw:flex-wrap tw:items-center tw:justify-center tw:gap-3">
            {onRetry && (
              <Button onClick={onRetry} variant="outline" size="sm">
                <RefreshCw className="tw:me-2 tw:h-4 tw:w-4" />
                {retryLabel}
              </Button>
            )}
            {action}
          </div>
        )}
      </div>
    );
  },
);
ErrorState.displayName = 'ErrorState';

export { ErrorState };
