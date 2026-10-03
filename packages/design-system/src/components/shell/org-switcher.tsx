import * as React from 'react';
import { cn } from '../../lib/utils.js';
import { ChevronsUpDown, Check, Building2, Plus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu.js';

export interface OrgItem {
  id: string;
  name: string;
  role?: string;
  avatarUrl?: string;
  isCurrent?: boolean;
  disabled?: boolean;
}

export interface OrgSwitcherProps {
  currentOrg?: OrgItem;
  organizations?: OrgItem[];
  onSelectOrg?: (orgId: string) => void;
  onCreateOrg?: () => void;
  disabled?: boolean;
  className?: string;
  label?: string;
  createOrgLabel?: string;
  collapsed?: boolean;
}

export function OrgSwitcher({
  currentOrg,
  organizations = [],
  onSelectOrg,
  onCreateOrg,
  disabled = false,
  className,
  label = 'Organizations',
  createOrgLabel = 'Create Organization',
  collapsed = false,
}: OrgSwitcherProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        role="combobox"
        aria-label={currentOrg?.name || 'Select organization'}
        disabled={disabled}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-md border border-sidebar-border bg-sidebar px-3 py-2 text-start font-normal text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
          collapsed && 'h-9 w-9 p-0 justify-center',
          disabled && 'pointer-events-none opacity-50',
          className
        )}
      >
        <div className="flex items-center gap-2 truncate">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Building2 className="h-3.5 w-3.5" />
          </span>
          {!collapsed && (
            <span className="truncate font-medium text-xs sm:text-sm text-foreground">
              {currentOrg?.name || 'Select organization'}
            </span>
          )}
        </div>
        {!collapsed && (
          <ChevronsUpDown className="ms-auto h-4 w-4 shrink-0 opacity-50" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
          {label}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {organizations.map((org) => {
          const isSelected = currentOrg?.id === org.id || org.isCurrent;
          return (
            <DropdownMenuItem
              key={org.id}
              disabled={org.disabled || disabled}
              onClick={() => {
                onSelectOrg?.(org.id);
              }}
              className="flex items-center justify-between gap-2 cursor-pointer"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                </span>
                <span className="truncate text-xs sm:text-sm">{org.name}</span>
              </div>
              {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </DropdownMenuItem>
          );
        })}
        {onCreateOrg && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                onCreateOrg();
              }}
              className="flex items-center gap-2 cursor-pointer text-primary"
            >
              <Plus className="h-4 w-4" />
              <span className="text-xs sm:text-sm font-medium">{createOrgLabel}</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
