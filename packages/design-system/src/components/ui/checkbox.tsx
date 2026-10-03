import * as React from 'react';
import { Check, Minus } from 'lucide-react';
import { cn } from '#lib/utils';

export interface CheckboxProps
  extends Omit<React.ComponentProps<'button'>, 'onChange'> {
  checked?: boolean | 'indeterminate';
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, checked = false, onCheckedChange, disabled, id, ...props }, ref) => {
    const isIndeterminate = checked === 'indeterminate';
    const isChecked = checked === true;

    const handleClick = () => {
      if (disabled) return;
      onCheckedChange?.(!isChecked);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleClick();
      }
    };

    return (
      <button
        ref={ref}
        type="button"
        role="checkbox"
        id={id}
        data-slot="checkbox"
        aria-checked={isIndeterminate ? 'mixed' : isChecked}
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          'tw:peer tw:h-4 tw:w-4 tw:shrink-0 tw:rounded-sm tw:border tw:border-input tw:bg-card tw:transition-colors tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-ring tw:focus-visible:ring-offset-2 tw:disabled:cursor-not-allowed tw:disabled:opacity-50 tw:inline-flex tw:items-center tw:justify-center',
          (isChecked || isIndeterminate) && 'tw:bg-primary tw:text-primary-foreground tw:border-primary',
          className,
        )}
        {...props}
      >
        {isIndeterminate ? (
          <Minus className="tw:h-3 tw:w-3" strokeWidth={3} />
        ) : isChecked ? (
          <Check className="tw:h-3 tw:w-3" strokeWidth={3} />
        ) : null}
      </button>
    );
  },
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
