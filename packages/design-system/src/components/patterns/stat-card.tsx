import * as React from 'react';
import { cn } from '#lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '#components/ui/card';
import { Metric, TrendMetric } from '#components/patterns/metric';

export interface StatCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  trend?: {
    value: string | number;
    direction?: 'up' | 'down' | 'neutral';
    label?: string;
  };
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, title, value, unit, description, icon, trend, ...props }, ref) => {
    return (
      <Card ref={ref} data-slot="stat-card" className={cn('tw:flex tw:flex-col', className)} {...props}>
        <CardHeader className="tw:flex tw:flex-row tw:items-center tw:justify-between tw:space-y-0 tw:pb-2">
          <CardTitle className="tw:text-sm tw:font-medium tw:text-muted-foreground">{title}</CardTitle>
          {icon && <div className="tw:text-muted-foreground tw:shrink-0">{icon}</div>}
        </CardHeader>
        <CardContent className="tw:flex tw:flex-col tw:gap-1.5">
          <Metric value={value} unit={unit} size="lg" />
          {(description || trend) && (
            <div className="tw:flex tw:items-center tw:gap-2 tw:text-xs tw:text-muted-foreground">
              {trend && (
                <TrendMetric value={trend.value} direction={trend.direction} />
              )}
              {trend?.label && <span>{trend.label}</span>}
              {description && !trend?.label && <span>{description}</span>}
            </div>
          )}
        </CardContent>
      </Card>
    );
  },
);
StatCard.displayName = 'StatCard';

export { StatCard };
