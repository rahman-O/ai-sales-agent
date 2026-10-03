import * as React from 'react';
import { Check, Circle } from 'lucide-react';
import { cn } from '#lib/utils';

interface DropdownMenuContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | null>(null);

export interface DropdownMenuProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function DropdownMenu({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: DropdownMenuProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen: handleOpenChange }}>
      <div className="tw:relative tw:inline-block" data-slot="dropdown-menu">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
}

export interface DropdownMenuTriggerProps extends React.ComponentProps<'button'> {}

const DropdownMenuTrigger = React.forwardRef<HTMLButtonElement, DropdownMenuTriggerProps>(
  ({ children, onClick, ...props }, ref) => {
    const context = React.useContext(DropdownMenuContext);
    if (!context) throw new Error('DropdownMenuTrigger must be used within DropdownMenu');

    return (
      <button
        ref={ref}
        type="button"
        data-slot="dropdown-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={context.open}
        onClick={(e) => {
          onClick?.(e);
          context.setOpen(!context.open);
        }}
        {...props}
      >
        {children}
      </button>
    );
  },
);
DropdownMenuTrigger.displayName = 'DropdownMenuTrigger';

export interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: 'start' | 'center' | 'end';
}

const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  ({ className, align = 'start', children, ...props }, ref) => {
    const context = React.useContext(DropdownMenuContext);
    const contentRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
      if (!context?.open) return;

      const handleOutsideClick = (e: MouseEvent) => {
        if (contentRef.current && !contentRef.current.parentElement?.contains(e.target as Node)) {
          context.setOpen(false);
        }
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
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

    const alignClasses = {
      start: 'tw:start-0',
      center: 'tw:left-1/2 tw:-translate-x-1/2 rtl:tw:translate-x-1/2',
      end: 'tw:end-0',
    }[align];

    return (
      <div
        ref={(node) => {
          contentRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        role="menu"
        data-slot="dropdown-menu-content"
        className={cn(
          'tw:absolute tw:z-50 tw:min-w-[8rem] tw:overflow-hidden tw:rounded-md tw:border tw:border-border tw:bg-popover tw:p-1 tw:text-popover-foreground tw:shadow-md tw:outline-none tw:animate-in tw:fade-in-0 tw:mt-1',
          alignClasses,
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
DropdownMenuContent.displayName = 'DropdownMenuContent';

export interface DropdownMenuItemProps extends React.HTMLAttributes<HTMLDivElement> {
  disabled?: boolean;
  inset?: boolean;
  onSelect?: () => void;
}

const DropdownMenuItem = React.forwardRef<HTMLDivElement, DropdownMenuItemProps>(
  ({ className, disabled = false, inset, onSelect, onClick, onKeyDown, children, ...props }, ref) => {
    const context = React.useContext(DropdownMenuContext);

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      onSelect?.();
      onClick?.(e);
      context?.setOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!disabled) {
          onSelect?.();
          context?.setOpen(false);
        }
      }
      onKeyDown?.(e);
    };

    return (
      <div
        ref={ref}
        role="menuitem"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        data-slot="dropdown-menu-item"
        className={cn(
          'tw:relative tw:flex tw:cursor-pointer tw:select-none tw:items-center tw:rounded-sm tw:px-2 tw:py-1.5 tw:text-sm tw:outline-none hover:tw:bg-accent hover:tw:text-accent-foreground focus:tw:bg-accent focus:tw:text-accent-foreground',
          inset && 'tw:ps-8',
          disabled && 'tw:pointer-events-none tw:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
DropdownMenuItem.displayName = 'DropdownMenuItem';

export interface DropdownMenuCheckboxItemProps extends DropdownMenuItemProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const DropdownMenuCheckboxItem = React.forwardRef<HTMLDivElement, DropdownMenuCheckboxItemProps>(
  ({ className, children, checked, onCheckedChange, disabled, ...props }, ref) => {
    const context = React.useContext(DropdownMenuContext);

    const handleSelect = () => {
      if (disabled) return;
      onCheckedChange?.(!checked);
      context?.setOpen(false);
    };

    return (
      <div
        ref={ref}
        role="menuitemcheckbox"
        aria-checked={checked}
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={handleSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleSelect();
          }
        }}
        data-slot="dropdown-menu-checkbox-item"
        className={cn(
          'tw:relative tw:flex tw:cursor-pointer tw:select-none tw:items-center tw:rounded-sm tw:py-1.5 tw:ps-8 tw:pe-2 tw:text-sm tw:outline-none hover:tw:bg-accent hover:tw:text-accent-foreground focus:tw:bg-accent focus:tw:text-accent-foreground',
          disabled && 'tw:pointer-events-none tw:opacity-50',
          className,
        )}
        {...props}
      >
        <span className="tw:absolute tw:start-2 tw:flex tw:h-3.5 tw:w-3.5 tw:items-center tw:justify-center">
          {checked && <Check className="tw:h-4 tw:w-4" />}
        </span>
        {children}
      </div>
    );
  },
);
DropdownMenuCheckboxItem.displayName = 'DropdownMenuCheckboxItem';

export interface DropdownMenuRadioItemProps extends DropdownMenuItemProps {
  value: string;
  checked?: boolean;
}

const DropdownMenuRadioItem = React.forwardRef<HTMLDivElement, DropdownMenuRadioItemProps>(
  ({ className, children, checked, disabled, onSelect, ...props }, ref) => {
    const context = React.useContext(DropdownMenuContext);

    const handleSelect = () => {
      if (disabled) return;
      onSelect?.();
      context?.setOpen(false);
    };

    return (
      <div
        ref={ref}
        role="menuitemradio"
        aria-checked={checked}
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={handleSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleSelect();
          }
        }}
        data-slot="dropdown-menu-radio-item"
        className={cn(
          'tw:relative tw:flex tw:cursor-pointer tw:select-none tw:items-center tw:rounded-sm tw:py-1.5 tw:ps-8 tw:pe-2 tw:text-sm tw:outline-none hover:tw:bg-accent hover:tw:text-accent-foreground focus:tw:bg-accent focus:tw:text-accent-foreground',
          disabled && 'tw:pointer-events-none tw:opacity-50',
          className,
        )}
        {...props}
      >
        <span className="tw:absolute tw:start-2 tw:flex tw:h-3.5 tw:w-3.5 tw:items-center tw:justify-center">
          {checked && <Circle className="tw:h-2 tw:w-2 tw:fill-current" />}
        </span>
        {children}
      </div>
    );
  },
);
DropdownMenuRadioItem.displayName = 'DropdownMenuRadioItem';

const DropdownMenuLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="dropdown-menu-label"
    className={cn(
      'tw:px-2 tw:py-1.5 tw:text-xs tw:font-semibold tw:text-muted-foreground',
      inset && 'tw:ps-8',
      className,
    )}
    {...props}
  />
));
DropdownMenuLabel.displayName = 'DropdownMenuLabel';

const DropdownMenuSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="dropdown-menu-separator"
    className={cn('tw:-mx-1 tw:my-1 tw:h-px tw:bg-border', className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

const DropdownMenuGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} data-slot="dropdown-menu-group" className={cn('tw:p-1', className)} {...props} />
));
DropdownMenuGroup.displayName = 'DropdownMenuGroup';

const DropdownMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn('tw:ms-auto tw:text-xs tw:tracking-widest tw:text-muted-foreground', className)}
      {...props}
    />
  );
};
DropdownMenuShortcut.displayName = 'DropdownMenuShortcut';

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuShortcut,
};
