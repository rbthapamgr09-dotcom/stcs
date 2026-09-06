import React, { useState, useEffect } from 'react';
import { Calendar, RefreshCw } from 'lucide-react';
import { bsToAd, adToBs, toNepaliDigits, toEnglishDigits, getCurrentDualDate } from '../../utils/nepaliCalendar';
import { NepaliBsDatePicker } from './NepaliBsDatePicker';

interface DualDatePickerProps {
  label?: string;
  bsValue?: string;
  adValue?: string;
  onChange: (dates: { bs: string; ad: string }) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  align?: 'left' | 'right';
}

export const DualDatePicker: React.FC<DualDatePickerProps> = ({
  label = 'मिति (Date)',
  bsValue = '',
  adValue = '',
  onChange,
  required = false,
  disabled = false,
  error,
  align = 'left',
}) => {
  const [bsInput, setBsInput] = useState<string>(bsValue || '');
  const [adInput, setAdInput] = useState<string>(adValue || '');

  useEffect(() => {
    if (bsValue !== undefined) setBsInput(toNepaliDigits(bsValue));
  }, [bsValue]);

  useEffect(() => {
    if (adValue !== undefined) setAdInput(adValue);
  }, [adValue]);

  // When BS Date is changed (typed or picked) -> Auto convert to AD Date
  const handleBsDateChange = (newBsDate: string) => {
    const unicodeBs = toNepaliDigits(newBsDate);
    setBsInput(unicodeBs);
    const eng = toEnglishDigits(unicodeBs).trim();
    const parts = eng.split(/[-/.]/).filter(Boolean);
    if (parts.length === 3 && parts[0].length === 4 && parts[1].length >= 1 && parts[2].length >= 1) {
      const converted = bsToAd(unicodeBs);
      if (converted.formattedAD && !isNaN(converted.adYear)) {
        setAdInput(converted.formattedAD);
        onChange({ bs: unicodeBs, ad: converted.formattedAD });
        return;
      }
    }
    onChange({ bs: unicodeBs, ad: adInput });
  };

  // When AD Date is changed (typed or selected) -> Auto convert to BS Date
  const handleAdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAdInput(val);
    if (val && val.length >= 8) {
      const converted = adToBs(val);
      setBsInput(converted.formattedBSDevanagari);
      onChange({ bs: converted.formattedBSDevanagari, ad: val });
    } else {
      onChange({ bs: bsInput, ad: val });
    }
  };

  const setToToday = () => {
    const cur = getCurrentDualDate();
    setBsInput(cur.bs);
    setAdInput(cur.ad);
    onChange({ bs: cur.bs, ad: cur.ad });
  };

  return (
    <div className="flex flex-col gap-1.5 text-left bg-[#f8faf7] p-3 rounded-xl border border-[#dce8d9]">
      <div className="flex items-center justify-between pb-1 border-b border-[#e7f0e4]">
        <label className="text-xs font-bold text-[#324528]">
          {label} {required && <span className="text-red-500 font-bold">*</span>}
        </label>
        <button
          type="button"
          onClick={setToToday}
          disabled={disabled}
          className="text-[11px] text-[#4B6043] hover:text-[#2c3d26] hover:bg-[#ebf4e8] px-2 py-0.5 rounded flex items-center gap-1 font-medium transition-colors cursor-pointer"
          title="आजको मिति सेट गर्नुहोस्"
        >
          <RefreshCw className="w-3 h-3" /> आज (Today)
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {/* Bikram Sambat Input with Interactive Calendar Dropdown */}
        <div className="relative flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold text-[#5a7251]">नेपाली वि.सं. (BS Date):</span>
          <NepaliBsDatePicker
            value={bsInput}
            onChange={handleBsDateChange}
            disabled={disabled}
            align={align}
            placeholder="२०८१/०५/०८ (वि.सं.)"
            className={error ? 'border-red-400 bg-red-50/20' : ''}
          />
        </div>

        {/* Gregorian AD Input */}
        <div className="relative flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold text-[#5a7251]">अंग्रेजी ई.सं. (AD Date):</span>
          <div className="relative">
            <input
              type="date"
              value={adInput}
              onChange={handleAdChange}
              disabled={disabled}
              className={`w-full pl-8 pr-2 py-1.5 text-xs rounded-lg border bg-white text-[#24331C] focus:outline-none focus:ring-2 focus:ring-[#4B6043]/30 focus:border-[#4B6043] transition-all font-mono ${
                error ? 'border-red-400 bg-red-50/20' : 'border-[#c8d7c2]'
              }`}
            />
            <Calendar className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <span className="absolute right-7 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-semibold pointer-events-none">
              AD
            </span>
          </div>
        </div>
      </div>
      {error && <p className="text-red-500 text-[11px] mt-0.5">{error}</p>}
    </div>
  );
};

