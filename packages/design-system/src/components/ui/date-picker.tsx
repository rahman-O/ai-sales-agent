import * as React from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '#lib/utils';
import { Button } from '#components/ui/button';
import { Calendar } from '#components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '#components/ui/popover';

export interface DatePickerProps {
  date?: Date;
  onDateChange?: (date: Date) => void;
  placeholder?: string;
  locale?: 'en' | 'ar';
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  className?: string;
}

function DatePicker({
  date,
  onDateChange,
  placeholder = 'Pick a date',
  locale = 'en',
  minDate,
  maxDate,
  disabled = false,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const formatDate = (d: Date) => {
    return d.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleSelect = (selectedDate: Date) => {
    onDateChange?.(selectedDate);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'tw:w-full tw:justify-start tw:text-start tw:font-normal',
            !date && 'tw:text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="tw:me-2 tw:h-4 tw:w-4" />
          {date ? formatDate(date) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="tw:w-auto tw:p-0" align="start">
        <Calendar
          selected={date}
          onSelect={handleSelect}
          locale={locale}
          minDate={minDate}
          maxDate={maxDate}
        />
      </PopoverContent>
    </Popover>
  );
}

export { DatePicker };
