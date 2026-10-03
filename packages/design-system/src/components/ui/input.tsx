import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '#lib/utils';

const inputVariants = cva(
  'tw:flex tw:w-full tw:rounded-md tw:border tw:bg-card tw:text-card-foreground tw:text-sm tw:transition-colors tw:file:border-0 tw:file:bg-transparent tw:file:text-sm tw:file:font-medium tw:placeholder:text-muted-foreground tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-ring tw:focus-visible:ring-offset-2 tw:disabled:cursor-not-allowed tw:disabled:opacity-50 tw:read-only:bg-muted tw:read-only:cursor-default',
  {
    variants: {
      size: {
        default: 'tw:min-h-[var(--ds-control-default,2.75rem)] tw:px-3 tw:py-2',
        sm: 'tw:min-h-[var(--ds-control-small,2.25rem)] tw:px-2.5 tw:py-1.5 tw:text-xs',
        lg: 'tw:min-h-[var(--ds-control-large,3rem)] tw:px-4 tw:py-3 tw:text-base',
      },
      invalid: {
        true: 'tw:border-destructive tw:focus-visible:ring-destructive',
        false: 'tw:border-input',
      },
    },
    defaultVariants: {
      size: 'default',
      invalid: false,
    },
  },
);

export interface InputProps
  extends Omit<React.ComponentProps<'input'>, 'size'>,
    VariantProps<typeof inputVariants> {
  invalid?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', size, invalid, ...props }, ref) => {
    return (
      <input
        type={type}
        data-slot="input"
        aria-invalid={invalid || props['aria-invalid']}
        className={cn(inputVariants({ size, invalid: !!invalid, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input, inputVariants };
