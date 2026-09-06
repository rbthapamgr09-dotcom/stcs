import * as XLSX from 'xlsx';
import { Employee, SalarySetup, DeductionSetup, OrganizationSetup, OrganizationItem, ServiceType, GenderType, FilingType, DisabilityType, RemoteAreaType, PensionType, NepaliMonth } from '../types';
import { GOVT_LEVELS, NEPALI_MONTHS } from '../data/ranks';
import { toNepaliDigits, toEnglishDigits, bsToAd, adToBs } from '../utils/nepaliCalendar';

export interface ParsedEmployeeRow {
  rowIndex: number;
  raw: Record<string, any>;
  employee: Omit<Employee, 'id' | 'createdAt'>;
  salary: Partial<SalarySetup>;
  deduction: Partial<DeductionSetup>;
  isValid: boolean;
  errors: string[];
  isExisting: boolean;
  existingId?: string;
}

// Complete column definitions matching every field of Employee Registration
export const TEMPLATE_COLUMNS = [
  { key: 'code', nepali: 'कर्मचारी संकेत नं.*', english: 'Employee Code*', required: true, example: '184920' },
  { key: 'name', nepali: 'कर्मचारीको पूरा नाम*', english: 'Full Name*', required: true, example: 'राम कुमार शर्मा' },
  { key: 'serviceGroup', nepali: 'सेवा / समूह / उपसमूह', english: 'Service / Group', required: false, example: 'ने.प्र. / सामान्य प्रशासन' },
  { key: 'designation', nepali: 'पद*', english: 'Designation*', required: true, example: 'शाखा अधिकृत' },
  { key: 'level', nepali: 'श्रेणी / तह*', english: 'Level / Rank*', required: true, example: 'अधिकृत सातौं' },
  { key: 'serviceType', nepali: 'सेवा प्रकार*', english: 'Service Type* (स्थायी/अस्थायी/करार)', required: true, example: 'स्थायी' },
  { key: 'gender', nepali: 'लिङ्ग*', english: 'Gender* (पुरुष/महिला/अन्य)', required: true, example: 'पुरुष' },
  { key: 'filingType', nepali: 'वैवाहिक / कर दाखिला*', english: 'Filing Type* (एकल/दम्पत्ती)', required: true, example: 'एकल' },
  { key: 'disability', nepali: 'अपाङ्गता*', english: 'Disability* (अपाङ्ग नभएको/क वर्ग/ख वर्ग/ग वर्ग/घ वर्ग)', required: true, example: 'अपाङ्ग नभएको' },
  { key: 'remoteArea', nepali: 'दुर्गम क्षेत्र वर्ग*', english: 'Remote Area* (दुर्गम नभएको/क/ख/ग/घ/ङ)', required: true, example: 'दुर्गम नभएको' },
  { key: 'pension', nepali: 'योगदानमा आधारित निवृत्तिभरण*', english: 'Pension* (भएको/नभएको)', required: true, example: 'भएको' },
  
  // Salary Setup Fields
  { key: 'basicSalary', nepali: 'शुरु तलब स्केल (मासिक)', english: 'Basic Monthly Salary', required: false, example: 43689 },
  { key: 'technicalGradeAmount', nepali: 'प्राविधिक ग्रेड रकम (मासिक)', english: 'Technical Grade Amount', required: false, example: 0 },
  { key: 'gradeRate', nepali: 'ग्रेड दर (प्रति ग्रेड)', english: 'Grade Rate', required: false, example: 1456 },
  { key: 'previousGradeCount', nepali: 'अघिल्लो असारसम्मको ग्रेड संख्या', english: 'Previous Grade Count', required: false, example: 2 },
  { key: 'addedGradeCount', nepali: 'चालु आ.व. मा थप हुने ग्रेड संख्या', english: 'Added Grade Count', required: false, example: 1 },
  { key: 'gradeIncreaseMonth', nepali: 'ग्रेड वृद्धि हुने महिना', english: 'Grade Increase Month (श्रावण देखि असार)', required: false, example: 'श्रावण' },
  { key: 'salaryMonthsCount', nepali: 'तलब पाउने महिना अवधि', english: 'Salary Months Count (1-12)', required: false, example: 12 },
  { key: 'lifeInsuranceFund', nepali: 'सावधिक जीवन बिमा कोष थप (मासिक)', english: 'Life Insurance Fund Monthly', required: false, example: 400 },
  { key: 'dearnessAllowance', nepali: 'महङ्गी भत्ता (मासिक)', english: 'Dearness Allowance Monthly', required: false, example: 2000 },
  
  // Allowances & Other Income
  { key: 'uniformAllowance', nepali: 'पोशाक भत्ता (वार्षिक)', english: 'Uniform Allowance Annual', required: false, example: 10000 },
  { key: 'uniformAllowanceMonth', nepali: 'पोशाक भत्ता पाउने महिना', english: 'Uniform Allowance Month', required: false, example: 'चैत्र' },
  { key: 'remoteAllowance', nepali: 'स्थानीय / दुर्गम भत्ता (मासिक)', english: 'Remote Allowance Monthly', required: false, example: 0 },
  { key: 'incentiveAllowance', nepali: 'प्रोत्साहन / विशेष भत्ता (मासिक)', english: 'Incentive Allowance Monthly', required: false, example: 0 },
  { key: 'vehicleAllowance', nepali: 'सवारी / इन्धन भत्ता (मासिक)', english: 'Vehicle Allowance Monthly', required: false, example: 0 },
  { key: 'communicationAllowance', nepali: 'सञ्चार / टेलिफोन भत्ता (मासिक)', english: 'Communication Allowance Monthly', required: false, example: 0 },
  { key: 'otherMonthlyAllowance', nepali: 'अन्य मासिक भत्ता (मासिक)', english: 'Other Monthly Allowance', required: false, example: 0 },
  { key: 'festivalBonusMonth', nepali: 'चाडपर्व खर्च पाउने महिना', english: 'Festival Bonus Month', required: false, example: 'असोज' },
  { key: 'festivalBonusCustom', nepali: 'चाडपर्व खर्च रकम (Custom)', english: 'Festival Bonus Custom Amount', required: false, example: '' },
  { key: 'otherIncome', nepali: 'अन्य अतिरिक्त आय (वार्षिक)', english: 'Other Income Annual', required: false, example: 0 },
  { key: 'otherTaxableIncome', nepali: 'अन्य करयोग्य आय (वार्षिक)', english: 'Other Taxable Income Annual', required: false, example: 0 },
  
  // Deductions & Tax Reliefs
  { key: 'citizenInvestmentTrust', nepali: 'नागरिक लगानी कोष कट्टी (मासिक)', english: 'CIT Deduction Monthly', required: false, example: 5000 },
  { key: 'investmentInsuranceDeduction', nepali: 'व्यक्तिगत जीवन बिमा प्रिमियम (वार्षिक)', english: 'Life Insurance Premium Annual', required: false, example: 40000 },
  { key: 'healthInsuranceDeduction', nepali: 'स्वास्थ्य बिमा प्रिमियम छुट (वार्षिक)', english: 'Health Insurance Premium Annual', required: false, example: 0 },
  { key: 'homeInsuranceDeduction', nepali: 'निजी घर बिमा प्रिमियम छुट (वार्षिक)', english: 'Home Insurance Premium Annual', required: false, example: 0 },
  { key: 'loanDeduction', nepali: 'सापटी / ऋण कट्टी (मासिक)', english: 'Loan Deduction Monthly', required: false, example: 0 },
  { key: 'otherDeduction', nepali: 'अन्य विविध कट्टी (मासिक)', english: 'Other Monthly Deductions', required: false, example: 0 },
  { key: 'disabilityReliefOverride', nepali: 'अपाङ्ग व्यक्ति कर छुट रकम', english: 'Disability Tax Relief Override', required: false, example: 0 },
  { key: 'pensionSSTExemptOverride', nepali: 'सा.सु.कर छुट रकम', english: 'Pension SST Exempt Override', required: false, example: 0 },
  { key: 'medicalExpenseActual', nepali: 'औषधी उपचार खर्च मिलान रकम', english: 'Medical Expense Actual Annual', required: false, example: 0 },
  { key: 'femaleTaxRebateOverride', nepali: 'महिला कर छुट रकम (१०%)', english: 'Female Tax Rebate Override', required: false, example: 0 },
  
  // Banking, Joining & Contacts
  { key: 'panNumber', nepali: 'स्थायी लेखा नम्बर (PAN)', english: 'PAN Number', required: false, example: '102938475' },
  { key: 'bankName', nepali: 'बैंकको नाम', english: 'Bank Name', required: false, example: 'राष्ट्रिय वाणिज्य बैंक लिमिटेड' },
  { key: 'bankAccount', nepali: 'बैंक खाता नम्बर', english: 'Bank Account Number', required: false, example: '1090100012345' },
  { key: 'joinedDateBS', nepali: 'शुरु नियुक्ति मिति (वि.सं.)', english: 'Joined Date BS (YYYY/MM/DD)', required: false, example: '२०७०/०४/०१' },
  { key: 'joinedDateAD', nepali: 'शुरु नियुक्ति मिति (ई.सं.)', english: 'Joined Date AD (YYYY-MM-DD)', required: false, example: '2013-07-16' },
  { key: 'currentPostDateBS', nepali: 'हालको पदमा नियुक्ति मिति (वि.सं.)', english: 'Current Post Date BS', required: false, example: '२०७८/०१/१५' },
  { key: 'currentPostDateAD', nepali: 'हालको पदमा नियुक्ति मिति (ई.सं.)', english: 'Current Post Date AD', required: false, example: '2021-04-28' },
  { key: 'phone', nepali: 'सम्पर्क मोबाइल / फोन', english: 'Phone / Mobile', required: false, example: '9851000000' },
  { key: 'email', nepali: 'इमेल ठेगाना', english: 'Email Address', required: false, example: 'employee@gov.np' },
  { key: 'remarks', nepali: 'कैफियत', english: 'Remarks', required: false, example: 'नयाँ भर्ना' },
];

/**
 * Generate Blank or Pre-filled Excel Template for Employee Registration & Salary Setup
 */
export function generateEmployeeRegistrationTemplate(options: {
  fiscalYear: string;
  organization?: OrganizationSetup;
  activeOrganization?: OrganizationItem;
  prefillEmployees?: Employee[];
  salarySetups?: Record<string, SalarySetup>;
  deductionSetups?: Record<string, DeductionSetup>;
}): XLSX.WorkBook {
  const { fiscalYear, organization, activeOrganization, prefillEmployees = [], salarySetups = {}, deductionSetups = {} } = options;
  const workbook = XLSX.utils.book_new();

  const orgName = activeOrganization?.name || organization?.name || 'नेपाल सरकार';
  const orgSubName = activeOrganization?.officeName || organization?.officeName || '';
  const orgAddress = activeOrganization?.address || organization?.address || '';

  // 1. Prepare Main Sheet Rows
  const headers = TEMPLATE_COLUMNS.map((c) => c.nepali);

  const dataRows: any[][] = [];

  if (prefillEmployees.length > 0) {
    // Fill with existing employee data
    prefillEmployees.forEach((emp) => {
      const sal = salarySetups[emp.id] || ({} as Partial<SalarySetup>);
      const ded = deductionSetups[emp.id] || ({} as Partial<DeductionSetup>);

      const row = [
        emp.code,
        emp.name,
        emp.serviceGroup || '',
        emp.designation,
        emp.level,
        emp.serviceType,
        emp.gender,
        emp.filingType,
        emp.disability,
        emp.remoteArea,
        emp.pension,
        sal.basicSalary ?? 35000,
        sal.technicalGradeAmount ?? 0,
        sal.gradeRate ?? 1100,
        sal.previousGradeCount ?? emp.previousGradeCount ?? 0,
        sal.addedGradeCount ?? emp.addedGradeCount ?? 1,
        sal.gradeIncreaseMonth ?? 'श्रावण',
        sal.salaryMonthsCount ?? 12,
        sal.lifeInsuranceFund ?? 400,
        sal.dearnessAllowance ?? 2000,
        sal.uniformAllowance ?? 10000,
        sal.uniformAllowanceMonth ?? 'चैत्र',
        sal.remoteAllowance ?? 0,
        sal.incentiveAllowance ?? 0,
        sal.vehicleAllowance ?? 0,
        sal.communicationAllowance ?? 0,
        sal.otherMonthlyAllowance ?? 0,
        sal.festivalBonusMonth ?? 'असोज',
        sal.festivalBonusCustom ?? '',
        sal.otherIncome ?? 0,
        sal.otherTaxableIncome ?? 0,
        ded.citizenInvestmentTrust ?? 0,
        ded.investmentInsuranceDeduction ?? 0,
        ded.healthInsuranceDeduction ?? 0,
        ded.homeInsuranceDeduction ?? 0,
        ded.loanDeduction ?? 0,
        ded.otherDeduction ?? 0,
        ded.disabilityReliefOverride ?? 0,
        ded.pensionSSTExemptOverride ?? 0,
        ded.medicalExpenseActual ?? 0,
        ded.femaleTaxRebateOverride ?? 0,
        emp.panNumber || '',
        emp.bankName || 'राष्ट्रिय वाणिज्य बैंक लिमिटेड',
        emp.bankAccount || '',
        emp.joinedDateBS || '',
        emp.joinedDateAD || '',
        emp.currentPostDateBS || '',
        emp.currentPostDateAD || '',
        emp.phone || '',
        emp.email || '',
        emp.remarks || '',
      ];
      dataRows.push(row);
    });
  } else {
    // Add 2 Realistic Guidance / Demo Rows
    const sampleRow1 = [
      '184920',
      'राम कुमार शर्मा',
      'ने.प्र. / सामान्य प्रशासन',
      'शाखा अधिकृत',
      'अधिकृत सातौं',
      'स्थायी',
      'पुरुष',
      'एकल',
      'अपाङ्ग नभएको',
      'दुर्गम नभएको',
      'भएको',
      43689,
      0,
      1456,
      2,
      1,
      'श्रावण',
      12,
      400,
      2000,
      10000,
      0,
      0,
      0,
      0,
      0,
      'असोज',
      '',
      0,
      0,
      5000,
      40000,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      '102938475',
      'राष्ट्रिय वाणिज्य बैंक लिमिटेड',
      '1090100012345',
      '2070/04/01',
      '2013-07-16',
      '2078/01/15',
      '2021-04-28',
      '9851000000',
      'ram.sharma@gov.np',
      'नयाँ भर्ना',
    ];

    const sampleRow2 = [
      '195033',
      'सिता कुमारी अधिकारी',
      'स्वास्थ्य सेवा',
      'स्टाफ नर्स',
      'सहायक पाँचौ (स्वास्थय सेवा)',
      'स्थायी',
      'महिला',
      'दम्पत्ती',
      'अपाङ्ग नभएको',
      'ख',
      'भएको',
      34730,
      0,
      1158,
      3,
      1,
      'श्रावण',
      12,
      400,
      2000,
      10000,
      3000,
      0,
      0,
      0,
      0,
      'असोज',
      '',
      0,
      0,
      4000,
      35000,
      20000,
      5000,
      0,
      0,
      0,
      0,
      0,
      0,
      '203948571',
      'नेपाल बैंक लिमिटेड',
      '0190100098765',
      '2073/08/10',
      '2016-11-25',
      '2079/02/20',
      '2022-06-03',
      '9841223344',
      'sita.adhikari@gov.np',
      '',
    ];

    dataRows.push(sampleRow1);
    dataRows.push(sampleRow2);
  }

  // Build Sheet 1: Registration Form
  const ws1 = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

  // Set column widths
  const colWidths = TEMPLATE_COLUMNS.map((col) => ({
    wch: Math.max(col.nepali.length + 4, col.example ? String(col.example).length + 4 : 12, 14),
  }));
  ws1['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(workbook, ws1, 'कर्मचारी_दर्ता_तथा_तलब_फाराम');

  // Build Sheet 2: Guidelines & Standard Options
  const instructionsHeader = ['क्र.सं.', 'स्तम्भको नाम (Field Name)', 'अनिवार्य / ऐच्छिक', 'मान्य विकल्पहरू तथा नियम (Allowed Values & Rules)', 'उदाहरणीय मान (Example)'];
  const instructionsData = TEMPLATE_COLUMNS.map((col, idx) => {
    let rules = '';
    if (col.key === 'code') rules = 'कर्मचारीको अद्वितीय संकेत नम्बर (अंक वा अक्षर)';
    else if (col.key === 'name') rules = 'कर्मचारीको पूरा नाम (नेपाली वा अंग्रेजी)';
    else if (col.key === 'serviceType') rules = 'मान्य मानहरू: स्थायी, अस्थायी, करार';
    else if (col.key === 'gender') rules = 'मान्य मानहरू: पुरुष, महिला, अन्य';
    else if (col.key === 'filingType') rules = 'मान्य मानहरू: एकल, दम्पत्ती (कर प्रयोजनका लागि)';
    else if (col.key === 'disability') rules = 'मान्य मानहरू: अपाङ्ग नभएको, अपाङ्ग भएको, क वर्ग, ख वर्ग, ग वर्ग, घ वर्ग';
    else if (col.key === 'remoteArea') rules = "मान्य मानहरू: दुर्गम नभएको, 'क' वर्ग, 'ख' वर्ग, 'ग' वर्ग, 'घ' वर्ग, 'ङ' वर्ग";
    else if (col.key === 'pension') rules = 'मान्य मानहरू: भएको, नभएको (योगदानमा आधारित निवृत्तिभरण)';
    else if (col.key === 'gradeIncreaseMonth' || col.key === 'festivalBonusMonth' || col.key === 'uniformAllowanceMonth') rules = 'श्रावण, भाद्र, असोज, कार्तिक, मंसिर, पौष, माघ, फागुन, चैत्र, बैशाख, जेठ, अषाढ';
    else if (col.key === 'salaryMonthsCount') rules = 'संख्या १ देखि १२ (सामान्यतया १२)';
    else if (col.key.includes('DateBS')) rules = 'वि.सं. मिति ढाँचा: YYYY/MM/DD (जस्तै: २०७०/०४/०१ वा 2070/04/01)';
    else if (col.key.includes('DateAD')) rules = 'ई.सं. मिति ढाँचा: YYYY-MM-DD (जस्तै: 2013-07-16)';
    else if (col.key.includes('Amount') || col.key.includes('Salary') || col.key.includes('Rate') || col.key.includes('Deduction') || col.key.includes('Allowance')) {
      rules = 'अंक (संख्या) - नेपाली वा अंग्रेजी दुबै अंक प्रविष्ट गर्न सकिनेछ।';
    } else {
      rules = 'खुला टेक्स्ट वा अंक';
    }

    return [idx + 1, col.nepali, col.required ? 'अनिवार्य (Required)' : 'ऐच्छिक (Optional)', rules, String(col.example)];
  });

  const ws2 = XLSX.utils.aoa_to_sheet([instructionsHeader, ...instructionsData]);
  ws2['!cols'] = [{ wch: 8 }, { wch: 32 }, { wch: 20 }, { wch: 48 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(workbook, ws2, 'निर्देशन_र_मानक_विकल्पहरू');

  // Build Sheet 3: Government Standard Ranks & Level List for Reference
  const rankHeader = ['क्र.सं.', 'श्रेणी / तह (Govt Level/Rank)', 'सामान्य पद (Typical Designation)'];
  const rankData = GOVT_LEVELS.map((lvl, i) => [i + 1, lvl, '']);
  const ws3 = XLSX.utils.aoa_to_sheet([rankHeader, ...rankData]);
  ws3['!cols'] = [{ wch: 8 }, { wch: 38 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(workbook, ws3, 'पद_र_तह_सूची_Reference');

  return workbook;
}

/**
 * Trigger browser download of generated template
 */
export function downloadEmployeeRegistrationTemplate(options: {
  fiscalYear: string;
  organization?: OrganizationSetup;
  activeOrganization?: OrganizationItem;
  prefillEmployees?: Employee[];
  salarySetups?: Record<string, SalarySetup>;
  deductionSetups?: Record<string, DeductionSetup>;
  filename?: string;
}) {
  const wb = generateEmployeeRegistrationTemplate(options);
  const sanitizedFy = options.fiscalYear.replace(/[\/\\]/g, '_');
  const filename = options.filename || (options.prefillEmployees && options.prefillEmployees.length > 0
    ? `Employee_Registration_Filled_Template_${sanitizedFy}.xlsx`
    : `Employee_Registration_Template_${sanitizedFy}.xlsx`);
  
  XLSX.writeFile(wb, filename);
}

/**
 * Clean & Parse a number value from Excel cell (supports Devanagari numerals, currency symbols, commas)
 */
export function parseNumberCell(val: any, defaultVal: number = 0): number {
  if (val === undefined || val === null || val === '') return defaultVal;
  if (typeof val === 'number') {
    return isNaN(val) ? defaultVal : val;
  }
  const str = String(val).trim();
  const engStr = toEnglishDigits(str).replace(/[^\d.-]/g, '');
  const num = parseFloat(engStr);
  return isNaN(num) ? defaultVal : num;
}

/**
 * Clean & Parse text cell from Excel
 */
export function parseStringCell(val: any, defaultVal: string = ''): string {
  if (val === undefined || val === null) return defaultVal;
  const str = String(val).trim();
  return str === '' ? defaultVal : str;
}

/**
 * Normalize Service Type
 */
export function normalizeServiceType(val: any): ServiceType {
  const str = parseStringCell(val, 'स्थायी');
  if (str.includes('करार')) return 'करार';
  if (str.includes('अस्थायी')) return 'अस्थायी';
  return 'स्थायी';
}

/**
 * Normalize Gender
 */
export function normalizeGender(val: any): GenderType {
  const str = parseStringCell(val, 'पुरुष');
  if (str.includes('महिला') || str.toLowerCase() === 'female' || str.toLowerCase() === 'f') return 'महिला';
  if (str.includes('अन्य') || str.toLowerCase() === 'other') return 'अन्य';
  return 'पुरुष';
}

/**
 * Normalize Filing Type
 */
export function normalizeFilingType(val: any): FilingType {
  const str = parseStringCell(val, 'एकल');
  if (str.includes('दम्पत्ती') || str.includes('दम्पति') || str.includes('विवाहित') || str.toLowerCase() === 'couple' || str.toLowerCase() === 'married') {
    return 'दम्पत्ती';
  }
  return 'एकल';
}

/**
 * Normalize Disability
 */
export function normalizeDisability(val: any): DisabilityType {
  const str = parseStringCell(val, 'अपाङ्ग नभएको');
  if (str.includes('क') || str.includes('ख') || str.includes('ग') || str.includes('घ') || str.includes('भएको') || str.toLowerCase() === 'yes') {
    return 'अपाङ्ग भएको';
  }
  return 'अपाङ्ग नभएको';
}

/**
 * Normalize Remote Area
 */
export function normalizeRemoteArea(val: any): RemoteAreaType {
  const str = parseStringCell(val, 'दुर्गम नभएको');
  if (str.includes('क') || str.toUpperCase() === 'A') return 'क';
  if (str.includes('ख') || str.toUpperCase() === 'B') return 'ख';
  if (str.includes('ग') || str.toUpperCase() === 'C') return 'ग';
  if (str.includes('घ') || str.toUpperCase() === 'D') return 'घ';
  if (str.includes('ङ') || str.toUpperCase() === 'E') return 'ङ';
  return 'दुर्गम नभएको';
}

/**
 * Normalize Pension Type
 */
export function normalizePension(val: any): PensionType {
  const str = parseStringCell(val, 'भएको');
  if (str.includes('नभएको') || str.includes('छैन') || str.toLowerCase() === 'no' || str.toLowerCase() === 'none') {
    return 'नभएको';
  }
  return 'भएको';
}

/**
 * Normalize Nepali Month
 */
export function normalizeNepaliMonth(val: any, defaultMonth: NepaliMonth = 'श्रावण'): NepaliMonth {
  const str = parseStringCell(val, defaultMonth);
  const months: NepaliMonth[] = ['श्रावण', 'भाद्र', 'असोज', 'कार्तिक', 'मंसिर', 'पौष', 'माघ', 'फागुन', 'चैत्र', 'बैशाख', 'जेठ', 'अषाढ'];
  for (const m of months) {
    if (str.includes(m) || str.replace(' ', '').includes(m)) return m;
  }
  return defaultMonth;
}

/**
 * Normalize Date BS and calculate AD date if needed
 */
export function normalizeDates(rawBs?: any, rawAd?: any): { bs: string; ad: string } {
  let bs = parseStringCell(rawBs, '');
  let ad = parseStringCell(rawAd, '');

  if (bs) {
    // Standardize BS date format
    const engBs = toEnglishDigits(bs).replace(/\s/g, '').replace(/[-.]/g, '/');
    const parts = engBs.split('/');
    if (parts.length === 3) {
      const y = parts[0].padStart(4, '20');
      const m = parts[1].padStart(2, '0');
      const d = parts[2].padStart(2, '0');
      bs = `${y}/${m}/${d}`;
      if (!ad) {
        const conv = bsToAd(bs);
        if (conv.formattedAD) ad = conv.formattedAD;
      }
    }
  }

  if (ad && !bs) {
    const conv = adToBs(ad);
    if (conv.formattedBS) bs = conv.formattedBS;
  }

  if (!bs) bs = '२०७०/०१/०१';
  if (!ad) ad = '2013-04-14';

  return { bs, ad };
}

/**
 * Find matching key in raw row object flexibly
 */
function findRowValue(row: Record<string, any>, possibleKeys: string[]): any {
  const rowKeys = Object.keys(row);
  for (const pKey of possibleKeys) {
    const lowerP = pKey.toLowerCase().replace(/[^a-z0-9\u0900-\u097F]/g, '');
    for (const rKey of rowKeys) {
      const lowerR = rKey.toLowerCase().replace(/[^a-z0-9\u0900-\u097F]/g, '');
      if (lowerR === lowerP || lowerR.includes(lowerP) || lowerP.includes(lowerR)) {
        return row[rKey];
      }
    }
  }
  return undefined;
}

/**
 * Parse an Excel file (Workbook) and convert to structured Employee/Salary/Deduction objects
 */
export function parseEmployeeExcelFile(
  fileData: ArrayBuffer | Uint8Array,
  existingEmployees: Employee[] = []
): {
  rows: ParsedEmployeeRow[];
  totalRows: number;
  validCount: number;
  errorCount: number;
  existingCount: number;
  newCount: number;
} {
  const workbook = XLSX.read(fileData, { type: 'array' });
  
  // Pick the first sheet or a sheet named 'कर्मचारी_दर्ता'
  let sheetName = workbook.SheetNames[0];
  for (const name of workbook.SheetNames) {
    if (name.includes('कर्मचारी') || name.includes('फाराम') || name.includes('Employee') || name.includes('Data')) {
      sheetName = name;
      break;
    }
  }

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error('एक्सेल फाइलमा कुनै सिट फेला परेन।');
  }

  // Convert to JSON objects
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  if (rawRows.length === 0) {
    throw new Error('छानिएको एक्सेल सिट खाली छ वा कुनै डाटा छैन।');
  }

  const parsedRows: ParsedEmployeeRow[] = [];
  const existingCodeMap = new Map<string, Employee>();
  existingEmployees.forEach((emp) => {
    existingCodeMap.set(toEnglishDigits(emp.code).trim().toLowerCase(), emp);
  });

  const fileCodeSet = new Set<string>();

  rawRows.forEach((row, index) => {
    const rowIndex = index + 2; // Accounting for header row (Row 1)
    const errors: string[] = [];

    // Extract fields
    const rawCode = findRowValue(row, ['कर्मचारी संकेत नं', 'संकेत नं', 'कर्मचारी संकेत', 'Employee Code', 'code', 'Code']);
    const rawName = findRowValue(row, ['कर्मचारीको पूरा नाम', 'कर्मचारीको नाम', 'नाम', 'Full Name', 'Name', 'name']);
    const rawGroup = findRowValue(row, ['सेवा / समूह / उपसमूह', 'सेवा/समूह', 'सेवा समूह', 'Service Group', 'Service/Group', 'serviceGroup']);
    const rawDesig = findRowValue(row, ['पद', 'Designation', 'designation', 'Post']);
    const rawLevel = findRowValue(row, ['श्रेणी / तह', 'श्रेणी/तह', 'तह', 'श्रेणी', 'Level', 'Rank', 'level']);
    const rawServiceType = findRowValue(row, ['सेवा प्रकार', 'Service Type', 'serviceType', 'Type']);
    const rawGender = findRowValue(row, ['लिङ्ग', 'Gender', 'gender', 'Sex']);
    const rawFiling = findRowValue(row, ['वैवाहिक / कर दाखिला', 'वैवाहिक स्थिति', 'कर दाखिला', 'Filing Type', 'filingType', 'Marital Status']);
    const rawDisability = findRowValue(row, ['अपाङ्गता', 'अपाङ्ग', 'Disability', 'disability']);
    const rawRemote = findRowValue(row, ['दुर्गम क्षेत्र वर्ग', 'दुर्गम क्षेत्र', 'दुर्गम', 'Remote Area', 'remoteArea']);
    const rawPension = findRowValue(row, ['योगदानमा आधारित निवृत्तिभरण', 'निवृत्तिभरण', 'Pension', 'pension']);

    const code = parseStringCell(rawCode, '');
    const name = parseStringCell(rawName, '');
    const serviceGroup = parseStringCell(rawGroup, '');
    const designation = parseStringCell(rawDesig, '');
    const level = parseStringCell(rawLevel, '');

    // Skip purely empty spacer rows
    if (!code && !name && !designation && !level) {
      return;
    }

    if (!code) errors.push('कर्मचारी संकेत नम्बर अनिवार्य छ।');
    if (!name) errors.push('कर्मचारीको नाम अनिवार्य छ।');
    if (!designation) errors.push('कर्मचारीको पद अनिवार्य छ।');

    const cleanCode = toEnglishDigits(code).trim().toLowerCase();
    if (cleanCode && fileCodeSet.has(cleanCode)) {
      errors.push(`संकेत नं. '${code}' यसै एक्सेल फाइलमा दोहोरिएको छ।`);
    } else if (cleanCode) {
      fileCodeSet.add(cleanCode);
    }

    const serviceType = normalizeServiceType(rawServiceType);
    const gender = normalizeGender(rawGender);
    const filingType = normalizeFilingType(rawFiling);
    const disability = normalizeDisability(rawDisability);
    const remoteArea = normalizeRemoteArea(rawRemote);
    const pension = normalizePension(rawPension);

    // Salary fields
    const rawBasic = findRowValue(row, ['शुरु तलब स्केल', 'तलब स्केल', 'Basic Monthly Salary', 'Basic Salary', 'basicSalary']);
    const rawTechGrade = findRowValue(row, ['प्राविधिक ग्रेड रकम', 'Technical Grade Amount', 'technicalGradeAmount']);
    const rawGradeRate = findRowValue(row, ['ग्रेड दर', 'Grade Rate', 'gradeRate']);
    const rawPrevGrade = findRowValue(row, ['अघिल्लो असारसम्मको ग्रेड संख्या', 'अघिल्लो असारसम्म ग्रेड', 'Previous Grade Count', 'previousGradeCount']);
    const rawAddGrade = findRowValue(row, ['चालु आ.व. मा थप हुने ग्रेड संख्या', 'थप हुने ग्रेड', 'Added Grade Count', 'addedGradeCount']);
    const rawGradeMonth = findRowValue(row, ['ग्रेड वृद्धि हुने महिना', 'ग्रेड वृद्धि महिना', 'Grade Increase Month', 'gradeIncreaseMonth']);
    const rawSalaryMonths = findRowValue(row, ['तलब पाउने महिना अवधि', 'तलब महिना', 'Salary Months Count', 'salaryMonthsCount']);
    const rawLifeInsFund = findRowValue(row, ['सावधिक जीवन बिमा कोष थप', 'सावधिक जीवन बिमा कोष', 'Life Insurance Fund', 'lifeInsuranceFund']);
    const rawDearness = findRowValue(row, ['महङ्गी भत्ता', 'Dearness Allowance', 'dearnessAllowance']);
    const rawUniform = findRowValue(row, ['पोशाक भत्ता', 'Uniform Allowance', 'uniformAllowance']);
    const rawUniformMonth = findRowValue(row, ['पोशाक भत्ता पाउने महिना', 'पोशाक भत्ता महिना', 'Uniform Allowance Month', 'uniformAllowanceMonth']);
    const rawRemoteAllowance = findRowValue(row, ['स्थानीय / दुर्गम भत्ता', 'दुर्गम भत्ता', 'Remote Allowance', 'remoteAllowance']);
    const rawIncentive = findRowValue(row, ['प्रोत्साहन / विशेष भत्ता', 'प्रोत्साहन भत्ता', 'Incentive Allowance', 'incentiveAllowance']);
    const rawVehicle = findRowValue(row, ['सवारी / इन्धन भत्ता', 'सवारी भत्ता', 'Vehicle Allowance', 'vehicleAllowance']);
    const rawComm = findRowValue(row, ['सञ्चार / टेलिफोन भत्ता', 'सञ्चार भत्ता', 'Communication Allowance', 'communicationAllowance']);
    const rawOtherMonthly = findRowValue(row, ['अन्य मासिक भत्ता', 'Other Monthly Allowance', 'otherMonthlyAllowance']);
    const rawFestMonth = findRowValue(row, ['चाडपर्व खर्च पाउने महिना', 'चाडपर्व खर्च महिना', 'Festival Bonus Month', 'festivalBonusMonth']);
    const rawFestCustom = findRowValue(row, ['चाडपर्व खर्च रकम', 'Festival Bonus Custom', 'festivalBonusCustom']);
    const rawOtherIncome = findRowValue(row, ['अन्य अतिरिक्त आय', 'अन्य आय', 'Other Income Annual', 'otherIncome']);
    const rawOtherTaxable = findRowValue(row, ['अन्य करयोग्य आय', 'Other Taxable Income Annual', 'otherTaxableIncome']);

    const basicSalary = parseNumberCell(rawBasic, 35000);
    const technicalGradeAmount = parseNumberCell(rawTechGrade, 0);
    const gradeRate = parseNumberCell(rawGradeRate, 1100);
    const previousGradeCount = parseNumberCell(rawPrevGrade, 0);
    const addedGradeCount = parseNumberCell(rawAddGrade, 1);
    const gradeIncreaseMonth = normalizeNepaliMonth(rawGradeMonth, 'श्रावण');
    const salaryMonthsCount = Math.min(12, Math.max(1, parseNumberCell(rawSalaryMonths, 12)));
    const lifeInsuranceFund = parseNumberCell(rawLifeInsFund, 400);
    const dearnessAllowance = parseNumberCell(rawDearness, 2000);
    const uniformAllowance = parseNumberCell(rawUniform, 10000);
    const uniformAllowanceMonth = parseStringCell(rawUniformMonth, 'चैत्र');
    const remoteAllowance = parseNumberCell(rawRemoteAllowance, 0);
    const incentiveAllowance = parseNumberCell(rawIncentive, 0);
    const vehicleAllowance = parseNumberCell(rawVehicle, 0);
    const communicationAllowance = parseNumberCell(rawComm, 0);
    const otherMonthlyAllowance = parseNumberCell(rawOtherMonthly, 0);
    const festivalBonusMonth = parseStringCell(rawFestMonth, 'असोज');
    const festivalBonusCustom = rawFestCustom !== '' && rawFestCustom !== undefined ? parseNumberCell(rawFestCustom, 0) : undefined;
    const otherIncome = parseNumberCell(rawOtherIncome, 0);
    const otherTaxableIncome = parseNumberCell(rawOtherTaxable, 0);

    // Deductions fields
    const rawCIT = findRowValue(row, ['नागरिक लगानी कोष कट्टी', 'नागरिक लगानी कोष', 'CIT Deduction', 'citizenInvestmentTrust']);
    const rawLifeInsPrem = findRowValue(row, ['व्यक्तिगत जीवन बिमा प्रिमियम', 'जीवन बिमा प्रिमियम', 'Life Insurance Premium', 'investmentInsuranceDeduction']);
    const rawHealthIns = findRowValue(row, ['स्वास्थ्य बिमा प्रिमियम छुट', 'स्वास्थ्य बिमा', 'Health Insurance Premium', 'healthInsuranceDeduction']);
    const rawHomeIns = findRowValue(row, ['निजी घर बिमा प्रिमियम छुट', 'घर बिमा', 'Home Insurance Premium', 'homeInsuranceDeduction']);
    const rawLoan = findRowValue(row, ['सापटी / ऋण कट्टी', 'सापटी कट्टी', 'Loan Deduction', 'loanDeduction']);
    const rawOtherDed = findRowValue(row, ['अन्य विविध कट्टी', 'विविध कट्टी', 'Other Deductions', 'otherDeduction']);
    const rawDisabilityRelief = findRowValue(row, ['अपाङ्ग व्यक्ति कर छुट रकम', 'अपाङ्ग कर छुट', 'Disability Tax Relief', 'disabilityReliefOverride']);
    const rawPensionSST = findRowValue(row, ['सा.सु.कर छुट रकम', 'सासुकर छुट', 'Pension SST Exempt', 'pensionSSTExemptOverride']);
    const rawMedicalExp = findRowValue(row, ['औषधी उपचार खर्च मिलान रकम', 'औषधी उपचार खर्च', 'Medical Expense Actual', 'medicalExpenseActual']);
    const rawFemaleRebate = findRowValue(row, ['महिला कर छुट रकम', 'महिला कर छुट', 'Female Tax Rebate', 'femaleTaxRebateOverride']);

    const citizenInvestmentTrust = parseNumberCell(rawCIT, 0);
    const investmentInsuranceDeduction = parseNumberCell(rawLifeInsPrem, 0);
    const healthInsuranceDeduction = parseNumberCell(rawHealthIns, 0);
    const homeInsuranceDeduction = parseNumberCell(rawHomeIns, 0);
    const loanDeduction = parseNumberCell(rawLoan, 0);
    const otherDeduction = parseNumberCell(rawOtherDed, 0);
    const disabilityReliefOverride = parseNumberCell(rawDisabilityRelief, 0);
    const pensionSSTExemptOverride = parseNumberCell(rawPensionSST, 0);
    const medicalExpenseActual = parseNumberCell(rawMedicalExp, 0);
    const femaleTaxRebateOverride = parseNumberCell(rawFemaleRebate, 0);

    // Bank, Joining & Contact fields
    const rawPan = findRowValue(row, ['स्थायी लेखा नम्बर', 'PAN Number', 'panNumber', 'PAN', 'pan']);
    const rawBank = findRowValue(row, ['बैंकको नाम', 'Bank Name', 'bankName']);
    const rawAccount = findRowValue(row, ['बैंक खाता नम्बर', 'खाता नम्बर', 'Bank Account', 'bankAccount']);
    const rawJoinedBS = findRowValue(row, ['शुरु नियुक्ति मिति वि.सं.', 'शुरु नियुक्ति मिति', 'Joined Date BS', 'joinedDateBS']);
    const rawJoinedAD = findRowValue(row, ['शुरु नियुक्ति मिति ई.सं.', 'Joined Date AD', 'joinedDateAD']);
    const rawCurrentPostBS = findRowValue(row, ['हालको पदमा नियुक्ति मिति वि.सं.', 'हालको पदमा नियुक्ति मिति', 'Current Post Date BS', 'currentPostDateBS']);
    const rawCurrentPostAD = findRowValue(row, ['हालको पदमा नियुक्ति मिति ई.सं.', 'Current Post Date AD', 'currentPostDateAD']);
    const rawPhone = findRowValue(row, ['सम्पर्क मोबाइल / फोन', 'सम्पर्क मोबाइल', 'फोन', 'मोबाइल', 'Phone', 'phone', 'Mobile']);
    const rawEmail = findRowValue(row, ['इमेल ठेगाना', 'इमेल', 'Email', 'email']);
    const rawRemarks = findRowValue(row, ['कैफियत', 'Remarks', 'remarks']);

    const panNumber = parseStringCell(rawPan, '');
    const bankName = parseStringCell(rawBank, 'राष्ट्रिय वाणिज्य बैंक लिमिटेड');
    const bankAccount = parseStringCell(rawAccount, '');
    const phone = parseStringCell(rawPhone, '');
    const email = parseStringCell(rawEmail, '');
    const remarks = parseStringCell(rawRemarks, '');

    const joinedDates = normalizeDates(rawJoinedBS, rawJoinedAD);
    const currentPostDates = normalizeDates(rawCurrentPostBS, rawCurrentPostAD);

    // Existing check
    const matchedExisting = cleanCode ? existingCodeMap.get(cleanCode) : undefined;
    const isExisting = !!matchedExisting;

    const parsedEmployee: Omit<Employee, 'id' | 'createdAt'> = {
      code,
      name,
      serviceGroup,
      designation,
      level: level || 'अधिकृत सातौं',
      serviceType,
      gender,
      filingType,
      disability,
      remoteArea,
      pension,
      panNumber,
      bankAccount,
      bankName,
      joinedDateBS: joinedDates.bs,
      joinedDateAD: joinedDates.ad,
      currentPostDateBS: currentPostDates.bs,
      currentPostDateAD: currentPostDates.ad,
      phone,
      email,
      remarks,
      technicalGradeAmount,
      previousGradeCount,
      addedGradeCount,
      gradeIncreaseMonthText: `${gradeIncreaseMonth} देखि`,
      festivalBonusMonth,
      uniformAllowanceMonth,
    };

    const parsedSalary: Partial<SalarySetup> = {
      basicSalary,
      technicalGradeAmount,
      gradeRate,
      previousGradeCount,
      addedGradeCount,
      currentGradeCount: previousGradeCount + addedGradeCount,
      gradeIncreaseCount: addedGradeCount,
      gradeIncreaseMonth,
      salaryMonthsCount,
      lifeInsuranceFund,
      dearnessAllowance,
      uniformAllowance,
      uniformAllowanceMonth,
      remoteAllowance,
      incentiveAllowance,
      vehicleAllowance,
      communicationAllowance,
      otherMonthlyAllowance,
      festivalBonusMonth,
      festivalBonusCustom,
      otherIncome,
      otherTaxableIncome,
    };

    const parsedDeduction: Partial<DeductionSetup> = {
      citizenInvestmentTrust,
      investmentInsuranceDeduction,
      healthInsuranceDeduction,
      homeInsuranceDeduction,
      loanDeduction,
      otherDeduction,
      disabilityReliefOverride,
      pensionSSTExemptOverride,
      medicalExpenseActual,
      femaleTaxRebateOverride,
    };

    parsedRows.push({
      rowIndex,
      raw: row,
      employee: parsedEmployee,
      salary: parsedSalary,
      deduction: parsedDeduction,
      isValid: errors.length === 0,
      errors,
      isExisting,
      existingId: matchedExisting?.id,
    });
  });

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const errorCount = parsedRows.filter((r) => !r.isValid).length;
  const existingCount = parsedRows.filter((r) => r.isValid && r.isExisting).length;
  const newCount = parsedRows.filter((r) => r.isValid && !r.isExisting).length;

  return {
    rows: parsedRows,
    totalRows: parsedRows.length,
    validCount,
    errorCount,
    existingCount,
    newCount,
  };
}
