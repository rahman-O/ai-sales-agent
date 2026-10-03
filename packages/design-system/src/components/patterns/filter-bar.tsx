import * as React from 'react';
import { RotateCcw } from 'lucide-react';
import { cn } from '#lib/utils';
import { Button } from '#components/ui/button';

export interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  searchSlot?: React.ReactNode;
  filtersSlot?: React.ReactNode;
  actionsSlot?: React.ReactNode;
  activeFilterCount?: number;
  onResetFilters?: () => void;
  resetLabel?: React.ReactNode;
}

const FilterBar = React.forwardRef<HTMLDivElement, FilterBarProps>(
  ({
    className,
    searchSlot,
    filtersSlot,
    actionsSlot,
    activeFilterCount = 0,
    onResetFilters,
    resetLabel = 'Reset / إعادة ضبط',
    children,
    ...props
  }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="filter-bar"
        className={cn(
          'tw:flex tw:flex-col lg:tw:flex-row lg:tw:items-center lg:tw:justify-between tw:gap-3 tw:p-3 tw:rounded-lg tw:border tw:border-border tw:bg-card/50',
          className,
        )}
        {...props}
      >
        <div className="tw:flex tw:flex-1 tw:flex-col sm:tw:flex-row sm:tw:items-center tw:gap-2">
          {searchSlot && <div className="tw:w-full sm:tw:max-w-xs">{searchSlot}</div>}
          {filtersSlot && (
            <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
              {filtersSlot}
            </div>
          )}
          {activeFilterCount > 0 && onResetFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onResetFilters}
              className="tw:text-xs tw:text-muted-foreground hover:tw:text-foreground tw:h-8"
            >
              <RotateCcw className="tw:me-1.5 tw:h-3 tw:w-3" />
              {resetLabel} ({activeFilterCount})
            </Button>
          )}
        </div>
        {(actionsSlot || children) && (
          <div className="tw:flex tw:items-center tw:gap-2 tw:shrink-0 tw:justify-end">
            {actionsSlot}
            {children}
          </div>
        )}
      </div>
    );
  },
);
FilterBar.displayName = 'FilterBar';

export { FilterBar };
