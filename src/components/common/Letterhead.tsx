import React from 'react';
import { useApp } from '../../context/AppContext';
import { getCurrentDualDate, toNepaliDigits } from '../../utils/nepaliCalendar';
import { ReportSignatures, SignatoryInfo } from './ReportSignatures';
import { OrganizationSetup } from '../../types';

export { ReportSignatures };
export type { SignatoryInfo };

interface LetterheadProps {
  title?: string;
  subTitle?: string;
  showSignatureSection?: boolean;
  showMetadata?: boolean;
  showLocation?: boolean;
  showReportDate?: boolean;
  compact?: boolean;
  customDateBS?: string;
  customDateAD?: string;
  recipientOffice1?: string;
  recipientOffice2?: string;
  preparedBy?: SignatoryInfo;
  checkedBy?: SignatoryInfo;
  approvedBy?: SignatoryInfo;
}

/**
 * Formats the official administrative address line for letterhead.
 * e.g. महेन्द्रनगर, भीमदत्त नगरपालिका-१८, कञ्चनपुर, सुदूरपश्चिम प्रदेश, नेपाल
 */
export function formatLetterheadAddress(org: Partial<OrganizationSetup>): string {
  const rawAddress = (org.address || '').trim();
  const rawLocalLevel = (org.localLevel || '').trim();
  const district = (org.district || '').trim();
  const province = (org.province || '').trim();
  const country = 'नेपाल';

  if (!rawAddress && !rawLocalLevel && !district && !province) {
    return 'महेन्द्रनगर, भीमदत्त नगरपालिका-१८, कञ्चनपुर, सुदूरपश्चिम प्रदेश, नेपाल';
  }

  // Extract ward digits (e.g., 18 or १८) if present in address
  let cleanAddress = rawAddress;
  let ward = '';

  const wardRegex = /(?:वडा\s*(?:नं|नम्बर)?\.?\s*[-:]?\s*)?([०-९0-9]+)/;
  const wardMatch = rawAddress.match(wardRegex);

  if (wardMatch && !rawLocalLevel.includes('-') && !rawLocalLevel.match(/[०-९0-9]/)) {
    ward = toNepaliDigits(wardMatch[1]);
    cleanAddress = rawAddress
      .replace(wardRegex, '')
      .replace(/^[,\s-]+|[,\s-]+$/g, '')
      .trim();
  }

  let formattedLocalLevel = rawLocalLevel;
  if (rawLocalLevel) {
    if (ward && !rawLocalLevel.includes('-') && !rawLocalLevel.match(/[०-९0-9]/)) {
      formattedLocalLevel = `${rawLocalLevel}-${ward}`;
    }
  } else if (ward) {
    formattedLocalLevel = `वडा नं-${ward}`;
  }

  const parts = [
    cleanAddress,
    formattedLocalLevel,
    district,
    province,
    country,
  ].filter(Boolean);

  return parts.join(', ');
}

export const Letterhead: React.FC<LetterheadProps> = ({
  title = 'कर्मचारी तलबी तथा कर कट्टी प्रतिवेदन',
  subTitle,
  showSignatureSection = false,
  showMetadata = false,
  showLocation = false,
  showReportDate = false,
  compact = false,
  customDateBS,
  customDateAD,
  recipientOffice1,
  recipientOffice2,
  preparedBy,
  checkedBy,
  approvedBy,
}) => {
  const { organization, activeOrganization, activeFiscalYear } = useApp();
  const currentDate = getCurrentDualDate();
  const dateBS = customDateBS || currentDate.bs;
  const dateAD = customDateAD || currentDate.ad;

  // संस्था / सरकारको तह (e.g. नेपाल सरकार / प्रदेश सरकार / स्थानीय तह / संस्थाको नाम)
  const orgLevelName = (organization.name || activeOrganization?.name || 'नेपाल सरकार').trim();

  const formattedAddress = formatLetterheadAddress(organization);

  return (
    <div className="w-full text-[#1e2a17]">
      {/* Official Top Letterhead Box */}
      <div className={`border-b-2 border-[#800000] ${compact ? 'pb-1 mb-1' : 'pb-4 mb-4'}`}>
        <div
          className={`relative w-full ${
            organization.alignment === 'left'
              ? 'flex items-start justify-start gap-3 sm:gap-4'
              : organization.alignment === 'right'
              ? 'flex items-start justify-end flex-row-reverse gap-3 sm:gap-4'
              : 'flex items-start justify-center'
          }`}
        >
          {/* Logo / Coat of Arms / Emblem SVG (Top-aligned at top-left so central text is 100% centered with document title) */}
          <div
            className={`${
              compact
                ? 'w-16 h-16 sm:w-20 sm:h-20 print:w-18 print:h-18'
                : 'w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 print:w-24 print:h-24'
            } ${
              organization.alignment === 'center' || !organization.alignment
                ? 'absolute left-0 top-0 shrink-0 flex items-start justify-start pt-0.5'
                : 'shrink-0 flex items-start justify-center pt-0.5 self-start'
            }`}
          >
            {organization.logoUrl ? (
              <img
                src={organization.logoUrl}
                alt="Logo"
                className={`${
                  compact
                    ? 'max-h-16 max-w-16 sm:max-h-20 sm:max-w-20 print:max-h-18 print:max-w-18'
                    : 'max-h-20 max-w-20 sm:max-h-24 sm:max-w-24 md:max-h-28 md:max-w-28 print:max-h-24 print:max-w-24'
                } object-contain drop-shadow-xs`}
              />
            ) : (
              <svg
                viewBox="0 0 100 100"
                className={`${
                  compact
                    ? 'w-16 h-16 sm:w-18 sm:h-18 print:w-16 print:h-16'
                    : 'w-18 h-18 sm:w-22 sm:h-22 md:w-24 md:h-24 print:w-20 print:h-20'
                } text-[#800000]`}
                fill="currentColor"
              >
                {/* Stylized Nepal Emblem outline */}
                <circle cx="50" cy="50" r="45" fill="#fdf2f2" stroke="#800000" strokeWidth="2.5" />
                <path d="M50 15 L58 35 L80 35 L62 48 L68 70 L50 56 L32 70 L38 48 L20 35 Z" fill="#800000" opacity="0.9" />
                <path d="M25 65 Q50 40 75 65 Q50 78 25 65" fill="#ffffff" stroke="#800000" strokeWidth="2" />
                <text x="50" y="86" textAnchor="middle" fontSize="6" fontWeight="bold" fill="#800000">
                  जननी जन्मभूमिश्च स्वर्गादपि गरीयसी
                </text>
              </svg>
            )}
          </div>

          {/* Center/Office Details in Dark Red (#800000) with precise pt font sizes */}
          <div
            className={`w-full ${
              organization.alignment === 'left'
                ? 'text-left'
                : organization.alignment === 'right'
                ? 'text-right'
                : 'text-center px-16 sm:px-20 md:px-24 flex flex-col items-center justify-center'
            }`}
          >
            {/* Level 1: संस्था / निकाय / सरकारको तह (9 pt) */}
            <h1
              style={{ fontSize: '9pt', lineHeight: 1.3 }}
              className="font-bold tracking-tight text-[#800000]"
            >
              {orgLevelName || 'नेपाल सरकार'}
            </h1>

            {/* Level 2: मन्त्रालय (11 pt) */}
            {(organization.ministryName || (!organization.officeName && !organization.departmentName)) && (
              <h2
                style={{ fontSize: '11pt', lineHeight: 1.3 }}
                className="font-bold text-[#800000] mt-0.5"
              >
                {organization.ministryName || 'पूर्वाधार विकास मन्त्रालय'}
              </h2>
            )}

            {/* Level 3: विभाग (14 pt) */}
            {(organization.departmentName || (!organization.officeName && !organization.ministryName)) && (
              <h3
                style={{ fontSize: '14pt', lineHeight: 1.3 }}
                className="font-bold text-[#800000] mt-0.5"
              >
                {organization.departmentName || 'सडक विभाग'}
              </h3>
            )}

            {/* Level 4: विभाग अन्तर्गतको माथिल्लो निकाय / निर्देशनालय (16 pt) */}
            {(organization.parentBodyName || (!organization.officeName && !organization.departmentName)) && (
              <h4
                style={{ fontSize: '16pt', lineHeight: 1.3 }}
                className="font-bold text-[#800000] mt-0.5"
              >
                {organization.parentBodyName || 'सडक सुधार तथा विकास आयोजना निर्देशनालय'}
              </h4>
            )}

            {/* Level 5: कार्यालयको नाम (18 pt) */}
            <h2
              style={{ fontSize: '18pt', lineHeight: 1.25 }}
              className="font-extrabold text-[#800000] mt-1 tracking-tight"
            >
              {organization.officeName || 'महाकाली पुल योजना'}
            </h2>

            {/* कार्यालयको नं. (Office Code No.) - Letterhead को last line (ठेगाना) को ठीक माथि Center Align मा */}
            {(organization.officeCode || organization.registrationNo || activeOrganization?.code) && (
              <p
                style={{ fontSize: '10.5pt', lineHeight: 1.3 }}
                className="text-center font-bold text-[#800000] mt-0.5 tracking-wide"
              >
                कार्यालयको नं. : {toNepaliDigits(organization.officeCode || organization.registrationNo || activeOrganization?.code || '')}
              </p>
            )}

            {/* Level 6: प्रशासनिक ठेगाना (Letterhead को अन्तिम लाइन - 10 pt) */}
            <p
              style={{ fontSize: '10pt', lineHeight: 1.4 }}
              className="font-medium text-[#800000] mt-0.5"
            >
              {formattedAddress}
            </p>

            {/* Level 7: सम्पर्क तथा प्यान विवरण (यदि उपलब्ध भएमा) */}
            {(organization.phone || organization.mobile || organization.email || organization.pan || organization.panNumber) && (
              <div
                style={{ fontSize: '9pt', lineHeight: 1.4 }}
                className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-[#800000] mt-1 font-mono ${
                  organization.alignment === 'left'
                    ? 'justify-start'
                    : organization.alignment === 'right'
                    ? 'justify-end'
                    : 'justify-center'
                }`}
              >
                {organization.phone && <span>फोनः- {toNepaliDigits(organization.phone)}</span>}
                {organization.mobile && <span>मोबाईलः- {toNepaliDigits(organization.mobile)}</span>}
                {organization.email && <span>इमेलः- {organization.email}</span>}
                {(organization.pan || organization.panNumber) && (
                  <span>प्यान नंः- {toNepaliDigits(organization.pan || organization.panNumber)}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Report Document Title Banner */}
        {title ? (
          <div className={`${compact ? 'mt-1 pt-1' : 'mt-4 pt-2'} border-t border-[#d8e4d2] text-center`}>
            <h3 className="text-lg sm:text-xl font-bold text-[#1f2e18] tracking-wide inline-block">
              {title}
            </h3>
            {subTitle && (
              <p className="text-xs sm:text-sm text-[#48603f] mt-1 font-medium text-center">
                {subTitle}
              </p>
            )}
            {showReportDate && (
              <p className="text-xs text-[#48603f] mt-1 font-medium text-center">
                प्रतिवेदन मिति: वि.सं. {toNepaliDigits(dateBS)} (ई.सं. {dateAD})
              </p>
            )}
          </div>
        ) : null}

        {/* Optional Recipient Offices */}
        {(recipientOffice1 || recipientOffice2) && (
          <div className="mt-3 text-left font-semibold text-xs text-[#1e2a17] space-y-0.5 bg-[#f8faf6] p-2.5 rounded-lg border border-[#e2ece0] print:bg-transparent print:border-none print:p-0">
            {recipientOffice1 && <p>{recipientOffice1}</p>}
            {recipientOffice2 && <p>{recipientOffice2}</p>}
          </div>
        )}
      </div>

      {/* Signature Section at the bottom if requested */}
      {showSignatureSection && (
        <ReportSignatures
          preparedBy={preparedBy}
          checkedBy={checkedBy}
          approvedBy={approvedBy}
        />
      )}
    </div>
  );
};
