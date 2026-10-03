import * as React from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { cn } from '#lib/utils';
import { buttonVariants } from '#components/ui/button';

const Pagination = ({ className, ...props }: React.ComponentProps<'nav'>) => (
  <nav
    role="navigation"
    aria-label="pagination"
    data-slot="pagination"
    className={cn('tw:mx-auto tw:flex tw:w-full tw:justify-center', className)}
    {...props}
  />
);
Pagination.displayName = 'Pagination';

const PaginationContent = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<'ul'>
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    data-slot="pagination-content"
    className={cn('tw:flex tw:flex-row tw:items-center tw:gap-1', className)}
    {...props}
  />
));
PaginationContent.displayName = 'PaginationContent';

const PaginationItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<'li'>
>(({ className, ...props }, ref) => (
  <li ref={ref} data-slot="pagination-item" className={cn('', className)} {...props} />
));
PaginationItem.displayName = 'PaginationItem';

type PaginationLinkProps = {
  isActive?: boolean;
  href?: string;
} & Pick<React.ComponentProps<'button'>, 'onClick' | 'disabled' | 'children' | 'className'>;

const PaginationLink = ({
  className,
  isActive,
  disabled,
  children,
  ...props
}: PaginationLinkProps) => (
  <button
    type="button"
    aria-current={isActive ? 'page' : undefined}
    disabled={disabled}
    data-slot="pagination-link"
    className={cn(
      buttonVariants({
        variant: isActive ? 'outline' : 'ghost',
        size: 'iconSm',
      }),
      className,
    )}
    {...props}
  >
    {children}
  </button>
);
PaginationLink.displayName = 'PaginationLink';

const PaginationPrevious = ({
  className,
  children = 'Previous',
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="Go to previous page"
    className={cn('tw:gap-1 tw:px-2.5 tw:w-auto sm:tw:pe-3', className)}
    {...props}
  >
    <ChevronLeft className="tw:h-4 tw:w-4 rtl:tw:rotate-180" />
    <span>{children}</span>
  </PaginationLink>
);
PaginationPrevious.displayName = 'PaginationPrevious';

const PaginationNext = ({
  className,
  children = 'Next',
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="Go to next page"
    className={cn('tw:gap-1 tw:px-2.5 tw:w-auto sm:tw:ps-3', className)}
    {...props}
  >
    <span>{children}</span>
    <ChevronRight className="tw:h-4 tw:w-4 rtl:tw:rotate-180" />
  </PaginationLink>
);
PaginationNext.displayName = 'PaginationNext';

const PaginationEllipsis = ({
  className,
  ...props
}: React.ComponentProps<'span'>) => (
  <span
    aria-hidden
    data-slot="pagination-ellipsis"
    className={cn('tw:flex tw:h-9 tw:w-9 tw:items-center tw:justify-center', className)}
    {...props}
  >
    <MoreHorizontal className="tw:h-4 tw:w-4" />
    <span className="tw:sr-only">More pages</span>
  </span>
);
PaginationEllipsis.displayName = 'PaginationEllipsis';

export {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
};
