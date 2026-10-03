import * as React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { cn } from '#lib/utils';

export interface MetricProps extends React.HTMLAttributes<HTMLDivElement> {
  value: React.ReactNode;
  unit?: React.ReactNode;
  size?: 'md' | 'lg';
}

function Metric({ value, unit, size = 'md', className, ...props }: MetricProps) {
  const sizeClasses = size === 'lg' ? 'ds-text-metric-lg tw:text-3xl' : 'ds-text-metric-md tw:text-2xl';

  return (
    <div
      data-slot="metric"
      className={cn('tw:flex tw:items-baseline tw:gap-1.5 tw:font-semibold tw:text-foreground', className)}
      {...props}
    >
      <span className={cn(sizeClasses, 'tw:tracking-tight')}>{value}</span>
      {unit && <span className="tw:text-sm tw:font-normal tw:text-muted-foreground">{unit}</span>}
    </div>
  );
}

export interface TrendMetricProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string | number;
  direction?: 'up' | 'down' | 'neutral';
  positiveIsGood?: boolean;
}

function TrendMetric({
  value,
  direction = 'neutral',
  positiveIsGood = true,
  className,
  ...props
}: TrendMetricProps) {
  const isPositive = direction === 'up';
  const isNegative = direction === 'down';

  const colorClass = React.useMemo(() => {
    if (direction === 'neutral') return 'tw:text-muted-foreground';
    if (isPositive) return positiveIsGood ? 'tw:text-[var(--success)]' : 'tw:text-destructive';
    if (isNegative) return positiveIsGood ? 'tw:text-destructive' : 'tw:text-[var(--success)]';
    return 'tw:text-muted-foreground';
  }, [direction, isPositive, isNegative, positiveIsGood]);

  const Icon = isPositive ? ArrowUpRight : isNegative ? ArrowDownRight : Minus;

  return (
    <div
      data-slot="trend-metric"
      className={cn('tw:inline-flex tw:items-center tw:gap-1 tw:text-xs tw:font-medium', colorClass, className)}
      {...props}
    >
      <Icon className="tw:h-3.5 tw:w-3.5 tw:shrink-0" />
      <span>{value}</span>
    </div>
  );
}

export { Metric, TrendMetric };
