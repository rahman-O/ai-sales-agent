import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '#lib/utils';
import { buttonVariants } from '#components/ui/button';

export interface CalendarProps {
  selected?: Date;
  onSelect?: (date: Date) => void;
  locale?: 'en' | 'ar';
  minDate?: Date;
  maxDate?: Date;
  className?: string;
}

function Calendar({
  selected,
  onSelect,
  locale = 'en',
  minDate,
  maxDate,
  className,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    return selected ? new Date(selected.getFullYear(), selected.getMonth(), 1) : new Date();
  });

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sunday

  const prevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const monthNamesEn = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthNamesAr = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];

  const weekDaysEn = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const weekDaysAr = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

  const monthLabel = locale === 'ar' ? `${monthNamesAr[month]} ${year}` : `${monthNamesEn[month]} ${year}`;
  const weekDays = locale === 'ar' ? weekDaysAr : weekDaysEn;

  const isSelected = (day: number) => {
    if (!selected) return false;
    return (
      selected.getDate() === day &&
      selected.getMonth() === month &&
      selected.getFullYear() === year
    );
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === month &&
      today.getFullYear() === year
    );
  };

  const isDisabled = (day: number) => {
    const date = new Date(year, month, day);
    if (minDate && date < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())) {
      return true;
    }
    if (maxDate && date > new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate())) {
      return true;
    }
    return false;
  };

  const days = [];
  // Empty slots for leading padding
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} className="tw:h-9 tw:w-9" />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const selectedState = isSelected(day);
    const todayState = isToday(day);
    const disabledState = isDisabled(day);

    days.push(
      <button
        key={day}
        type="button"
        disabled={disabledState}
        onClick={() => onSelect?.(new Date(year, month, day))}
        className={cn(
          buttonVariants({ variant: selectedState ? 'default' : 'ghost', size: 'iconSm' }),
          'tw:h-9 tw:w-9 tw:p-0 tw:font-normal',
          todayState && !selectedState && 'tw:border tw:border-primary tw:font-semibold',
          disabledState && 'tw:opacity-30 tw:pointer-events-none',
        )}
      >
        {day}
      </button>
    );
  }

  return (
    <div
      data-slot="calendar"
      className={cn('tw:p-3 tw:border tw:border-border tw:rounded-md tw:bg-card tw:w-fit', className)}
    >
      <div className="tw:flex tw:items-center tw:justify-between tw:pb-2">
        <span className="tw:text-sm tw:font-semibold">{monthLabel}</span>
        <div className="tw:flex tw:items-center tw:gap-1">
          <button
            type="button"
            onClick={prevMonth}
            className={cn(buttonVariants({ variant: 'outline', size: 'iconSm' }), 'tw:h-7 tw:w-7')}
            aria-label="Previous month"
          >
            <ChevronLeft className="tw:h-4 tw:w-4 rtl:tw:rotate-180" />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className={cn(buttonVariants({ variant: 'outline', size: 'iconSm' }), 'tw:h-7 tw:w-7')}
            aria-label="Next month"
          >
            <ChevronRight className="tw:h-4 tw:w-4 rtl:tw:rotate-180" />
          </button>
        </div>
      </div>
      <div className="tw:grid tw:grid-cols-7 tw:gap-1 tw:text-center tw:text-xs tw:font-medium tw:text-muted-foreground tw:pb-1">
        {weekDays.map((d, i) => (
          <div key={i} className="tw:h-6 tw:flex tw:items-center tw:justify-center">
            {d}
          </div>
        ))}
      </div>
      <div className="tw:grid tw:grid-cols-7 tw:gap-1">{days}</div>
    </div>
  );
}

export { Calendar };
