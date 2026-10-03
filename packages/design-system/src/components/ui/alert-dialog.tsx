import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '#lib/utils';
import { buttonVariants } from '#components/ui/button';

interface AlertDialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const AlertDialogContext = React.createContext<AlertDialogContextValue | null>(null);

export interface AlertDialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function AlertDialog({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: AlertDialogProps) {
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
    <AlertDialogContext.Provider value={{ open, setOpen: handleOpenChange }}>
      {children}
    </AlertDialogContext.Provider>
  );
}

export interface AlertDialogTriggerProps extends React.ComponentProps<'button'> {}

const AlertDialogTrigger = React.forwardRef<HTMLButtonElement, AlertDialogTriggerProps>(
  ({ children, onClick, ...props }, ref) => {
    const context = React.useContext(AlertDialogContext);
    if (!context) throw new Error('AlertDialogTrigger must be used within AlertDialog');

    return (
      <button
        ref={ref}
        type="button"
        data-slot="alert-dialog-trigger"
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
AlertDialogTrigger.displayName = 'AlertDialogTrigger';

export interface AlertDialogContentProps extends React.HTMLAttributes<HTMLDivElement> {}

const AlertDialogContent = React.forwardRef<HTMLDivElement, AlertDialogContentProps>(
  ({ className, children, ...props }, ref) => {
    const context = React.useContext(AlertDialogContext);
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
        }
      };

      contentRef.current?.focus();

      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        previousActiveElement?.focus();
      };
    }, [context?.open, context]);

    if (!context?.open || !mounted) return null;

    const overlay = (
      <div className="tw:fixed tw:inset-0 tw:z-50 tw:flex tw:items-center tw:justify-center tw:bg-black/50 tw:backdrop-blur-xs tw:p-4 tw:animate-in tw:fade-in-0">
        <div
          ref={(node) => {
            contentRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) ref.current = node;
          }}
          role="alertdialog"
          aria-modal="true"
          tabIndex={-1}
          data-slot="alert-dialog-content"
          className={cn(
            'tw:relative tw:w-full tw:max-w-lg tw:rounded-lg tw:border tw:border-border tw:bg-card tw:p-6 tw:text-card-foreground tw:shadow-lg tw:duration-200 tw:outline-none',
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </div>
    );

    return createPortal(overlay, document.body);
  },
);
AlertDialogContent.displayName = 'AlertDialogContent';

const AlertDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-slot="alert-dialog-header"
    className={cn('tw:flex tw:flex-col tw:space-y-2 tw:text-start', className)}
    {...props}
  />
);
AlertDialogHeader.displayName = 'AlertDialogHeader';

const AlertDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-slot="alert-dialog-footer"
    className={cn(
      'tw:flex tw:flex-col-reverse sm:tw:flex-row sm:tw:justify-end sm:tw:gap-2 tw:pt-4',
      className,
    )}
    {...props}
  />
);
AlertDialogFooter.displayName = 'AlertDialogFooter';

const AlertDialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2
      ref={ref}
      data-slot="alert-dialog-title"
      className={cn('ds-text-section-title tw:text-lg tw:font-semibold', className)}
      {...props}
    />
  ),
);
AlertDialogTitle.displayName = 'AlertDialogTitle';

const AlertDialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      data-slot="alert-dialog-description"
      className={cn('ds-text-helper tw:text-sm tw:text-muted-foreground', className)}
      {...props}
    />
  ),
);
AlertDialogDescription.displayName = 'AlertDialogDescription';

const AlertDialogAction = React.forwardRef<HTMLButtonElement, React.ComponentProps<'button'>>(
  ({ className, onClick, ...props }, ref) => {
    const context = React.useContext(AlertDialogContext);
    return (
      <button
        ref={ref}
        type="button"
        data-slot="alert-dialog-action"
        onClick={(e) => {
          onClick?.(e);
          context?.setOpen(false);
        }}
        className={cn(buttonVariants({ variant: 'default' }), className)}
        {...props}
      />
    );
  },
);
AlertDialogAction.displayName = 'AlertDialogAction';

const AlertDialogCancel = React.forwardRef<HTMLButtonElement, React.ComponentProps<'button'>>(
  ({ className, onClick, ...props }, ref) => {
    const context = React.useContext(AlertDialogContext);
    return (
      <button
        ref={ref}
        type="button"
        data-slot="alert-dialog-cancel"
        onClick={(e) => {
          onClick?.(e);
          context?.setOpen(false);
        }}
        className={cn(buttonVariants({ variant: 'outline' }), className)}
        {...props}
      />
    );
  },
);
AlertDialogCancel.displayName = 'AlertDialogCancel';

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
