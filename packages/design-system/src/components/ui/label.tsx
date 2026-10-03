import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '#lib/utils';

const labelVariants = cva(
  'ds-text-label tw:text-sm tw:font-medium tw:leading-none tw:text-foreground peer-disabled:tw:cursor-not-allowed peer-disabled:tw:opacity-70 tw:inline-flex tw:items-center tw:gap-1',
  {
    variants: {
      size: {
        default: 'tw:text-sm',
        sm: 'tw:text-xs',
        lg: 'tw:text-base',
      },
      error: {
        true: 'tw:text-destructive',
        false: '',
      },
    },
    defaultVariants: {
      size: 'default',
      error: false,
    },
  },
);

export interface LabelProps
  extends React.ComponentProps<'label'>,
    VariantProps<typeof labelVariants> {
  required?: boolean;
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, size, error, required, children, ...props }, ref) => {
    return (
      <label
        ref={ref}
        data-slot="label"
        className={cn(labelVariants({ size, error, className }))}
        {...props}
      >
        {children}
        {required && (
          <span className="tw:text-destructive tw:font-semibold" aria-hidden="true">
            *
          </span>
        )}
      </label>
    );
  },
);
Label.displayName = 'Label';

export { Label, labelVariants };
