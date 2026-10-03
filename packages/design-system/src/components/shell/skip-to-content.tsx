import * as React from 'react';
import { cn } from '../../lib/utils.js';

export interface SkipToContentProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  targetId?: string;
  label?: string;
}

export function SkipToContent({
  className,
  targetId = 'main-content',
  label = 'Skip to main content',
  children,
  ...props
}: SkipToContentProps) {
  return (
    <a
      href={`#${targetId}`}
      className={cn(
        'sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-50',
        'rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg',
        'outline-none ring-2 ring-ring ring-offset-2 ring-offset-background transition-all',
        className
      )}
      {...props}
    >
      {children || label}
    </a>
  );
}
