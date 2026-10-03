import * as React from 'react';
import { cn } from '#lib/utils';

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        'tw:animate-pulse tw:rounded-md tw:bg-muted motion-reduce:tw:animate-none',
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
