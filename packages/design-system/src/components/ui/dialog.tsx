import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '#lib/utils';

interface DialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function Dialog({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: DialogProps) {
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
    <DialogContext.Provider value={{ open, setOpen: handleOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
}

export interface DialogTriggerProps extends React.ComponentProps<'button'> {
  asChild?: boolean;
}

const DialogTrigger = React.forwardRef<HTMLButtonElement, DialogTriggerProps>(
  ({ children, onClick, ...props }, ref) => {
    const context = React.useContext(DialogContext);
    if (!context) throw new Error('DialogTrigger must be used within Dialog');

    return (
      <button
        ref={ref}
        type="button"
        data-slot="dialog-trigger"
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
DialogTrigger.displayName = 'DialogTrigger';

export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  onClose?: () => void;
}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, onClose, ...props }, ref) => {
    const context = React.useContext(DialogContext);
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

      // Simple focus to modal
      contentRef.current?.focus();

      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        previousActiveElement?.focus();
      };
    }, [context?.open, context, onClose]);

    if (!context?.open || !mounted) return null;

    const overlay = (
      <div
        className="tw:fixed tw:inset-0 tw:z-50 tw:flex tw:items-center tw:justify-center tw:bg-black/50 tw:backdrop-blur-xs tw:p-4 tw:animate-in tw:fade-in-0"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            context.setOpen(false);
            onClose?.();
          }
        }}
      >
        <div
          ref={(node) => {
            contentRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) ref.current = node;
          }}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          data-slot="dialog-content"
          className={cn(
            'tw:relative tw:w-full tw:max-w-lg tw:rounded-lg tw:border tw:border-border tw:bg-card tw:p-6 tw:text-card-foreground tw:shadow-lg tw:duration-200 tw:outline-none',
            className,
          )}
          {...props}
        >
          {children}
          <button
            type="button"
            data-slot="dialog-close"
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
DialogContent.displayName = 'DialogContent';

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-slot="dialog-header"
    className={cn('tw:flex tw:flex-col tw:space-y-1.5 tw:text-start', className)}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-slot="dialog-footer"
    className={cn(
      'tw:flex tw:flex-col-reverse sm:tw:flex-row sm:tw:justify-end sm:tw:gap-2 tw:pt-4',
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2
      ref={ref}
      data-slot="dialog-title"
      className={cn('ds-text-section-title tw:text-lg tw:font-semibold tw:leading-none tw:tracking-tight', className)}
      {...props}
    />
  ),
);
DialogTitle.displayName = 'DialogTitle';

const DialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      data-slot="dialog-description"
      className={cn('ds-text-helper tw:text-sm tw:text-muted-foreground', className)}
      {...props}
    />
  ),
);
DialogDescription.displayName = 'DialogDescription';

const DialogClose = React.forwardRef<HTMLButtonElement, React.ComponentProps<'button'>>(
  ({ onClick, ...props }, ref) => {
    const context = React.useContext(DialogContext);
    return (
      <button
        ref={ref}
        type="button"
        data-slot="dialog-close"
        onClick={(e) => {
          onClick?.(e);
          context?.setOpen(false);
        }}
        {...props}
      />
    );
  },
);
DialogClose.displayName = 'DialogClose';

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
};
