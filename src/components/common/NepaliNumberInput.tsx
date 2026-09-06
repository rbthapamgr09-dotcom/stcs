import React, { useState, useEffect } from 'react';
import { toNepaliDigits, toEnglishDigits, toDisplayDigits, formatNepaliNumber } from '../../utils/nepaliCalendar';
import { useApp } from '../../context/AppContext';

export interface NepaliNumberInputProps {
  id?: string;
  name?: string;
  value: number | undefined | null;
  onChange: (val: number) => void;
  placeholder?: string;
  className?: string;
  allowDecimals?: boolean;
  formatDecimalOnBlur?: boolean;
  decimalPlaces?: number;
  isInfinityAllowed?: boolean;
  min?: number;
  max?: number;
  disabled?: boolean;
  required?: boolean;
  useDevanagari?: boolean;
}

/**
 * Reusable Numeric Input Component
 * Automatically converts user typed digits and formats numbers in standard 0.00 format on blur
 * Supports switching between Nepali Unicode (०-९) and English numbers (0-9).
 */
export const NepaliNumberInput: React.FC<NepaliNumberInputProps> = ({
  id,
  name,
  value,
  onChange,
  placeholder,
  className = '',
  allowDecimals = true,
  formatDecimalOnBlur = true,
  decimalPlaces = 2,
  isInfinityAllowed = false,
  disabled = false,
  useDevanagari: useDevanagariProp,
}) => {
  let appDevanagari = true;
  try {
    const app = useApp();
    if (app && typeof app.useDevanagariNumerals === 'boolean') {
      appDevanagari = app.useDevanagariNumerals;
    }
  } catch {
    // fallback if used outside provider
  }

  const isDevanagari = useDevanagariProp !== undefined ? useDevanagariProp : appDevanagari;

  const [isFocused, setIsFocused] = useState(false);
  const [rawText, setRawText] = useState('');

  const numValue = value === null || value === undefined ? 0 : value;

  const defaultPlaceholder = placeholder
    ? toDisplayDigits(placeholder, isDevanagari)
    : isDevanagari
    ? (allowDecimals && decimalPlaces > 0 ? '०.००' : '०')
    : (allowDecimals && decimalPlaces > 0 ? '0.00' : '0');

  const formatWithDecimals = (val: number): string => {
    if (isInfinityAllowed && val >= 999999990) {
      return '';
    }
    const dec = formatDecimalOnBlur && allowDecimals ? decimalPlaces : 0;
    return formatNepaliNumber(val || 0, {
      useDevanagari: isDevanagari,
      decimals: dec,
      showThousandsSeparator: true,
    });
  };

  useEffect(() => {
    if (!isFocused) {
      if (isInfinityAllowed && numValue >= 999999990) {
        setRawText('');
      } else if (numValue === 0 && (value === null || value === undefined)) {
        setRawText('');
      } else {
        setRawText(formatWithDecimals(numValue));
      }
    }
  }, [numValue, value, isFocused, isInfinityAllowed, formatDecimalOnBlur, decimalPlaces, isDevanagari]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value;
    const engDigits = toEnglishDigits(inputVal);
    const cleanEng = allowDecimals
      ? engDigits.replace(/[^0-9.]/g, '')
      : engDigits.replace(/[^0-9]/g, '');

    // Prevent multiple decimal dots
    const parts = cleanEng.split('.');
    const sanitizedEng = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleanEng;

    const displayVal = isDevanagari ? toNepaliDigits(sanitizedEng) : sanitizedEng;
    setRawText(displayVal);

    if (sanitizedEng === '' || sanitizedEng === '.') {
      onChange(isInfinityAllowed ? 999999999 : 0);
    } else {
      const parsed = parseFloat(sanitizedEng);
      onChange(isNaN(parsed) ? 0 : parsed);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    if (isInfinityAllowed && numValue >= 999999990) {
      setRawText('');
    } else if (numValue === 0 && (value === null || value === undefined)) {
      setRawText('');
    } else if (numValue === 0) {
      setRawText('');
    } else {
      // When focusing, show clean number without forced trailing zero padding if whole number for easy typing
      const strVal = numValue % 1 === 0 ? numValue.toString() : numValue.toFixed(decimalPlaces);
      setRawText(isDevanagari ? toNepaliDigits(strVal) : toEnglishDigits(strVal));
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (rawText.trim() === '') {
      if (isInfinityAllowed) {
        onChange(999999999);
      } else {
        onChange(0);
        setRawText(formatWithDecimals(0));
      }
    } else {
      const eng = toEnglishDigits(rawText);
      const parsed = parseFloat(eng);
      const validNum = isNaN(parsed) ? 0 : parsed;
      onChange(validNum);
      setRawText(formatWithDecimals(validNum));
    }
  };

  return (
    <input
      id={id}
      name={name}
      type="text"
      inputMode={allowDecimals ? 'decimal' : 'numeric'}
      value={rawText}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={defaultPlaceholder}
      disabled={disabled}
      className={className}
    />
  );
};
