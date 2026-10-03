import * as React from 'react';
import { cn } from '#lib/utils';

export interface BidiTextProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'bdi' | 'span' | 'code' | 'time';
  direction?: 'ltr' | 'rtl' | 'auto';
  isolate?: boolean;
}

export function BidiText({
  as: Component = 'bdi',
  direction,
  isolate = true,
  className,
  children,
  ...props
}: BidiTextProps) {
  return (
    <Component
      dir={direction}
      data-slot="bidi-text"
      className={cn(
        isolate && 'inline-block [unicode-bidi:isolate]',
        direction === 'ltr' && 'text-left [direction:ltr]',
        direction === 'rtl' && 'text-right [direction:rtl]',
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export interface LatinIdentifierProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

export function LatinIdentifier({ className, children, ...props }: LatinIdentifierProps) {
  return (
    <BidiText
      as="bdi"
      direction="ltr"
      className={cn('font-mono select-all', className)}
      {...props}
    >
      {children}
    </BidiText>
  );
}

export interface PhoneNumberDisplayProps extends React.HTMLAttributes<HTMLElement> {
  phone: string;
}

export function PhoneNumberDisplay({ phone, className, ...props }: PhoneNumberDisplayProps) {
  return (
    <BidiText
      as="bdi"
      direction="ltr"
      className={cn('font-mono tracking-wide', className)}
      {...props}
    >
      {phone}
    </BidiText>
  );
}
