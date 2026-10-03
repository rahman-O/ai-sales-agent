import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '#lib/utils';
import { Spinner } from '#components/ui/spinner';

const buttonVariants = cva(
  'ds-button tw:inline-flex tw:items-center tw:justify-center tw:gap-2 tw:rounded-md tw:font-medium tw:transition-colors tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-ring tw:focus-visible:ring-offset-2 tw:disabled:pointer-events-none tw:disabled:opacity-50 tw:select-none tw:shrink-0',
  {
    variants: {
      variant: {
        default: 'tw:bg-primary tw:text-primary-foreground hover:tw:opacity-90',
        secondary: 'tw:bg-secondary tw:text-secondary-foreground hover:tw:opacity-90',
        destructive: 'tw:bg-destructive tw:text-destructive-foreground hover:tw:opacity-90',
        outline: 'tw:border tw:border-border tw:bg-transparent tw:text-foreground hover:tw:bg-muted',
        ghost: 'tw:bg-transparent tw:text-foreground hover:tw:bg-muted',
        link: 'tw:text-primary tw:underline-offset-4 hover:tw:underline tw:bg-transparent',
      },
      size: {
        default: 'tw:min-h-[var(--ds-control-default,2.75rem)] tw:px-4 tw:py-2 tw:text-sm',
        sm: 'tw:min-h-[var(--ds-control-small,2.25rem)] tw:px-3 tw:py-1.5 tw:text-xs',
        lg: 'tw:min-h-[var(--ds-control-large,3rem)] tw:px-6 tw:py-3 tw:text-base',
        icon: 'tw:min-h-[var(--ds-control-default,2.75rem)] tw:w-[var(--ds-control-default,2.75rem)] tw:p-0',
        iconSm: 'tw:min-h-[var(--ds-control-small,2.25rem)] tw:w-[var(--ds-control-small,2.25rem)] tw:p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ComponentProps<'button'>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  loadingText?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading = false, loadingText, disabled, children, type = 'button', ...props }, ref) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type={type}
        data-slot="button"
        disabled={isDisabled}
        aria-disabled={isDisabled ? 'true' : undefined}
        aria-busy={loading ? 'true' : undefined}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {loading ? (
          <>
            <Spinner size="sm" className="tw:shrink-0" />
            {loadingText || children}
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
