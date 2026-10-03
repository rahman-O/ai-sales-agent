import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '#lib/utils';

const alertVariants = cva(
  'tw:relative tw:w-full tw:rounded-lg tw:border tw:p-4 tw:text-sm [&>svg~*]:tw:ps-7 [&>svg+div]:tw:translate-y-[-3px] [&>svg]:tw:absolute [&>svg]:tw:start-4 [&>svg]:tw:top-4 [&>svg]:tw:text-foreground',
  {
    variants: {
      variant: {
        default: 'tw:bg-card tw:text-card-foreground tw:border-border',
        destructive:
          'tw:border-destructive/50 tw:text-destructive tw:bg-destructive/10 dark:tw:border-destructive [&>svg]:tw:text-destructive',
        warning:
          'tw:border-[var(--warning-border)] tw:text-[var(--warning)] tw:bg-[var(--warning-background)] [&>svg]:tw:text-[var(--warning)]',
        success:
          'tw:border-[var(--success-border)] tw:text-[var(--success)] tw:bg-[var(--success-background)] [&>svg]:tw:text-[var(--success)]',
        info:
          'tw:border-[var(--info-border)] tw:text-[var(--info)] tw:bg-[var(--info-background)] [&>svg]:tw:text-[var(--info)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      data-slot="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  ),
);
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    data-slot="alert-title"
    className={cn('ds-text-card-title tw:mb-1 tw:font-semibold tw:leading-none tw:tracking-tight', className)}
    {...props}
  />
));
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="alert-description"
    className={cn('ds-text-helper tw:text-sm [&_p]:tw:leading-relaxed', className)}
    {...props}
  />
));
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription };
