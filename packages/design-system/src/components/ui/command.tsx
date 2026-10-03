import * as React from 'react';
import { Search } from 'lucide-react';
import { cn } from '#lib/utils';

interface CommandContextValue {
  search: string;
  setSearch: (val: string) => void;
}

const CommandContext = React.createContext<CommandContextValue>({
  search: '',
  setSearch: () => {},
});

export interface CommandProps extends React.HTMLAttributes<HTMLDivElement> {}

const Command = React.forwardRef<HTMLDivElement, CommandProps>(
  ({ className, children, ...props }, ref) => {
    const [search, setSearch] = React.useState('');

    return (
      <CommandContext.Provider value={{ search, setSearch }}>
        <div
          ref={ref}
          data-slot="command"
          className={cn(
            'tw:flex tw:h-full tw:w-full tw:flex-col tw:overflow-hidden tw:rounded-md tw:bg-popover tw:text-popover-foreground tw:border tw:border-border',
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </CommandContext.Provider>
    );
  },
);
Command.displayName = 'Command';

export interface CommandInputProps
  extends Omit<React.ComponentProps<'input'>, 'size'> {}

const CommandInput = React.forwardRef<HTMLInputElement, CommandInputProps>(
  ({ className, value, onChange, placeholder = 'Type a command or search...', ...props }, ref) => {
    const context = React.useContext(CommandContext);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      context.setSearch(e.target.value);
      onChange?.(e);
    };

    return (
      <div className="tw:flex tw:items-center tw:border-b tw:border-border tw:px-3">
        <Search className="tw:me-2 tw:h-4 tw:w-4 tw:shrink-0 tw:opacity-50" />
        <input
          ref={ref}
          type="text"
          value={value ?? context.search}
          onChange={handleChange}
          placeholder={placeholder}
          className={cn(
            'tw:flex tw:h-11 tw:w-full tw:rounded-md tw:bg-transparent tw:py-3 tw:text-sm tw:outline-none tw:placeholder:text-muted-foreground tw:disabled:cursor-not-allowed tw:disabled:opacity-50',
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);
CommandInput.displayName = 'CommandInput';

const CommandList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="command-list"
      className={cn('tw:max-h-[300px] tw:overflow-y-auto tw:overflow-x-hidden tw:p-1', className)}
      {...props}
    >
      {children}
    </div>
  ),
);
CommandList.displayName = 'CommandList';

const CommandEmpty = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children = 'No results found.', ...props }, ref) => (
    <div
      ref={ref}
      data-slot="command-empty"
      className={cn('tw:py-6 tw:text-center tw:text-sm tw:text-muted-foreground', className)}
      {...props}
    >
      {children}
    </div>
  ),
);
CommandEmpty.displayName = 'CommandEmpty';

export interface CommandGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  heading?: React.ReactNode;
}

const CommandGroup = React.forwardRef<HTMLDivElement, CommandGroupProps>(
  ({ className, heading, children, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="command-group"
      className={cn(
        'tw:overflow-hidden tw:p-1 tw:text-foreground [&_[data-slot=command-group-heading]]:tw:px-2 [&_[data-slot=command-group-heading]]:tw:py-1.5 [&_[data-slot=command-group-heading]]:tw:text-xs [&_[data-slot=command-group-heading]]:tw:font-medium [&_[data-slot=command-group-heading]]:tw:text-muted-foreground',
        className,
      )}
      {...props}
    >
      {heading && <div data-slot="command-group-heading">{heading}</div>}
      {children}
    </div>
  ),
);
CommandGroup.displayName = 'CommandGroup';

const CommandSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="command-separator"
      className={cn('tw:-mx-1 tw:h-px tw:bg-border', className)}
      {...props}
    />
  ),
);
CommandSeparator.displayName = 'CommandSeparator';

export interface CommandItemProps extends React.HTMLAttributes<HTMLDivElement> {
  disabled?: boolean;
  onSelect?: () => void;
}

const CommandItem = React.forwardRef<HTMLDivElement, CommandItemProps>(
  ({ className, disabled = false, onSelect, onClick, onKeyDown, children, ...props }, ref) => {
    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      onSelect?.();
      onClick?.(e);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!disabled) onSelect?.();
      }
      onKeyDown?.(e);
    };

    return (
      <div
        ref={ref}
        role="option"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        data-slot="command-item"
        className={cn(
          'tw:relative tw:flex tw:cursor-pointer tw:select-none tw:items-center tw:rounded-sm tw:px-2 tw:py-1.5 tw:text-sm tw:outline-none hover:tw:bg-accent hover:tw:text-accent-foreground focus:tw:bg-accent focus:tw:text-accent-foreground',
          disabled && 'tw:pointer-events-none tw:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
CommandItem.displayName = 'CommandItem';

const CommandShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn(
        'tw:ms-auto tw:text-xs tw:tracking-widest tw:text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
};
CommandShortcut.displayName = 'CommandShortcut';

export {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};
