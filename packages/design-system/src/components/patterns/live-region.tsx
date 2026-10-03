import * as React from 'react';
import { cn } from '#lib/utils';

export interface LiveRegionProps extends React.HTMLAttributes<HTMLDivElement> {
  mode?: 'polite' | 'assertive' | 'off';
  atomic?: boolean;
  relevant?: 'additions' | 'removals' | 'text' | 'all' | 'additions text';
  visuallyHidden?: boolean;
}

export function LiveRegion({
  mode = 'polite',
  atomic = true,
  relevant = 'additions text',
  visuallyHidden = true,
  className,
  children,
  ...props
}: LiveRegionProps) {
  return (
    <div
      aria-live={mode}
      aria-atomic={atomic}
      aria-relevant={relevant}
      data-slot="live-region"
      className={cn(
        visuallyHidden && 'sr-only',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface AnnounceStatusProps {
  message?: string;
  mode?: 'polite' | 'assertive';
}

export function AnnounceStatus({ message, mode = 'polite' }: AnnounceStatusProps) {
  if (!message) return null;
  return (
    <LiveRegion mode={mode} role="status">
      {message}
    </LiveRegion>
  );
}
