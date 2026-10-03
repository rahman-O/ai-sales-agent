import * as React from 'react';
import { cn } from '../../lib/utils.js';

export interface TopbarProps extends React.HTMLAttributes<HTMLElement> {
  sticky?: boolean;
}

export function Topbar({
  className,
  sticky = true,
  children,
  ...props
}: TopbarProps) {
  return (
    <header
      aria-label="Top bar"
      className={cn(
        'flex h-14 w-full items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 gap-4',
        sticky && 'sticky top-0',
        className
      )}
      {...props}
    >
      {children}
    </header>
  );
}

export function TopbarLeading({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center gap-3 overflow-hidden', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function TopbarTrailing({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center gap-2 shrink-0 ms-auto', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function TopbarTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      className={cn('text-base font-semibold text-foreground truncate', className)}
      {...props}
    >
      {children}
    </h1>
  );
}
