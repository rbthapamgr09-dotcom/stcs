import React, { forwardRef } from 'react';

export interface NepaliTextInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string | number | undefined | null;
  onChange: (value: string) => void;
  isNepali?: boolean;
  mode?: string;
  convertDigits?: boolean;
  showToggleBadge?: boolean;
  containerClassName?: string;
}

/**
 * Standard Native Text Input Component
 * Uses native OS keyboard input directly without virtual keyboard overlays.
 */
export const NepaliTextInput = forwardRef<HTMLInputElement, NepaliTextInputProps>(
  (
    {
      value = '',
      onChange,
      isNepali,
      mode,
      convertDigits,
      showToggleBadge,
      placeholder,
      className = '',
      containerClassName = '',
      id,
      name,
      disabled,
      required,
      type = 'text',
      ...restProps
    },
    ref
  ) => {
    const stringVal = value === null || value === undefined ? '' : String(value);

    return (
      <div className={`relative flex items-center w-full ${containerClassName}`}>
        <input
          {...restProps}
          ref={ref}
          id={id}
          name={name}
          type={type}
          value={stringVal}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          className={`w-full px-3 py-2 text-sm border rounded-lg transition-colors focus:ring-2 focus:ring-[#4B6043] focus:outline-none ${className}`}
        />
      </div>
    );
  }
);

NepaliTextInput.displayName = 'NepaliTextInput';

export interface NepaliTextAreaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value: string | undefined | null;
  onChange: (value: string) => void;
  isNepali?: boolean;
  mode?: string;
  convertDigits?: boolean;
  showToggleBadge?: boolean;
  containerClassName?: string;
}

/**
 * Standard Native Text Area Component
 */
export const NepaliTextArea = forwardRef<HTMLTextAreaElement, NepaliTextAreaProps>(
  (
    {
      value = '',
      onChange,
      isNepali,
      mode,
      convertDigits,
      showToggleBadge,
      placeholder,
      className = '',
      containerClassName = '',
      id,
      name,
      disabled,
      required,
      rows = 3,
      ...restProps
    },
    ref
  ) => {
    const stringVal = value === null || value === undefined ? '' : String(value);

    return (
      <div className={`relative w-full ${containerClassName}`}>
        <textarea
          {...restProps}
          ref={ref}
          id={id}
          name={name}
          rows={rows}
          value={stringVal}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          className={`w-full px-3 py-2 text-sm border rounded-lg transition-colors focus:ring-2 focus:ring-[#4B6043] focus:outline-none ${className}`}
        />
      </div>
    );
  }
);

NepaliTextArea.displayName = 'NepaliTextArea';
