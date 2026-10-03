import * as React from 'react';
import { cn } from '#lib/utils';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'default' | 'lg';
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, size = 'default', ...props }, ref) => {
    const sizeClasses = {
      sm: 'tw:h-8 tw:w-8 tw:text-xs',
      default: 'tw:h-10 tw:w-10 tw:text-sm',
      lg: 'tw:h-12 tw:w-12 tw:text-base',
    }[size];

    return (
      <div
        ref={ref}
        data-slot="avatar"
        className={cn(
          'tw:relative tw:flex tw:shrink-0 tw:overflow-hidden tw:rounded-full tw:bg-muted',
          sizeClasses,
          className,
        )}
        {...props}
      />
    );
  },
);
Avatar.displayName = 'Avatar';

export interface AvatarImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  onLoadingStatusChange?: (status: 'loading' | 'loaded' | 'error') => void;
}

const AvatarImage = React.forwardRef<HTMLImageElement, AvatarImageProps>(
  ({ className, src, alt = '', onLoadingStatusChange, ...props }, ref) => {
    const [status, setStatus] = React.useState<'loading' | 'loaded' | 'error'>('loading');

    React.useEffect(() => {
      if (!src) {
        setStatus('error');
        onLoadingStatusChange?.('error');
        return;
      }

      let isMounted = true;
      const image = new Image();
      image.src = src;
      image.onload = () => {
        if (!isMounted) return;
        setStatus('loaded');
        onLoadingStatusChange?.('loaded');
      };
      image.onerror = () => {
        if (!isMounted) return;
        setStatus('error');
        onLoadingStatusChange?.('error');
      };

      return () => {
        isMounted = false;
      };
    }, [src, onLoadingStatusChange]);

    if (status !== 'loaded') return null;

    return (
      <img
        ref={ref}
        src={src}
        alt={alt}
        data-slot="avatar-image"
        className={cn('tw:aspect-square tw:h-full tw:w-full tw:object-cover', className)}
        {...props}
      />
    );
  },
);
AvatarImage.displayName = 'AvatarImage';

const AvatarFallback = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="avatar-fallback"
        className={cn(
          'tw:flex tw:h-full tw:w-full tw:items-center tw:justify-center tw:rounded-full tw:bg-muted tw:font-medium tw:text-muted-foreground',
          className,
        )}
        {...props}
      />
    );
  },
);
AvatarFallback.displayName = 'AvatarFallback';

export { Avatar, AvatarImage, AvatarFallback };
