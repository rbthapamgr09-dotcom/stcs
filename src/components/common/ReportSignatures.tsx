import React from 'react';
import { useApp } from '../../context/AppContext';
import { toNepaliDigits, getCurrentDualDate } from '../../utils/nepaliCalendar';

export interface SignatoryInfo {
  name?: string;
  designation?: string;
  dateBS?: string;
}

interface ReportSignaturesProps {
  preparedBy?: SignatoryInfo;
  checkedBy?: SignatoryInfo;
  approvedBy?: SignatoryInfo;
  className?: string;
  variant?: 'detailed' | 'simple';
}

export const ReportSignatures: React.FC<ReportSignaturesProps> = ({
  preparedBy,
  checkedBy,
  approvedBy,
  className = '',
  variant = 'detailed',
}) => {
  const { organization, activeFiscalYear } = useApp();
  const currentDate = getCurrentDualDate();

  if (variant === 'simple') {
    return (
      <div
        className={`w-full mt-12 pt-8 border-t border-[#cad8c5] print:border-black grid grid-cols-3 gap-6 text-center font-bold text-black break-inside-avoid ${className}`}
        style={{ fontSize: '10pt' }}
      >
        {/* 1. तयार गर्ने - Center Aligned */}
        <div className="flex flex-col items-center justify-center text-center">
          <p
            className="font-bold text-[#24331C] print:text-black text-[10pt]"
            style={{ fontSize: '10pt' }}
          >
            तयार गर्ने
          </p>
        </div>

        {/* 2. पेश गर्ने - Center Aligned */}
        <div className="flex flex-col items-center justify-center text-center">
          <p
            className="font-bold text-[#24331C] print:text-black text-[10pt]"
            style={{ fontSize: '10pt' }}
          >
            पेश गर्ने
          </p>
        </div>

        {/* 3. सदर गर्ने - Center Aligned */}
        <div className="flex flex-col items-center justify-center text-center">
          <p
            className="font-bold text-[#24331C] print:text-black text-[10pt]"
            style={{ fontSize: '10pt' }}
          >
            सदर गर्ने
          </p>
        </div>
      </div>
    );
  }

  // Try to load any saved settings from localStorage for active fiscal year
  const savedSettings = React.useMemo(() => {
    try {
      const savedStr =
        localStorage.getItem(`nepal_payroll_kitabkhana_report_settings_${activeFiscalYear}`) ||
        localStorage.getItem('nepal_payroll_kitabkhana_report_settings_latest');
      if (savedStr) {
        return JSON.parse(savedStr);
      }
    } catch {
      // ignore
    }
    return null;
  }, [activeFiscalYear]);

  const prep = {
    name: preparedBy?.name ?? savedSettings?.preparedBy?.name ?? '',
    designation: preparedBy?.designation ?? savedSettings?.preparedBy?.designation ?? 'लेखापाल',
    dateBS: preparedBy?.dateBS ?? savedSettings?.preparedBy?.dateBS ?? currentDate.bs,
  };

  const chk = {
    name: checkedBy?.name ?? savedSettings?.checkedBy?.name ?? '',
    designation: checkedBy?.designation ?? savedSettings?.checkedBy?.designation ?? 'लेखा अधिकृत',
    dateBS: checkedBy?.dateBS ?? savedSettings?.checkedBy?.dateBS ?? currentDate.bs,
  };

  const app = {
    name: approvedBy?.name ?? savedSettings?.approvedBy?.name ?? organization.authorizedPersonName ?? '',
    designation:
      approvedBy?.designation ??
      savedSettings?.approvedBy?.designation ??
      organization.authorizedPersonDesignation ??
      'कार्यालय प्रमुख',
    dateBS: approvedBy?.dateBS ?? savedSettings?.approvedBy?.dateBS ?? currentDate.bs,
  };

  return (
    <div
      className={`w-full mt-10 pt-6 border-t border-[#cad8c5] print:border-black grid grid-cols-3 gap-6 text-center text-xs text-black break-inside-avoid ${className}`}
    >
      {/* 1. तयार गर्ने (Prepared By) - Center Aligned */}
      <div className="flex flex-col items-center text-center">
        <p
          className="font-bold text-[#24331C] print:text-black text-[10pt] mb-1"
          style={{ fontSize: '10pt' }}
        >
          तयार गर्ने
        </p>
        <div className="h-10 w-44 border-b border-dashed border-gray-400 print:border-black flex items-center justify-center mb-2">
          {/* Signature Line */}
        </div>
      </div>

      {/* 2. जाँच गर्ने (Checked By) - Center Aligned */}
      <div className="flex flex-col items-center text-center">
        <p
          className="font-bold text-[#24331C] print:text-black text-[10pt] mb-1"
          style={{ fontSize: '10pt' }}
        >
          जाँच गर्ने / पेश गर्ने
        </p>
        <div className="h-10 w-44 border-b border-dashed border-gray-400 print:border-black flex items-center justify-center mb-2">
          {/* Signature Line */}
        </div>
      </div>

      {/* 3. प्रमाणित गर्ने (Approved By) - Center Aligned */}
      <div className="flex flex-col items-center text-center">
        <p
          className="font-bold text-[#24331C] print:text-black text-[10pt] mb-1"
          style={{ fontSize: '10pt' }}
        >
          प्रमाणित / स्वीकृत / सदर गर्ने
        </p>
        <div className="h-10 w-44 border-b border-dashed border-gray-400 print:border-black flex items-center justify-center mb-2">
          {organization.signatureUrl ? (
            <img
              src={organization.signatureUrl}
              alt="Signature"
              className="max-h-9 object-contain"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};
