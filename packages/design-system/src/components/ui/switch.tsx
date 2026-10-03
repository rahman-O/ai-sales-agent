import * as React from 'react';
import { cn } from '#lib/utils';

export interface SwitchProps
  extends Omit<React.ComponentProps<'button'>, 'onChange'> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked: controlledChecked, defaultChecked = false, onCheckedChange, disabled, id, ...props }, ref) => {
    const [uncontrolledChecked, setUncontrolledChecked] = React.useState(defaultChecked);
    const isControlled = controlledChecked !== undefined;
    const isChecked = isControlled ? controlledChecked : uncontrolledChecked;

    const handleClick = () => {
      if (disabled) return;
      const next = !isChecked;
      if (!isControlled) {
        setUncontrolledChecked(next);
      }
      onCheckedChange?.(next);
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
        role="switch"
        id={id}
        data-slot="switch"
        aria-checked={isChecked}
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          'tw:peer tw:inline-flex tw:h-6 tw:w-11 tw:shrink-0 tw:cursor-pointer tw:items-center tw:rounded-full tw:border-2 tw:border-transparent tw:transition-colors tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-ring tw:focus-visible:ring-offset-2 tw:disabled:cursor-not-allowed tw:disabled:opacity-50',
          isChecked ? 'tw:bg-primary' : 'tw:bg-input',
          className,
        )}
        {...props}
      >
        <span
          className={cn(
            'tw:pointer-events-none tw:block tw:h-5 tw:w-5 tw:rounded-full tw:bg-card tw:shadow-sm tw:ring-0 tw:transition-transform ltr:tw:translate-x-0 rtl:tw:translate-x-0',
            isChecked && 'ltr:tw:translate-x-5 rtl:tw:-translate-x-5',
          )}
        />
      </button>
    );
  },
);
Switch.displayName = 'Switch';

export { Switch };
