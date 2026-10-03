import * as React from 'react';
import { cn } from '#lib/utils';

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, ...props }, ref) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        data-slot="progress"
        className={cn(
          'tw:relative tw:h-2 tw:w-full tw:overflow-hidden tw:rounded-full tw:bg-muted',
          className,
        )}
        {...props}
      >
        <div
          className="tw:h-full tw:w-full tw:flex-1 tw:bg-primary tw:transition-all duration-200"
          style={{ transform: `translateX(-${100 - percentage}%)` }}
        />
      </div>
    );
  },
);
Progress.displayName = 'Progress';

export { Progress };
