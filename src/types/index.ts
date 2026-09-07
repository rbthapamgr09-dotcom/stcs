export type ServiceType = 'स्थायी' | 'अस्थायी' | 'करार';
export type GenderType = 'पुरुष' | 'महिला' | 'अन्य';
export type DisabilityType = 'अपाङ्ग भएको' | 'अपाङ्ग नभएको';
export type RemoteAreaType = 'क' | 'ख' | 'ग' | 'घ' | 'ङ' | 'दुर्गम नभएको';
export type PensionType = 'भएको' | 'नभएको';
export type FilingType = 'एकल' | 'दम्पत्ती';

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'GENERAL_USER' | 'ACCOUNTANT' | 'VIEWER';

export interface User {
  id: string;
  username: string; // User ID / प्रयोगकर्ता आइडी
  password?: string; // पासवर्ड
  fullName: string;
  role: UserRole;
  organizationId?: string; // सम्बद्ध कार्यालय / संस्थाको ID ('all' for global superadmin, or org_id)
  organizationName?: string; // सम्बद्ध कार्यालयको नाम
  email?: string;
  phone?: string;
  designation?: string;
  securityPin?: string; // ४ अंकको सुरक्षा पिन (Forgot Password Reset का लागि)
  securityQuestion?: string; // सुरक्षा प्रश्न
  securityAnswer?: string; // सुरक्षा उत्तर
  isActive: boolean;
  mustChangePassword?: boolean; // शुरुको पहिलो लगइनमा अनिवार्य पासवर्ड परिवर्तन गर्नुपर्ने
  isFirstLogin?: boolean;
  createdAt: string;
  lastLogin?: string;
  passwordChangedAt?: string;
}

export interface FiscalYearData {
  employees: Employee[];
  salarySetups: Record<string, SalarySetup>;
  deductionSetups: Record<string, DeductionSetup>;
  taxReferences: TaxReference[];
}

export type NepaliMonth =
  | 'श्रावण'
  | 'भाद्र'
  | 'असोज'
  | 'कार्तिक'
  | 'मंसिर'
  | 'पौष'
  | 'माघ'
  | 'फागुन'
  | 'चैत्र'
  | 'बैशाख'
  | 'जेठ'
  | 'अषाढ';

export interface Employee {
  id: string;
  code: string; // कर्मचारी संकेत नम्बर (Unique)
  name: string; // कर्मचारीको नाम
  designation: string; // पद
  level: string; // श्रेणी/तह
  serviceGroup?: string; // सेवा/समूह/उपसमूह (e.g. ने.ई./सिभिल/हाईवे, प्रशासन/लेखा)
  serviceType: ServiceType; // स्थायी/अस्थायी/करार
  gender: GenderType; // लिङ्ग
  disability: DisabilityType; // अपाङ्ग भए/नभएको
  remoteArea: RemoteAreaType; // दुर्गम क्षेत्र (क, ख, ग, घ, ङ, दुर्गम नभएको)
  pension: PensionType; // योगदानमा आधारित निवृत्तिभरण (भएको/नभएको)
  filingType: FilingType; // एकल / दम्पत्ती
  panNumber?: string;
  bankAccount?: string;
  bankName?: string;
  joinedDateBS: string; // शुरु नियुक्ति मिति
  joinedDateAD: string;
  currentPostDateBS?: string; // हालको पदमा बढुवा/स्तरवृद्धि/नियुक्ति मिति
  currentPostDateAD?: string;
  technicalGradeAmount?: number; // ०५७/४/१ भन्दा अगाडी नियुक्त प्राविधिक कर्मचारीको तलबमानमा थप रकम
  previousGradeCount?: number; // अघिल्लो आ.व. असार मसान्त सम्मको ग्रेड संख्या
  addedGradeCount?: number; // चालु आ.व. मा थप हुने ग्रेड संख्या
  gradeIncreaseMonthText?: string; // ग्रेड वृद्धि हुने महिना (जस्तै: श्रावण देखि)
  festivalBonusMonth?: string; // चाडपर्व खर्च पाउने महिना (जस्तै: असोज)
  uniformAllowanceMonth?: string; // पोशाक भत्ता पाउने महिना (जस्तै: चैत्र वा श्रावण)
  phone?: string;
  email?: string;
  remarks?: string; // कैफियत (जस्तै: ग्रेड पुरा भएको)
  createdAt: string;
}

export interface SalarySetup {
  id: string;
  employeeId: string;
  basicSalary: number; // हालको पदको शुरु तलब स्केल (Basic monthly salary)
  technicalGradeAmount?: number; // ०५७/४/१ भन्दा अगाडी नियुक्त प्राविधिक कर्मचारीको तलबमानमा थप रकम
  salaryMonthsCount: number; // तलबको अवधि (सामान्यतया १२ महिना)
  gradeRate: number; // ग्रेड दर
  currentGradeCount: number; // जम्मा ग्रेड संख्या वा खाइपाई आएको ग्रेड संख्या
  previousGradeCount?: number; // अघिल्लो आ.व. असार मसान्त सम्मको ग्रेड संख्या
  addedGradeCount?: number; // चालु आ.व. मा थप हुने ग्रेड संख्या
  gradeIncreaseCount: number; // ग्रेड बृद्धि संख्या
  gradeIncreaseMonth: NepaliMonth; // ग्रेड बृद्धि हुने महिना
  festivalBonusMonth?: string; // चाडपर्व खर्च पाउने महिना (जस्तै: असोज वा बैशाख महिनामा भुक्तानी)
  festivalBonusCustom?: number; // चाडपर्व खर्च रकम (override/custom)
  lifeInsuranceFund: number; // सावधिक जीवन बिमा कोष रकम (मासिक)
  dearnessAllowance: number; // महङ्गी भत्ता रकम (मासिक)
  uniformAllowance: number; // पोशाक भत्ता रकम (वार्षिक एकमुष्ठ)
  uniformAllowanceMonth?: string; // पोशाक भत्ता पाउने महिना (जस्तै: चैत्र वा श्रावण महिनामा भुक्तानी)
  remoteAllowance: number; // स्थानीय / दुर्गम भत्ता (मासिक)
  incentiveAllowance: number; // प्रोत्साहन / विशेष भत्ता (मासिक)
  vehicleAllowance?: number; // सवारी / इन्धन भत्ता (मासिक)
  communicationAllowance?: number; // सञ्चार / टेलिफोन भत्ता (मासिक)
  otherMonthlyAllowance?: number; // अन्य भत्ता (मासिक)
  otherIncome: number; // अन्य आय रकम (वार्षिक वा अन्य)
  otherTaxableIncome?: number; // अन्य अतिरिक्त आय / करयोग्य आय (वार्षिक एकमुष्ठ)
  updatedAt: string;
}

export interface DeductionSetup {
  id: string;
  employeeId: string;
  loanDeduction: number; // सापटी / ऋण कट्टी रकम (मासिक)
  citizenInvestmentTrust: number; // नागरिक लगानी कोष रकम (मासिक)
  investmentInsuranceDeduction: number; // व्यक्तिगत जीवन बिमा प्रिमियम (वार्षिक एकमुष्ठ)
  healthInsuranceDeduction?: number; // स्वास्थ्य बिमा प्रिमियम (वार्षिक एकमुष्ठ - अधिकतम रु. २०,०००)
  homeInsuranceDeduction?: number; // निजी घर बिमा प्रिमियम (वार्षिक एकमुष्ठ - अधिकतम रु. ५,०००)
  remoteTaxReliefOverride?: number; // दुर्गम छुट रकम override (optional)
  otherDeduction: number; // अन्य विविध कट्टी (मासिक)
  disabilityReliefOverride?: number; // अपाङ्ग व्यक्तिले पाउने छुट रकम (वार्षिक)
  pensionSSTExemptOverride?: number; // योगदानमा आधारित निवृत्तिभरण कोष प्राप्त कर्मचारीलाई सा.सु.कर छुट रकम (वार्षिक)
  medicalExpenseActual?: number; // औषधी उपचार खर्च मिलान रकम (वार्षिक)
  femaleTaxRebateOverride?: number; // वार्षिक करको १०% ले वार्षिक छुट रकम (महिला कर्मचारीको लागि मात्र)
  // Employee-specific statutory deduction ceilings / overrides
  lifeInsuranceCeilingLimit?: number; // कर्मचारीगत सावधिक जीवन बिमा अधिकतम कट्टी सीमा (मानक रु ४०,००० वा स्ल्याब अनुसार)
  citCeilingLimit?: number; // कर्मचारीगत ना.ल.कोष / अवकाश कोष अधिकतम कट्टी सीमा (मानक रु ३,००,००० वा १/३)
  healthInsuranceCeilingLimit?: number; // कर्मचारीगत स्वास्थ्य बिमा अधिकतम कट्टी सीमा (मानक रु २०,०००)
  homeInsuranceCeilingLimit?: number; // कर्मचारीगत निजी घर बिमा अधिकतम कट्टी सीमा (मानक रु ५,०००)
  medicalTaxCreditCeilingLimit?: number; // कर्मचारीगत औषधी उपचार कर मिलान अधिकतम सीमा (मानक रु ७५०)
  updatedAt: string;
}

export interface TaxSlab {
  id: string;
  fromAmount: number;
  toAmount: number; // use Infinity or very large for above limit
  ratePercent: number;
  description: string;
}

export interface TaxReference {
  id: string;
  fiscalYear: string; // e.g. "२०८१/८२"
  filingType: FilingType; // एकल वा दम्पत्ती
  slabs: TaxSlab[];
  remoteExemptions: {
    'क': number;
    'ख': number;
    'ग': number;
    'घ': number;
    'ङ': number;
    'दुर्गम नभएको': number;
  };
  disabilityExemptionPercent: number; // e.g. 50% additional basic slab exemption
  femaleTaxRebatePercent: number; // e.g. 10% rebate for single female
  pensionSSTExempt: boolean; // True if 1% Social Security Tax is exempt for pension contributors
  medicalTaxCreditRatePercent: number; // e.g. 15%
  medicalTaxCreditMaxAmount: number; // e.g. Rs 750
  lifeInsuranceMaxDeduction: number; // e.g. Rs 40,000
  citMaxDeductionPercent: number; // e.g. 33.33%
  citMaxDeductionAmount: number; // e.g. Rs 300,000
}

export interface OrganizationSetup {
  name: string; // संस्था / सरकारको तह (e.g. नेपाल सरकार / प्रदेश सरकार)
  ministryName?: string; // मन्त्रालय (e.g. भौतिक पूर्वाधार तथा यातायात मन्त्रालय)
  departmentName?: string; // विभाग (e.g. सडक विभाग / आन्तरिक राजस्व विभाग)
  department?: string; // विभाग / शाखा
  parentBodyName?: string; // विभाग अन्तर्गतको माथिल्लो निकाय (e.g. आयोजना निर्देशनालय / सुपरिवेक्षण कार्यालय)
  officeName: string; // कार्यालयको नाम (e.g. योजना कार्यालय, गोरखा / जिल्ला प्रशासन कार्यालय)
  officeCode?: string; // कार्यालय कोड नं. (e.g. ३२५०१३५०१ / MBP-KNP-01)
  province: string; // प्रदेश
  district: string; // जिल्ला
  localLevel?: string; // स्थानीय तह / पालिका
  address: string; // वडा नं., टोल वा स्थान
  phone?: string; // फोन नं (वैकल्पिक)
  mobile?: string; // मोबाईल नं (वैकल्पिक)
  email: string; // इमेल
  whatsapp?: string; // वाट्सएप (WhatsApp)
  website?: string; // वेभसाइट
  pan?: string; // कार्यालयको प्यान नं (वैकल्पिक)
  panNumber?: string; // कार्यालयको प्यान नं
  registrationNo?: string; // दर्ता नं / कार्यालय कोड नं
  logoUrl?: string; // लोगो
  headerText?: string; // हेडर सन्देश
  footerText?: string; // फुटर सन्देश
  alignment?: 'center' | 'left' | 'right';
  authorizedPersonName?: string; // अधिकृत व्यक्तिको नाम
  authorizedPersonDesignation?: string; // अधिकृत व्यक्तिको पद
  signatureUrl?: string; // हस्ताक्षर
  currentFiscalYear?: string;
}

export interface OrganizationItem extends OrganizationSetup {
  id: string; // Unique Organization ID (e.g. org_default, org_gorkha, etc.)
  code?: string; // कार्यालय कोड
  createdAt: string;
  isActive: boolean;
  webAppUrl?: string;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  driveFolderUrl?: string;
}

export interface OrganizationDataStore {
  organization: OrganizationSetup;
  fiscalYears: string[];
  activeFiscalYear: string;
  fyDatabase: Record<string, FiscalYearData>;
  googleSheetsConfig?: GoogleSheetsConfig;
}

export interface Calculation33Item {
  sn: number;
  code: string;
  title: string;
  amount: number;
  formula: string;
  remarks: string;
  category: 'आय' | 'कट्टी' | 'कर_दायित्व' | 'विवरण' | 'छुट';
}

export interface AnnualTaxCalculationResult {
  employeeId: string;
  fiscalYear: string;
  
  // Grade Breakdown
  gradeAmount: number; // १. ग्रेड रकम = ग्रेड दर × हालको ग्रेड संख्या
  gradePeriodMonths: number; // २. ग्रेड अवधि महिना
  gradeIncreaseAmount: number; // ३. ग्रेड बृद्धि पश्चात रकम
  gradeIncreasePeriodMonths: number; // ४. ग्रेड बृद्धि अवधि महिना
  
  // Income Items
  festivalAllowance: number; // ५. चाडपर्व खर्च (तलब प्राविधिक ग्रेड समेत + ग्रेड रकम)
  dearnessAllowanceAnnual: number; // ६. मंहगी भत्ता रकम (१२ महिना)
  uniformAllowanceAnnual: number; // ७. पोशाक भत्ता रकम
  remoteAllowanceAnnual: number; // ८. दुर्गम भत्ता रकम (१२ महिना)
  incentiveAllowanceAnnual: number; // ९. प्रोत्साहन भत्ता रकम (१२ महिना)
  otherIncomeAnnual: number; // १०. अन्य आय रकम
  
  // EPF Items
  epfOfficeContributionNormal: number; // ११. कर्मचारी संचय कोष थप (कार्यालय)
  epfOfficeContributionPostIncrease: number; // १२. कर्मचारी संचय कोष थप ग्रेड बृद्धि पश्चात
  
  // Pension Items
  pensionOfficeContributionNormal: number; // १३. योगदानमा आधारित निवृत्तिभरण रकम थप (कार्यालय)
  pensionOfficeContributionPostIncrease: number; // १४. योगदानमा आधारित निवृत्तिभरण थप ग्रेड बृद्धि पश्चात
  
  // Totals & Multiplied contributions
  epfTotalContributionNormal: number; // १५. कर्मचारी संचय कोष (थप × २)
  epfTotalContributionPostIncrease: number; // १६. कर्मचारी संचय कोष ग्रेड बृद्धि
  pensionTotalContributionNormal: number; // १७. योगदानमा आधारित निवृत्तिभरण रकम (थप × २)
  pensionTotalContributionPostIncrease: number; // १८. योगदानमा आधारित निवृत्तिभरण ग्रेड बृद्धि
  
  lifeInsuranceFundAnnual: number; // १९. सावधिक जीवन बिमा कोष (रकम × २ × १२)
  citDeductionAnnual: number; // २०. नागरिक लगानी कोष कट्टी रकम
  
  // Totals
  totalAnnualIncome: number; // जम्मा वार्षिक आय रकम (समस्त घटकहरूको योग)
  totalAnnualDeductions: number; // जम्मा वार्षिक कट्टी रकम
  annualTaxableIncome: number; // बार्षिक कर योग्य आय रकम (आय - कट्टी)
  
  // Tax Slab Breakdown
  taxSlabBreakdowns: {
    slabName: string;
    taxableInSlab: number;
    ratePercent: number;
    taxAmount: number;
  }[];
  
  grossTaxLiabilityWithSST: number; // कुल कर दायित्व सा.सु.कर समेत
  
  // Tax Slab Specific Outputs (1% SST vs Remuneration Tax)
  annualSST: number; // वार्षिक सामाजिक सुरक्षा कर (१% स्ल्याब)
  monthlySST: number; // मासिक सामाजिक सुरक्षा कर (१% स्ल्याब / १२)
  annualRemunerationTax: number; // वार्षिक पारिश्रमिक कर (१% बाहेकका स्ल्याबहरूको योग - छुट)
  monthlyRemunerationTax: number; // मासिक पारिश्रमिक कर (वार्षिक पारिश्रमिक कर / १२)
  
  // Tax Reliefs & Rebates
  disabilityTaxRelief: number; // अपाङ्ग व्यक्तिले पाउने छुट
  pensionSSTExemption: number; // योगदानमा आधारित निवृत्तिभरण प्राप्तलाई सा.सु.कर छुट
  femaleTaxRebate: number; // महिला कर्मचारीलाई छुट कर (१०%)
  medicalTaxCredit: number; // औषधी खर्च मिलान रकम
  
  netAnnualTaxLiability: number; // अन्तिम कर दायित्व
  monthlyTaxDeduction: number; // मासिक कर कट्टी
  
  // Detailed 33-point breakdown list for official report
  items33: Calculation33Item[];
}

export interface MonthlySalaryItem {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  designation: string;
  level: string;
  month: NepaliMonth;
  
  // Earnings
  basicSalary: number;
  gradeAmount: number;
  gradeIncreaseAmount: number;
  dearnessAllowance: number;
  uniformAllowance: number; // in month applicable (or 0)
  remoteAllowance: number;
  incentiveAllowance: number;
  festivalAllowance: number; // In Dashain/Festival month
  otherIncome: number;
  grossSalary: number;
  
  // Deductions
  epfEmployee: number;
  pensionEmployee: number;
  citDeduction: number;
  lifeInsuranceDeduction: number;
  loanDeduction: number;
  otherDeduction: number;
  taxDeduction: number;
  totalDeduction: number;
  
  // Net
  netSalary: number;
}

export interface GoogleSheetsConfig {
  webAppUrl: string;
  spreadsheetId: string;
  spreadsheetUrl?: string;
  spreadsheetName?: string;
  connectedAccountEmail?: string;
  authMethod?: 'oauth' | 'apps_script' | 'both';
  syncMode: 'auto' | 'manual';
  autoSync: boolean;
  lastSyncTime?: string;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  errorMessage?: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

export interface SystemSupportContact {
  phone: string; // सम्पर्क नं. (Contact No.)
  email: string; // इमेल (Email)
  whatsapp: string; // वाट्सएप (WhatsApp)
  supportNote?: string; // अतिरिक्त सहायता सन्देश
}

