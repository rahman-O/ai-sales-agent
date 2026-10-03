import * as React from 'react';
import { cn } from '../../lib/utils.js';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar.js';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu.js';
import { LogOut } from 'lucide-react';

export interface UserProfile {
  name: string;
  email?: string;
  role?: string;
  avatarUrl?: string;
  initials?: string;
}

export interface AccountMenuItem {
  label: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

export interface AccountMenuProps {
  user?: UserProfile;
  items?: AccountMenuItem[];
  onLogout?: () => void;
  logoutLabel?: string;
  className?: string;
}

export function AccountMenu({
  user = { name: 'User' },
  items = [],
  onLogout,
  logoutLabel = 'Log out',
  className,
}: AccountMenuProps) {
  const initials =
    user.initials ||
    user.name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() ||
    'U';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'relative flex h-9 w-9 items-center justify-center rounded-full p-0 outline-none ring-offset-background hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring',
          className
        )}
        aria-label={`User account menu for ${user.name}`}
      >
        <Avatar className="h-8 w-8">
          {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none truncate">{user.name}</p>
            {user.email && (
              <p className="text-xs leading-none text-muted-foreground truncate">
                {user.email}
              </p>
            )}
            {user.role && (
              <p className="text-xs text-primary font-medium">{user.role}</p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length > 0 && (
          <DropdownMenuGroup>
            {items.map((item, idx) => (
              <DropdownMenuItem
                key={idx}
                disabled={item.disabled}
                onClick={item.onClick}
                className={cn('cursor-pointer gap-2', item.destructive && 'text-destructive focus:text-destructive')}
              >
                {item.icon}
                <span>{item.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        )}
        {onLogout && (
          <>
            {items.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onClick={onLogout}
              className="cursor-pointer gap-2 text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              <span>{logoutLabel}</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
