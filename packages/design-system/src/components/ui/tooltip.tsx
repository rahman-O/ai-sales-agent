import * as React from 'react';
import { cn } from '#lib/utils';

interface TooltipContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const TooltipContext = React.createContext<TooltipContextValue | null>(null);

export interface TooltipProviderProps {
  delayDuration?: number;
  children: React.ReactNode;
}

function TooltipProvider({ children }: TooltipProviderProps) {
  return <>{children}</>;
}

export interface TooltipProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function Tooltip({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: TooltipProps) {
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
    <TooltipContext.Provider value={{ open, setOpen: handleOpenChange }}>
      <div className="tw:relative tw:inline-flex" data-slot="tooltip">
        {children}
      </div>
    </TooltipContext.Provider>
  );
}

export interface TooltipTriggerProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean;
}

const TooltipTrigger = React.forwardRef<HTMLButtonElement, React.ComponentProps<'button'>>(
  ({ children, onMouseEnter, onMouseLeave, onFocus, onBlur, ...props }, ref) => {
    const context = React.useContext(TooltipContext);

    return (
      <button
        ref={ref}
        type="button"
        data-slot="tooltip-trigger"
        onMouseEnter={(e) => {
          onMouseEnter?.(e);
          context?.setOpen(true);
        }}
        onMouseLeave={(e) => {
          onMouseLeave?.(e);
          context?.setOpen(false);
        }}
        onFocus={(e) => {
          onFocus?.(e);
          context?.setOpen(true);
        }}
        onBlur={(e) => {
          onBlur?.(e);
          context?.setOpen(false);
        }}
        {...props}
      >
        {children}
      </button>
    );
  },
);
TooltipTrigger.displayName = 'TooltipTrigger';

export interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: 'top' | 'right' | 'bottom' | 'left';
}

const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ className, side = 'top', children, ...props }, ref) => {
    const context = React.useContext(TooltipContext);
    if (!context?.open) return null;

    const sideClasses = {
      top: 'tw:bottom-full tw:left-1/2 tw:-translate-x-1/2 tw:mb-1.5',
      bottom: 'tw:top-full tw:left-1/2 tw:-translate-x-1/2 tw:mt-1.5',
      left: 'tw:right-full tw:top-1/2 tw:-translate-y-1/2 tw:me-1.5',
      right: 'tw:left-full tw:top-1/2 tw:-translate-y-1/2 tw:ms-1.5',
    }[side];

    return (
      <div
        ref={ref}
        role="tooltip"
        data-slot="tooltip-content"
        className={cn(
          'tw:absolute tw:z-50 tw:overflow-hidden tw:rounded-md tw:bg-foreground tw:px-3 tw:py-1.5 tw:text-xs tw:text-background tw:shadow-md tw:animate-in tw:fade-in-0 tw:pointer-events-none tw:whitespace-nowrap',
          sideClasses,
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
TooltipContent.displayName = 'TooltipContent';

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
