import React, { useMemo, useRef } from 'react';
import {
  Printer,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  FileSpreadsheet,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';
import { Letterhead } from '../common/Letterhead';
import { formatNepaliCurrency, toNepaliDigits } from '../../utils/nepaliCalendar';
import { round2, getNepaliMonthIndex } from '../../utils/calculationEngine';
import { SalarySetup, DeductionSetup, AnnualTaxCalculationResult } from '../../types';

interface EmployeeTaxAssessmentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  onSelectEmployeeId: (id: string) => void;
}

export const EmployeeTaxAssessmentReportModal: React.FC<EmployeeTaxAssessmentReportModalProps> = ({
  isOpen,
  onClose,
  employeeId,
  onSelectEmployeeId,
}) => {
  const {
    employees,
    salarySetups,
    deductionSetups,
    taxReferences,
    annualTaxResults,
    activeFiscalYear,
    useDevanagariNumerals,
    organization,
  } = useApp();

  const printRef = useRef<HTMLDivElement>(null);

  const employee = useMemo(() => {
    return employees.find((e) => e.id === employeeId) || employees[0];
  }, [employees, employeeId]);

  const currentIndex = employees.findIndex((e) => e.id === (employee?.id || employeeId));

  const handlePrev = () => {
    if (currentIndex > 0) {
      onSelectEmployeeId(employees[currentIndex - 1].id);
    } else if (employees.length > 0) {
      onSelectEmployeeId(employees[employees.length - 1].id);
    }
  };

  const handleNext = () => {
    if (currentIndex < employees.length - 1) {
      onSelectEmployeeId(employees[currentIndex + 1].id);
    } else if (employees.length > 0) {
      onSelectEmployeeId(employees[0].id);
    }
  };

  if (!isOpen || !employee) return null;

  const empId = employee.id;
  const activeTaxRef =
    taxReferences.find((t) => t.fiscalYear === activeFiscalYear && t.filingType === employee.filingType) ||
    taxReferences.find((t) => t.filingType === employee.filingType) ||
    taxReferences[0];

  const defaultSal: SalarySetup = {
    id: `sal_${empId}`,
    employeeId: empId,
    basicSalary: 30000,
    technicalGradeAmount: 0,
    salaryMonthsCount: 12,
    gradeRate: 1000,
    currentGradeCount: 1,
    previousGradeCount: 1,
    addedGradeCount: 0,
    gradeIncreaseCount: 0,
    gradeIncreaseMonth: 'श्रावण',
    festivalBonusMonth: 'असोज',
    festivalBonusCustom: 0,
    lifeInsuranceFund: 400,
    dearnessAllowance: 2000,
    uniformAllowance: 10000,
    remoteAllowance: 0,
    incentiveAllowance: 0,
    otherIncome: 0,
    updatedAt: new Date().toISOString(),
  };
  const sal: SalarySetup = salarySetups[empId] || defaultSal;

  const defaultDed: DeductionSetup = {
    id: `ded_${empId}`,
    employeeId: empId,
    loanDeduction: 0,
    citizenInvestmentTrust: 0,
    investmentInsuranceDeduction: 0,
    otherDeduction: 0,
    updatedAt: new Date().toISOString(),
  };
  const ded: DeductionSetup = deductionSetups[empId] || defaultDed;

  const res: AnnualTaxCalculationResult | undefined = annualTaxResults[empId];

  // Grade and Salary period math
  const prevGradeCount = sal.previousGradeCount !== undefined
    ? sal.previousGradeCount
    : Math.max(0, sal.currentGradeCount - (sal.gradeIncreaseCount || 0));
  const incGradeCount = sal.gradeIncreaseCount || 0;
  const hasIncrement = incGradeCount > 0;

  const incMonthIdx = getNepaliMonthIndex(sal.gradeIncreaseMonth);
  const gradePeriodMonths = hasIncrement
    ? (incMonthIdx === -1 ? 12 : incMonthIdx)
    : 12;
  const gradeIncreasePeriodMonths = hasIncrement ? (12 - gradePeriodMonths) : 0;

  const basicSalaryWithTech = sal.basicSalary + (sal.technicalGradeAmount || employee.technicalGradeAmount || 0);
  const gradeMonthlyBefore = sal.gradeRate * prevGradeCount;
  const gradeMonthlyAfter = sal.gradeRate * (prevGradeCount + incGradeCount);

  // Festival Allowance (चाडपर्व खर्च)
  // यदि कर्मचारीको ग्रेड बृद्धि - चाडपर्व खर्च पाउने महिना (असोज) मा हुन्छ भने:
  // क्र.स. १ को तलब (प्राविधिक ग्रेड समेत) र क्र.स.. ३ ग्रेड बृद्धि रकमको योग (जोड)
  // अन्यथा:
  // क्र.स. १ को तलब (प्राविधिक ग्रेड समेत) र क्र.सं. २ ग्रेड रकमको योग (जोड)
  const festMonth = (sal.festivalBonusMonth || employee.festivalBonusMonth || 'असोज').replace(' महिनामा भुक्तानी', '').trim();
  const festMonthIdx = getNepaliMonthIndex(festMonth);
  const isFestPostIncrease = hasIncrement && incMonthIdx !== -1 && festMonthIdx !== -1 && incMonthIdx <= festMonthIdx;
  
  const festivalMonthlyRate = isFestPostIncrease
    ? round2(basicSalaryWithTech + gradeMonthlyAfter)
    : round2(basicSalaryWithTech + gradeMonthlyBefore);

  const festivalAllowance = festivalMonthlyRate;

  // Office contributions (आय तर्फ)
  const monthlySalaryWithCurrentGrade = basicSalaryWithTech + gradeMonthlyBefore;
  const gradeIncreaseAmountMonthly = basicSalaryWithTech + gradeMonthlyAfter;
  const isContract = employee.serviceType === 'करार';
  const epfOfficeContributionNormal = isContract ? 0 : round2(monthlySalaryWithCurrentGrade * 0.10);
  const epfOfficeContributionPostIncrease = isContract || gradeIncreasePeriodMonths === 0
    ? 0
    : round2(gradeIncreaseAmountMonthly * 0.10);

  const hasPension = employee.pension === 'भएको';
  const pensionOfficeContributionNormal = !hasPension ? 0 : round2(monthlySalaryWithCurrentGrade * 0.06);
  const pensionOfficeContributionPostIncrease = !hasPension || gradeIncreasePeriodMonths === 0
    ? 0
    : round2(gradeIncreaseAmountMonthly * 0.06);

  // Total Deductions (कट्टी तर्फ)
  const epfTotalContributionNormal = epfOfficeContributionNormal * 2;
  const epfTotalContributionPostIncrease = epfOfficeContributionPostIncrease * 2;
  const pensionTotalContributionNormal = pensionOfficeContributionNormal * 2;
  const pensionTotalContributionPostIncrease = pensionOfficeContributionPostIncrease * 2;

  const lifeInsurancePaidAnnual = round2(sal.lifeInsuranceFund * 2 * 12);
  const citDeductionAnnual = round2(ded.citizenInvestmentTrust * 12);

  // Other Annual Deductions
  const lifeInsuranceRelief = Math.min(
    ded.investmentInsuranceDeduction || 0,
    activeTaxRef?.lifeInsuranceMaxDeduction || 40000
  );
  const remoteRelief = ded.remoteTaxReliefOverride !== undefined
    ? ded.remoteTaxReliefOverride
    : (activeTaxRef?.remoteExemptions?.[employee.remoteArea] || 0);
  const otherDeductionsAnnual = round2((ded.otherDeduction || 0) * 12 + (ded.loanDeduction || 0) * 12);

  // कुल जम्मा आय रकम (Sum of rows 1 to 13 of Table 1)
  const totalTableIncome = round2(
    (basicSalaryWithTech * 12) +
    (gradeMonthlyBefore * gradePeriodMonths) +
    (hasIncrement ? gradeMonthlyAfter * gradeIncreasePeriodMonths : 0) +
    festivalAllowance +
    (sal.lifeInsuranceFund * 12) +
    (sal.dearnessAllowance * 12) +
    sal.uniformAllowance +
    (epfOfficeContributionNormal * gradePeriodMonths) +
    (hasIncrement ? epfOfficeContributionPostIncrease * gradeIncreasePeriodMonths : 0) +
    (pensionOfficeContributionNormal * gradePeriodMonths) +
    (hasIncrement ? pensionOfficeContributionPostIncrease * gradeIncreasePeriodMonths : 0) +
    ((sal.remoteAllowance || 0) * 12) +
    ((sal.incentiveAllowance || 0) * 12)
  );

  // जम्मा कट्टी रकम (Sum of rows 1 to 9 of Table 2)
  const totalTableDeductions = round2(
    (epfTotalContributionNormal * gradePeriodMonths) +
    (hasIncrement ? epfTotalContributionPostIncrease * gradeIncreasePeriodMonths : 0) +
    (pensionTotalContributionNormal * gradePeriodMonths) +
    (hasIncrement ? pensionTotalContributionPostIncrease * gradeIncreasePeriodMonths : 0) +
    lifeInsurancePaidAnnual +
    citDeductionAnnual +
    lifeInsuranceRelief +
    remoteRelief +
    otherDeductionsAnnual
  );

  // कर योग्य आय रकम
  const tableTaxableIncome = round2(Math.max(0, totalTableIncome - totalTableDeductions));

  // Progressive Tax Slabs Breakdown based on tableTaxableIncome
  const isCouple = employee.filingType === 'दम्पत्ती';
  const defaultSlabCapacities = isCouple
    ? [600000, 200000, 300000, 900000, 3000000, Infinity]
    : [500000, 200000, 300000, 1000000, 3000000, Infinity];

  const rawSlabs = (activeTaxRef?.slabs && activeTaxRef.slabs.length > 0)
    ? [...activeTaxRef.slabs]
    : [
        { fromAmount: 0, toAmount: isCouple ? 600000 : 500000, ratePercent: 1, description: '१% सा.सु.कर' },
        { fromAmount: isCouple ? 600000 : 500000, toAmount: isCouple ? 800000 : 700000, ratePercent: 10, description: '१०%' },
        { fromAmount: isCouple ? 800000 : 700000, toAmount: isCouple ? 1100000 : 1000000, ratePercent: 20, description: '२०%' },
        { fromAmount: isCouple ? 1100000 : 1000000, toAmount: 2000000, ratePercent: 30, description: '३०%' },
        { fromAmount: 2000000, toAmount: 5000000, ratePercent: 36, description: '३६%' },
        { fromAmount: 5000000, toAmount: Infinity, ratePercent: 39, description: '३९%' },
      ];

  let remainingTaxable = tableTaxableIncome;
  let sstTax = 0;
  let slab10Tax = 0;
  let slab20Tax = 0;
  let slabHigh1Tax = 0;
  let slabHigh2Tax = 0;
  let slabHigh1Rate = 30;
  let slabHigh2Rate = 36;

  for (let i = 0; i < rawSlabs.length; i++) {
    const slab = rawSlabs[i];
    const toAmt = Number(slab.toAmount);
    const fromAmt = Number(slab.fromAmount);
    const rate = Number(slab.ratePercent) || 0;
    const defaultCap = defaultSlabCapacities[i] ?? Infinity;
    let slabCapacity = 0;

    if (i === 0) {
      slabCapacity = toAmt > 0 ? toAmt : (fromAmt > 0 ? fromAmt : defaultCap);
    } else if (i === rawSlabs.length - 1) {
      if (toAmt <= fromAmt || toAmt >= 999999990 || slab.toAmount === Infinity || !toAmt) {
        slabCapacity = Infinity;
      } else {
        slabCapacity = Math.max(0, toAmt - fromAmt);
      }
    } else {
      if (toAmt > fromAmt) {
        slabCapacity = toAmt - fromAmt;
      } else {
        slabCapacity = defaultCap;
      }
    }

    if (slabCapacity <= 0) {
      slabCapacity = defaultCap;
    }

    if (i === 3) slabHigh1Rate = rate || 30;
    if (i >= 4) slabHigh2Rate = rate || 36;

    if (remainingTaxable <= 0) continue;

    const taxableInThisSlab = slabCapacity === Infinity
      ? remainingTaxable
      : Math.min(remainingTaxable, slabCapacity);
    const taxInThisSlab = round2(taxableInThisSlab * (rate / 100));

    if (i === 0) {
      sstTax = taxInThisSlab;
    } else if (i === 1) {
      slab10Tax = taxInThisSlab;
    } else if (i === 2) {
      slab20Tax = taxInThisSlab;
    } else if (i === 3) {
      slabHigh1Tax = taxInThisSlab;
      slabHigh1Rate = rate;
    } else if (i >= 4) {
      slabHigh2Tax = round2(slabHigh2Tax + taxInThisSlab);
      slabHigh2Rate = rate;
    }

    if (slabCapacity !== Infinity) {
      remainingTaxable = round2(remainingTaxable - taxableInThisSlab);
    } else {
      remainingTaxable = 0;
    }
  }

  // जम्मा वार्षिक कर दायित्व रकम (Sum of rows 1 to 5 of Table 3)
  const totalGrossTax = round2(sstTax + slab10Tax + slab20Tax + slabHigh1Tax + slabHigh2Tax);

  // निवृत्तिभरण छुट नियम:
  // १. यदि कर्मचारीको योगदानमा आधारित निवृत्तिभरण "भएको" छ भने १% सा.सु.कर छुट हुने (कट्टी नहुने)
  // २. तर यदि कर्मचारीको संचय कोष (EPF) कट्टी भएको र निवृत्तिभरण कोष कट्टी नभएको अवस्था छ (वा निवृत्तिभरण "नभएको") भने १% सा.सु.कर कट्टी हुने (छुट नहुने)
  const hasContributoryPension =
    employee.pension === 'भएको' &&
    !(
      (epfTotalContributionNormal > 0 || epfOfficeContributionNormal > 0) &&
      pensionTotalContributionNormal === 0 &&
      pensionOfficeContributionNormal === 0
    );

  // Exemptions
  // १. अपाङ्ग व्यक्तिले पाउने छुट रकम (वार्षिक)
  let disabilityTaxRelief = 0;
  if (ded.disabilityReliefOverride !== undefined && Number(ded.disabilityReliefOverride) > 0) {
    disabilityTaxRelief = round2(Number(ded.disabilityReliefOverride));
  } else if (employee.disability === 'अपाङ्ग भएको') {
    const firstSlabTax = sstTax || 0;
    const disPct = (activeTaxRef?.disabilityExemptionPercent ?? 50) / 100;
    disabilityTaxRelief = round2(firstSlabTax * disPct);
  } else if (res?.disabilityTaxRelief) {
    disabilityTaxRelief = res.disabilityTaxRelief;
  }

  // २. योगदानमा आधारित निवृत्तिभरण कोष प्राप्त कर्मचारीलाई सा.सु.कर छुट रकम (वार्षिक)
  const pensionSSTExemption = hasContributoryPension ? sstTax : 0;

  // ३. औषधी उपचार खर्च मिलान (वार्षिक)
  let medicalTaxCredit = 0;
  if (ded.medicalExpenseActual !== undefined && Number(ded.medicalExpenseActual) > 0) {
    const medRate = (activeTaxRef?.medicalTaxCreditRatePercent ?? 15) / 100;
    const medCeiling = ded.medicalTaxCreditCeilingLimit !== undefined && Number(ded.medicalTaxCreditCeilingLimit) > 0
      ? Number(ded.medicalTaxCreditCeilingLimit)
      : (activeTaxRef?.medicalTaxCreditMaxAmount ?? 750);
    medicalTaxCredit = round2(Math.min(Number(ded.medicalExpenseActual) * medRate, medCeiling));
  } else if (res?.medicalTaxCredit) {
    medicalTaxCredit = res.medicalTaxCredit;
  }

  // Numbers formatter - without 'रु.' symbol
  const formatMoney = (val: number | undefined | null) => {
    if (val === undefined || val === null) return '-';
    if (val === 0) return useDevanagariNumerals ? '०.००' : '0.00';
    return formatNepaliCurrency(val, { useDevanagari: useDevanagariNumerals, showSymbol: false });
  };

  const formatDigits = (val: number | string) => {
    return useDevanagariNumerals ? toNepaliDigits(val) : String(val);
  };

  // ४. वार्षिक करको १०% छुट (महिला कर्मचारीको लागि मात्र) रकम (वार्षिक)
  const singleTaxRef = taxReferences.find((t) => t.fiscalYear === activeFiscalYear && t.filingType === 'एकल') || taxReferences.find((t) => t.filingType === 'एकल');
  const femaleRebateRate = (activeTaxRef?.femaleTaxRebatePercent !== undefined && Number(activeTaxRef.femaleTaxRebatePercent) > 0)
    ? Number(activeTaxRef.femaleTaxRebatePercent)
    : (singleTaxRef?.femaleTaxRebatePercent !== undefined && Number(singleTaxRef.femaleTaxRebatePercent) > 0
        ? Number(singleTaxRef.femaleTaxRebatePercent)
        : 10);

  const isFemale = employee.gender
    ? (employee.gender.trim() === 'महिला' ||
       employee.gender.includes('महिला') ||
       employee.gender.trim().toLowerCase() === 'female' ||
       employee.gender.trim().toLowerCase() === 'f')
    : false;

  let femaleTaxRebate = 0;
  if (ded.femaleTaxRebateOverride !== undefined && Number(ded.femaleTaxRebateOverride) > 0) {
    femaleTaxRebate = round2(Number(ded.femaleTaxRebateOverride));
  } else if (isFemale && totalGrossTax > 0) {
    femaleTaxRebate = round2(totalGrossTax * (femaleRebateRate / 100));
  } else if (res?.femaleTaxRebate) {
    femaleTaxRebate = res.femaleTaxRebate;
  }

  const femaleRebateLabel = `वार्षिक करको ${formatDigits(femaleRebateRate)}% छुट (महिला कर्मचारीको लागि मात्र) रकम`;

  const totalRebates = round2(disabilityTaxRelief + pensionSSTExemption + medicalTaxCredit + femaleTaxRebate);

  // वार्षिक कुल जम्मा कर कट्टी रकम
  const netTax = Math.max(0, round2(totalGrossTax - totalRebates));
  // मासिक कुल जम्मा कर कट्टी रकम
  const monthlyTax = round2(netTax / 12);

  // Monthly breakdown per slab
  // प्रयोगकर्ताको सूत्र: (१% ले हुने वार्षिक कर रकम - अपाङ्ग व्यक्तिले पाउने छुट रकम - योगदानमा आधारित निवृत्तिभरण कोष प्राप्त कर्मचारीलाई सा.सु.कर छुट रकम - औषधी उपचार खर्च मिलान - वार्षिक करको १०% छुट (महिला कर्मचारीको लागि मात्र) रकम) / 12
  const sstNetAnnual = Math.max(
    0,
    round2(sstTax - disabilityTaxRelief - pensionSSTExemption - medicalTaxCredit - femaleTaxRebate)
  );
  const monthlySst = round2(sstNetAnnual / 12);
  const monthlySlab10 = round2(slab10Tax / 12);
  const monthlySlab20 = round2(slab20Tax / 12);
  const monthlySlabHigh1 = round2(slabHigh1Tax / 12);
  const monthlySlabHigh2 = round2(slabHigh2Tax / 12);

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    const rows = [
      ['पारिश्रमिक आयकर निर्धारण विवरण'],
      [`आर्थिक वर्ष: ${activeFiscalYear}`, `क.सं.नं.: ${employee.code}`],
      [`नाम,थर: ${employee.name}`, `दम्पत्ती/एकल: ${employee.filingType}`],
      [`पद: ${employee.designation}`, `लिंग: ${employee.gender}`],
      [`श्रेणी/तह: ${employee.level}`, `पान नं.: ${employee.panNumber || '-'}`],
      [],
      ['क्र.सं.', 'विवरण', 'मासिक दर', 'अवधि (महिना)', 'जम्मा'],
      ['', 'आय रकम', '', '', ''],
      [1, 'तलब (प्राविधिक ग्रेड समेत)', basicSalaryWithTech, 12, basicSalaryWithTech * 12],
      [2, 'ग्रेड', gradeMonthlyBefore, gradePeriodMonths, gradeMonthlyBefore * gradePeriodMonths],
      [3, 'ग्रेड वृद्धि', hasIncrement ? gradeMonthlyAfter : 0, gradeIncreasePeriodMonths, hasIncrement ? gradeMonthlyAfter * gradeIncreasePeriodMonths : 0],
      [4, 'चाडपर्व खर्च', festivalAllowance, 1, festivalAllowance],
      [5, 'सावधिक जीवन बिमा कोष', sal.lifeInsuranceFund, 12, sal.lifeInsuranceFund * 12],
      [6, 'महंगी भत्ता', sal.dearnessAllowance, 12, sal.dearnessAllowance * 12],
      [7, 'पोशाक भत्ता', sal.uniformAllowance, 1, sal.uniformAllowance],
      [8, 'कर्मचारी संचयकोष थप', epfOfficeContributionNormal, gradePeriodMonths, epfOfficeContributionNormal * gradePeriodMonths],
      [9, 'कर्मचारी संचयकोष थप (ग्रेड वृद्धि)', epfOfficeContributionPostIncrease, gradeIncreasePeriodMonths, epfOfficeContributionPostIncrease * gradeIncreasePeriodMonths],
      [10, 'योगदानमा आधारित निवृत्तिभरण कोष थप', pensionOfficeContributionNormal, gradePeriodMonths, pensionOfficeContributionNormal * gradePeriodMonths],
      [11, 'योगदानमा आधारित निवृत्तिभरण कोष थप (ग्रेड वृद्धि)', pensionOfficeContributionPostIncrease, gradeIncreasePeriodMonths, pensionOfficeContributionPostIncrease * gradeIncreasePeriodMonths],
      [12, 'दुर्गम भत्ता', sal.remoteAllowance || 0, 12, (sal.remoteAllowance || 0) * 12],
      [13, 'अन्य (प्रोत्साहन भत्ता)', sal.incentiveAllowance || 0, 12, (sal.incentiveAllowance || 0) * 12],
      ['', 'कुल जम्मा आय रकम', '', '', totalTableIncome],
      [],
      ['', 'कट्टी रकम', '', '', ''],
      [1, 'कर्मचारी संचयकोष', epfTotalContributionNormal, gradePeriodMonths, epfTotalContributionNormal * gradePeriodMonths],
      [2, 'कर्मचारी संचयकोष (ग्रेड वृद्धि)', epfTotalContributionPostIncrease, gradeIncreasePeriodMonths, epfTotalContributionPostIncrease * gradeIncreasePeriodMonths],
      [3, 'योगदानमा आधारित निवृत्तिभरण कोष', pensionTotalContributionNormal, gradePeriodMonths, pensionTotalContributionNormal * gradePeriodMonths],
      [4, 'योगदानमा आधारित निवृत्तिभरण कोष (ग्रेड वृद्धि)', pensionTotalContributionPostIncrease, gradeIncreasePeriodMonths, pensionTotalContributionPostIncrease * gradeIncreasePeriodMonths],
      [5, 'सावधिक जीवन बिमा कोष', sal.lifeInsuranceFund * 2, 12, lifeInsurancePaidAnnual],
      [6, 'नागरिक लगानी कोष', ded.citizenInvestmentTrust, 12, citDeductionAnnual],
      [7, 'लगानी बिमा रकम', '', 'वार्षिक', lifeInsuranceRelief],
      [8, 'दुर्गम भत्ता छुट रकम', '', 'वार्षिक', remoteRelief],
      [9, 'अन्य', '', 'वार्षिक', otherDeductionsAnnual],
      ['', 'जम्मा कट्टी रकम', '', '', totalTableDeductions],
      ['', 'कर योग्य आय रकम', '', '', tableTaxableIncome],
      [],
      ['क्र.सं.', 'कर विवरण', '', 'अवधि', 'जम्मा'],
      [1, '१% ले हुने वार्षिक कर रकम', '', 'वार्षिक', sstTax],
      [2, '१०% ले हुने वार्षिक कर रकम', '', 'वार्षिक', slab10Tax],
      [3, '२०% ले हुने वार्षिक कर रकम', '', 'वार्षिक', slab20Tax],
      [4, `${slabHigh1Rate}% ले हुने वार्षिक कर रकम`, '', 'वार्षिक', slabHigh1Tax],
      [5, `${slabHigh2Rate}% ले हुने वार्षिक कर रकम`, '', 'वार्षिक', slabHigh2Tax],
      ['', 'जम्मा वार्षिक कर दायित्व रकम', '', '', totalGrossTax],
      [],
      ['', 'छुट रकम', '', '', ''],
      [1, 'अपाङ्ग व्यक्तिले पाउने छुट रकम', '', 'वार्षिक', disabilityTaxRelief],
      [2, 'योगदानमा आधारित निवृत्तिभरण कोष प्राप्त कर्मचारीलाई सा.सु.कर छुट रकम', '', 'वार्षिक', pensionSSTExemption],
      [3, 'औषधी उपचार खर्च मिलान', '', 'वार्षिक', medicalTaxCredit],
      [4, femaleRebateLabel, '', 'वार्षिक', femaleTaxRebate],
      ['', 'वार्षिक कुल जम्मा कर कट्टी रकम', '', '', netTax],
      ['', 'मासिक कुल जम्मा कर कट्टी रकम', '', '', monthlyTax],
      ['', 'मासिक कर कट्टी रकम (१%)', '', '', monthlySst],
      ['', 'मासिक कर कट्टी रकम (१०%)', '', '', monthlySlab10],
      ['', 'मासिक कर कट्टी रकम (२०%)', '', '', monthlySlab20],
      ['', 'मासिक कर कट्टी रकम (२५%/३०%)', '', '', monthlySlabHigh1],
      ['', 'मासिक कर कट्टी रकम (२९%/३६%)', '', '', monthlySlabHigh2],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'आयकर_निर्धारण_विवरण');
    XLSX.writeFile(workbook, `Tax_Assessment_${employee.code}_${employee.name}_${activeFiscalYear}.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white overflow-hidden print:static print:z-auto print:bg-white print:overflow-visible print:m-0 print:p-0">
      {/* Dedicated Print Styles for A4 Single-Document Output */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 8mm 6mm 8mm;
          }
          .annual-tax-main-sheet {
            display: none !important;
          }
          html, body {
            background-color: #ffffff !important;
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .bg-olive-light {
            background-color: #d8e6cd !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* Container Box - Full Screen Size */}
      <div className="w-full h-full flex flex-col bg-white print:bg-white print:h-auto print:overflow-visible print:m-0 print:p-0">
        
        {/* Top Actions Bar (Hidden in Print) */}
        <div className="px-4 sm:px-6 py-2.5 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 bg-white shadow-2xs shrink-0 no-print">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gray-100 border border-gray-300 flex items-center justify-center text-gray-800">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-gray-900">
                पारिश्रमिक आयकर निर्धारण विवरण
              </h3>
              <p className="text-xs text-gray-500">
                आ.व. {toNepaliDigits(activeFiscalYear)} • {employee.name} ({employee.code})
              </p>
            </div>
          </div>

          {/* Navigation between employees & Actions */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg p-1 shadow-2xs">
              <button
                onClick={handlePrev}
                className="p-1 hover:bg-gray-100 rounded text-gray-700 transition-colors"
                title="अघिल्लो कर्मचारी"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <select
                value={employee.id}
                onChange={(e) => onSelectEmployeeId(e.target.value)}
                className="text-xs font-semibold bg-transparent border-none focus:ring-0 text-gray-800 px-1 py-0.5 cursor-pointer max-w-[150px] sm:max-w-[200px] truncate"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.code})
                  </option>
                ))}
              </select>

              <button
                onClick={handleNext}
                className="p-1 hover:bg-gray-100 rounded text-gray-700 transition-colors"
                title="पछिल्लो कर्मचारी"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-white hover:bg-emerald-50 rounded-lg border border-emerald-300 transition-colors shadow-2xs"
              title="Excel मा निर्यात गर्नुहोस्"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">एक्सेल</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-[#305724] hover:bg-[#25441c] rounded-lg shadow-xs transition-colors"
              title="लेटरहेड सहित प्रिन्ट गर्नुहोस्"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>प्रिन्ट</span>
            </button>

            <button
              onClick={onClose}
              className="flex items-center gap-1 px-3 py-1.5 hover:bg-red-50 hover:border-red-300 rounded-lg text-gray-700 hover:text-red-700 border border-gray-300 bg-white transition-colors ml-1 shadow-2xs text-xs font-medium"
              title="बन्द गर्नुहोस्"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">बन्द गर्नुहोस्</span>
            </button>
          </div>
        </div>

        {/* Printable Document Scroll Area - Full Screen Layout */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 flex justify-center bg-white print:p-0 print:overflow-visible print:bg-white">
          <div
            ref={printRef}
            className="bg-white w-full max-w-[780px] p-6 sm:p-8 border border-gray-200 font-sans text-black print:p-0 print:shadow-none print:border-none print:max-w-full print:w-full print:m-0"
          >
            {/* Official Letterhead */}
            <div className="w-full mb-0">
              <Letterhead
                title=""
                compact={true}
                showMetadata={false}
                showSignatureSection={false}
              />
            </div>

            {/* Document Title as in Attached PDF */}
            <div className="text-center mt-1 mb-2">
              <h2 className="text-base sm:text-lg font-bold tracking-tight underline decoration-1 underline-offset-3 text-black">
                पारिश्रमिक आयकर निर्धारण विवरण
              </h2>
            </div>

            {/* Employee Metadata 4-Row Grid */}
            <div className="text-xs sm:text-[13px] leading-relaxed mb-2 font-medium text-black">
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 border-b border-gray-300 pb-2">
                {/* Row 1 */}
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold">आर्थिक वर्षः</span>
                  <span className="font-bold">{toNepaliDigits(activeFiscalYear)}</span>
                </div>
                <div className="flex items-baseline justify-end gap-2 text-right">
                  <span className="font-semibold">क.सं.नंः</span>
                  <span className="font-bold">{formatDigits(employee.code)}</span>
                </div>

                {/* Row 2 */}
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold">नाम, थरः</span>
                  <span className="font-bold">{employee.name}</span>
                </div>
                <div className="flex items-baseline justify-end gap-2 text-right">
                  <span className="font-semibold">एकल/दम्पतिः</span>
                  <span className="font-bold">{employee.filingType}</span>
                </div>

                {/* Row 3 */}
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold">पदः</span>
                  <span>{employee.designation}</span>
                </div>
                <div className="flex items-baseline justify-end gap-2 text-right">
                  <span className="font-semibold">लिङ्गः</span>
                  <span>{employee.gender}</span>
                </div>

                {/* Row 4 */}
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold">श्रेणी/तहः</span>
                  <span>{employee.level}</span>
                </div>
                <div className="flex items-baseline justify-end gap-2 text-right">
                  <span className="font-semibold">पान नंः</span>
                  <span className="font-mono">{employee.panNumber ? formatDigits(employee.panNumber) : '-'}</span>
                </div>
              </div>
            </div>

          {/* Main Assessment Table */}
          <div className="w-full overflow-x-auto print:overflow-visible">
            <table className="w-full table-fixed text-xs sm:text-[11.5px] border-collapse border border-gray-400 print:text-[10px]">
              <colgroup>
                <col className="w-[5%]" />
                <col className="w-[42%]" />
                <col className="w-[17%]" />
                <col className="w-[15%]" />
                <col className="w-[21%]" />
              </colgroup>
              
              {/* Table Header: Olive Light Green */}
              <thead>
                <tr className="bg-[#d8e6cd] bg-olive-light text-black font-bold border border-gray-400">
                  <th className="py-1 px-1 border border-gray-400 text-center whitespace-nowrap">क्र.सं.</th>
                  <th className="py-1 px-2 border border-gray-400 text-center">विवरण</th>
                  <th className="py-1 px-2 border border-gray-400 text-center whitespace-nowrap">मासिक दर</th>
                  <th className="py-1 px-2 border border-gray-400 text-center whitespace-nowrap">अवधि (महिना)</th>
                  <th className="py-1 px-2 border border-gray-400 text-center whitespace-nowrap">जम्मा</th>
                </tr>
              </thead>

              <tbody>
                {/* 1. आय रकम Header */}
                <tr className="bg-[#d8e6cd] bg-olive-light text-black font-bold border border-gray-400">
                  <td colSpan={5} className="py-1 px-3 text-center tracking-wide font-bold">
                    आय रकम
                  </td>
                </tr>

                {/* 1.1 तलब (प्राविधिक ग्रेड समेत) */}
                <tr className="border border-gray-400">
                  <td className="py-0.5 px-1 border border-gray-400 text-center font-mono">{formatDigits(1)}</td>
                  <td className="py-0.5 px-2 border border-gray-400">तलब (प्राविधिक ग्रेड समेत)</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono">{formatMoney(basicSalaryWithTech)}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-center font-mono">{formatDigits(12)}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono font-medium">{formatMoney(basicSalaryWithTech * 12)}</td>
                </tr>

                {/* 1.2 ग्रेड */}
                <tr className="border border-gray-400">
                  <td className="py-0.5 px-1 border border-gray-400 text-center font-mono">{formatDigits(2)}</td>
                  <td className="py-0.5 px-2 border border-gray-400">ग्रेड</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono">{gradeMonthlyBefore > 0 ? formatMoney(gradeMonthlyBefore) : '-'}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-center font-mono">{formatDigits(gradePeriodMonths)}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono font-medium">{gradeMonthlyBefore * gradePeriodMonths > 0 ? formatMoney(gradeMonthlyBefore * gradePeriodMonths) : '-'}</td>
                </tr>

                {/* 1.3 ग्रेड वृद्धि */}
                <tr className="border border-gray-400">
                  <td className="py-0.5 px-1 border border-gray-400 text-center font-mono">{formatDigits(3)}</td>
                  <td className="py-0.5 px-2 border border-gray-400">ग्रेड वृद्धि</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono">{hasIncrement && gradeMonthlyAfter > 0 ? formatMoney(gradeMonthlyAfter) : '-'}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-center font-mono">{hasIncrement ? formatDigits(gradeIncreasePeriodMonths) : '-'}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono font-medium">{hasIncrement && gradeMonthlyAfter * gradeIncreasePeriodMonths > 0 ? formatMoney(gradeMonthlyAfter * gradeIncreasePeriodMonths) : '-'}</td>
                </tr>

                {/* 1.4 चाडपर्व खर्च */}
                <tr className="border border-gray-400">
                  <td className="py-0.5 px-1 border border-gray-400 text-center font-mono">{formatDigits(4)}</td>
                  <td className="py-0.5 px-2 border border-gray-400">चाडपर्व खर्च</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono">{formatMoney(festivalAllowance)}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-center font-mono">{formatDigits(1)}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono font-medium">{formatMoney(festivalAllowance)}</td>
                </tr>

                {/* 1.5 सावधिक जीवन बिमा कोष */}
                <tr className="border border-gray-400">
                  <td className="py-0.5 px-1 border border-gray-400 text-center font-mono">{formatDigits(5)}</td>
                  <td className="py-0.5 px-2 border border-gray-400">सावधिक जीवन बिमा कोष</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono">{formatMoney(sal.lifeInsuranceFund)}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-center font-mono">{formatDigits(12)}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono font-medium">{formatMoney(sal.lifeInsuranceFund * 12)}</td>
                </tr>

                {/* 1.6 महंगी भत्ता */}
                <tr className="border border-gray-400">
                  <td className="py-0.5 px-1 border border-gray-400 text-center font-mono">{formatDigits(6)}</td>
                  <td className="py-0.5 px-2 border border-gray-400">महंगी भत्ता</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono">{formatMoney(sal.dearnessAllowance)}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-center font-mono">{formatDigits(12)}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono font-medium">{formatMoney(sal.dearnessAllowance * 12)}</td>
                </tr>

                {/* 1.7 पोशाक भत्ता */}
                <tr className="border border-gray-400">
                  <td className="py-0.5 px-1 border border-gray-400 text-center font-mono">{formatDigits(7)}</td>
                  <td className="py-0.5 px-2 border border-gray-400">पोशाक भत्ता</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono">{formatMoney(sal.uniformAllowance)}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-center font-mono">{formatDigits(1)}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono font-medium">{formatMoney(sal.uniformAllowance)}</td>
                </tr>

                {/* 1.8 कर्मचारी संचयकोष थप */}
                <tr className="border border-gray-400">
                  <td className="py-0.5 px-1 border border-gray-400 text-center font-mono">{formatDigits(8)}</td>
                  <td className="py-0.5 px-2 border border-gray-400">कर्मचारी संचयकोष थप</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono">{epfOfficeContributionNormal > 0 ? formatMoney(epfOfficeContributionNormal) : '-'}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-center font-mono">{formatDigits(gradePeriodMonths)}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono font-medium">{epfOfficeContributionNormal * gradePeriodMonths > 0 ? formatMoney(epfOfficeContributionNormal * gradePeriodMonths) : '-'}</td>
                </tr>

                {/* 1.9 कर्मचारी संचयकोष थप (ग्रेड वृद्धि) */}
                <tr className="border border-gray-400">
                  <td className="py-0.5 px-1 border border-gray-400 text-center font-mono">{formatDigits(9)}</td>
                  <td className="py-0.5 px-2 border border-gray-400">कर्मचारी संचयकोष थप (ग्रेड वृद्धि)</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono">{hasIncrement && epfOfficeContributionPostIncrease > 0 ? formatMoney(epfOfficeContributionPostIncrease) : '-'}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-center font-mono">{hasIncrement ? formatDigits(gradeIncreasePeriodMonths) : '-'}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono font-medium">{hasIncrement && epfOfficeContributionPostIncrease * gradeIncreasePeriodMonths > 0 ? formatMoney(epfOfficeContributionPostIncrease * gradeIncreasePeriodMonths) : '-'}</td>
                </tr>

                {/* 1.10 योगदानमा आधारित निवृत्तिभरण कोष थप */}
                <tr className="border border-gray-400">
                  <td className="py-0.5 px-1 border border-gray-400 text-center font-mono">{formatDigits(10)}</td>
                  <td className="py-0.5 px-2 border border-gray-400">योगदानमा आधारित निवृत्तिभरण कोष थप</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono">{pensionOfficeContributionNormal > 0 ? formatMoney(pensionOfficeContributionNormal) : '-'}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-center font-mono">{formatDigits(gradePeriodMonths)}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono font-medium">{pensionOfficeContributionNormal * gradePeriodMonths > 0 ? formatMoney(pensionOfficeContributionNormal * gradePeriodMonths) : '-'}</td>
                </tr>

                {/* 1.11 योगदानमा आधारित निवृत्तिभरण कोष थप (ग्रेड वृद्धि) */}
                <tr className="border border-gray-400">
                  <td className="py-0.5 px-1 border border-gray-400 text-center font-mono">{formatDigits(11)}</td>
                  <td className="py-0.5 px-2 border border-gray-400">योगदानमा आधारित निवृत्तिभरण कोष थप (ग्रेड वृद्धि)</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono">{hasIncrement && pensionOfficeContributionPostIncrease > 0 ? formatMoney(pensionOfficeContributionPostIncrease) : '-'}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-center font-mono">{hasIncrement ? formatDigits(gradeIncreasePeriodMonths) : '-'}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono font-medium">{hasIncrement && pensionOfficeContributionPostIncrease * gradeIncreasePeriodMonths > 0 ? formatMoney(pensionOfficeContributionPostIncrease * gradeIncreasePeriodMonths) : '-'}</td>
                </tr>

                {/* 1.12 दुर्गम भत्ता */}
                <tr className="border border-gray-400">
                  <td className="py-0.5 px-1 border border-gray-400 text-center font-mono">{formatDigits(12)}</td>
                  <td className="py-0.5 px-2 border border-gray-400">दुर्गम भत्ता</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono">{sal.remoteAllowance ? formatMoney(sal.remoteAllowance) : '-'}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-center font-mono">{formatDigits(12)}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono font-medium">{sal.remoteAllowance ? formatMoney(sal.remoteAllowance * 12) : '-'}</td>
                </tr>

                {/* 1.13 अन्य (प्रोत्साहन भत्ता) */}
                <tr className="border border-gray-400">
                  <td className="py-0.5 px-1 border border-gray-400 text-center font-mono">{formatDigits(13)}</td>
                  <td className="py-0.5 px-2 border border-gray-400">अन्य (प्रोत्साहन भत्ता)</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono">{sal.incentiveAllowance ? formatMoney(sal.incentiveAllowance) : '-'}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-center font-mono">{formatDigits(12)}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono font-medium">{sal.incentiveAllowance ? formatMoney(sal.incentiveAllowance * 12) : '-'}</td>
                </tr>

                {/* कुल जम्मा आय रकम */}
                <tr className="bg-[#d8e6cd] bg-olive-light text-black font-bold border border-gray-400">
                  <td colSpan={4} className="py-1 px-3 text-right font-bold tracking-wide">
                    कुल जम्मा आय रकम
                  </td>
                  <td className="py-1 px-2 text-right font-mono font-bold">
                    {formatMoney(totalTableIncome)}
                  </td>
                </tr>

                {/* 2. कट्टी रकम Header */}
                <tr className="bg-[#d8e6cd] bg-olive-light text-black font-bold border border-gray-400">
                  <td className="py-1 px-1 border border-gray-400 text-center font-bold whitespace-nowrap">
                    क्र.सं.
                  </td>
                  <td className="py-1 px-2 border border-gray-400 text-center font-bold">
                    कट्टी रकम
                  </td>
                  <td className="py-1 px-2 border border-gray-400 text-center font-bold whitespace-nowrap">
                    मासिक दर
                  </td>
                  <td className="py-1 px-2 border border-gray-400 text-center font-bold whitespace-nowrap">
                    अवधि (महिना)
                  </td>
                  <td className="py-1 px-2 border border-gray-400 text-center font-bold whitespace-nowrap">
                    जम्मा
                  </td>
                </tr>

                {/* 2.1 कर्मचारी संचयकोष */}
                <tr className="border border-gray-400">
                  <td className="py-0.5 px-1 border border-gray-400 text-center font-mono">{formatDigits(1)}</td>
                  <td className="py-0.5 px-2 border border-gray-400">कर्मचारी संचयकोष</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono">{epfTotalContributionNormal > 0 ? formatMoney(epfTotalContributionNormal) : '-'}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-center font-mono">{formatDigits(gradePeriodMonths)}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono font-medium">{epfTotalContributionNormal * gradePeriodMonths > 0 ? formatMoney(epfTotalContributionNormal * gradePeriodMonths) : '-'}</td>
                </tr>

                {/* 2.2 कर्मचारी संचयकोष (ग्रेड वृद्धि) */}
                <tr className="border border-gray-400">
                  <td className="py-0.5 px-1 border border-gray-400 text-center font-mono">{formatDigits(2)}</td>
                  <td className="py-0.5 px-2 border border-gray-400">कर्मचारी संचयकोष (ग्रेड वृद्धि)</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono">{hasIncrement && epfTotalContributionPostIncrease > 0 ? formatMoney(epfTotalContributionPostIncrease) : '-'}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-center font-mono">{hasIncrement ? formatDigits(gradeIncreasePeriodMonths) : '-'}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono font-medium">{hasIncrement && epfTotalContributionPostIncrease * gradeIncreasePeriodMonths > 0 ? formatMoney(epfTotalContributionPostIncrease * gradeIncreasePeriodMonths) : '-'}</td>
                </tr>

                {/* 2.3 योगदानमा आधारित निवृत्तिभरण कोष */}
                <tr className="border border-gray-400">
                  <td className="py-0.5 px-1 border border-gray-400 text-center font-mono">{formatDigits(3)}</td>
                  <td className="py-0.5 px-2 border border-gray-400">योगदानमा आधारित निवृत्तिभरण कोष</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono">{pensionTotalContributionNormal > 0 ? formatMoney(pensionTotalContributionNormal) : '-'}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-center font-mono">{formatDigits(gradePeriodMonths)}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono font-medium">{pensionTotalContributionNormal * gradePeriodMonths > 0 ? formatMoney(pensionTotalContributionNormal * gradePeriodMonths) : '-'}</td>
                </tr>

                {/* 2.4 योगदानमा आधारित निवृत्तिभरण कोष (ग्रेड वृद्धि) */}
                <tr className="border border-gray-400">
                  <td className="py-0.5 px-1 border border-gray-400 text-center font-mono">{formatDigits(4)}</td>
                  <td className="py-0.5 px-2 border border-gray-400">योगदानमा आधारित निवृत्तिभरण कोष (ग्रेड वृद्धि)</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono">{hasIncrement && pensionTotalContributionPostIncrease > 0 ? formatMoney(pensionTotalContributionPostIncrease) : '-'}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-center font-mono">{hasIncrement ? formatDigits(gradeIncreasePeriodMonths) : '-'}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono font-medium">{hasIncrement && pensionTotalContributionPostIncrease * gradeIncreasePeriodMonths > 0 ? formatMoney(pensionTotalContributionPostIncrease * gradeIncreasePeriodMonths) : '-'}</td>
                </tr>

                {/* 2.5 सावधिक जीवन बिमा कोष */}
                <tr className="border border-gray-400">
                  <td className="py-0.5 px-1 border border-gray-400 text-center font-mono">{formatDigits(5)}</td>
                  <td className="py-0.5 px-2 border border-gray-400">सावधिक जीवन बिमा कोष</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono">{formatMoney(sal.lifeInsuranceFund * 2)}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-center font-mono">{formatDigits(12)}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono font-medium">{formatMoney(lifeInsurancePaidAnnual)}</td>
                </tr>

                {/* 2.6 नागरिक लगानी कोष */}
                <tr className="border border-gray-400">
                  <td className="py-0.5 px-1 border border-gray-400 text-center font-mono">{formatDigits(6)}</td>
                  <td className="py-0.5 px-2 border border-gray-400">नागरिक लगानी कोष</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono">{ded.citizenInvestmentTrust ? formatMoney(ded.citizenInvestmentTrust) : '-'}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-center font-mono">{formatDigits(12)}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono font-medium">{citDeductionAnnual > 0 ? formatMoney(citDeductionAnnual) : '-'}</td>
                </tr>

                {/* 2.7 लगानी बिमा रकम */}
                <tr className="border border-gray-400">
                  <td className="py-0.5 px-1 border border-gray-400 text-center font-mono">{formatDigits(7)}</td>
                  <td className="py-0.5 px-2 border border-gray-400">लगानी बिमा रकम</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono">-</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-center">वार्षिक</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono font-medium">{lifeInsuranceRelief > 0 ? formatMoney(lifeInsuranceRelief) : '-'}</td>
                </tr>

                {/* 2.8 दुर्गम भत्ता छुट रकम */}
                <tr className="border border-gray-400">
                  <td className="py-0.5 px-1 border border-gray-400 text-center font-mono">{formatDigits(8)}</td>
                  <td className="py-0.5 px-2 border border-gray-400">दुर्गम भत्ता छुट रकम</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono">-</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-center">वार्षिक</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono font-medium">{remoteRelief > 0 ? formatMoney(remoteRelief) : '-'}</td>
                </tr>

                {/* 2.9 अन्य */}
                <tr className="border border-gray-400">
                  <td className="py-0.5 px-1 border border-gray-400 text-center font-mono">{formatDigits(9)}</td>
                  <td className="py-0.5 px-2 border border-gray-400">अन्य</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono">-</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-center">वार्षिक</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono font-medium">{otherDeductionsAnnual > 0 ? formatMoney(otherDeductionsAnnual) : '-'}</td>
                </tr>

                {/* जम्मा कट्टी रकम */}
                <tr className="bg-[#d8e6cd] bg-olive-light text-black font-bold border border-gray-400">
                  <td colSpan={4} className="py-1 px-3 text-right font-bold tracking-wide">
                    जम्मा कट्टी रकम
                  </td>
                  <td className="py-1 px-2 text-right font-mono font-bold">
                    {formatMoney(totalTableDeductions)}
                  </td>
                </tr>

                {/* कर योग्य आय रकम */}
                <tr className="bg-white text-black font-bold border border-gray-400">
                  <td colSpan={4} className="py-1 px-3 text-right font-bold tracking-wide">
                    कर योग्य आय रकम
                  </td>
                  <td className="py-1 px-2 text-right font-mono font-bold">
                    {formatMoney(tableTaxableIncome)}
                  </td>
                </tr>

                {/* 3. कर विवरण Header */}
                <tr className="bg-[#d8e6cd] bg-olive-light text-black font-bold border border-gray-400">
                  <th className="py-1 px-1 border border-gray-400 text-center whitespace-nowrap">क्र.सं.</th>
                  <th colSpan={2} className="py-1 px-2 border border-gray-400 text-center">कर विवरण</th>
                  <th className="py-1 px-2 border border-gray-400 text-center whitespace-nowrap">अवधि</th>
                  <th className="py-1 px-2 border border-gray-400 text-center whitespace-nowrap">जम्मा</th>
                </tr>

                {/* 3.1 १% ले हुने वार्षिक कर रकम */}
                <tr className="border border-gray-400">
                  <td className="py-0.5 px-1 border border-gray-400 text-center font-mono">{formatDigits(1)}</td>
                  <td colSpan={2} className="py-0.5 px-2 border border-gray-400">१% ले हुने वार्षिक कर रकम</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-center">वार्षिक</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono font-medium">{sstTax > 0 ? formatMoney(sstTax) : '-'}</td>
                </tr>

                {/* 3.2 १०% ले हुने वार्षिक कर रकम */}
                <tr className="border border-gray-400">
                  <td className="py-0.5 px-1 border border-gray-400 text-center font-mono">{formatDigits(2)}</td>
                  <td colSpan={2} className="py-0.5 px-2 border border-gray-400">१०% ले हुने वार्षिक कर रकम</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-center">वार्षिक</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono font-medium">{slab10Tax > 0 ? formatMoney(slab10Tax) : '-'}</td>
                </tr>

                {/* 3.3 २०% ले हुने वार्षिक कर रकम */}
                <tr className="border border-gray-400">
                  <td className="py-0.5 px-1 border border-gray-400 text-center font-mono">{formatDigits(3)}</td>
                  <td colSpan={2} className="py-0.5 px-2 border border-gray-400">२०% ले हुने वार्षिक कर रकम</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-center">वार्षिक</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono font-medium">{slab20Tax > 0 ? formatMoney(slab20Tax) : '-'}</td>
                </tr>

                {/* 3.4 २५%/३०% ले हुने वार्षिक कर रकम */}
                <tr className="border border-gray-400">
                  <td className="py-0.5 px-1 border border-gray-400 text-center font-mono">{formatDigits(4)}</td>
                  <td colSpan={2} className="py-0.5 px-2 border border-gray-400">
                    {`${formatDigits(slabHigh1Rate)}% ले हुने वार्षिक कर रकम`}
                  </td>
                  <td className="py-0.5 px-2 border border-gray-400 text-center">वार्षिक</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono font-medium">{slabHigh1Tax > 0 ? formatMoney(slabHigh1Tax) : '-'}</td>
                </tr>

                {/* 3.5 २९%/३६% ले हुने वार्षिक कर रकम */}
                <tr className="border border-gray-400">
                  <td className="py-0.5 px-1 border border-gray-400 text-center font-mono">{formatDigits(5)}</td>
                  <td colSpan={2} className="py-0.5 px-2 border border-gray-400">
                    {`${formatDigits(slabHigh2Rate)}% ले हुने वार्षिक कर रकम`}
                  </td>
                  <td className="py-0.5 px-2 border border-gray-400 text-center">वार्षिक</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono font-medium">{slabHigh2Tax > 0 ? formatMoney(slabHigh2Tax) : '-'}</td>
                </tr>

                {/* जम्मा वार्षिक कर दायित्व रकम */}
                <tr className="bg-[#d8e6cd] bg-olive-light text-black font-bold border border-gray-400">
                  <td colSpan={4} className="py-1 px-3 text-right font-bold tracking-wide">
                    जम्मा वार्षिक कर दायित्व रकम
                  </td>
                  <td className="py-1 px-2 text-right font-mono font-bold">
                    {formatMoney(totalGrossTax)}
                  </td>
                </tr>

                {/* 4. छुट रकम Header */}
                <tr className="bg-[#d8e6cd] bg-olive-light text-black font-bold border border-gray-400">
                  <th className="py-1 px-1 border border-gray-400 text-center whitespace-nowrap">क्र.सं.</th>
                  <th colSpan={2} className="py-1 px-2 border border-gray-400 text-center">छुट रकम</th>
                  <th className="py-1 px-2 border border-gray-400 text-center whitespace-nowrap">अवधि</th>
                  <th className="py-1 px-2 border border-gray-400 text-center whitespace-nowrap">जम्मा</th>
                </tr>

                {/* 4.1 अपाङ्ग व्यक्तिले पाउने छुट रकम */}
                <tr className="border border-gray-400">
                  <td className="py-0.5 px-1 border border-gray-400 text-center font-mono">{formatDigits(1)}</td>
                  <td colSpan={2} className="py-0.5 px-2 border border-gray-400">अपाङ्ग व्यक्तिले पाउने छुट रकम</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-center">वार्षिक</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono font-medium">{disabilityTaxRelief > 0 ? formatMoney(disabilityTaxRelief) : '-'}</td>
                </tr>

                {/* 4.2 योगदानमा आधारित निवृत्तिभरण कोष प्राप्त कर्मचारीलाई सा.सु.कर छुट रकम */}
                <tr className="border border-gray-400">
                  <td className="py-0.5 px-1 border border-gray-400 text-center font-mono">{formatDigits(2)}</td>
                  <td colSpan={2} className="py-0.5 px-2 border border-gray-400">योगदानमा आधारित निवृत्तिभरण कोष प्राप्त कर्मचारीलाई सा.सु.कर छुट रकम</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-center">वार्षिक</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono font-medium">{pensionSSTExemption > 0 ? formatMoney(pensionSSTExemption) : '-'}</td>
                </tr>

                {/* 4.3 औषधी उपचार खर्च मिलान */}
                <tr className="border border-gray-400">
                  <td className="py-0.5 px-1 border border-gray-400 text-center font-mono">{formatDigits(3)}</td>
                  <td colSpan={2} className="py-0.5 px-2 border border-gray-400">औषधी उपचार खर्च मिलान</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-center">वार्षिक</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono font-medium">{medicalTaxCredit > 0 ? formatMoney(medicalTaxCredit) : '-'}</td>
                </tr>

                {/* 4.4 वार्षिक करको १०% छुट (महिला कर्मचारीको लागि मात्र) रकम */}
                <tr className="border border-gray-400">
                  <td className="py-0.5 px-1 border border-gray-400 text-center font-mono">{formatDigits(4)}</td>
                  <td colSpan={2} className="py-0.5 px-2 border border-gray-400">{femaleRebateLabel}</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-center">वार्षिक</td>
                  <td className="py-0.5 px-2 border border-gray-400 text-right font-mono font-medium">
                    {isFemale ? (femaleTaxRebate > 0 ? formatMoney(femaleTaxRebate) : formatMoney(0)) : '-'}
                  </td>
                </tr>

                {/* वार्षिक कुल जम्मा कर कट्टी रकम */}
                <tr className="bg-[#d8e6cd] bg-olive-light text-black font-bold border border-gray-400">
                  <td colSpan={4} className="py-1 px-3 text-right font-bold tracking-wide">
                    वार्षिक कुल जम्मा कर कट्टी रकम
                  </td>
                  <td className="py-1 px-2 text-right font-mono font-bold">
                    {formatMoney(netTax)}
                  </td>
                </tr>

                {/* मासिक कुल जम्मा कर कट्टी रकम */}
                <tr className="bg-[#d8e6cd] bg-olive-light text-black font-bold border border-gray-400">
                  <td colSpan={4} className="py-1 px-3 text-right font-bold tracking-wide">
                    मासिक कुल जम्मा कर कट्टी रकम
                  </td>
                  <td className="py-1 px-2 text-right font-mono font-bold">
                    {formatMoney(monthlyTax)}
                  </td>
                </tr>

                {/* Highlighted Monthly Tax by Slabs */}
                <tr className="bg-white text-black font-bold border border-gray-400">
                  <td colSpan={4} className="py-0.5 px-3 text-right font-bold">
                    मासिक कर कट्टी रकम (१%)
                  </td>
                  <td className="py-0.5 px-2 text-right font-mono font-bold">
                    {monthlySst > 0 ? formatMoney(monthlySst) : '-'}
                  </td>
                </tr>

                <tr className="bg-white text-black font-bold border border-gray-400">
                  <td colSpan={4} className="py-0.5 px-3 text-right font-bold">
                    मासिक कर कट्टी रकम (१०%)
                  </td>
                  <td className="py-0.5 px-2 text-right font-mono font-bold">
                    {monthlySlab10 > 0 ? formatMoney(monthlySlab10) : '-'}
                  </td>
                </tr>

                <tr className="bg-white text-black font-bold border border-gray-400">
                  <td colSpan={4} className="py-0.5 px-3 text-right font-bold">
                    मासिक कर कट्टी रकम (२०%)
                  </td>
                  <td className="py-0.5 px-2 text-right font-mono font-bold">
                    {monthlySlab20 > 0 ? formatMoney(monthlySlab20) : '-'}
                  </td>
                </tr>

                <tr className="bg-white text-black font-bold border border-gray-400">
                  <td colSpan={4} className="py-0.5 px-3 text-right font-bold">
                    मासिक कर कट्टी रकम ({formatDigits(slabHigh1Rate)}%)
                  </td>
                  <td className="py-0.5 px-2 text-right font-mono font-bold">
                    {monthlySlabHigh1 > 0 ? formatMoney(monthlySlabHigh1) : '-'}
                  </td>
                </tr>

                <tr className="bg-white text-black font-bold border border-gray-400">
                  <td colSpan={4} className="py-0.5 px-3 text-right font-bold">
                    मासिक कर कट्टी रकम ({formatDigits(slabHigh2Rate)}%)
                  </td>
                  <td className="py-0.5 px-2 text-right font-mono font-bold">
                    {monthlySlabHigh2 > 0 ? formatMoney(monthlySlabHigh2) : '-'}
                  </td>
                </tr>

              </tbody>
            </table>
          </div>

          {/* Bottom Declaration and Signature Section as in Attached PDF */}
          <div className="mt-4 pt-2 text-xs sm:text-[12.5px] leading-relaxed text-black break-inside-avoid print:mt-3 print:pt-1">
            <p className="font-medium">
              माथि उल्लेखित अनुमानित वार्षिक पारिश्रमिक आय विवरण ठिक छ । यसमा पछि थपघट भएमा सोही बमोजिम विवरण पेश गर्नेछु।
            </p>

            <div className="mt-6 print:mt-4 flex justify-between items-end">
              <div className="space-y-4 print:space-y-2">
                <div>
                  <span className="font-semibold">कर्मचारीको दस्तखतः</span> ....................................................
                </div>
                <div>
                  <span className="font-semibold">मितिः</span> ....................................................
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
      </div>
    </div>
  );
};
