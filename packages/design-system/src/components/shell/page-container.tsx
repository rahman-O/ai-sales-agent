import * as React from 'react';
import { cn } from '../../lib/utils.js';

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  disablePadding?: boolean;
}

const maxWidthMap: Record<NonNullable<PageContainerProps['maxWidth']>, string> = {
  sm: 'max-w-screen-sm',
  md: 'max-w-screen-md',
  lg: 'max-w-screen-lg',
  xl: 'max-w-screen-xl',
  '2xl': 'max-w-screen-2xl',
  full: 'max-w-full',
};

export function PageContainer({
  className,
  maxWidth = '2xl',
  disablePadding = false,
  children,
  ...props
}: PageContainerProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full',
        maxWidthMap[maxWidth],
        !disablePadding && 'p-4 sm:p-6 lg:p-8 space-y-6',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
