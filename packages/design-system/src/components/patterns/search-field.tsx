import * as React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '#lib/utils';
import { Spinner } from '#components/ui/spinner';

export interface SearchFieldProps
  extends Omit<React.ComponentProps<'input'>, 'size' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  loading?: boolean;
  shortcut?: string;
  size?: 'sm' | 'default';
}

const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(
  ({
    className,
    value,
    onChange,
    onClear,
    loading = false,
    shortcut,
    placeholder = 'Search...',
    size = 'default',
    ...props
  }, ref) => {
    const handleClear = () => {
      onChange('');
      onClear?.();
    };

    return (
      <div
        data-slot="search-field"
        className={cn(
          'tw:relative tw:flex tw:items-center tw:w-full tw:rounded-md tw:border tw:border-input tw:bg-card tw:text-card-foreground tw:focus-within:ring-2 tw:focus-within:ring-ring tw:focus-within:ring-offset-2',
          size === 'sm' ? 'tw:min-h-[var(--ds-control-small,2.25rem)]' : 'tw:min-h-[var(--ds-control-default,2.75rem)]',
          className,
        )}
      >
        <div className="tw:flex tw:items-center tw:ps-3 tw:pointer-events-none tw:text-muted-foreground">
          {loading ? (
            <Spinner size="sm" />
          ) : (
            <Search className="tw:h-4 tw:w-4" />
          )}
        </div>
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="tw:flex tw:w-full tw:bg-transparent tw:px-3 tw:py-1.5 tw:text-sm tw:outline-none tw:placeholder:text-muted-foreground tw:disabled:cursor-not-allowed tw:disabled:opacity-50"
          {...props}
        />
        <div className="tw:flex tw:items-center tw:pe-2 tw:gap-1.5">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="tw:text-muted-foreground hover:tw:text-foreground tw:p-0.5 tw:rounded-xs tw:transition-colors"
              aria-label="Clear search"
            >
              <X className="tw:h-3.5 tw:w-3.5" />
            </button>
          )}
          {shortcut && !value && (
            <kbd className="tw:pointer-events-none tw:hidden sm:tw:inline-flex tw:h-5 tw:select-none tw:items-center tw:gap-1 tw:rounded-xs tw:border tw:border-border tw:bg-muted tw:px-1.5 tw:font-mono tw:text-[10px] tw:font-medium tw:text-muted-foreground">
              {shortcut}
            </kbd>
          )}
        </div>
      </div>
    );
  },
);
SearchField.displayName = 'SearchField';

export { SearchField };
