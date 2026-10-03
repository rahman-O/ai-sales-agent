import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '#lib/utils';

const spinnerVariants = cva(
  'tw:inline-block tw:animate-spin tw:rounded-full tw:border-solid tw:border-current tw:border-e-transparent tw:align-[-0.125em] motion-reduce:tw:animate-[spin_1.5s_linear_infinite]',
  {
    variants: {
      size: {
        default: 'tw:h-5 tw:w-5 tw:border-2',
        sm: 'tw:h-4 tw:w-4 tw:border-2',
        lg: 'tw:h-8 tw:w-8 tw:border-3',
        xl: 'tw:h-12 tw:w-12 tw:border-4',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
);

export interface SpinnerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof spinnerVariants> {
  label?: string;
}

const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(
  ({ className, size, label = 'Loading...', ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="status"
        aria-label={label}
        className={cn(spinnerVariants({ size, className }))}
        {...props}
      >
        <span className="tw:sr-only">{label}</span>
      </div>
    );
  },
);
Spinner.displayName = 'Spinner';

export { Spinner, spinnerVariants };
