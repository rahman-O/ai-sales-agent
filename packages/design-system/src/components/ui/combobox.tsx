import * as React from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '#lib/utils';
import { Input } from '#components/ui/input';

export interface ComboboxOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
}

function Combobox({
  options = [],
  value: controlledValue,
  defaultValue = '',
  onValueChange,
  placeholder = 'Select option...',
  searchPlaceholder = 'Search...',
  emptyText = 'No results found.',
  disabled = false,
  invalid = false,
  className,
}: ComboboxProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolledValue;

  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = React.useMemo(() => {
    if (!search.trim()) return options;
    const lower = search.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(lower));
  }, [options, search]);

  React.useEffect(() => {
    if (!open) {
      setSearch('');
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleSelect = (optValue: string) => {
    if (!isControlled) {
      setUncontrolledValue(optValue);
    }
    onValueChange?.(optValue);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={cn('tw:relative tw:w-full', className)} data-slot="combobox">
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          'tw:flex tw:min-h-[var(--ds-control-default,2.75rem)] tw:w-full tw:items-center tw:justify-between tw:rounded-md tw:border tw:bg-card tw:px-3 tw:py-2 tw:text-sm tw:text-card-foreground tw:placeholder:text-muted-foreground tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-ring tw:focus-visible:ring-offset-2 tw:disabled:cursor-not-allowed tw:disabled:opacity-50',
          invalid ? 'tw:border-destructive' : 'tw:border-input',
        )}
      >
        <span className={cn('tw:truncate', !selectedOption && 'tw:text-muted-foreground')}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronsUpDown className="tw:h-4 tw:w-4 tw:opacity-50 tw:shrink-0" />
      </button>

      {open && (
        <div
          role="listbox"
          className="tw:absolute tw:z-50 tw:mt-1 tw:max-h-60 tw:w-full tw:overflow-hidden tw:rounded-md tw:border tw:border-border tw:bg-popover tw:p-1 tw:text-popover-foreground tw:shadow-md tw:animate-in tw:fade-in-80"
        >
          <div className="tw:flex tw:items-center tw:border-b tw:border-border tw:px-2 tw:pb-1">
            <Search className="tw:h-4 tw:w-4 tw:text-muted-foreground tw:shrink-0 tw:me-2" />
            <Input
              type="text"
              size="sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="tw:border-0 tw:bg-transparent tw:p-1 tw:shadow-none tw:focus-visible:ring-0"
              autoFocus
            />
          </div>
          <div className="tw:max-h-48 tw:overflow-y-auto tw:py-1">
            {filteredOptions.length === 0 ? (
              <div className="tw:py-4 tw:text-center tw:text-xs tw:text-muted-foreground">
                {emptyText}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <div
                    key={opt.value}
                    role="option"
                    tabIndex={opt.disabled ? -1 : 0}
                    aria-selected={isSelected}
                    aria-disabled={opt.disabled}
                    onClick={() => !opt.disabled && handleSelect(opt.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (!opt.disabled) handleSelect(opt.value);
                      }
                    }}
                    className={cn(
                      'tw:relative tw:flex tw:w-full tw:cursor-pointer tw:select-none tw:items-center tw:rounded-sm tw:py-1.5 tw:ps-2 tw:pe-8 tw:text-sm tw:outline-none hover:tw:bg-accent hover:tw:text-accent-foreground focus:tw:bg-accent focus:tw:text-accent-foreground',
                      opt.disabled && 'tw:pointer-events-none tw:opacity-50',
                      isSelected && 'tw:font-medium',
                    )}
                  >
                    <span className="tw:truncate">{opt.label}</span>
                    {isSelected && (
                      <span className="tw:absolute tw:end-2 tw:flex tw:h-3.5 tw:w-3.5 tw:items-center tw:justify-center">
                        <Check className="tw:h-4 tw:w-4" />
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { Combobox };
