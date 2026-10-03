import * as React from 'react';
import { cn } from '#lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '#components/ui/card';

export interface SettingsSectionProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

const SettingsSection = React.forwardRef<HTMLDivElement, SettingsSectionProps>(
  ({ className, title, description, action, children, ...props }, ref) => {
    return (
      <Card ref={ref} data-slot="settings-section" className={cn('tw:divide-y tw:divide-border', className)} {...props}>
        <CardHeader className="tw:flex tw:flex-col sm:tw:flex-row sm:tw:items-center sm:tw:justify-between tw:gap-3">
          <div className="tw:grid tw:gap-1">
            <CardTitle className="tw:text-base tw:font-semibold">{title}</CardTitle>
            {description && (
              <CardDescription className="tw:text-xs tw:text-muted-foreground">
                {description}
              </CardDescription>
            )}
          </div>
          {action && <div className="tw:shrink-0">{action}</div>}
        </CardHeader>
        <CardContent className="tw:divide-y tw:divide-border tw:p-0">
          {children}
        </CardContent>
      </Card>
    );
  },
);
SettingsSection.displayName = 'SettingsSection';

export interface SettingsRowProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  description?: React.ReactNode;
  control?: React.ReactNode;
  fullWidth?: boolean;
}

const SettingsRow = React.forwardRef<HTMLDivElement, SettingsRowProps>(
  ({ className, label, description, control, fullWidth = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="settings-row"
        className={cn(
          'tw:flex tw:flex-col tw:gap-3 tw:p-6 sm:tw:flex-row sm:tw:items-center sm:tw:justify-between',
          fullWidth && 'tw:flex-col sm:tw:items-start',
          className,
        )}
        {...props}
      >
        <div className="tw:grid tw:gap-1 tw:max-w-xl">
          <span className="tw:text-sm tw:font-medium tw:text-foreground">{label}</span>
          {description && (
            <span className="tw:text-xs tw:text-muted-foreground">{description}</span>
          )}
        </div>
        {(control || children) && (
          <div className="tw:shrink-0 tw:flex tw:items-center tw:gap-2">
            {control}
            {children}
          </div>
        )}
      </div>
    );
  },
);
SettingsRow.displayName = 'SettingsRow';

export { SettingsSection, SettingsRow };
