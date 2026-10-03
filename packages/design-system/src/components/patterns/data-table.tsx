import * as React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '#lib/utils';
import { Spinner } from '#components/ui/spinner';
import { EmptyState } from '#components/patterns/empty-state';

export interface ColumnDef<T> {
  key: string;
  header: React.ReactNode;
  cell: (item: T) => React.ReactNode;
  align?: 'start' | 'center' | 'end';
  sortable?: boolean;
  className?: string;
}

export interface DataTableProps<T> extends React.HTMLAttributes<HTMLDivElement> {
  columns: ColumnDef<T>[];
  data: T[];
  loading?: boolean;
  emptyTitle?: React.ReactNode;
  emptyDescription?: React.ReactNode;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  pagination?: React.ReactNode;
}

function DataTable<T extends { id?: string | number }>({
  columns,
  data,
  loading = false,
  emptyTitle = 'No data available',
  emptyDescription = 'There are no records to display.',
  sortKey,
  sortDirection,
  onSort,
  pagination,
  className,
  ...props
}: DataTableProps<T>) {
  return (
    <div data-slot="data-table" className={cn('tw:flex tw:flex-col tw:gap-3 tw:w-full', className)} {...props}>
      <div
        role="region"
        aria-label="Data table"
        tabIndex={0}
        className="tw:overflow-x-auto tw:rounded-lg tw:border tw:border-border tw:bg-card focus-visible:tw:outline-none focus-visible:tw:ring-2 focus-visible:tw:ring-ring"
      >
        <table className="tw:w-full tw:text-sm tw:text-start tw:border-collapse">
          <thead>
            <tr className="tw:border-b tw:border-border tw:bg-muted/50 tw:text-muted-foreground">
              {columns.map((col) => {
                const isSorted = sortKey === col.key;
                const alignClass = {
                  start: 'tw:text-start',
                  center: 'tw:text-center',
                  end: 'tw:text-end',
                }[col.align ?? 'start'];

                return (
                  <th
                    key={col.key}
                    scope="col"
                    className={cn(
                      'tw:h-10 tw:px-4 tw:text-xs tw:font-semibold tw:select-none',
                      alignClass,
                      col.className,
                    )}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => onSort?.(col.key)}
                        className="tw:inline-flex tw:items-center tw:gap-1.5 hover:tw:text-foreground tw:transition-colors"
                      >
                        <span>{col.header}</span>
                        {isSorted ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="tw:h-3.5 tw:w-3.5" />
                          ) : (
                            <ArrowDown className="tw:h-3.5 tw:w-3.5" />
                          )
                        ) : (
                          <ArrowUpDown className="tw:h-3.5 tw:w-3.5 tw:opacity-40" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="tw:divide-y tw:divide-border">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="tw:h-32 tw:text-center">
                  <div className="tw:flex tw:flex-col tw:items-center tw:justify-center tw:gap-2">
                    <Spinner size="default" />
                    <span className="tw:text-xs tw:text-muted-foreground">Loading records...</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="tw:p-6">
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr
                  key={row.id ?? rowIndex}
                  className="hover:tw:bg-muted/30 tw:transition-colors"
                >
                  {columns.map((col) => {
                    const alignClass = {
                      start: 'tw:text-start',
                      center: 'tw:text-center',
                      end: 'tw:text-end',
                    }[col.align ?? 'start'];

                    return (
                      <td
                        key={col.key}
                        className={cn('tw:p-4 tw:align-middle', alignClass, col.className)}
                      >
                        {col.cell(row)}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pagination && <div className="tw:flex tw:justify-end">{pagination}</div>}
    </div>
  );
}

export { DataTable };
