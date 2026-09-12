import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  X,
  CheckCircle2,
  Filter,
  Users,
  Layers,
  Banknote,
  Scissors,
  Building,
  Calendar,
  Sparkles,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Employee, SalarySetup, DeductionSetup, OrganizationSetup, OrganizationItem } from '../../types';
import { toNepaliDigits, toEnglishDigits, formatNepaliCurrency } from '../../utils/nepaliCalendar';

export type ExportType = 'all_in_one' | 'personal_details' | 'salary_setup' | 'deduction_setup' | 'multi_sheet_workbook';

interface EmployeeExcelExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  allEmployees: Employee[];
  filteredEmployees: Employee[];
  salarySetups: Record<string, SalarySetup>;
  deductionSetups: Record<string, DeductionSetup>;
  activeFiscalYear: string;
  organization?: OrganizationSetup;
  activeOrganization?: OrganizationItem;
}

export const EmployeeExcelExportModal: React.FC<EmployeeExcelExportModalProps> = ({
  isOpen,
  onClose,
  allEmployees,
  filteredEmployees,
  salarySetups,
  deductionSetups,
  activeFiscalYear,
  organization,
  activeOrganization,
}) => {
  const [exportScope, setExportScope] = useState<'all' | 'filtered'>('all');
  const [exportType, setExportType] = useState<ExportType>('multi_sheet_workbook');
  const [numeralFormat, setNumeralFormat] = useState<'english_calc' | 'nepali_devanagari'>('english_calc');
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const targetEmployees = exportScope === 'filtered' ? filteredEmployees : allEmployees;
  const orgName = activeOrganization?.name || organization?.name || 'नेपाल सरकार';
  const orgSubName = activeOrganization?.subTitle || organization?.subTitle || '';
  const orgAddress = activeOrganization?.address || organization?.address || '';

  // Helper to format values according to numeral format preference
  const formatNum = (val: number | undefined | null): number | string => {
    if (val === undefined || val === null || isNaN(val)) return numeralFormat === 'nepali_devanagari' ? '०' : 0;
    if (numeralFormat === 'nepali_devanagari') {
      return toNepaliDigits(Math.round(val));
    }
    return Math.round(val);
  };

  const formatTextNum = (val: string | number | undefined | null): string => {
    if (val === undefined || val === null) return '';
    const str = String(val);
    return numeralFormat === 'nepali_devanagari' ? toNepaliDigits(str) : toEnglishDigits(str);
  };

  // Generate Data for Sheet 1: Master All-In-One
  const generateMasterData = (empList: Employee[]) => {
    return empList.map((emp, index) => {
      const sal = salarySetups[emp.id] || {
        basicSalary: 0,
        technicalGradeAmount: 0,
        gradeRate: 0,
        previousGradeCount: emp.previousGradeCount || 0,
        addedGradeCount: emp.addedGradeCount || 0,
        currentGradeCount: (emp.previousGradeCount || 0) + (emp.addedGradeCount || 0),
        gradeIncreaseCount: 0,
        gradeIncreaseMonth: 'श्रावण',
        salaryMonthsCount: 12,
        lifeInsuranceFund: 400,
        dearnessAllowance: 2000,
        uniformAllowance: 10000,
        uniformAllowanceMonth: 'चैत्र',
        remoteAllowance: 0,
        incentiveAllowance: 0,
        vehicleAllowance: 0,
        communicationAllowance: 0,
        otherMonthlyAllowance: 0,
        festivalBonusMonth: 'असोज',
        festivalBonusCustom: 0,
        otherIncome: 0,
        otherTaxableIncome: 0,
      };

      const ded = deductionSetups[emp.id] || {
        citizenInvestmentTrust: 0,
        investmentInsuranceDeduction: 0,
        healthInsuranceDeduction: 0,
        homeInsuranceDeduction: 0,
        loanDeduction: 0,
        otherDeduction: 0,
        disabilityReliefOverride: 0,
        pensionSSTExemptOverride: 0,
        medicalExpenseActual: 0,
        femaleTaxRebateOverride: 0,
      };

      const totalGrades = sal.currentGradeCount ?? ((sal.previousGradeCount || 0) + (sal.addedGradeCount || 0));
      const monthlyGradeAmount = totalGrades * (sal.gradeRate || 0);
      const basicWithTech = (sal.basicSalary || 0) + (sal.technicalGradeAmount || 0);
      const totalMonthlyBasicScale = basicWithTech + monthlyGradeAmount;

      return {
        'क्र.सं.': formatTextNum(index + 1),
        'संकेत नं.': formatTextNum(emp.code),
        'कर्मचारीको नाम': emp.name,
        'सेवा/समूह': emp.serviceGroup || '-',
        'पद': emp.designation,
        'श्रेणी/तह': emp.level,
        'सेवा प्रकार': emp.serviceType,
        'लिङ्ग': emp.gender,
        'वैवाहिक/कर दाखिला': emp.filingType,
        'अपाङ्गता': emp.disability,
        'दुर्गम क्षेत्र': emp.remoteArea,
        'निवृत्तिभरण': emp.pension,
        'स्थायी लेखा नं (PAN)': formatTextNum(emp.panNumber || '-'),
        'बैंकको नाम': emp.bankName || '-',
        'बैंक खाता नं.': formatTextNum(emp.bankAccount || '-'),
        'शुरु नियुक्ति मिति (वि.सं.)': formatTextNum(emp.joinedDateBS),
        'शुरु नियुक्ति मिति (ई.सं.)': emp.joinedDateAD || '-',
        'हालको पदमा नियुक्ति मिति (वि.सं.)': formatTextNum(emp.currentPostDateBS || '-'),
        'हालको पदमा नियुक्ति मिति (ई.सं.)': emp.currentPostDateAD || '-',
        'सम्पर्क फोन': formatTextNum(emp.phone || '-'),
        'इमेल': emp.email || '-',
        // Salary Setup
        'शुरु तलब स्केल (मासिक)': formatNum(sal.basicSalary),
        'प्राविधिक ग्रेड रकम': formatNum(sal.technicalGradeAmount || 0),
        'ग्रेड दर': formatNum(sal.gradeRate || 0),
        'अघिल्लो असारसम्म ग्रेड': formatNum(sal.previousGradeCount || 0),
        'थप हुने ग्रेड': formatNum(sal.addedGradeCount || 0),
        'जम्मा ग्रेड संख्या': formatNum(totalGrades),
        'मासिक ग्रेड रकम': formatNum(monthlyGradeAmount),
        'जम्मा तलब स्केल (ग्रेड समेत मासिक)': formatNum(totalMonthlyBasicScale),
        'ग्रेड वृद्धि महिना': sal.gradeIncreaseMonth || 'श्रावण',
        'तलब पाउने महिना': formatNum(sal.salaryMonthsCount || 12),
        'सावधिक जीवन बिमा कोष थप (मासिक)': formatNum(sal.lifeInsuranceFund || 400),
        'महङ्गी भत्ता (मासिक)': formatNum(sal.dearnessAllowance || 2000),
        'पोशाक भत्ता (वार्षिक)': formatNum(sal.uniformAllowance || 10000),
        'पोशाक भत्ता भुक्तानी महिना': sal.uniformAllowanceMonth || 'चैत्र',
        'दुर्गम/स्थानीय भत्ता (मासिक)': formatNum(sal.remoteAllowance || 0),
        'प्रोत्साहन/विशेष भत्ता (मासिक)': formatNum(sal.incentiveAllowance || 0),
        'सवारी/इन्धन भत्ता (मासिक)': formatNum(sal.vehicleAllowance || 0),
        'सञ्चार/टेलिफोन भत्ता (मासिक)': formatNum(sal.communicationAllowance || 0),
        'अन्य मासिक भत्ता': formatNum(sal.otherMonthlyAllowance || 0),
        'चाडपर्व खर्च भुक्तानी महिना': sal.festivalBonusMonth || 'असोज',
        'चाडपर्व खर्च रकम': formatNum(sal.festivalBonusCustom || totalMonthlyBasicScale),
        'अन्य अतिरिक्त आय (वार्षिक)': formatNum(sal.otherIncome || 0),
        'अन्य करयोग्य आय': formatNum(sal.otherTaxableIncome || 0),
        // Deductions & Tax Reliefs
        'नागरिक लगानी कोष (मासिक)': formatNum(ded.citizenInvestmentTrust || 0),
        'व्यक्तिगत जीवन बिमा प्रिमियम (वार्षिक)': formatNum(ded.investmentInsuranceDeduction || 0),
        'स्वास्थ्य बिमा प्रिमियम छुट (वार्षिक)': formatNum(ded.healthInsuranceDeduction || 0),
        'निजी घर बिमा प्रिमियम छुट (वार्षिक)': formatNum(ded.homeInsuranceDeduction || 0),
        'सापटी/ऋण कट्टी (मासिक)': formatNum(ded.loanDeduction || 0),
        'अन्य विविध कट्टी (मासिक)': formatNum(ded.otherDeduction || 0),
        'अपाङ्ग कर छुट रकम': formatNum(ded.disabilityReliefOverride || 0),
        'सा.सु.कर छुट रकम': formatNum(ded.pensionSSTExemptOverride || 0),
        'औषधी उपचार कर मिलान रकम': formatNum(ded.medicalExpenseActual || 0),
        'महिला कर्मचारी कर छुट (१०%)': formatNum(ded.femaleTaxRebateOverride || 0),
        'कैफियत': emp.remarks || '',
      };
    });
  };

  // Generate Data for Sheet 2: Employee Personal & Service Details
  const generatePersonalData = (empList: Employee[]) => {
    return empList.map((emp, index) => ({
      'क्र.सं.': formatTextNum(index + 1),
      'कर्मचारी संकेत नं.': formatTextNum(emp.code),
      'कर्मचारीको नाम': emp.name,
      'सेवा/समूह/उपसमूह': emp.serviceGroup || '-',
      'पद': emp.designation,
      'श्रेणी/तह': emp.level,
      'सेवा प्रकार': emp.serviceType,
      'लिङ्ग': emp.gender,
      'पारिवारिक स्थिति/कर दाखिला': emp.filingType,
      'अपाङ्गता': emp.disability,
      'दुर्गम क्षेत्र वर्ग': emp.remoteArea,
      'योगदानमा आधारित निवृत्तिभरण': emp.pension,
      'स्थायी लेखा नम्बर (PAN)': formatTextNum(emp.panNumber || '-'),
      'बैंकको नाम': emp.bankName || '-',
      'बैंक खाता नम्बर': formatTextNum(emp.bankAccount || '-'),
      'शुरु नियुक्ति मिति (वि.सं.)': formatTextNum(emp.joinedDateBS),
      'शुरु नियुक्ति मिति (ई.सं.)': emp.joinedDateAD || '-',
      'हालको पदमा नियुक्ति/बढुवा (वि.सं.)': formatTextNum(emp.currentPostDateBS || '-'),
      'हालको पदमा नियुक्ति/बढुवा (ई.सं.)': emp.currentPostDateAD || '-',
      'सम्पर्क मोबाइल': formatTextNum(emp.phone || '-'),
      'इमेल': emp.email || '-',
      'कैफियत': emp.remarks || '',
    }));
  };

  // Generate Data for Sheet 3: Salary & Allowance Setup
  const generateSalaryData = (empList: Employee[]) => {
    return empList.map((emp, index) => {
      const sal = salarySetups[emp.id] || {
        basicSalary: 0,
        technicalGradeAmount: 0,
        gradeRate: 0,
        previousGradeCount: emp.previousGradeCount || 0,
        addedGradeCount: emp.addedGradeCount || 0,
        currentGradeCount: (emp.previousGradeCount || 0) + (emp.addedGradeCount || 0),
        gradeIncreaseCount: 0,
        gradeIncreaseMonth: 'श्रावण',
        salaryMonthsCount: 12,
        lifeInsuranceFund: 400,
        dearnessAllowance: 2000,
        uniformAllowance: 10000,
        uniformAllowanceMonth: 'चैत्र',
        remoteAllowance: 0,
        incentiveAllowance: 0,
        vehicleAllowance: 0,
        communicationAllowance: 0,
        otherMonthlyAllowance: 0,
        festivalBonusMonth: 'असोज',
        festivalBonusCustom: 0,
        otherIncome: 0,
        otherTaxableIncome: 0,
      };

      const totalGrades = sal.currentGradeCount ?? ((sal.previousGradeCount || 0) + (sal.addedGradeCount || 0));
      const monthlyGradeAmount = totalGrades * (sal.gradeRate || 0);
      const basicWithTech = (sal.basicSalary || 0) + (sal.technicalGradeAmount || 0);
      const totalMonthlyBasicScale = basicWithTech + monthlyGradeAmount;

      return {
        'क्र.सं.': formatTextNum(index + 1),
        'संकेत नं.': formatTextNum(emp.code),
        'कर्मचारीको नाम': emp.name,
        'पद': emp.designation,
        'श्रेणी/तह': emp.level,
        'हालको पदको शुरु तलब स्केल': formatNum(sal.basicSalary),
        'प्राविधिक ग्रेड रकम': formatNum(sal.technicalGradeAmount || 0),
        'ग्रेड दर': formatNum(sal.gradeRate || 0),
        'अघिल्लो असारसम्मको ग्रेड': formatNum(sal.previousGradeCount || 0),
        'चालु आ.व. मा थप ग्रेड': formatNum(sal.addedGradeCount || 0),
        'जम्मा ग्रेड संख्या': formatNum(totalGrades),
        'मासिक ग्रेड रकम': formatNum(monthlyGradeAmount),
        'जम्मा मासिक तलब स्केल': formatNum(totalMonthlyBasicScale),
        'ग्रेड वृद्धि हुने महिना': sal.gradeIncreaseMonth || 'श्रावण',
        'तलब पाउने महिना अवधि': formatNum(sal.salaryMonthsCount || 12),
        'सावधिक जीवन बिमा कोष (मासिक)': formatNum(sal.lifeInsuranceFund || 400),
        'महङ्गी भत्ता (मासिक)': formatNum(sal.dearnessAllowance || 2000),
        'पोशाक भत्ता (वार्षिक)': formatNum(sal.uniformAllowance || 10000),
        'पोशाक भत्ता भुक्तानी महिना': sal.uniformAllowanceMonth || 'चैत्र',
        'स्थानीय / दुर्गम भत्ता (मासिक)': formatNum(sal.remoteAllowance || 0),
        'प्रोत्साहन / विशेष भत्ता (मासिक)': formatNum(sal.incentiveAllowance || 0),
        'सवारी / इन्धन भत्ता (मासिक)': formatNum(sal.vehicleAllowance || 0),
        'सञ्चार / टेलिफोन भत्ता (मासिक)': formatNum(sal.communicationAllowance || 0),
        'अन्य मासिक भत्ता': formatNum(sal.otherMonthlyAllowance || 0),
        'चाडपर्व खर्च भुक्तानी महिना': sal.festivalBonusMonth || 'असोज',
        'चाडपर्व खर्च रकम': formatNum(sal.festivalBonusCustom || totalMonthlyBasicScale),
        'अन्य अतिरिक्त आय (वार्षिक)': formatNum(sal.otherIncome || 0),
        'अन्य करयोग्य आय': formatNum(sal.otherTaxableIncome || 0),
      };
    });
  };

  // Generate Data for Sheet 4: Deduction & Tax Relief Setup
  const generateDeductionData = (empList: Employee[]) => {
    return empList.map((emp, index) => {
      const ded = deductionSetups[emp.id] || {
        citizenInvestmentTrust: 0,
        investmentInsuranceDeduction: 0,
        healthInsuranceDeduction: 0,
        homeInsuranceDeduction: 0,
        loanDeduction: 0,
        otherDeduction: 0,
        disabilityReliefOverride: 0,
        pensionSSTExemptOverride: 0,
        medicalExpenseActual: 0,
        femaleTaxRebateOverride: 0,
      };

      return {
        'क्र.सं.': formatTextNum(index + 1),
        'संकेत नं.': formatTextNum(emp.code),
        'कर्मचारीको नाम': emp.name,
        'पद': emp.designation,
        'सेवा प्रकार': emp.serviceType,
        'पारिवारिक स्थिति': emp.filingType,
        'नागरिक लगानी कोष (मासिक)': formatNum(ded.citizenInvestmentTrust || 0),
        'व्यक्तिगत जीवन बिमा प्रिमियम (वार्षिक)': formatNum(ded.investmentInsuranceDeduction || 0),
        'स्वास्थ्य बिमा प्रिमियम छुट (वार्षिक)': formatNum(ded.healthInsuranceDeduction || 0),
        'निजी घर बिमा प्रिमियम छुट (वार्षिक)': formatNum(ded.homeInsuranceDeduction || 0),
        'सापटी / ऋण कट्टी (मासिक)': formatNum(ded.loanDeduction || 0),
        'अन्य विविध कट्टी (मासिक)': formatNum(ded.otherDeduction || 0),
        'अपाङ्ग व्यक्ति कर छुट रकम': formatNum(ded.disabilityReliefOverride || 0),
        'सा.सु.कर छुट रकम': formatNum(ded.pensionSSTExemptOverride || 0),
        'औषधी उपचार खर्च कर मिलान रकम': formatNum(ded.medicalExpenseActual || 0),
        'महिला कर्मचारी कर छुट रकम (१०%)': formatNum(ded.femaleTaxRebateOverride || 0),
        'कैफियत': emp.remarks || '',
      };
    });
  };

  // Apply column width autofit
  const autoFitColumns = (worksheet: XLSX.WorkSheet, data: any[]) => {
    if (!data || data.length === 0) return;
    const keys = Object.keys(data[0]);
    const colWidths = keys.map((key) => {
      let maxLen = key.length;
      data.forEach((row) => {
        const val = row[key];
        if (val !== undefined && val !== null) {
          const strVal = String(val);
          if (strVal.length > maxLen) {
            maxLen = strVal.length;
          }
        }
      });
      return { wch: Math.min(Math.max(maxLen + 4, 10), 40) };
    });
    worksheet['!cols'] = colWidths;
  };

  const handleExecuteExport = () => {
    try {
      setIsExporting(true);
      const workbook = XLSX.utils.book_new();
      const sanitizedFy = activeFiscalYear.replace(/[\/\\]/g, '_');

      if (exportType === 'all_in_one') {
        const masterData = generateMasterData(targetEmployees);
        const ws = XLSX.utils.json_to_sheet(masterData);
        autoFitColumns(ws, masterData);
        XLSX.utils.book_append_sheet(workbook, ws, 'कर्मचारी_तथा_तलब_मास्टर_विवरण');
        XLSX.writeFile(workbook, `Employees_Master_Salary_Setup_${sanitizedFy}.xlsx`);
      } else if (exportType === 'personal_details') {
        const personalData = generatePersonalData(targetEmployees);
        const ws = XLSX.utils.json_to_sheet(personalData);
        autoFitColumns(ws, personalData);
        XLSX.utils.book_append_sheet(workbook, ws, 'कर्मचारी_व्यक्तिगत_विवरण');
        XLSX.writeFile(workbook, `Employees_Personal_Details_${sanitizedFy}.xlsx`);
      } else if (exportType === 'salary_setup') {
        const salaryData = generateSalaryData(targetEmployees);
        const ws = XLSX.utils.json_to_sheet(salaryData);
        autoFitColumns(ws, salaryData);
        XLSX.utils.book_append_sheet(workbook, ws, 'तलब_तथा_भत्ता_सेटअप');
        XLSX.writeFile(workbook, `Employees_Salary_Allowances_Setup_${sanitizedFy}.xlsx`);
      } else if (exportType === 'deduction_setup') {
        const deductionData = generateDeductionData(targetEmployees);
        const ws = XLSX.utils.json_to_sheet(deductionData);
        autoFitColumns(ws, deductionData);
        XLSX.utils.book_append_sheet(workbook, ws, 'कट्टी_तथा_कर_छुट_सेटअप');
        XLSX.writeFile(workbook, `Employees_Deductions_Tax_Reliefs_${sanitizedFy}.xlsx`);
      } else if (exportType === 'multi_sheet_workbook') {
        // Sheet 1: Master All-In-One
        const masterData = generateMasterData(targetEmployees);
        const wsMaster = XLSX.utils.json_to_sheet(masterData);
        autoFitColumns(wsMaster, masterData);
        XLSX.utils.book_append_sheet(workbook, wsMaster, '१. पूर्ण मास्टर विवरण');

        // Sheet 2: Personal Details
        const personalData = generatePersonalData(targetEmployees);
        const wsPersonal = XLSX.utils.json_to_sheet(personalData);
        autoFitColumns(wsPersonal, personalData);
        XLSX.utils.book_append_sheet(workbook, wsPersonal, '२. कर्मचारी व्यक्तिगत विवरण');

        // Sheet 3: Salary Setup
        const salaryData = generateSalaryData(targetEmployees);
        const wsSalary = XLSX.utils.json_to_sheet(salaryData);
        autoFitColumns(wsSalary, salaryData);
        XLSX.utils.book_append_sheet(workbook, wsSalary, '३. तलब तथा भत्ता सेटअप');

        // Sheet 4: Deductions Setup
        const deductionData = generateDeductionData(targetEmployees);
        const wsDeduction = XLSX.utils.json_to_sheet(deductionData);
        autoFitColumns(wsDeduction, deductionData);
        XLSX.utils.book_append_sheet(workbook, wsDeduction, '४. कट्टी तथा कर छुट');

        XLSX.writeFile(workbook, `Employees_Details_and_Salary_Setup_Comprehensive_${sanitizedFy}.xlsx`);
      }

      setTimeout(() => {
        setIsExporting(false);
        onClose();
      }, 500);
    } catch (err) {
      console.error('Failed to export employee Excel file:', err);
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-[#c8d7c2] w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-[#224b2f] via-[#2d5e3c] to-[#1e442a] text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shadow-inner">
              <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-wide">कर्मचारी विवरण तथा तलब/आय एक्सेल (Excel) मा Export</h3>
              <p className="text-xs text-emerald-100/90 font-light">
                {orgName} | आ.व. {toNepaliDigits(activeFiscalYear)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-[#24331C] text-xs">
          {/* Section 1: Export Scope */}
          <div className="space-y-2.5">
            <label className="font-bold text-[#24331C] flex items-center gap-1.5 text-xs">
              <Users className="w-4 h-4 text-[#4B6043]" />
              <span>१. कुन कर्मचारीहरूको विवरण Export गर्ने?</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setExportScope('all')}
                className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                  exportScope === 'all'
                    ? 'border-[#2d5e3c] bg-[#eef6ec] ring-2 ring-[#2d5e3c]/20 shadow-xs'
                    : 'border-[#d6e3d2] bg-[#fbfdfa] hover:bg-white hover:border-[#b4caa8]'
                }`}
              >
                <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center ${exportScope === 'all' ? 'border-[#2d5e3c] bg-[#2d5e3c] text-white' : 'border-gray-400'}`}>
                  {exportScope === 'all' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="font-bold text-sm text-[#24331C] flex flex-col leading-tight">
                    <span>सबै कर्मचारीहरू</span>
                    <span className="text-[11px] font-normal opacity-85">(All Employees)</span>
                  </div>
                  <div className="text-[11px] text-[#556e4e] mt-1">
                    कुल <strong>{toNepaliDigits(allEmployees.length)}</strong> जना कर्मचारीहरूको सम्पूर्ण रेकर्ड
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setExportScope('filtered')}
                disabled={filteredEmployees.length === 0}
                className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                  exportScope === 'filtered'
                    ? 'border-[#2d5e3c] bg-[#eef6ec] ring-2 ring-[#2d5e3c]/20 shadow-xs'
                    : 'border-[#d6e3d2] bg-[#fbfdfa] hover:bg-white hover:border-[#b4caa8]'
                } ${filteredEmployees.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center ${exportScope === 'filtered' ? 'border-[#2d5e3c] bg-[#2d5e3c] text-white' : 'border-gray-400'}`}>
                  {exportScope === 'filtered' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="font-bold text-sm text-[#24331C] flex flex-col leading-tight">
                    <span>हाल फिल्टर/खोज गरिएका</span>
                    <span className="text-[11px] font-normal opacity-85">(Filtered)</span>
                  </div>
                  <div className="text-[11px] text-[#556e4e] mt-1">
                    छानिएका <strong>{toNepaliDigits(filteredEmployees.length)}</strong> जना कर्मचारीहरू
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Section 2: Choose Export Type / Structure */}
          <div className="space-y-2.5">
            <label className="font-bold text-[#24331C] flex items-center gap-1.5 text-xs">
              <Layers className="w-4 h-4 text-[#4B6043]" />
              <span>२. Excel फाइलको ढाँचा / सिट रोज्नुहोस् (Excel File Layout)</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Option: Multi-Sheet Comprehensive Workbook */}
              <div
                onClick={() => setExportType('multi_sheet_workbook')}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer sm:col-span-2 ${
                  exportType === 'multi_sheet_workbook'
                    ? 'border-[#2d5e3c] bg-[#edf6eb] ring-2 ring-[#2d5e3c]/20 shadow-xs'
                    : 'border-[#d6e3d2] bg-[#fbfdfa] hover:bg-white hover:border-[#b4caa8]'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center ${exportType === 'multi_sheet_workbook' ? 'border-[#2d5e3c] bg-[#2d5e3c] text-white' : 'border-gray-400'}`}>
                    {exportType === 'multi_sheet_workbook' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-[#24331C] flex items-center gap-1.5">
                      <span>सबै सिटहरू सहितको कम्प्रिहेन्सिभ वर्कबुक (४ वटा सिटहरू)</span>
                      <span className="px-2 py-0.5 rounded-md bg-[#2d5e3c] text-white text-[10px] font-bold">सिफारिस गरिएको</span>
                    </div>
                    <p className="text-[11px] text-[#556e4e] mt-1">
                      मास्टर विवरण, व्यक्तिगत विवरण, तलब-ग्रेड-भत्ता सेटअप तथा कट्टी-छुट सेटअपलाई छुट्टाछुट्टै ४ वटा ट्याबमा समावेश गर्दछ।
                    </p>
                  </div>
                </div>
              </div>

              {/* Option: All-in-One Master Sheet */}
              <div
                onClick={() => setExportType('all_in_one')}
                className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                  exportType === 'all_in_one'
                    ? 'border-[#2d5e3c] bg-[#edf6eb] ring-2 ring-[#2d5e3c]/20 shadow-xs'
                    : 'border-[#d6e3d2] bg-[#fbfdfa] hover:bg-white hover:border-[#b4caa8]'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center ${exportType === 'all_in_one' ? 'border-[#2d5e3c] bg-[#2d5e3c] text-white' : 'border-gray-400'}`}>
                    {exportType === 'all_in_one' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <div className="font-bold text-[#24331C]">१. पूर्ण मास्टर सिट (Master All-In-One)</div>
                    <p className="text-[11px] text-[#556e4e] mt-0.5">कर्मचारी विवरण, तलब, भत्ता र कट्टी सबै एउटै सिटमा</p>
                  </div>
                </div>
              </div>

              {/* Option: Personal Details Only */}
              <div
                onClick={() => setExportType('personal_details')}
                className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                  exportType === 'personal_details'
                    ? 'border-[#2d5e3c] bg-[#edf6eb] ring-2 ring-[#2d5e3c]/20 shadow-xs'
                    : 'border-[#d6e3d2] bg-[#fbfdfa] hover:bg-white hover:border-[#b4caa8]'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center ${exportType === 'personal_details' ? 'border-[#2d5e3c] bg-[#2d5e3c] text-white' : 'border-gray-400'}`}>
                    {exportType === 'personal_details' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <div className="font-bold text-[#24331C]">२. कर्मचारी व्यक्तिगत विवरण मात्र</div>
                    <p className="text-[11px] text-[#556e4e] mt-0.5">संकेत नं, पद, सेवा, बैंक, PAN, मिति, सम्पर्क आदि</p>
                  </div>
                </div>
              </div>

              {/* Option: Salary Setup Only */}
              <div
                onClick={() => setExportType('salary_setup')}
                className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                  exportType === 'salary_setup'
                    ? 'border-[#2d5e3c] bg-[#edf6eb] ring-2 ring-[#2d5e3c]/20 shadow-xs'
                    : 'border-[#d6e3d2] bg-[#fbfdfa] hover:bg-white hover:border-[#b4caa8]'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center ${exportType === 'salary_setup' ? 'border-[#2d5e3c] bg-[#2d5e3c] text-white' : 'border-gray-400'}`}>
                    {exportType === 'salary_setup' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <div className="font-bold text-[#24331C]">३. तलब, ग्रेड र भत्ता विवरण मात्र</div>
                    <p className="text-[11px] text-[#556e4e] mt-0.5">शुरु स्केल, ग्रेड, महङ्गी, पोशाक, चाडपर्व र अन्य आय</p>
                  </div>
                </div>
              </div>

              {/* Option: Deductions Setup Only */}
              <div
                onClick={() => setExportType('deduction_setup')}
                className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                  exportType === 'deduction_setup'
                    ? 'border-[#2d5e3c] bg-[#edf6eb] ring-2 ring-[#2d5e3c]/20 shadow-xs'
                    : 'border-[#d6e3d2] bg-[#fbfdfa] hover:bg-white hover:border-[#b4caa8]'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center ${exportType === 'deduction_setup' ? 'border-[#2d5e3c] bg-[#2d5e3c] text-white' : 'border-gray-400'}`}>
                    {exportType === 'deduction_setup' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <div className="font-bold text-[#24331C]">४. कट्टी तथा कर छुट विवरण मात्र</div>
                    <p className="text-[11px] text-[#556e4e] mt-0.5">CIT, बिमा प्रिमियम, सापटी, सा.सु.कर, औषधी छुट आदि</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Numeral Type (Formula-friendly numeric vs Devanagari numerals) */}
          <div className="space-y-2 pt-2 border-t border-[#eaf1e6]">
            <label className="font-bold text-[#24331C] text-xs">३. अंक ढाँचा (Number Format)</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-[#d6e3d2] bg-[#fbfdfa] cursor-pointer hover:bg-white">
                <input
                  type="radio"
                  name="numeralFormat"
                  checked={numeralFormat === 'english_calc'}
                  onChange={() => setNumeralFormat('english_calc')}
                  className="text-[#2d5e3c] focus:ring-[#2d5e3c]"
                />
                <div>
                  <span className="font-bold text-[#24331C] block">गणितीय/अन्तर्राष्ट्रिय अंक (35000, 2081)</span>
                  <span className="text-[11px] text-gray-500 block">Excel मा =SUM(), औसत आदि सुत्रहरू सिधै चल्नेछ</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-[#d6e3d2] bg-[#fbfdfa] cursor-pointer hover:bg-white">
                <input
                  type="radio"
                  name="numeralFormat"
                  checked={numeralFormat === 'nepali_devanagari'}
                  onChange={() => setNumeralFormat('nepali_devanagari')}
                  className="text-[#2d5e3c] focus:ring-[#2d5e3c]"
                />
                <div>
                  <span className="font-bold text-[#24331C] block">नेपाली देवनागरी अंक (३५०००, २०८१)</span>
                  <span className="text-[11px] text-gray-500 block">नेपाली युनिकोड आधिकारिक प्रतिवेदन स्वरूप</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#f8faf6] border-t border-[#d6e3d2] flex items-center justify-between gap-3">
          <div className="text-xs text-[#526a48] font-medium hidden sm:block">
            फाइल नाम: <span className="font-mono text-[#24331C]">Employees_Salary_Setup_{activeFiscalYear.replace(/[\/\\]/g, '_')}.xlsx</span>
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#c8d7c2] bg-white text-[#24331C] font-semibold hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <span className="flex flex-col items-center leading-tight">
                <span>रद्द गर्नुहोस्</span>
                <span className="text-[10px] font-normal text-gray-500">(Cancel)</span>
              </span>
            </button>

            <button
              type="button"
              onClick={handleExecuteExport}
              disabled={isExporting || targetEmployees.length === 0}
              className="px-5 py-2 rounded-xl bg-[#234e2c] hover:bg-[#1a3c22] text-white font-bold transition-all shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4 text-emerald-300 shrink-0" />
              <span className="flex flex-col text-left leading-tight">
                <span>{isExporting ? 'Export हुँदैछ...' : 'Excel डाउनलोड गर्नुहोस्'}</span>
                {!isExporting && <span className="text-[10px] font-normal opacity-90">(Download Excel)</span>}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
