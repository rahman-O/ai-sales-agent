import * as React from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '#lib/utils';

interface SelectContextValue {
  value?: string;
  onValueChange?: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  disabled?: boolean;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  children: React.ReactNode;
}

function Select({
  value: controlledValue,
  defaultValue,
  onValueChange,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  disabled,
  children,
}: SelectProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
  const isValueControlled = controlledValue !== undefined;
  const value = isValueControlled ? controlledValue : uncontrolledValue;

  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isOpenControlled = controlledOpen !== undefined;
  const open = isOpenControlled ? controlledOpen : uncontrolledOpen;

  const handleValueChange = React.useCallback(
    (val: string) => {
      if (!isValueControlled) {
        setUncontrolledValue(val);
      }
      onValueChange?.(val);
      if (!isOpenControlled) {
        setUncontrolledOpen(false);
      }
      onOpenChange?.(false);
    },
    [isValueControlled, onValueChange, isOpenControlled, onOpenChange],
  );

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (disabled) return;
      if (!isOpenControlled) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [disabled, isOpenControlled, onOpenChange],
  );

  return (
    <SelectContext.Provider
      value={{
        value,
        onValueChange: handleValueChange,
        open,
        setOpen: handleOpenChange,
        disabled,
      }}
    >
      <div className="tw:relative tw:inline-block tw:w-full" data-slot="select">
        {children}
      </div>
    </SelectContext.Provider>
  );
}

export interface SelectTriggerProps extends React.ComponentProps<'button'> {
  invalid?: boolean;
}

const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, children, invalid, disabled, ...props }, ref) => {
    const context = React.useContext(SelectContext);
    if (!context) throw new Error('SelectTrigger must be used within Select');

    const isDisabled = disabled || context.disabled;

    return (
      <button
        ref={ref}
        type="button"
        role="combobox"
        aria-expanded={context.open}
        aria-haspopup="listbox"
        disabled={isDisabled}
        data-slot="select-trigger"
        onClick={() => context.setOpen(!context.open)}
        className={cn(
          'tw:flex tw:min-h-[var(--ds-control-default,2.75rem)] tw:w-full tw:items-center tw:justify-between tw:rounded-md tw:border tw:bg-card tw:px-3 tw:py-2 tw:text-sm tw:text-card-foreground tw:placeholder:text-muted-foreground tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-ring tw:focus-visible:ring-offset-2 tw:disabled:cursor-not-allowed tw:disabled:opacity-50',
          invalid ? 'tw:border-destructive' : 'tw:border-input',
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown className="tw:h-4 tw:w-4 tw:opacity-50 tw:shrink-0" />
      </button>
    );
  },
);
SelectTrigger.displayName = 'SelectTrigger';

export interface SelectValueProps extends React.HTMLAttributes<HTMLSpanElement> {
  placeholder?: string;
}

const SelectValue = React.forwardRef<HTMLSpanElement, SelectValueProps>(
  ({ className, placeholder = 'Select an option', children, ...props }, ref) => {
    const context = React.useContext(SelectContext);
    const hasValue = context?.value !== undefined && context.value !== '';

    return (
      <span
        ref={ref}
        data-slot="select-value"
        className={cn('tw:truncate', !hasValue && 'tw:text-muted-foreground', className)}
        {...props}
      >
        {children || (hasValue ? context?.value : placeholder)}
      </span>
    );
  },
);
SelectValue.displayName = 'SelectValue';

export interface SelectContentProps extends React.HTMLAttributes<HTMLDivElement> {
  position?: 'popper' | 'item-aligned';
}

const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(
  ({ className, children, ...props }, ref) => {
    const context = React.useContext(SelectContext);
    const contentRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
      if (!context?.open) return;

      const handleOutsideClick = (event: MouseEvent) => {
        if (contentRef.current && !contentRef.current.parentElement?.contains(event.target as Node)) {
          context.setOpen(false);
        }
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          context.setOpen(false);
        }
      };

      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('mousedown', handleOutsideClick);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }, [context]);

    if (!context?.open) return null;

    return (
      <div
        ref={(node) => {
          contentRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        role="listbox"
        data-slot="select-content"
        className={cn(
          'tw:absolute tw:z-50 tw:mt-1 tw:max-h-60 tw:w-full tw:min-w-[8rem] tw:overflow-auto tw:rounded-md tw:border tw:border-border tw:bg-popover tw:p-1 tw:text-popover-foreground tw:shadow-md tw:animate-in tw:fade-in-80',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
SelectContent.displayName = 'SelectContent';

export interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  disabled?: boolean;
}

const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  ({ className, children, value, disabled = false, ...props }, ref) => {
    const context = React.useContext(SelectContext);
    const isSelected = context?.value === value;

    const handleClick = () => {
      if (disabled) return;
      context?.onValueChange?.(value);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    };

    return (
      <div
        ref={ref}
        role="option"
        tabIndex={disabled ? -1 : 0}
        aria-selected={isSelected}
        aria-disabled={disabled}
        data-slot="select-item"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          'tw:relative tw:flex tw:w-full tw:cursor-pointer tw:select-none tw:items-center tw:rounded-sm tw:py-1.5 tw:ps-2 tw:pe-8 tw:text-sm tw:outline-none hover:tw:bg-accent hover:tw:text-accent-foreground focus:tw:bg-accent focus:tw:text-accent-foreground',
          disabled && 'tw:pointer-events-none tw:opacity-50',
          isSelected && 'tw:font-medium',
          className,
        )}
        {...props}
      >
        <span className="tw:truncate">{children}</span>
        {isSelected && (
          <span className="tw:absolute tw:end-2 tw:flex tw:h-3.5 tw:w-3.5 tw:items-center tw:justify-center">
            <Check className="tw:h-4 tw:w-4" />
          </span>
        )}
      </div>
    );
  },
);
SelectItem.displayName = 'SelectItem';

const SelectGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="select-group" className={cn('tw:p-1', className)} {...props} />
  ),
);
SelectGroup.displayName = 'SelectGroup';

const SelectLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="select-label"
      className={cn('tw:px-2 tw:py-1.5 tw:text-xs tw:font-semibold tw:text-muted-foreground', className)}
      {...props}
    />
  ),
);
SelectLabel.displayName = 'SelectLabel';

const SelectSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="select-separator"
      className={cn('tw:-mx-1 tw:my-1 tw:h-px tw:bg-border', className)}
      {...props}
    />
  ),
);
SelectSeparator.displayName = 'SelectSeparator';

export {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
};
