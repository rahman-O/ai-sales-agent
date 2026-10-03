import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '#lib/utils';

interface SheetContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SheetContext = React.createContext<SheetContextValue | null>(null);

export interface SheetProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function Sheet({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: SheetProps) {
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
    <SheetContext.Provider value={{ open, setOpen: handleOpenChange }}>
      {children}
    </SheetContext.Provider>
  );
}

export interface SheetTriggerProps extends React.ComponentProps<'button'> {}

const SheetTrigger = React.forwardRef<HTMLButtonElement, SheetTriggerProps>(
  ({ children, onClick, ...props }, ref) => {
    const context = React.useContext(SheetContext);
    if (!context) throw new Error('SheetTrigger must be used within Sheet');

    return (
      <button
        ref={ref}
        type="button"
        data-slot="sheet-trigger"
        aria-haspopup="dialog"
        aria-expanded={context.open}
        onClick={(e) => {
          onClick?.(e);
          context.setOpen(true);
        }}
        {...props}
      >
        {children}
      </button>
    );
  },
);
SheetTrigger.displayName = 'SheetTrigger';

const sheetVariants = cva(
  'tw:fixed tw:z-50 tw:gap-4 tw:bg-card tw:p-6 tw:shadow-lg tw:transition tw:ease-in-out tw:border-border',
  {
    variants: {
      side: {
        top: 'tw:inset-x-0 tw:top-0 tw:border-b',
        bottom: 'tw:inset-x-0 tw:bottom-0 tw:border-t',
        start: 'tw:inset-y-0 ltr:tw:left-0 ltr:tw:border-r rtl:tw:right-0 rtl:tw:border-l tw:w-3/4 sm:tw:max-w-sm',
        end: 'tw:inset-y-0 ltr:tw:right-0 ltr:tw:border-l rtl:tw:left-0 rtl:tw:border-r tw:w-3/4 sm:tw:max-w-sm',
        left: 'tw:inset-y-0 tw:left-0 tw:h-full tw:w-3/4 tw:border-r sm:tw:max-w-sm',
        right: 'tw:inset-y-0 tw:right-0 tw:h-full tw:w-3/4 tw:border-l sm:tw:max-w-sm',
      },
    },
    defaultVariants: {
      side: 'end',
    },
  },
);

export interface SheetContentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof sheetVariants> {
  onClose?: () => void;
}

const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
  ({ side = 'end', className, children, onClose, ...props }, ref) => {
    const context = React.useContext(SheetContext);
    const contentRef = React.useRef<HTMLDivElement | null>(null);
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
      setMounted(true);
    }, []);

    React.useEffect(() => {
      if (!context?.open) return;

      const previousActiveElement = document.activeElement as HTMLElement | null;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          context.setOpen(false);
          onClose?.();
        }
      };

      contentRef.current?.focus();

      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        previousActiveElement?.focus();
      };
    }, [context?.open, context, onClose]);

    if (!context?.open || !mounted) return null;

    const overlay = (
      <div className="tw:fixed tw:inset-0 tw:z-50 tw:bg-black/50 tw:backdrop-blur-xs tw:animate-in tw:fade-in-0">
        <div
          className="tw:fixed tw:inset-0"
          onClick={() => {
            context.setOpen(false);
            onClose?.();
          }}
        />
        <div
          ref={(node) => {
            contentRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) ref.current = node;
          }}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          data-slot="sheet-content"
          className={cn(sheetVariants({ side }), className)}
          {...props}
        >
          {children}
          <button
            type="button"
            data-slot="sheet-close"
            onClick={() => {
              context.setOpen(false);
              onClose?.();
            }}
            className="tw:absolute tw:end-4 tw:top-4 tw:rounded-sm tw:opacity-70 tw:ring-offset-background tw:transition-opacity hover:tw:opacity-100 tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-ring"
          >
            <X className="tw:h-4 tw:w-4" />
            <span className="tw:sr-only">Close</span>
          </button>
        </div>
      </div>
    );

    return createPortal(overlay, document.body);
  },
);
SheetContent.displayName = 'SheetContent';

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-slot="sheet-header"
    className={cn('tw:flex tw:flex-col tw:space-y-2 tw:text-start', className)}
    {...props}
  />
);
SheetHeader.displayName = 'SheetHeader';

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-slot="sheet-footer"
    className={cn(
      'tw:flex tw:flex-col-reverse sm:tw:flex-row sm:tw:justify-end sm:tw:gap-2 tw:pt-4',
      className,
    )}
    {...props}
  />
);
SheetFooter.displayName = 'SheetFooter';

const SheetTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2
      ref={ref}
      data-slot="sheet-title"
      className={cn('ds-text-section-title tw:text-lg tw:font-semibold tw:text-foreground', className)}
      {...props}
    />
  ),
);
SheetTitle.displayName = 'SheetTitle';

const SheetDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      data-slot="sheet-description"
      className={cn('ds-text-helper tw:text-sm tw:text-muted-foreground', className)}
      {...props}
    />
  ),
);
SheetDescription.displayName = 'SheetDescription';

export {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
