import * as React from 'react';
import { Circle } from 'lucide-react';
import { cn } from '#lib/utils';

interface RadioGroupContextValue {
  name?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue>({});

export interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, name, value: controlledValue, defaultValue, onValueChange, disabled, children, ...props }, ref) => {
    const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : uncontrolledValue;

    const handleValueChange = React.useCallback(
      (val: string) => {
        if (!isControlled) {
          setUncontrolledValue(val);
        }
        onValueChange?.(val);
      },
      [isControlled, onValueChange],
    );

    return (
      <RadioGroupContext.Provider value={{ name, value, onValueChange: handleValueChange, disabled }}>
        <div
          ref={ref}
          role="radiogroup"
          data-slot="radio-group"
          className={cn('tw:grid tw:gap-2', className)}
          {...props}
        >
          {children}
        </div>
      </RadioGroupContext.Provider>
    );
  },
);
RadioGroup.displayName = 'RadioGroup';

export interface RadioGroupItemProps
  extends Omit<React.ComponentProps<'button'>, 'onChange'> {
  value: string;
}

const RadioGroupItem = React.forwardRef<HTMLButtonElement, RadioGroupItemProps>(
  ({ className, value, disabled: itemDisabled, id, ...props }, ref) => {
    const context = React.useContext(RadioGroupContext);
    const isChecked = context.value === value;
    const isDisabled = itemDisabled || context.disabled;

    const handleClick = () => {
      if (isDisabled) return;
      context.onValueChange?.(value);
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
        role="radio"
        id={id}
        data-slot="radio-group-item"
        aria-checked={isChecked}
        disabled={isDisabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          'tw:aspect-square tw:h-4 tw:w-4 tw:rounded-full tw:border tw:border-input tw:bg-card tw:text-primary tw:transition-colors tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-ring tw:focus-visible:ring-offset-2 tw:disabled:cursor-not-allowed tw:disabled:opacity-50 tw:inline-flex tw:items-center tw:justify-center',
          isChecked && 'tw:border-primary',
          className,
        )}
        {...props}
      >
        {isChecked ? (
          <Circle className="tw:h-2 tw:w-2 tw:fill-primary tw:text-primary" />
        ) : null}
      </button>
    );
  },
);
RadioGroupItem.displayName = 'RadioGroupItem';

export { RadioGroup, RadioGroupItem };
