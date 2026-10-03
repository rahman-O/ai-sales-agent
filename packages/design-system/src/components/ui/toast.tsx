import * as React from 'react';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { cn } from '#lib/utils';

export type ToastType = 'default' | 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  type?: ToastType;
  duration?: number;
}

type ToastListener = (toasts: ToastData[]) => void;

let toasts: ToastData[] = [];
const listeners = new Set<ToastListener>();

function emit() {
  listeners.forEach((listener) => listener([...toasts]));
}

export const toast = {
  show: (data: Omit<ToastData, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastData = { id, duration: 4000, ...data };
    toasts = [...toasts, newToast];
    emit();

    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        toast.dismiss(id);
      }, newToast.duration);
    }
    return id;
  },
  success: (title: React.ReactNode, description?: React.ReactNode) => {
    return toast.show({ title, description, type: 'success' });
  },
  error: (title: React.ReactNode, description?: React.ReactNode) => {
    return toast.show({ title, description, type: 'error' });
  },
  warning: (title: React.ReactNode, description?: React.ReactNode) => {
    return toast.show({ title, description, type: 'warning' });
  },
  info: (title: React.ReactNode, description?: React.ReactNode) => {
    return toast.show({ title, description, type: 'info' });
  },
  dismiss: (id: string) => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  },
};

export interface ToasterProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

function Toaster({ position = 'bottom-right' }: ToasterProps) {
  const [activeToasts, setActiveToasts] = React.useState<ToastData[]>([]);

  React.useEffect(() => {
    const listener: ToastListener = (items) => setActiveToasts(items);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const positionClasses = {
    'top-right': 'tw:top-4 tw:end-4',
    'top-left': 'tw:top-4 tw:start-4',
    'bottom-right': 'tw:bottom-4 tw:end-4',
    'bottom-left': 'tw:bottom-4 tw:start-4',
    'top-center': 'tw:top-4 tw:left-1/2 tw:-translate-x-1/2',
    'bottom-center': 'tw:bottom-4 tw:left-1/2 tw:-translate-x-1/2',
  }[position];

  if (activeToasts.length === 0) return null;

  return (
    <div
      data-slot="toaster"
      aria-live="polite"
      role="region"
      aria-label="Notifications"
      className={cn(
        'tw:fixed tw:z-50 tw:flex tw:max-h-screen tw:w-full tw:max-w-sm tw:flex-col-reverse tw:gap-2 tw:p-4',
        positionClasses,
      )}
    >
      {activeToasts.map((t) => {
        const icons: Record<ToastType, React.ReactNode> = {
          default: null,
          success: <CheckCircle className="tw:h-5 tw:w-5 tw:text-[var(--success)]" />,
          error: <AlertCircle className="tw:h-5 tw:w-5 tw:text-destructive" />,
          warning: <AlertTriangle className="tw:h-5 tw:w-5 tw:text-[var(--warning)]" />,
          info: <Info className="tw:h-5 tw:w-5 tw:text-[var(--info)]" />,
        };

        return (
          <div
            key={t.id}
            role="status"
            data-slot="toast"
            className={cn(
              'tw:pointer-events-auto tw:relative tw:flex tw:w-full tw:items-start tw:gap-3 tw:overflow-hidden tw:rounded-md tw:border tw:border-border tw:bg-card tw:p-4 tw:text-card-foreground tw:shadow-lg tw:transition-all tw:animate-in tw:fade-in-0 tw:slide-in-from-bottom-2',
            )}
          >
            {t.type && icons[t.type] && (
              <div className="tw:shrink-0 tw:mt-0.5">{icons[t.type]}</div>
            )}
            <div className="tw:grid tw:gap-1 tw:flex-1">
              {t.title && (
                <div className="tw:text-sm tw:font-semibold">{t.title}</div>
              )}
              {t.description && (
                <div className="tw:text-xs tw:text-muted-foreground">{t.description}</div>
              )}
            </div>
            <button
              type="button"
              data-slot="toast-close"
              onClick={() => toast.dismiss(t.id)}
              className="tw:rounded-sm tw:opacity-70 tw:ring-offset-background tw:transition-opacity hover:tw:opacity-100 tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-ring"
            >
              <X className="tw:h-4 tw:w-4" />
              <span className="tw:sr-only">Close</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

export { Toaster };
