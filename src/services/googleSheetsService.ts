import NepaliDate from 'nepali-date-converter';
import { normalizeLogoUrl } from '../utils/logoUtils';
import { verifyPasswordSync } from '../utils/securityUtils';
import {
  Employee,
  SalarySetup,
  DeductionSetup,
  TaxReference,
  OrganizationSetup,
  AnnualTaxCalculationResult,
  MonthlySalaryItem,
  NepaliMonth,
  User,
} from '../types';

export interface AppSyncDataPayload {
  fiscalYear: string;
  month: NepaliMonth;
  organization: OrganizationSetup;
  employees: Employee[];
  salarySetups: Record<string, SalarySetup>;
  deductionSetups: Record<string, DeductionSetup>;
  taxReferences: TaxReference[];
  users?: User[];
  calculatedResults?: Record<string, AnnualTaxCalculationResult>;
  monthlyItems?: MonthlySalaryItem[];
  timestamp?: string;
}

/**
 * Generates accurate Kathmandu (Nepal) local time string: (UTC+05:45)
 * Example: "2026-09-03 16:35:20 (UTC+05:45 Kathmandu)"
 */
export function getKathmanduTimestamp(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kathmandu',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';
    const yyyy = getPart('year');
    const mm = getPart('month');
    const dd = getPart('day');
    const hh = getPart('hour');
    const min = getPart('minute');
    const ss = getPart('second');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss} (UTC+05:45 Kathmandu)`;
  } catch (e) {
    // Fallback: manual calculation for UTC+5:45 offset (345 minutes)
    const utcTime = date.getTime() + date.getTimezoneOffset() * 60000;
    const ktmTime = new Date(utcTime + 345 * 60000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${ktmTime.getFullYear()}-${pad(ktmTime.getMonth() + 1)}-${pad(ktmTime.getDate())} ${pad(ktmTime.getHours())}:${pad(ktmTime.getMinutes())}:${pad(ktmTime.getSeconds())} (UTC+05:45 Kathmandu)`;
  }
}

export const TARGET_GOOGLE_DRIVE_FOLDER_ID = '1XEVf3izkJYujAyW-qUfi3eP7vFimb2kj';
export const TARGET_GOOGLE_DRIVE_FOLDER_URL = 'https://drive.google.com/drive/u/0/folders/1XEVf3izkJYujAyW-qUfi3eP7vFimb2kj';
export const TARGET_ADMIN_ACCOUNT_EMAIL = 'rbthapamgr09@gmail.com';

/**
 * Returns formatted Google Spreadsheet title based on office name and district
 * Example: "stcs_खानेपानी तथा ढल व्यवस्थापन_गोरखा"
 */
export function formatOfficeSpreadsheetTitle(officeName: string, district?: string): string {
  const cleanOfficeName = (officeName || 'कार्यालय').trim().replace(/[/\\?%*:|"<>]/g, '_');
  const cleanDistrict = (district || '').trim().replace(/[/\\?%*:|"<>]/g, '_');
  return cleanDistrict ? `stcs_${cleanOfficeName}_${cleanDistrict}` : `stcs_${cleanOfficeName}`;
}

const REQUIRED_DATA_SHEET_NAMES = [
  'कर्मचारी_विवरण',
  'तलब_सेटअप',
  'कट्टी_सेटअप',
  'मासिक_तलब_सिट',
  'वार्षिक_कर_विवरण',
  'कार्यालय_विवरण',
  'कर_स्ल्याब_दर',
  'प्रयोगकर्ता_सूची',
];

const ALL_REQUIRED_SHEET_NAMES = [
  ...REQUIRED_DATA_SHEET_NAMES,
  'AuditLog',
];

/**
 * Creates a new Google Spreadsheet on the user's Google Drive with all required sheet tabs
 * Named "stcs_<office name>_<district>" and placed inside designated Drive folder (1XEVf3izkJYujAyW-qUfi3eP7vFimb2kj)
 */
export async function createAppSpreadsheet(
  accessToken: string,
  orgName: string,
  district?: string,
  fiscalYear?: string
): Promise<{ id: string; url: string; title: string }> {
  const title = formatOfficeSpreadsheetTitle(orgName, district);

  const sheets = ALL_REQUIRED_SHEET_NAMES.map((sheetTitle) => ({
    properties: {
      title: sheetTitle,
      gridProperties: {
        frozenRowCount: 1,
      },
    },
  }));

  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title,
      },
      sheets,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const rawMsg = String(errData?.error?.message || '');
    if (rawMsg.toLowerCase().includes('scope') || rawMsg.toLowerCase().includes('insufficient')) {
      throw new Error('Google OAuth अनुमति (Scopes) अभाव: गुगलको प्रत्यक्ष REST API बाट सिट सिर्जना गर्न सकिएन।');
    }
    throw new Error(rawMsg || `Google Spreadsheet सिर्जना गर्न सकिएन (Status: ${response.status})`);
  }

  const result = await response.json();
  const id = result.spreadsheetId;
  const url = result.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${id}/edit`;

  // Attach spreadsheet into specific Google Drive Folder (1XEVf3izkJYujAyW-qUfi3eP7vFimb2kj)
  try {
    await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}?addParents=${TARGET_GOOGLE_DRIVE_FOLDER_ID}&supportsAllDrives=true`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (e) {
    console.warn('Google Drive folder assignment warning:', e);
  }

  // Initialize AuditLog header with Kathmandu Timezone label
  try {
    const auditHeader = [
      'Timestamp (UTC+05:45 Kathmandu)',
      'Nepali Date (वि.सं.)',
      'Action / कार्य',
      'Status / स्थिति',
      'User / प्रयोगकर्ता',
      'विवरण (Details)',
      'कुल कर्मचारी',
      'आर्थिक वर्ष',
      'महिना',
    ];
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/AuditLog!A1:I1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [auditHeader] }),
      }
    );
  } catch (e) {
    console.warn('Initial AuditLog header setup warning:', e);
  }

  return { id, url, title };
}

/**
 * Lists user's spreadsheets from Google Drive API
 */
export async function listUserSpreadsheets(
  accessToken: string
): Promise<Array<{ id: string; name: string; modifiedTime?: string }>> {
  try {
    const q = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&pageSize=20`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    return data.files || [];
  } catch (err) {
    console.warn('Error listing spreadsheets from Google Drive:', err);
    return [];
  }
}

/**
 * Searches for the user's existing Payroll spreadsheet in Google Drive
 */
export async function findAppSpreadsheetInDrive(
  accessToken: string
): Promise<{ id: string; name: string; url: string } | null> {
  try {
    const files = await listUserSpreadsheets(accessToken);
    if (!files || files.length === 0) return null;

    // Prefer files with standard app titles
    const matched = files.find(
      (f) =>
        f.name.includes('तलब तथा कर') ||
        f.name.includes('कर्मचारी तलब') ||
        f.name.includes('Payroll') ||
        f.name.includes('Salary')
    ) || files[0];

    if (matched) {
      return {
        id: matched.id,
        name: matched.name,
        url: `https://docs.google.com/spreadsheets/d/${matched.id}/edit`,
      };
    }
    return null;
  } catch (err) {
    console.warn('Error searching app spreadsheet in Google Drive:', err);
    return null;
  }
}

/**
 * Pulls and parses data from Google Sheets API v4 directly
 */
export async function pullDataFromGoogleSpreadsheet(
  accessToken: string,
  spreadsheetId: string
): Promise<{
  success: boolean;
  message: string;
  data?: {
    organization?: Partial<OrganizationSetup>;
    employees?: Employee[];
    salarySetups?: Record<string, SalarySetup>;
    deductionSetups?: Record<string, DeductionSetup>;
    taxReferences?: TaxReference[];
    users?: User[];
  };
}> {
  try {
    const ranges = [
      'कर्मचारी_विवरण!A1:Z500',
      'तलब_सेटअप!A1:Z500',
      'कट्टी_सेटअप!A1:Z500',
      'कार्यालय_विवरण!A1:Z500',
      'कर_स्ल्याब_दर!A1:Z500',
      'प्रयोगकर्ता_सूची!A1:Z500',
      'Employees!A1:Z500',
      'SalarySetup!A1:Z500',
      'DeductionSetup!A1:Z500',
      'Organization!A1:Z500',
      'TaxReference!A1:Z500',
      'Users!A1:Z500',
    ];

    const query = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&');
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${query}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Google Sheets बाट डाटा तान्न सकिएन (Status: ${res.status})`);
    }

    const json = await res.json();
    const valueRanges: Array<{ range: string; values?: any[][] }> = json.valueRanges || [];

    const getRangeValues = (names: string[]): any[][] => {
      for (const name of names) {
        const found = valueRanges.find((vr) => vr.range.includes(name));
        if (found && found.values && found.values.length > 0) {
          return found.values;
        }
      }
      return [];
    };

    // 1. Parse Employees
    const empValues = getRangeValues(['कर्मचारी_विवरण', 'Employees']);
    const employees: Employee[] = [];
    if (empValues.length > 1) {
      const rows = empValues.slice(1);
      rows.forEach((row, idx) => {
        if (!row || row.length === 0 || (!row[1] && !row[2])) return;
        const code = String(row[1] || '').trim();
        const name = String(row[2] || '').trim();
        if (!name) return;

        employees.push({
          id: `emp_${code || idx + 1}_${Date.now()}`,
          code: code || `EMP-${idx + 1}`,
          name: name,
          designation: String(row[3] || 'अधिकृत'),
          level: String(row[4] || 'अधिकृत स्तर'),
          serviceGroup: String(row[5] || 'प्रशासन'),
          serviceType: (row[6] === 'करार' || row[6] === 'अस्थायी' ? row[6] : 'स्थायी') as any,
          gender: (row[7] === 'महिला' ? 'महिला' : row[7] === 'अन्य' ? 'अन्य' : 'पुरुष') as any,
          disability: (row[8] === 'अपाङ्ग भएको' ? 'अपाङ्ग भएको' : 'अपाङ्ग नभएको') as any,
          remoteArea: (['क', 'ख', 'ग', 'घ', 'ङ'].includes(row[9]) ? row[9] : 'दुर्गम नभएको') as any,
          pension: (row[10] === 'भएको' ? 'भएको' : 'नभएको') as any,
          filingType: (row[11] === 'दम्पत्ती' ? 'दम्पत्ती' : 'एकल') as any,
          panNumber: String(row[12] || ''),
          bankAccount: String(row[13] || ''),
          bankName: String(row[14] || ''),
          joinedDateBS: String(row[15] || '२०८०-०४-०१'),
          joinedDateAD: '',
          currentPostDateBS: String(row[16] || ''),
          phone: String(row[17] || ''),
          email: String(row[18] || ''),
          remarks: String(row[19] || ''),
          createdAt: new Date().toISOString(),
        });
      });
    }

    // 2. Parse Salary Setups
    const salaryValues = getRangeValues(['तलब_सेटअप', 'SalarySetup']);
    const salarySetups: Record<string, SalarySetup> = {};
    if (salaryValues.length > 1) {
      const rows = salaryValues.slice(1);
      rows.forEach((row, idx) => {
        if (!row || row.length === 0) return;
        const code = String(row[1] || '').trim();
        const emp = employees.find((e) => e.code === code) || employees[idx];
        const empId = emp ? emp.id : `emp_${code || idx + 1}`;

        salarySetups[empId] = {
          id: `sal_${empId}`,
          employeeId: empId,
          basicSalary: Number(row[3]) || 35000,
          technicalGradeAmount: Number(row[4]) || 0,
          salaryMonthsCount: Number(row[5]) || 12,
          gradeRate: Number(row[6]) || 1100,
          currentGradeCount: Number(row[7]) || 0,
          gradeIncreaseCount: Number(row[8]) || 0,
          gradeIncreaseMonth: (row[9] || 'श्रावण') as any,
          festivalBonusMonth: String(row[10] || 'असोज'),
          festivalBonusCustom: Number(row[11]) || 0,
          lifeInsuranceFund: Number(row[12]) || 400,
          dearnessAllowance: Number(row[13]) || 2000,
          uniformAllowance: Number(row[14]) || 10000,
          remoteAllowance: Number(row[15]) || 0,
          incentiveAllowance: Number(row[16]) || 0,
          vehicleAllowance: Number(row[17]) || 0,
          communicationAllowance: Number(row[18]) || 0,
          otherMonthlyAllowance: Number(row[19]) || 0,
          otherIncome: Number(row[20]) || 0,
          otherTaxableIncome: Number(row[21]) || 0,
          updatedAt: new Date().toISOString(),
        };
      });
    }

    // 3. Parse Deduction Setups
    const dedValues = getRangeValues(['कट्टी_सेटअप', 'DeductionSetup']);
    const deductionSetups: Record<string, DeductionSetup> = {};
    if (dedValues.length > 1) {
      const rows = dedValues.slice(1);
      rows.forEach((row, idx) => {
        if (!row || row.length === 0) return;
        const code = String(row[1] || '').trim();
        const emp = employees.find((e) => e.code === code) || employees[idx];
        const empId = emp ? emp.id : `emp_${code || idx + 1}`;

        deductionSetups[empId] = {
          id: `ded_${empId}`,
          employeeId: empId,
          loanDeduction: Number(row[3]) || 0,
          citizenInvestmentTrust: Number(row[4]) || 0,
          investmentInsuranceDeduction: Number(row[5]) || 0,
          healthInsuranceDeduction: Number(row[6]) || 0,
          homeInsuranceDeduction: Number(row[7]) || 0,
          remoteTaxReliefOverride: Number(row[8]) || 0,
          otherDeduction: Number(row[9]) || 0,
          disabilityReliefOverride: Number(row[10]) || 0,
          pensionSSTExemptOverride: Number(row[11]) || 0,
          medicalExpenseActual: Number(row[12]) || 0,
          femaleTaxRebateOverride: Number(row[13]) || 0,
          updatedAt: new Date().toISOString(),
        };
      });
    }

    // 4. Parse Organization Setup
    const orgValues = getRangeValues(['कार्यालय_विवरण', 'Organization']);
    const orgData: Partial<OrganizationSetup> = {};
    if (orgValues.length > 1) {
      orgValues.forEach((row) => {
        if (!row || row.length < 2) return;
        const key = String(row[0] || '').trim();
        const val = String(row[1] || '').trim();

        if (key.includes('संस्था / सरकारको तह') || key === 'name') orgData.name = val;
        if (key.includes('मन्त्रालय') || key === 'ministryName') orgData.ministryName = val;
        if (key.includes('विभाग') || key === 'departmentName') orgData.departmentName = val;
        if (key.includes('माथिल्लो निकाय') || key === 'parentBodyName') orgData.parentBodyName = val;
        if (key.includes('कार्यालयको नाम') || key === 'officeName') orgData.officeName = val;
        if (key.includes('कार्यालय कोड नं.') || key === 'officeCode') orgData.officeCode = val;
        if (key.includes('प्रदेश') || key === 'province') orgData.province = val;
        if (key.includes('जिल्ला') || key === 'district') orgData.district = val;
        if (key.includes('स्थानीय तह') || key.includes('पालिका') || key === 'localLevel') orgData.localLevel = val;
        if (key.includes('ठेगाना') || key === 'address') orgData.address = val;
        if (key.includes('फोन नं.') || key === 'phone') orgData.phone = val;
        if (key.includes('मोबाइल नं.') || key === 'mobile') orgData.mobile = val;
        if (key.includes('इमेल') || key === 'email') orgData.email = val;
        if (key.includes('वाट्सएप') || key === 'whatsapp') orgData.whatsapp = val;
        if (key.includes('वेबसाइट') || key === 'website') orgData.website = val;
        if (key.includes('प्यान') || key === 'pan' || key === 'panNumber') {
          orgData.pan = val;
          orgData.panNumber = val;
        }
        if (key.includes('दर्ता') || key === 'registrationNo') orgData.registrationNo = val;
        if (key.includes('लोगो') || key.includes('Logo') || key === 'logoUrl') orgData.logoUrl = normalizeLogoUrl(val);
        if (key.includes('अधिकृत व्यक्तिको नाम') || key === 'authorizedPersonName') orgData.authorizedPersonName = val;
        if (key.includes('अधिकृत व्यक्तिको पद') || key === 'authorizedPersonDesignation') orgData.authorizedPersonDesignation = val;
        if (key.includes('डिजिटल हस्ताक्षर') || key.includes('Signature') || key === 'signatureUrl') orgData.signatureUrl = val;
        if (key.includes('हेडर सन्देश') || key === 'headerText') orgData.headerText = val;
        if (key.includes('फुटर सन्देश') || key === 'footerText') orgData.footerText = val;
        if (key.includes('संरेखण') || key.includes('Alignment') || key === 'alignment') orgData.alignment = (val as any) || 'center';
      });
    }

    // 5. Parse Users (प्रयोगकर्ता_सूची / Users)
    const userValues = getRangeValues(['प्रयोगकर्ता_सूची', 'Users']);
    const users: User[] = [];
    if (userValues.length > 1) {
      const rows = userValues.slice(1);
      rows.forEach((row, idx) => {
        if (!row || row.length === 0) return;
        const uid = String(row[1] || '').trim();
        const username = String(row[2] || '').trim();
        const fullName = String(row[3] || '').trim();
        if (!username && !fullName) return;

        users.push({
          id: uid || `user_${Date.now()}_${idx + 1}`,
          username: username || `user_${idx + 1}`,
          fullName: fullName || username,
          role: (['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'GENERAL_USER', 'VIEWER'].includes(String(row[4] || ''))
            ? row[4]
            : 'GENERAL_USER') as any,
          email: String(row[5] || ''),
          phone: String(row[6] || ''),
          designation: String(row[7] || ''),
          organizationName: String(row[8] || orgData.officeName || orgData.name || ''),
          isActive: String(row[9] || 'सक्रिय').trim() === 'सक्रिय' || String(row[9] || '').trim() === 'Active' || String(row[9] || '') === 'true',
          password: String(row[10] || ''),
          createdAt: String(row[11] || new Date().toISOString()),
          lastLogin: String(row[12] || ''),
        });
      });
    }

    return {
      success: true,
      message: `गुगल सिट्सबाट ${employees.length} जना कर्मचारी, ${users.length} प्रयोगकर्ता र सेटिङ्स सफलतापूर्वक प्राप्त भयो।`,
      data: {
        employees: employees.length > 0 ? employees : undefined,
        salarySetups: Object.keys(salarySetups).length > 0 ? salarySetups : undefined,
        deductionSetups: Object.keys(deductionSetups).length > 0 ? deductionSetups : undefined,
        organization: Object.keys(orgData).length > 0 ? orgData : undefined,
        users: users.length > 0 ? users : undefined,
      },
    };
  } catch (err: any) {
    console.error('Direct Google Sheets pull error:', err);
    return {
      success: false,
      message: err?.message || 'Google Sheets बाट डाटा प्राप्त गर्न सकिएन',
    };
  }
}

/**
 * Ensures all required sheets exist in the spreadsheet
 */
async function ensureSheetsExist(accessToken: string, spreadsheetId: string): Promise<void> {
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!metaRes.ok) {
    return;
  }

  const metaData = await metaRes.json();
  const existingSheets: string[] = (metaData.sheets || []).map((s: any) => s.properties?.title);

  const missing = ALL_REQUIRED_SHEET_NAMES.filter((name) => !existingSheets.includes(name));

  if (missing.length > 0) {
    const requests = missing.map((title) => ({
      addSheet: {
        properties: {
          title,
          gridProperties: { frozenRowCount: 1 },
        },
      },
    }));

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    });
  }
}

/**
 * Format payload into row arrays for each sheet tab
 */
function prepareSheetsData(payload: AppSyncDataPayload) {
  const {
    fiscalYear,
    month,
    organization,
    employees,
    salarySetups,
    deductionSetups,
    taxReferences,
    calculatedResults = {},
    monthlyItems = [],
    timestamp = new Date().toLocaleString('ne-NP'),
  } = payload;

  // 1. कर्मचारी_विवरण (Employees)
  const employeeHeader = [
    'क्र.सं.',
    'कर्मचारी संकेत नं.',
    'कर्मचारीको नाम',
    'पद',
    'तह/श्रेणी',
    'सेवा/समूह',
    'सेवा प्रकार',
    'लिङ्ग',
    'अपाङ्गता',
    'दुर्गम क्षेत्र',
    'निवृत्तिभरण',
    'कर निर्धारण',
    'प्यान नं.',
    'बैंक खाता नं.',
    'बैंकको नाम',
    'शुरु नियुक्ति मिति (वि.सं.)',
    'हालको पदमा नियुक्ति (वि.सं.)',
    'फोन नं.',
    'इमेल',
    'कैफियत',
  ];

  const employeeRows = employees.map((emp, idx) => [
    idx + 1,
    emp.code || '',
    emp.name || '',
    emp.designation || '',
    emp.level || '',
    emp.serviceGroup || '',
    emp.serviceType || 'स्थायी',
    emp.gender || 'पुरुष',
    emp.disability || 'अपाङ्ग नभएको',
    emp.remoteArea || 'दुर्गम नभएको',
    emp.pension || 'नभएको',
    emp.filingType || 'एकल',
    emp.panNumber || '',
    emp.bankAccount || '',
    emp.bankName || '',
    emp.joinedDateBS || '',
    emp.currentPostDateBS || '',
    emp.phone || '',
    emp.email || '',
    emp.remarks || '',
  ]);

  // 2. तलब_सेटअप (Salary Setup)
  const salaryHeader = [
    'क्र.सं.',
    'संकेत नं.',
    'कर्मचारीको नाम',
    'शुरु तलब स्केल',
    'प्राविधिक ग्रेड रकम',
    'तलब अवधि (महिना)',
    'ग्रेड दर',
    'खाइपाई आएको ग्रेड संख्या',
    'ग्रेड बृद्धि संख्या',
    'ग्रेड बृद्धि महिना',
    'चाडपर्व खर्च महिना',
    'चाडपर्व खर्च (कस्टम)',
    'सावधिक जीवन बिमा कोष (मासिक)',
    'महङ्गी भत्ता (मासिक)',
    'पोशाक भत्ता (वार्षिक)',
    'दुर्गम भत्ता (मासिक)',
    'प्रोत्साहन भत्ता (मासिक)',
    'सवारी/इन्धन भत्ता (मासिक)',
    'सञ्चार भत्ता (मासिक)',
    'अन्य मासिक भत्ता',
    'अन्य वार्षिक आय',
    'पछिल्लो अपडेट',
  ];

  const salaryRows = employees.map((emp, idx) => {
    const s = salarySetups[emp.id] || ({} as Partial<SalarySetup>);
    return [
      idx + 1,
      emp.code || '',
      emp.name || '',
      s.basicSalary ?? 0,
      s.technicalGradeAmount ?? 0,
      s.salaryMonthsCount ?? 12,
      s.gradeRate ?? 0,
      s.currentGradeCount ?? 0,
      s.gradeIncreaseCount ?? 0,
      s.gradeIncreaseMonth ?? 'श्रावण',
      s.festivalBonusMonth ?? 'असोज',
      s.festivalBonusCustom ?? '',
      s.lifeInsuranceFund ?? 400,
      s.dearnessAllowance ?? 2000,
      s.uniformAllowance ?? 10000,
      s.remoteAllowance ?? 0,
      s.incentiveAllowance ?? 0,
      s.vehicleAllowance ?? 0,
      s.communicationAllowance ?? 0,
      s.otherMonthlyAllowance ?? 0,
      s.otherIncome ?? 0,
      s.updatedAt || timestamp,
    ];
  });

  // 3. कट्टी_सेटअप (Deduction Setup)
  const deductionHeader = [
    'क्र.सं.',
    'संकेत नं.',
    'कर्मचारीको नाम',
    'सापटी/ऋण कट्टी (मासिक)',
    'नागरिक लगानी कोष (मासिक)',
    'व्यक्तिगत जीवन बिमा प्रिमियम (वार्षिक)',
    'स्वास्थ्य बिमा प्रिमियम (वार्षिक)',
    'निजी घर बिमा प्रिमियम (वार्षिक)',
    'अन्य विविध कट्टी (मासिक)',
    'औषधी उपचार खर्च मिलान रकम',
    'अपाङ्ग छुट Override',
    'महिला कर छुट Override',
    'ना.ल.कोष अधिकतम सीमा',
    'जीवन बिमा अधिकतम सीमा',
    'स्वास्थ्य बिमा अधिकतम सीमा',
    'पछिल्लो अपडेट',
  ];

  const deductionRows = employees.map((emp, idx) => {
    const d = deductionSetups[emp.id] || ({} as Partial<DeductionSetup>);
    return [
      idx + 1,
      emp.code || '',
      emp.name || '',
      d.loanDeduction ?? 0,
      d.citizenInvestmentTrust ?? 0,
      d.investmentInsuranceDeduction ?? 0,
      d.healthInsuranceDeduction ?? 0,
      d.homeInsuranceDeduction ?? 0,
      d.otherDeduction ?? 0,
      d.medicalExpenseActual ?? 0,
      d.disabilityReliefOverride ?? '',
      d.femaleTaxRebateOverride ?? '',
      d.citCeilingLimit ?? '',
      d.lifeInsuranceCeilingLimit ?? '',
      d.healthInsuranceCeilingLimit ?? '',
      d.updatedAt || timestamp,
    ];
  });

  // 4. मासिक_तलब_सिट (Monthly Salary Sheet)
  const monthlyHeader = [
    'महिना',
    'संकेत नं.',
    'कर्मचारीको नाम',
    'पद',
    'शुरु तलब',
    'ग्रेड रकम',
    'ग्रेड वृद्धि रकम',
    'महङ्गी भत्ता',
    'पोशाक भत्ता',
    'दुर्गम भत्ता',
    'प्रोत्साहन भत्ता',
    'चाडपर्व खर्च',
    'अन्य आय',
    'कुल पारिश्रमिक आय (Gross)',
    'संचय कोष कट्टी',
    'निवृत्तिभरण कट्टी',
    'ना.ल.कोष कट्टी',
    'बिमा कोष कट्टी',
    'ऋण/सापटी कट्टी',
    'अन्य कट्टी',
    'कर कट्टी रकम',
    'जम्मा कट्टी',
    'खुद भुक्तानी तलब (Net)',
  ];

  const monthlyRows = monthlyItems.map((item) => [
    item.month || month,
    item.employeeCode,
    item.employeeName,
    item.designation,
    item.basicSalary,
    item.gradeAmount,
    item.gradeIncreaseAmount,
    item.dearnessAllowance,
    item.uniformAllowance,
    item.remoteAllowance,
    item.incentiveAllowance,
    item.festivalAllowance,
    item.otherIncome,
    item.grossSalary,
    item.epfEmployee,
    item.pensionEmployee,
    item.citDeduction,
    item.lifeInsuranceDeduction,
    item.loanDeduction,
    item.otherDeduction,
    item.taxDeduction,
    item.totalDeduction,
    item.netSalary,
  ]);

  // 5. वार्षिक_कर_विवरण (Annual Tax Assessment Report)
  const annualHeader = [
    'आ.व.',
    'संकेत नं.',
    'कर्मचारीको नाम',
    'पद',
    'कर निर्धारण',
    'वार्षिक तलब + ग्रेड',
    'चाडपर्व खर्च',
    'महङ्गी भत्ता',
    'पोशाक भत्ता',
    'दुर्गम भत्ता',
    'प्रोत्साहन भत्ता',
    'अन्य आय',
    'संचय कोष थप (कार्यालय)',
    'निवृत्तिभरण थप (कार्यालय)',
    'जम्मा वार्षिक आय',
    'जम्मा वार्षिक कट्टी',
    'वार्षिक करयोग्य आय',
    '१% सामाजिक सुरक्षा कर',
    'वार्षिक पारिश्रमिक कर',
    'कुल कर दायित्व सा.सु.कर समेत',
    'औषधी/महिला/अन्य छुट',
    'अन्तिम वार्षिक कर दायित्व',
    'मासिक कर कट्टी दर',
  ];

  const annualRows = employees.map((emp) => {
    const r = calculatedResults[emp.id];
    return [
      fiscalYear,
      emp.code || '',
      emp.name || '',
      emp.designation || '',
      emp.filingType || 'एकल',
      r ? (r.gradeAmount * r.gradePeriodMonths + r.gradeIncreaseAmount * r.gradeIncreasePeriodMonths) : 0,
      r?.festivalAllowance ?? 0,
      r?.dearnessAllowanceAnnual ?? 0,
      r?.uniformAllowanceAnnual ?? 0,
      r?.remoteAllowanceAnnual ?? 0,
      r?.incentiveAllowanceAnnual ?? 0,
      r?.otherIncomeAnnual ?? 0,
      r ? (r.epfOfficeContributionNormal + r.epfOfficeContributionPostIncrease) : 0,
      r ? (r.pensionOfficeContributionNormal + r.pensionOfficeContributionPostIncrease) : 0,
      r?.totalAnnualIncome ?? 0,
      r?.totalAnnualDeductions ?? 0,
      r?.annualTaxableIncome ?? 0,
      r?.annualSST ?? 0,
      r?.annualRemunerationTax ?? 0,
      r?.grossTaxLiabilityWithSST ?? 0,
      r ? (r.medicalTaxCredit + r.femaleTaxRebate + r.disabilityTaxRelief) : 0,
      r?.netAnnualTaxLiability ?? 0,
      r?.monthlyTaxDeduction ?? 0,
    ];
  });

  // 6. कार्यालय_विवरण (Organization Details)
  const orgHeader = ['विवरण / फिल्ड (Field Name)', 'मान (Value)'];
  const orgRows = [
    ['संस्था / सरकारको तह', organization.name || ''],
    ['मन्त्रालय', organization.ministryName || ''],
    ['विभाग', organization.departmentName || ''],
    ['माथिल्लो निकाय', organization.parentBodyName || ''],
    ['कार्यालयको नाम', organization.officeName || ''],
    ['कार्यालय कोड नं.', organization.officeCode || organization.registrationNo || ''],
    ['प्रदेश', organization.province || ''],
    ['जिल्ला', organization.district || ''],
    ['स्थानीय तह / पालिका', organization.localLevel || ''],
    ['ठेगाना / स्थान', organization.address || ''],
    ['फोन नं.', organization.phone || ''],
    ['मोबाइल नं.', organization.mobile || ''],
    ['इमेल', organization.email || ''],
    ['वाट्सएप / सम्पर्क', organization.whatsapp || ''],
    ['वेबसाइट', organization.website || ''],
    ['प्यान नं.', organization.panNumber || organization.pan || ''],
    ['दर्ता नं.', organization.registrationNo || ''],
    ['कार्यालयको लोगो (Logo URL / Base64 Data)', organization.logoUrl || ''],
    ['अधिकृत व्यक्तिको नाम', organization.authorizedPersonName || ''],
    ['अधिकृत व्यक्तिको पद', organization.authorizedPersonDesignation || ''],
    ['डिजिटल हस्ताक्षर (Signature URL / Base64 Data)', organization.signatureUrl || ''],
    ['हेडर सन्देश (Header Text)', organization.headerText || ''],
    ['फुटर सन्देश (Footer Text)', organization.footerText || ''],
    ['लेटरहेड संरेखण (Alignment)', organization.alignment || 'center'],
    ['सक्रिय आर्थिक वर्ष', fiscalYear || ''],
    ['सक्रिय महिना', month || ''],
    ['डाटा सिंक समय (Time Log)', getKathmanduTimestamp()],
  ];

  // 7. कर_स्ल्याब_दर (Tax References)
  const taxHeader = [
    'आर्थिक वर्ष',
    'कर निर्धारण प्रकार',
    'स्ल्याब विवरण',
    'देखि रकम',
    'सम्म रकम',
    'कर दर (%)',
    'अपाङ्गता छुट (%)',
    'महिला कर छुट (%)',
    'सा.सु.कर छुट निवृत्तिभरण',
    'औषधी उपचार कर मिलान दर (%)',
    'औषधी उपचार अधिकतम सीमा',
  ];

  const taxRows: any[][] = [];
  taxReferences.forEach((t) => {
    t.slabs.forEach((slab) => {
      taxRows.push([
        t.fiscalYear,
        t.filingType,
        slab.description,
        slab.fromAmount,
        slab.toAmount === Infinity ? 'माथि सबै' : slab.toAmount,
        slab.ratePercent,
        t.disabilityExemptionPercent,
        t.femaleTaxRebatePercent,
        t.pensionSSTExempt ? 'छुट' : 'छुट नभएको',
        t.medicalTaxCreditRatePercent,
        t.medicalTaxCreditMaxAmount,
      ]);
    });
  });

  // 8. Format User Accounts Data (प्रयोगकर्ता_सूची)
  const userHeader = [
    'क्र.सं.',
    'User ID',
    'प्रयोगकर्ताको नाम (Username)',
    'पूरा नाम (Full Name)',
    'भूमिका (Role)',
    'इमेल (Email)',
    'फोन नं.',
    'पद (Designation)',
    'सम्बद्ध कार्यालय (Office Name)',
    'स्थिति (Status)',
    'पासवर्ड ह्यास (Password Hash)',
    'दर्ता मिति (Created At)',
    'पछिल्लो लगइन (Last Login)',
  ];

  const userRows = (payload.users || []).map((u, idx) => [
    idx + 1,
    u.id,
    u.username,
    u.fullName,
    u.role,
    u.email || '',
    u.phone || '',
    u.designation || '',
    u.organizationName || payload.organization.officeName || payload.organization.name || '',
    u.isActive ? 'सक्रिय' : 'निष्क्रिय',
    u.password || '',
    u.createdAt || '',
    u.lastLogin || '',
  ]);

  return {
    employeeData: [employeeHeader, ...employeeRows],
    salaryData: [salaryHeader, ...salaryRows],
    deductionData: [deductionHeader, ...deductionRows],
    monthlyData: [monthlyHeader, ...monthlyRows],
    annualData: [annualHeader, ...annualRows],
    orgData: [orgHeader, ...orgRows],
    taxData: [taxHeader, ...taxRows],
    userData: [userHeader, ...userRows],
  };
}

/**
 * Appends an audit log record into the AuditLog sheet with Kathmandu Time (UTC+05:45)
 */
async function appendAuditLog(
  accessToken: string,
  spreadsheetId: string,
  payload: AppSyncDataPayload,
  action: string = 'डाटा सुरक्षित / सिंक (Push & Sync Data)',
  status: string = 'सफल (Success)'
): Promise<void> {
  const ktmTimestamp = getKathmanduTimestamp();
  let bsDate = '';
  try {
    const nepDate = new NepaliDate(new Date());
    bsDate = nepDate.format('YYYY-MM-DD');
  } catch (e) {
    bsDate = '';
  }

  const auditHeader = [
    'Timestamp (UTC+05:45 Kathmandu)',
    'Nepali Date (वि.सं.)',
    'Action / कार्य',
    'Status / स्थिति',
    'User / प्रयोगकर्ता',
    'विवरण (Details)',
    'कुल कर्मचारी संख्या',
    'आर्थिक वर्ष',
    'महिना',
  ];

  const auditRow = [
    ktmTimestamp,
    bsDate,
    action,
    status,
    payload.organization.officeName || payload.organization.name || 'System User',
    `कुल ${payload.employees.length} कर्मचारी र ${payload.users?.length || 0} प्रयोगकर्ता विवरण गुगल सिटमा सुरक्षित गरियो।`,
    payload.employees.length,
    payload.fiscalYear,
    payload.month,
  ];

  // 1. Ensure header exists in AuditLog sheet
  try {
    const checkRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/AuditLog!A1:I1`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    const checkData = await checkRes.json();
    if (!checkData.values || checkData.values.length === 0) {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/AuditLog!A1:I1?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: [auditHeader],
          }),
        }
      );
    }
  } catch (e) {
    console.warn('AuditLog header check warning:', e);
  }

  // 2. Append new row with Kathmandu time log
  try {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/AuditLog!A:I:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [auditRow],
        }),
      }
    );
  } catch (e) {
    console.warn('AuditLog append warning:', e);
  }
}

/**
 * Pushes entire data payload directly to Google Spreadsheet via Sheets API v4
 */
export async function pushDataToGoogleSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  payload: AppSyncDataPayload
): Promise<{ success: boolean; message: string; updatedSheetsCount: number }> {
  // Step 1: Ensure all sheets exist (including AuditLog and प्रयोगकर्ता_सूची)
  await ensureSheetsExist(accessToken, spreadsheetId);

  // Step 2: Prepare formatted data
  const data = prepareSheetsData(payload);

  // Step 3: Clear only data sheet ranges (Preserve AuditLog history intact!)
  const clearRanges = REQUIRED_DATA_SHEET_NAMES.map((s) => `${s}!A1:Z500`);
  try {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ranges: clearRanges }),
    });
  } catch (e) {
    console.warn('Batch clear warning:', e);
  }

  // Step 4: Batch write all data sheets
  const updatePayload = {
    valueInputOption: 'USER_ENTERED',
    data: [
      { range: 'कर्मचारी_विवरण!A1', values: data.employeeData },
      { range: 'तलब_सेटअप!A1', values: data.salaryData },
      { range: 'कट्टी_सेटअप!A1', values: data.deductionData },
      { range: 'मासिक_तलब_सिट!A1', values: data.monthlyData },
      { range: 'वार्षिक_कर_विवरण!A1', values: data.annualData },
      { range: 'कार्यालय_विवरण!A1', values: data.orgData },
      { range: 'कर_स्ल्याब_दर!A1', values: data.taxData },
      { range: 'प्रयोगकर्ता_सूची!A1', values: data.userData },
    ],
  };

  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload),
    }
  );

  if (!updateRes.ok) {
    const errObj = await updateRes.json().catch(() => ({}));
    throw new Error(errObj?.error?.message || `Google Sheets मा डाटा लेख्न सकिएन (Status: ${updateRes.status})`);
  }

  // Step 5: Append Audit Log with Kathmandu Time (UTC+05:45)
  await appendAuditLog(accessToken, spreadsheetId, payload);

  return {
    success: true,
    message: `गुगल सिट्समा ${payload.employees.length} कर्मचारी, ${payload.users?.length || 0} प्रयोगकर्ता, तलब, कट्टी तथा कर गणना सफलतापूर्वक सुरक्षित भयो (Time log: UTC+05:45 Kathmandu)।`,
    updatedSheetsCount: 8,
  };
}

/**
 * Direct sync of office users list into the office's Google Spreadsheet 'प्रयोगकर्ता_सूची' sheet.
 * Can be executed via Google OAuth access token OR via Apps Script Web App.
 */
export async function saveUsersToOfficeSpreadsheet(
  options: {
    spreadsheetId?: string;
    accessToken?: string;
    webAppUrl?: string;
    users: User[];
    officeName?: string;
  }
): Promise<{ success: boolean; message: string }> {
  const { spreadsheetId, accessToken, webAppUrl, users, officeName } = options;

  if (!spreadsheetId && !webAppUrl) {
    return { success: false, message: 'गुगल सिट आईडी वा Web App URL उपलब्ध छैन।' };
  }

  const userHeader = [
    'क्र.सं.',
    'User ID',
    'प्रयोगकर्ताको नाम (Username)',
    'पूरा नाम (Full Name)',
    'भूमिका (Role)',
    'इमेल (Email)',
    'फोन नं.',
    'पद (Designation)',
    'सम्बद्ध कार्यालय (Office Name)',
    'स्थिति (Status)',
    'पासवर्ड ह्यास (Password Hash)',
    'दर्ता मिति (Created At)',
    'पछिल्लो लगइन (Last Login)',
  ];

  const userRows = users.map((u, idx) => [
    idx + 1,
    u.id,
    u.username,
    u.fullName,
    u.role,
    u.email || '',
    u.phone || '',
    u.designation || '',
    u.organizationName || officeName || '',
    u.isActive ? 'सक्रिय' : 'निष्क्रिय',
    u.password || '',
    u.createdAt || '',
    u.lastLogin || '',
  ]);

  const allRows = [userHeader, ...userRows];

  // Try via Direct REST API if accessToken and spreadsheetId are present
  if (accessToken && spreadsheetId) {
    try {
      await ensureSheetsExist(accessToken, spreadsheetId);

      // Clear existing users rows
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/प्रयोगकर्ता_सूची!A1:M100:clear`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Write updated users
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/प्रयोगकर्ता_सूची!A1?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: allRows }),
        }
      );

      if (res.ok) {
        return {
          success: true,
          message: `कार्यालयको गुगल सिटमा ${users.length} जना प्रयोगकर्ता प्रोफाइल सफलतापूर्वक सिंक गरियो।`,
        };
      }
    } catch (e) {
      console.warn('Direct Google Sheet users sync failed, trying Web App if available:', e);
    }
  }

  // Try via Apps Script Web App (with proxy fallback)
  if (webAppUrl) {
    const payload = {
      action: 'syncUsers',
      spreadsheetId,
      officeName,
      users,
      timestamp: getKathmanduTimestamp(),
    };

    try {
      let res: Response | null = null;
      try {
        res = await fetch(webAppUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
        });
      } catch (directErr) {
        // Fallback to local server proxy if direct fetch is blocked
        res = await fetch('/api/sheets/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetUrl: webAppUrl, payload }),
        });
      }

      if (res && res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.success) {
          return {
            success: true,
            message: data.message || `Apps Script मार्फत ${users.length} जना प्रयोगकर्ता सिटमा सुरक्षित गरियो।`,
          };
        }
      }
    } catch (e: any) {
      console.warn('Apps Script user sync error:', e);
    }
  }

  return { success: false, message: 'गुगल सिटमा प्रयोगकर्ता सुरक्षित गर्न जडान उपलब्ध छैन वा असफल भयो।' };
}

/**
 * Validates login credentials directly against the office's Google Sheet 'प्रयोगकर्ता_सूची' sheet.
 * Works across any device/browser.
 */
export async function verifyUserFromSpreadsheet(
  options: {
    spreadsheetId?: string;
    accessToken?: string;
    webAppUrl?: string;
    username: string;
    passwordInput?: string;
    password?: string;
    officeName?: string;
  }
): Promise<{ success: boolean; user?: User; message?: string; wrongPassword?: boolean }> {
  const { spreadsheetId, accessToken, webAppUrl, username } = options;
  const passwordInput = options.passwordInput || options.password || '';
  const cleanInput = (username || '').trim().toLowerCase();

  // Method 1: Check via Apps Script Web App (Works seamlessly on ANY device/browser)
  if (webAppUrl) {
    try {
      const payload = {
        action: 'login',
        spreadsheetId,
        username: cleanInput,
        password: passwordInput,
      };

      let res: Response | null = null;
      try {
        res = await fetch(webAppUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
        });
      } catch (directErr) {
        // Fallback to server proxy if CORS or direct fetch failed
        res = await fetch('/api/sheets/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetUrl: webAppUrl, payload }),
        });
      }

      if (res && res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data && data.success && data.user) {
          return {
            success: true,
            user: data.user,
            message: 'गुगल सिटबाट प्रयोगकर्ता प्रमाणीकरण सफल भयो।',
          };
        }
        if (data && data.wrongPassword) {
          return { success: false, message: data.message || 'गलत पासवर्ड।', wrongPassword: true };
        }
        if (data && data.message && data.message !== 'Failed to fetch') {
          return { success: false, message: data.message };
        }
      }
    } catch (e) {
      console.warn('Apps Script login check warning:', e);
    }
  }

  // Method 2: Check via Direct Google Sheets API
  if (accessToken && spreadsheetId) {
    try {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/प्रयोगकर्ता_सूची!A1:M100`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (res.ok) {
        const json = await res.json();
        const rows: any[][] = json.values || [];
        if (rows.length > 1) {
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;
            const uid = String(row[1] || '').trim();
            const uname = String(row[2] || '').trim();
            const pwd = String(row[10] || '').trim();
            const activeStr = String(row[9] || '').trim();
            const isActive = activeStr === 'सक्रिय' || activeStr === 'Active' || activeStr === 'true';

            if (uname.toLowerCase() === cleanInput || uid.toLowerCase() === cleanInput) {
              const passCheck = verifyPasswordSync(passwordInput, pwd);
              const isPasswordCorrect = passCheck.isValid || pwd === passwordInput;

              if (!isPasswordCorrect) {
                return { success: false, message: 'गलत पासवर्ड।', wrongPassword: true };
              }
              if (!isActive) {
                return { success: false, message: 'गुगल सिटमा यो प्रयोगकर्ता निष्क्रिय (Inactive) रहेको छ।' };
              }

              const user: User = {
                id: uid || `user_${Date.now()}`,
                username: uname,
                fullName: String(row[3] || uname),
                role: (['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'GENERAL_USER', 'VIEWER'].includes(String(row[4] || ''))
                  ? row[4]
                  : 'GENERAL_USER') as any,
                email: String(row[5] || ''),
                phone: String(row[6] || ''),
                designation: String(row[7] || ''),
                organizationName: String(row[8] || ''),
                isActive: true,
                password: pwd,
                createdAt: String(row[11] || ''),
                lastLogin: getKathmanduTimestamp(),
              };

              return { success: true, user, message: 'गुगल सिटबाट प्रयोगकर्ता प्रमाणीकरण सफल भयो।' };
            }
          }
        }
      }
    } catch (e) {
      console.warn('Direct Google Sheet login check warning:', e);
    }
  }

  return {
    success: false,
    message: 'गुगल सिटमा प्रयोगकर्ता फेला परेन वा पासवर्ड मिलेन।',
  };
}

/**
 * Searches Google Drive folder (1XEVf3izkJYujAyW-qUfi3eP7vFimb2kj) for all spreadsheets with title 'stcs_*'
 */
export async function listOfficeSheetsInDriveFolder(
  accessToken?: string,
  webAppUrl?: string
): Promise<Array<{ id: string; name: string; title: string; url: string }>> {
  if (accessToken) {
    try {
      const query = encodeURIComponent(
        `'${TARGET_GOOGLE_DRIVE_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`
      );
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)&supportsAllDrives=true`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (res.ok) {
        const data = await res.json();
        return (data.files || []).map((f: any) => ({
          id: f.id,
          name: f.name,
          title: f.name,
          url: f.webViewLink || `https://docs.google.com/spreadsheets/d/${f.id}/edit`,
        }));
      }
    } catch (e) {
      console.warn('List office sheets error via Drive API:', e);
    }
  }

  if (webAppUrl) {
    try {
      const res = await fetch(webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'listSheets', folderId: TARGET_GOOGLE_DRIVE_FOLDER_ID }),
      });
      const data = await res.json().catch(() => ({}));
      if (data && Array.isArray(data.sheets)) {
        return data.sheets.map((s: any) => ({
          id: s.id,
          name: s.name || s.title || '',
          title: s.name || s.title || '',
          url: s.url || `https://docs.google.com/spreadsheets/d/${s.id}/edit`,
        }));
      }
    } catch (e) {
      console.warn('List office sheets via Web App warning:', e);
    }
  }

  return [];
}
