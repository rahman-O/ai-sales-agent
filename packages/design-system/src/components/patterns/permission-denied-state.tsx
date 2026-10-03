import * as React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { cn } from '#lib/utils';
import { Button } from '#components/ui/button';

export interface PermissionDeniedStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: React.ReactNode;
  title?: React.ReactNode;
  message?: React.ReactNode;
  action?: React.ReactNode;
  onGoBack?: () => void;
  goBackLabel?: React.ReactNode;
}

const PermissionDeniedState = React.forwardRef<HTMLDivElement, PermissionDeniedStateProps>(
  ({
    className,
    icon,
    title = 'Access Denied / غير مصرح بالوصول',
    message = 'You do not have permission to view or manage this resource. Please contact your organization administrator.',
    action,
    onGoBack,
    goBackLabel = 'Go back / الرجوع',
    ...props
  }, ref) => {
    return (
      <div
        ref={ref}
        role="alert"
        data-slot="permission-denied-state"
        className={cn(
          'tw:flex tw:min-h-[14rem] tw:w-full tw:flex-col tw:items-center tw:justify-center tw:rounded-lg tw:border tw:border-border tw:bg-muted/40 tw:p-8 tw:text-center tw:animate-in tw:fade-in-50',
          className,
        )}
        {...props}
      >
        <div className="tw:mx-auto tw:flex tw:h-12 tw:w-12 tw:items-center tw:justify-center tw:rounded-full tw:bg-muted tw:text-muted-foreground tw:mb-4">
          {icon ?? <ShieldAlert className="tw:h-6 tw:w-6" />}
        </div>
        <h3 className="ds-text-card-title tw:text-lg tw:font-semibold tw:text-foreground">
          {title}
        </h3>
        <p className="ds-text-helper tw:mt-1.5 tw:max-w-md tw:text-sm tw:text-muted-foreground">
          {message}
        </p>
        {(action || onGoBack) && (
          <div className="tw:mt-6 tw:flex tw:flex-wrap tw:items-center tw:justify-center tw:gap-3">
            {onGoBack && (
              <Button onClick={onGoBack} variant="outline" size="sm">
                <ArrowLeft className="tw:me-2 tw:h-4 tw:w-4 rtl:tw:rotate-180" />
                {goBackLabel}
              </Button>
            )}
            {action}
          </div>
        )}
      </div>
    );
  },
);
PermissionDeniedState.displayName = 'PermissionDeniedState';

export { PermissionDeniedState };
