import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '#lib/utils';

const badgeVariants = cva(
  'tw:inline-flex tw:items-center tw:gap-1.5 tw:rounded-full tw:px-2.5 tw:py-0.5 tw:text-xs tw:font-semibold tw:transition-colors tw:select-none',
  {
    variants: {
      variant: {
        default: 'tw:bg-primary tw:text-primary-foreground',
        secondary: 'tw:bg-secondary tw:text-secondary-foreground',
        destructive: 'tw:bg-destructive tw:text-destructive-foreground',
        outline: 'tw:border tw:border-border tw:text-foreground',
        success: 'tw:bg-[var(--success-background)] tw:text-[var(--success)] tw:border tw:border-[var(--success-border)]',
        warning: 'tw:bg-[var(--warning-background)] tw:text-[var(--warning)] tw:border tw:border-[var(--warning-border)]',
        danger: 'tw:bg-[var(--danger-background)] tw:text-[var(--danger)] tw:border tw:border-[var(--danger-border)]',
        info: 'tw:bg-[var(--info-background)] tw:text-[var(--info)] tw:border tw:border-[var(--info-border)]',
      },
      size: {
        default: 'tw:px-2.5 tw:py-0.5 tw:text-xs',
        sm: 'tw:px-2 tw:py-0.25 tw:text-[0.6875rem]',
        lg: 'tw:px-3 tw:py-1 tw:text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div
      data-slot="badge"
      className={cn(badgeVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
