import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '#lib/utils';

const textareaVariants = cva(
  'tw:flex tw:min-h-[5rem] tw:w-full tw:rounded-md tw:border tw:bg-card tw:text-card-foreground tw:px-3 tw:py-2 tw:text-sm tw:placeholder:text-muted-foreground tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-ring tw:focus-visible:ring-offset-2 tw:disabled:cursor-not-allowed tw:disabled:opacity-50 tw:read-only:bg-muted tw:read-only:cursor-default',
  {
    variants: {
      invalid: {
        true: 'tw:border-destructive tw:focus-visible:ring-destructive',
        false: 'tw:border-input',
      },
      resizable: {
        true: 'tw:resize-y',
        false: 'tw:resize-none',
      },
    },
    defaultVariants: {
      invalid: false,
      resizable: true,
    },
  },
);

export interface TextareaProps
  extends React.ComponentProps<'textarea'>,
    VariantProps<typeof textareaVariants> {
  invalid?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, resizable, ...props }, ref) => {
    return (
      <textarea
        data-slot="textarea"
        aria-invalid={invalid || props['aria-invalid']}
        className={cn(textareaVariants({ invalid: !!invalid, resizable, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea, textareaVariants };
