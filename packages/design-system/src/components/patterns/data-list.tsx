import * as React from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '#lib/utils';

export interface DataListProps extends React.HTMLAttributes<HTMLDListElement> {
  columns?: 1 | 2 | 3;
}

const DataList = React.forwardRef<HTMLDListElement, DataListProps>(
  ({ className, columns = 1, children, ...props }, ref) => {
    const colClasses = {
      1: 'tw:grid-cols-1',
      2: 'tw:grid-cols-1 sm:tw:grid-cols-2',
      3: 'tw:grid-cols-1 sm:tw:grid-cols-2 lg:tw:grid-cols-3',
    }[columns];

    return (
      <dl
        ref={ref}
        data-slot="data-list"
        className={cn('tw:grid tw:gap-4', colClasses, className)}
        {...props}
      >
        {children}
      </dl>
    );
  },
);
DataList.displayName = 'DataList';

export interface InfoRowProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  value: React.ReactNode;
  copyable?: boolean;
  copyValue?: string;
}

const InfoRow = React.forwardRef<HTMLDivElement, InfoRowProps>(
  ({ className, label, value, copyable = false, copyValue, ...props }, ref) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = () => {
      const textToCopy = copyValue ?? (typeof value === 'string' ? value : '');
      if (!textToCopy) return;

      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div
        ref={ref}
        data-slot="info-row"
        className={cn('tw:flex tw:flex-col tw:gap-1 tw:py-1', className)}
        {...props}
      >
        <dt className="tw:text-xs tw:font-medium tw:text-muted-foreground">{label}</dt>
        <dd className="tw:flex tw:items-center tw:gap-2 tw:text-sm tw:font-medium tw:text-foreground">
          <span className="tw:truncate">{value}</span>
          {copyable && (
            <button
              type="button"
              onClick={handleCopy}
              className="tw:text-muted-foreground hover:tw:text-foreground tw:p-0.5 tw:rounded-xs tw:transition-colors"
              aria-label="Copy value"
            >
              {copied ? (
                <Check className="tw:h-3.5 tw:w-3.5 tw:text-[var(--success)]" />
              ) : (
                <Copy className="tw:h-3.5 tw:w-3.5" />
              )}
            </button>
          )}
        </dd>
      </div>
    );
  },
);
InfoRow.displayName = 'InfoRow';

export { DataList, InfoRow };
