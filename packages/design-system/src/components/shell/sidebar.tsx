import * as React from 'react';
import { cn } from '../../lib/utils.js';

export interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  'aria-label'?: string;
}

export function Sidebar({
  className,
  collapsed = false,
  children,
  'aria-label': ariaLabel = 'Sidebar navigation',
  ...props
}: SidebarProps) {
  return (
    <aside
      aria-label={ariaLabel}
      data-collapsed={collapsed ? 'true' : 'false'}
      className={cn(
        'relative flex flex-col border-e border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-in-out',
        collapsed ? 'w-16' : 'w-64',
        className
      )}
      {...props}
    >
      {children}
    </aside>
  );
}

export function SidebarHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex h-14 items-center border-b border-sidebar-border px-3 gap-2', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function SidebarContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <nav
      aria-label="Main Navigation"
      className={cn('flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-4', className)}
      {...props}
    >
      {children}
    </nav>
  );
}

export interface SidebarSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: React.ReactNode;
}

export function SidebarSection({
  className,
  label,
  children,
  ...props
}: SidebarSectionProps) {
  return (
    <div className={cn('space-y-1', className)} {...props}>
      {label && (
        <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground select-none">
          {label}
        </div>
      )}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export interface SidebarItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  label: React.ReactNode;
  badge?: React.ReactNode;
  collapsed?: boolean;
  asChild?: boolean;
  href?: string;
}

export function SidebarItem({
  className,
  active = false,
  disabled = false,
  icon,
  label,
  badge,
  collapsed = false,
  asChild = false,
  href,
  ...props
}: SidebarItemProps) {
  const content = (
    <>
      {icon && (
        <span
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground transition-colors group-hover:text-sidebar-foreground',
            active && 'text-sidebar-primary-foreground'
          )}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      {!collapsed && (
        <span className="flex-1 truncate text-start text-sm font-medium">
          {label}
        </span>
      )}
      {!collapsed && badge && (
        <span className="ms-auto flex shrink-0 items-center justify-center">
          {badge}
        </span>
      )}
    </>
  );

  const itemClasses = cn(
    'group flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
    active
      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
    disabled && 'pointer-events-none opacity-50',
    collapsed && 'justify-center px-2',
    className
  );

  if (href) {
    return (
      <a
        href={href}
        aria-current={active ? 'page' : undefined}
        aria-disabled={disabled}
        className={itemClasses}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      disabled={disabled}
      className={itemClasses}
      {...props}
    >
      {content}
    </button>
  );
}

export function SidebarFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center border-t border-sidebar-border p-3 gap-2', className)}
      {...props}
    >
      {children}
    </div>
  );
}
