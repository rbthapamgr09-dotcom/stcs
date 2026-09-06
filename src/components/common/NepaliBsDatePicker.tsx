import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Clock } from 'lucide-react';
import {
  toNepaliDigits,
  toEnglishDigits,
  NEPALI_MONTH_NAMES,
  NEPALI_WEEK_DAYS,
  getCurrentDualDate,
  getDaysInBsMonth,
  getBsMonthFirstDayOfWeek,
  getAvailableBsYears,
} from '../../utils/nepaliCalendar';

interface NepaliBsDatePickerProps {
  value: string;
  onChange: (dateBS: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  align?: 'left' | 'right';
}

export const NepaliBsDatePicker: React.FC<NepaliBsDatePickerProps> = ({
  value,
  onChange,
  placeholder = '२०८३/०५/१६',
  className = '',
  disabled = false,
  id,
  align = 'left',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Accurate Today in BS based on Nepal Standard Time
  const todayBSInfo = useMemo(() => {
    const cur = getCurrentDualDate();
    return {
      year: cur.bsYear,
      month: cur.bsMonth,
      day: cur.bsDay,
      formatted: cur.bs,
    };
  }, []);

  // Parse current value into year, month, day
  const parsedValue = useMemo(() => {
    if (!value) return null;
    const engStr = toEnglishDigits(value).trim();
    const parts = engStr.split(/[\/\-\.]/).map((p) => parseInt(p, 10));
    if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return {
        year: parts[0],
        month: parts[1],
        day: parts[2],
      };
    }
    return null;
  }, [value]);

  // Calendar View State (which year/month is currently browsed)
  const [viewYear, setViewYear] = useState<number>(() => {
    return parsedValue?.year || todayBSInfo.year || 2083;
  });

  const [viewMonth, setViewMonth] = useState<number>(() => {
    return parsedValue?.month || todayBSInfo.month || 5;
  });

  // When value changes externally or calendar opens, align view
  useEffect(() => {
    if (parsedValue) {
      setViewYear(parsedValue.year);
      setViewMonth(parsedValue.month);
    }
  }, [parsedValue, isOpen]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle direct keyboard entry with automatic Nepali Unicode conversion
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    // Convert any English digits to Nepali digits automatically
    const converted = toNepaliDigits(rawVal);
    onChange(converted);
  };

  // Calendar calculation: Day of week for 1st day of the BS month
  const firstDayOfWeek = useMemo(() => {
    return getBsMonthFirstDayOfWeek(viewYear, viewMonth);
  }, [viewYear, viewMonth]);

  // Total days in the current BS month
  const totalDaysInMonth = useMemo(() => {
    return getDaysInBsMonth(viewYear, viewMonth);
  }, [viewYear, viewMonth]);

  // Select a day
  const handleSelectDay = (day: number) => {
    const formatted = `${toNepaliDigits(viewYear)}/${toNepaliDigits(String(viewMonth).padStart(2, '0'))}/${toNepaliDigits(String(day).padStart(2, '0'))}`;
    onChange(formatted);
    setIsOpen(false);
  };

  // Previous Month
  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      if (viewYear > 2000) {
        setViewYear(viewYear - 1);
        setViewMonth(12);
      }
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  // Next Month
  const handleNextMonth = () => {
    if (viewMonth === 12) {
      if (viewYear < 2095) {
        setViewYear(viewYear + 1);
        setViewMonth(1);
      }
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // Set Today
  const handleSetToday = () => {
    onChange(todayBSInfo.formatted);
    setViewYear(todayBSInfo.year);
    setViewMonth(todayBSInfo.month);
    setIsOpen(false);
  };

  // Available BS Years range
  const availableYears = useMemo(() => {
    return getAvailableBsYears();
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
          id={id}
          type="text"
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full pr-8 pl-2.5 py-1.5 text-xs rounded-lg border border-[#c8d7c2] bg-[#fdfefd] text-[#24331C] font-mono focus:ring-2 focus:ring-[#4B6043]/30 focus:border-[#4B6043] outline-none transition-all ${className}`}
        />
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          title="विक्रम सम्वत क्यालेन्डर खोल्नुहोस् (BS Calendar)"
          className="absolute right-1.5 p-1 rounded hover:bg-[#edf4ea] text-[#4B6043] transition-colors"
        >
          <CalendarIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* POPUP BIKRAM SAMBAT CALENDAR */}
      {isOpen && (
        <div
          className={`absolute z-50 mt-1.5 ${
            align === 'right' ? 'right-0' : 'left-0'
          } bg-white rounded-2xl shadow-2xl border border-[#b3c9ae] p-3.5 w-72 text-[#24331C] animate-in fade-in zoom-in-95 duration-100 max-w-[calc(100vw-2rem)]`}
        >
          {/* Header with Year & Month Selectors */}
          <div className="flex items-center justify-between gap-1 pb-2.5 border-b border-[#e5eee2]">
            <button
              type="button"
              onClick={handlePrevMonth}
              title="अघिल्लो महिना"
              className="p-1 rounded-lg hover:bg-[#edf4ea] text-[#4B6043] transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5">
              {/* Month Dropdown */}
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(parseInt(e.target.value, 10))}
                className="py-1 px-1.5 text-xs font-bold rounded-lg border border-[#c8d7c2] bg-[#f8fbf6] text-[#24331C] outline-none focus:ring-1 focus:ring-[#4B6043]"
              >
                {NEPALI_MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>

              {/* Year Dropdown */}
              <select
                value={viewYear}
                onChange={(e) => setViewYear(parseInt(e.target.value, 10))}
                className="py-1 px-1.5 text-xs font-bold rounded-lg border border-[#c8d7c2] bg-[#f8fbf6] text-[#24331C] font-mono outline-none focus:ring-1 focus:ring-[#4B6043]"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {toNepaliDigits(yr)}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              title="पछिल्लो महिना"
              className="p-1 rounded-lg hover:bg-[#edf4ea] text-[#4B6043] transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday Names */}
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-[10px] text-gray-600 my-2">
            {NEPALI_WEEK_DAYS.map((dayName, idx) => (
              <div
                key={dayName}
                className={`py-1 rounded ${idx === 6 ? 'text-red-500 font-extrabold' : ''}`}
              >
                {dayName}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {/* Empty slots before first day */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="h-7" />
            ))}

            {/* Days of current BS month */}
            {Array.from({ length: totalDaysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const isSelected =
                parsedValue &&
                parsedValue.year === viewYear &&
                parsedValue.month === viewMonth &&
                parsedValue.day === dayNum;

              const isToday =
                todayBSInfo.year === viewYear &&
                todayBSInfo.month === viewMonth &&
                todayBSInfo.day === dayNum;

              const dayOfWeek = (firstDayOfWeek + i) % 7;
              const isSaturday = dayOfWeek === 6;

              return (
                <button
                  key={`day-${dayNum}`}
                  type="button"
                  onClick={() => handleSelectDay(dayNum)}
                  className={`h-7 w-7 mx-auto rounded-lg flex items-center justify-center font-medium font-mono transition-all text-xs cursor-pointer
                    ${isSelected ? 'bg-[#4B6043] text-white font-bold shadow-xs' : ''}
                    ${!isSelected && isToday ? 'border border-[#4B6043] text-[#24331C] font-bold bg-[#edf4ea]/50 ring-1 ring-[#4B6043]/30' : ''}
                    ${!isSelected && !isToday && isSaturday ? 'text-red-500 hover:bg-red-50' : ''}
                    ${!isSelected && !isToday && !isSaturday ? 'text-gray-700 hover:bg-[#edf4ea] hover:text-[#24331C]' : ''}
                  `}
                >
                  {toNepaliDigits(dayNum)}
                </button>
              );
            })}
          </div>

          {/* Quick Footer Action Buttons */}
          <div className="mt-3 pt-2.5 border-t border-[#e5eee2] flex items-center justify-between text-[11px]">
            <button
              type="button"
              onClick={handleSetToday}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#edf4ea] hover:bg-[#dbe8d6] text-[#344b2d] font-bold transition-colors cursor-pointer"
            >
              <Clock className="w-3 h-3 text-[#4B6043]" />
              <span>आज ({todayBSInfo.formatted})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              className="flex items-center gap-0.5 px-2 py-1 rounded-lg text-gray-500 hover:text-red-600 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>खाली</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
