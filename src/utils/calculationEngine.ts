import {
  Employee,
  SalarySetup,
  DeductionSetup,
  TaxReference,
  AnnualTaxCalculationResult,
  Calculation33Item,
  MonthlySalaryItem,
  NepaliMonth,
} from '../types';

export const MONTH_WEIGHT_MAP: Record<NepaliMonth, number> = {
  'श्रावण': 12,
  'भाद्र': 11,
  'असोज': 10,
  'कार्तिक': 9,
  'मंसिर': 8,
  'पौष': 7,
  'माघ': 6,
  'फागुन': 5,
  'चैत्र': 4,
  'बैशाख': 3,
  'जेठ': 2,
  'अषाढ': 1,
};

export const MONTH_ORDER: NepaliMonth[] = [
  'श्रावण',
  'भाद्र',
  'असोज',
  'कार्तिक',
  'मंसिर',
  'पौष',
  'माघ',
  'फागुन',
  'चैत्र',
  'बैशाख',
  'जेठ',
  'अषाढ',
];

/**
 * Round to 2 decimal places to prevent floating point inaccuracies
 */
export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Robustly resolve month index from 0 (श्रावण) to 11 (अषाढ)
 */
export function getNepaliMonthIndex(monthName: string | undefined): number {
  if (!monthName) return -1;
  const clean = monthName.replace(' देखि', '').replace(' महिनामा भुक्तानी', '').trim();
  const map: Record<string, number> = {
    'श्रावण': 0, 'साउन': 0,
    'भाद्र': 1, 'भदौ': 1,
    'असोज': 2, 'आश्विन': 2,
    'कार्तिक': 3, 'कात्तिक': 3,
    'मंसिर': 4, 'मार्ग': 4,
    'पौष': 5, 'पुस': 5,
    'माघ': 6,
    'फागुन': 7, 'फाल्गुन': 7,
    'चैत्र': 8, 'चैत': 8,
    'बैशाख': 9, 'वैशाख': 9,
    'जेठ': 10,
    'अषाढ': 11, 'असार': 11,
  };
  return map[clean] !== undefined ? map[clean] : MONTH_ORDER.indexOf(clean as NepaliMonth);
}

/**
 * Calculate Grade Amount (ग्रेड रकम)
 * ग्रेड रकम = ग्रेड दर × हालको ग्रेड संख्या
 */
export function calculateGradeAmount(gradeRate: number, currentGradeCount: number): number {
  return round2(Math.max(0, gradeRate) * Math.max(0, currentGradeCount));
}

/**
 * Calculate Grade Period Months (ग्रेड अवधि महिना - वृद्धि हुनु अगाडिको महिना संख्या)
 * श्रावण देखि वृद्धि हुने महिना भन्दा अघिल्लो महिना सम्मको महिना संख्या (उदा: माघ भए ६, श्रावण भए ०)
 */
export function calculateGradePeriodMonths(gradeIncreaseMonth: NepaliMonth | string): number {
  const index = getNepaliMonthIndex(gradeIncreaseMonth);
  return index !== -1 ? index : 12;
}

/**
 * Calculate Grade Increase Amount (ग्रेड बृद्धि पश्चात मासिक रकम)
 */
export function calculateGradeIncreaseAmount(
  basicSalary: number,
  gradeRate: number,
  currentGradeCount: number,
  gradeIncreaseCount: number
): number {
  const totalGrades = Math.max(0, currentGradeCount) + Math.max(0, gradeIncreaseCount);
  return round2(Math.max(0, basicSalary) + Math.max(0, gradeRate) * totalGrades);
}

/**
 * Calculate Grade Increase Period Months (ग्रेड बृद्धि अवधि महिना)
 */
export function calculateGradeIncreasePeriodMonths(
  gradePeriodMonths: number,
  gradeIncreaseCount: number
): number {
  if (gradeIncreaseCount > 0 && gradePeriodMonths < 12) {
    return 12 - gradePeriodMonths;
  }
  return 0;
}

/**
 * Main Annual Salary & Tax Calculation Engine
 */
export function calculateAnnualSalaryAndTax(
  employee: Employee,
  salarySetup: SalarySetup,
  deductionSetup: DeductionSetup,
  taxReference: TaxReference
): AnnualTaxCalculationResult {
  // अघिल्लो आ.व. असार मसान्त सम्मको ग्रेड संख्या र थप हुने ग्रेड संख्या
  const gradeRate = Number(salarySetup.gradeRate || 0);
  const currentGradeCount = Number(salarySetup.currentGradeCount || 0);
  const incGradeCount = Number(salarySetup.gradeIncreaseCount || 0);
  const prevGradeCount = salarySetup.previousGradeCount !== undefined
    ? Number(salarySetup.previousGradeCount)
    : Math.max(0, currentGradeCount - incGradeCount);

  // We define basicSalary to include the technical grade amount (Col 5)
  const basicSalary = Number(salarySetup.basicSalary || 0) + Number(salarySetup.technicalGradeAmount || employee.technicalGradeAmount || 0);

  // 1. Grade Amount (वृद्धि हुनु अगाडिको ग्रेड रकम)
  const gradeAmount = calculateGradeAmount(gradeRate, prevGradeCount);
  
  // 2. Grade Period Months
  const hasIncrement = incGradeCount > 0;
  const gradePeriodMonths = hasIncrement ? calculateGradePeriodMonths(salarySetup.gradeIncreaseMonth || 'श्रावण') : 12;
  
  // 3. Grade Increase Amount (Monthly base with tech + all grades post-increment)
  const gradeIncreaseAmount = hasIncrement
    ? calculateGradeIncreaseAmount(
        basicSalary,
        gradeRate,
        prevGradeCount,
        incGradeCount
      )
    : basicSalary + gradeAmount;
    
  // 4. Grade Increase Period Months
  const gradeIncreasePeriodMonths = hasIncrement
    ? calculateGradeIncreasePeriodMonths(gradePeriodMonths, incGradeCount)
    : 0;

  // Monthly base with current grade (वृद्धि हुनु अगाडिको तलब र ग्रेड)
  const monthlySalaryWithCurrentGrade = basicSalary + gradeAmount;

  // Calculate the monthly salary of the festival bonus month dynamically
  const festMonth = (salarySetup.festivalBonusMonth || employee.festivalBonusMonth || 'असोज').replace(' महिनामा भुक्तानी', '').trim();
  const festMonthIdx = getNepaliMonthIndex(festMonth);
  const incMonthIdx = getNepaliMonthIndex(salarySetup.gradeIncreaseMonth);
  const isFestPostIncrease = incGradeCount > 0 && incMonthIdx !== -1 && festMonthIdx !== -1 && incMonthIdx <= festMonthIdx;
  const festivalMonthSalary = isFestPostIncrease ? gradeIncreaseAmount : monthlySalaryWithCurrentGrade;

  // 5. Festival allowance (चाडपर्व खर्च)
  // यदि कर्मचारीको ग्रेड बृद्धि - चाडपर्व खर्च पाउने महिना (असोज) मा हुन्छ भने: क्र.सं. १ (तलब) + क्र.सं. ३ (ग्रेड वृद्धि)
  // अन्यथा: क्र.सं. १ (तलब) + क्र.सं. २ (ग्रेड)
  const standardFestivalAllowance = round2(festivalMonthSalary);

  // If custom festival bonus was mistakenly auto-filled with post-increase amount when it shouldn't be, correct it:
  let festivalAllowance = standardFestivalAllowance;
  if (salarySetup.festivalBonusCustom !== undefined && salarySetup.festivalBonusCustom > 0) {
    const buggyPostIncreaseAmount = round2(gradeIncreaseAmount);
    if (!isFestPostIncrease && salarySetup.festivalBonusCustom === buggyPostIncreaseAmount) {
      festivalAllowance = standardFestivalAllowance;
    } else if (salarySetup.festivalBonusCustom === standardFestivalAllowance) {
      festivalAllowance = standardFestivalAllowance;
    } else {
      festivalAllowance = salarySetup.festivalBonusCustom;
    }
  }

  // 6. Dearness Allowance (मंहगी भत्ता) = मासिक × १२
  const dearnessAllowanceAnnual = round2(Number(salarySetup.dearnessAllowance || 0) * 12);

  // 7. Uniform Allowance (पोशाक भत्ता) = वार्षिक रकम
  const uniformAllowanceAnnual = round2(Number(salarySetup.uniformAllowance || 0));

  // 8. Remote Area Allowance (दुर्गम भत्ता) = मासिक × १२
  const remoteAllowanceAnnual = round2(Number(salarySetup.remoteAllowance || 0) * 12);

  // 9. Incentive Allowance (प्रोत्साहन भत्ता) = मासिक × १२
  const incentiveAllowanceAnnual = round2(Number(salarySetup.incentiveAllowance || 0) * 12);

  // Vehicle and Communication Allowance (मासिक × १२)
  const vehicleAllowanceAnnual = round2(Number(salarySetup.vehicleAllowance || 0) * 12);
  const communicationAllowanceAnnual = round2(Number(salarySetup.communicationAllowance || 0) * 12);

  // 10. Other Income (अन्य आय + अतिरिक्त करयोग्य आय)
  const otherIncomeAnnual = round2(Number(salarySetup.otherIncome || 0) + Number(salarySetup.otherTaxableIncome || 0));

  // 11. EPF Office Contribution (कर्मचारी संचय कोष थप)
  // If करार: 0, Else: (तलब + ग्रेड) × 10%
  const isContract = employee.serviceType === 'करार';
  const epfOfficeContributionNormal = isContract
    ? 0
    : round2(monthlySalaryWithCurrentGrade * 0.10);

  // 12. EPF Office Contribution Post Increment
  const epfOfficeContributionPostIncrease = isContract || gradeIncreasePeriodMonths === 0
    ? 0
    : round2(gradeIncreaseAmount * 0.10);

  // 13. Pension Office Contribution (योगदानमा आधारित निवृत्तिभरण रकम थप)
  // If Pension = नभएको: 0, Else: (तलब + ग्रेड) × 6%
  const hasPension = employee.pension === 'भएको';
  const pensionOfficeContributionNormal = !hasPension
    ? 0
    : round2(monthlySalaryWithCurrentGrade * 0.06);

  // 14. Pension Office Contribution Post Increment
  const pensionOfficeContributionPostIncrease = !hasPension || gradeIncreasePeriodMonths === 0
    ? 0
    : round2(gradeIncreaseAmount * 0.06);

  // 15 & 16. Total EPF (Employee + Office = Office × 2)
  const epfTotalContributionNormal = epfOfficeContributionNormal * 2;
  const epfTotalContributionPostIncrease = epfOfficeContributionPostIncrease * 2;

  // 17 & 18. Total Pension (Employee + Office = Office × 2)
  const pensionTotalContributionNormal = pensionOfficeContributionNormal * 2;
  const pensionTotalContributionPostIncrease = pensionOfficeContributionPostIncrease * 2;

  // 19. Term Life Insurance Fund (सावधिक जीवन बिमा कोष) = Monthly × 2 × 12 (Employee + Govt)
  const lifeInsuranceFundAnnual = round2(Number(salarySetup.lifeInsuranceFund || 0) * 2 * 12);

  // 20. CIT Deduction Annual (नागरिक लगानी कोष)
  const citDeductionAnnual = round2(Number(deductionSetup.citizenInvestmentTrust || 0) * 12);

  // --- Total Annual Income (जम्मा वार्षिक आय रकम) ---
  const incomeFromBaseSalary = round2(monthlySalaryWithCurrentGrade * gradePeriodMonths);
  const incomeFromPostIncreaseSalary = round2(gradeIncreaseAmount * gradeIncreasePeriodMonths);
  const epfOfficeAnnual = round2(
    epfOfficeContributionNormal * gradePeriodMonths +
    epfOfficeContributionPostIncrease * gradeIncreasePeriodMonths
  );
  const pensionOfficeAnnual = round2(
    pensionOfficeContributionNormal * gradePeriodMonths +
    pensionOfficeContributionPostIncrease * gradeIncreasePeriodMonths
  );

  const totalAnnualIncome = round2(
    incomeFromBaseSalary +
    incomeFromPostIncreaseSalary +
    epfOfficeAnnual +
    pensionOfficeAnnual +
    dearnessAllowanceAnnual +
    remoteAllowanceAnnual +
    incentiveAllowanceAnnual +
    vehicleAllowanceAnnual +
    communicationAllowanceAnnual +
    otherIncomeAnnual +
    festivalAllowance +
    uniformAllowanceAnnual
  );

  // --- Total Annual Deductions (जम्मा वार्षिक कट्टी रकम) ---
  const epfTotalDeductionAnnual = round2(
    epfTotalContributionNormal * gradePeriodMonths +
    epfTotalContributionPostIncrease * gradeIncreasePeriodMonths
  );
  const pensionTotalDeductionAnnual = round2(
    pensionTotalContributionNormal * gradePeriodMonths +
    pensionTotalContributionPostIncrease * gradeIncreasePeriodMonths
  );

  // Life insurance deduction limit (custom employee ceiling or taxReference ceiling or 40,000)
  const lifeCeiling = deductionSetup.lifeInsuranceCeilingLimit !== undefined && deductionSetup.lifeInsuranceCeilingLimit > 0
    ? deductionSetup.lifeInsuranceCeilingLimit
    : (taxReference.lifeInsuranceMaxDeduction || 40000);
  const actualLifeInsurancePaid = Number(deductionSetup.investmentInsuranceDeduction || 0) || (Number(salarySetup.lifeInsuranceFund || 0) * 12);
  const lifeInsuranceRelief = round2(
    Math.min(actualLifeInsurancePaid, lifeCeiling)
  );

  // Health insurance deduction limit (Income Tax Act 2058: default max 20,000 or custom employee ceiling)
  const healthCeiling = deductionSetup.healthInsuranceCeilingLimit !== undefined && deductionSetup.healthInsuranceCeilingLimit > 0
    ? deductionSetup.healthInsuranceCeilingLimit
    : 20000;
  const healthInsuranceRelief = round2(
    Math.min(Number(deductionSetup.healthInsuranceDeduction || 0), healthCeiling)
  );

  // Home building insurance deduction limit (Income Tax Act 2058: default max 5,000 or custom employee ceiling)
  const homeCeiling = deductionSetup.homeInsuranceCeilingLimit !== undefined && deductionSetup.homeInsuranceCeilingLimit > 0
    ? deductionSetup.homeInsuranceCeilingLimit
    : 5000;
  const homeInsuranceRelief = round2(
    Math.min(Number(deductionSetup.homeInsuranceDeduction || 0), homeCeiling)
  );

  // CIT Limit (1/3 of total income or citCeiling or actual)
  const citCeiling = deductionSetup.citCeilingLimit !== undefined && deductionSetup.citCeilingLimit > 0
    ? deductionSetup.citCeilingLimit
    : (taxReference.citMaxDeductionAmount || 300000);
  const citLimit = round2(
    Math.min(
      citDeductionAnnual,
      citCeiling,
      totalAnnualIncome * ((taxReference.citMaxDeductionPercent || 33.33) / 100)
    )
  );

  // Remote Area Tax Relief
  const remoteRelief = deductionSetup.remoteTaxReliefOverride !== undefined && deductionSetup.remoteTaxReliefOverride > 0
    ? deductionSetup.remoteTaxReliefOverride
    : (taxReference.remoteExemptions[employee.remoteArea] || 0);

  // Other annual deductions
  const otherDeductionsAnnual = round2(Number(deductionSetup.otherDeduction || 0) * 12);
  const loanDeductionsAnnual = round2(Number(deductionSetup.loanDeduction || 0) * 12);

  const totalAnnualDeductions = round2(
    epfTotalDeductionAnnual +
    pensionTotalDeductionAnnual +
    lifeInsuranceRelief +
    healthInsuranceRelief +
    homeInsuranceRelief +
    citLimit +
    remoteRelief +
    otherDeductionsAnnual +
    loanDeductionsAnnual
  );

  // --- Annual Taxable Income (वार्षिक कर योग्य आय रकम) ---
  const annualTaxableIncome = round2(Math.max(0, totalAnnualIncome - totalAnnualDeductions));

  // --- Progressive Tax Calculation ---
  let remainingTaxable = annualTaxableIncome;
  let grossTax = 0;
  const slabBreakdowns: {
    slabName: string;
    taxableInSlab: number;
    ratePercent: number;
    taxAmount: number;
  }[] = [];

  // Slabs for employee filing type (Single vs Married) in configured order
  const isCouple = employee.filingType === 'दम्पत्ती';
  const defaultSlabCapacities = isCouple
    ? [600000, 200000, 300000, 900000, 3000000, Infinity]
    : [500000, 200000, 300000, 1000000, 3000000, Infinity];

  const relevantSlabs = (taxReference.slabs && taxReference.slabs.length > 0)
    ? [...taxReference.slabs]
    : [
        { fromAmount: 0, toAmount: isCouple ? 600000 : 500000, ratePercent: 1, description: 'पहिलो स्ल्याब (१% सा.सु.कर)' },
        { fromAmount: isCouple ? 600000 : 500000, toAmount: isCouple ? 800000 : 700000, ratePercent: 10, description: 'दोस्रो स्ल्याब (१०%)' },
        { fromAmount: isCouple ? 800000 : 700000, toAmount: isCouple ? 1100000 : 1000000, ratePercent: 20, description: 'तेस्रो स्ल्याब (२०%)' },
        { fromAmount: isCouple ? 1100000 : 1000000, toAmount: 2000000, ratePercent: 30, description: 'चौथो स्ल्याब (३०%)' },
        { fromAmount: 2000000, toAmount: 5000000, ratePercent: 36, description: 'पाँचौं स्ल्याब (३६%)' },
        { fromAmount: 5000000, toAmount: Infinity, ratePercent: 39, description: 'छैटौं स्ल्याब (३९%)' },
      ];

  for (let i = 0; i < relevantSlabs.length; i++) {
    const slab = relevantSlabs[i];
    const toAmt = Number(slab.toAmount);
    const fromAmt = Number(slab.fromAmount);
    const rate = Number(slab.ratePercent) || 0;
    const defaultCap = defaultSlabCapacities[i] ?? Infinity;
    let slabCapacity = 0;

    if (i === 0) {
      slabCapacity = toAmt > 0 ? toAmt : (fromAmt > 0 ? fromAmt : defaultCap);
    } else if (i === relevantSlabs.length - 1) {
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

    if (remainingTaxable <= 0) {
      slabBreakdowns.push({
        slabName: slab.description,
        taxableInSlab: 0,
        ratePercent: rate,
        taxAmount: 0,
      });
      continue;
    }

    const taxableInThisSlab = slabCapacity === Infinity
      ? remainingTaxable
      : Math.min(remainingTaxable, slabCapacity);
    const taxForThisSlab = round2(taxableInThisSlab * (rate / 100));

    slabBreakdowns.push({
      slabName: slab.description,
      taxableInSlab: round2(taxableInThisSlab),
      ratePercent: rate,
      taxAmount: taxForThisSlab,
    });

    grossTax += taxForThisSlab;
    if (slabCapacity !== Infinity) {
      remainingTaxable -= taxableInThisSlab;
    } else {
      remainingTaxable = 0;
    }
  }

  const grossTaxLiabilityWithSST = round2(grossTax);

  // --- Tax Reliefs & Exemptions ---
  // 1. Disability Relief: 50% extra allowance on basic tax / relief
  let disabilityTaxRelief = 0;
  if (deductionSetup.disabilityReliefOverride !== undefined && Number(deductionSetup.disabilityReliefOverride) > 0) {
    disabilityTaxRelief = round2(Number(deductionSetup.disabilityReliefOverride));
  } else if (employee.disability === 'अपाङ्ग भएको') {
    // 50% rebate or basic slab relief
    const firstSlabTax = slabBreakdowns[0]?.taxAmount || 0;
    const disPct = (taxReference.disabilityExemptionPercent || 50) / 100;
    disabilityTaxRelief = round2(firstSlabTax * disPct);
  }

  // 2. Pension SST Exemption: If contributory pension is "भएको", 1% SST on first slab is exempt
  // प्रयोगकर्ताको नियम: कुनै कर्मचारीको योगदान आधारित निवृत्तिभरण "भएको" छ भने त्यस कर्मचारीको सा.सु.कर छुट हुने भएकोले १% सा.सु.कर कट्टी नहुने र "नभएको" छ भने सा.सु.कर कट्टी हुने व्यवस्था
  // यदि कर्मचारीको संचय कोष (EPF) कट्टी भएको र निवृत्तिभरण कोष कट्टी नभएको भए ऊ संचय कोषमा आबद्ध भएकोले १% सा.सु.कर कट्टी हुन्छ।
  const hasContributoryPension =
    employee.pension === 'भएको' &&
    !(
      (epfTotalContributionNormal > 0 || epfOfficeContributionNormal > 0) &&
      pensionTotalContributionNormal === 0 &&
      pensionOfficeContributionNormal === 0
    );

  let pensionSSTExemption = 0;
  const sstSlabs = slabBreakdowns.filter((s) => s.ratePercent === 1);
  const firstSlabSSTGross = round2(sstSlabs.reduce((sum, s) => sum + s.taxAmount, 0));

  if (hasContributoryPension) {
    if (slabBreakdowns.length > 0 && slabBreakdowns[0].ratePercent === 1) {
      pensionSSTExemption = slabBreakdowns[0].taxAmount;
    } else {
      pensionSSTExemption = firstSlabSSTGross;
    }
  } else {
    // निवृत्तिभरण "नभएको" भएमा सा.सु.कर छुट हुँदैन
    pensionSSTExemption = 0;
  }

  // Progressive Remuneration Tax (पारिश्रमिक कर) from higher slabs (> 1%)
  const nonSstSlabs = slabBreakdowns.filter((s) => s.ratePercent !== 1);
  const grossRemunerationTax = round2(nonSstSlabs.reduce((sum, s) => sum + s.taxAmount, 0));

  // Assessed tax before female rebate & medical
  const taxAfterBaseExemptions = Math.max(0, grossTaxLiabilityWithSST - disabilityTaxRelief - pensionSSTExemption);

  // 3. Female Employee Tax Rebate (from statutory ceilings rate for female employee)
  const femaleRebatePercent = (taxReference.femaleTaxRebatePercent !== undefined && Number(taxReference.femaleTaxRebatePercent) > 0)
    ? Number(taxReference.femaleTaxRebatePercent)
    : 10;
  let femaleTaxRebate = 0;
  const isFemale = employee.gender
    ? (employee.gender.trim() === 'महिला' ||
       employee.gender.includes('महिला') ||
       employee.gender.trim().toLowerCase() === 'female' ||
       employee.gender.trim().toLowerCase() === 'f')
    : false;

  if (deductionSetup.femaleTaxRebateOverride !== undefined && Number(deductionSetup.femaleTaxRebateOverride) > 0) {
    femaleTaxRebate = round2(Number(deductionSetup.femaleTaxRebateOverride));
  } else if (isFemale && grossTaxLiabilityWithSST > 0) {
    // महिला कर्मचारी भएमा वार्षिक कर दायित्व रकममा महिला कर छुट प्रतिशत अनुसार गणना
    femaleTaxRebate = round2(grossTaxLiabilityWithSST * (femaleRebatePercent / 100));
  }

  // 4. Medical Tax Credit (औषधी खर्च मिलान रकम) - 15% of actual expense, max 750 or employee custom ceiling
  let medicalTaxCredit = 0;
  if (deductionSetup.medicalExpenseActual && deductionSetup.medicalExpenseActual > 0) {
    const calculatedCredit = deductionSetup.medicalExpenseActual * (taxReference.medicalTaxCreditRatePercent / 100);
    const medMax = deductionSetup.medicalTaxCreditCeilingLimit !== undefined && deductionSetup.medicalTaxCreditCeilingLimit > 0
      ? deductionSetup.medicalTaxCreditCeilingLimit
      : (taxReference.medicalTaxCreditMaxAmount || 750);
    medicalTaxCredit = round2(Math.min(calculatedCredit, medMax));
  }

  // 1% Social Security Tax (सा.सु.कर)
  // प्रयोगकर्ताको सूत्र: (१% ले हुने वार्षिक कर रकम - अपाङ्ग व्यक्तिले पाउने छुट रकम - योगदानमा आधारित निवृत्तिभरण कोष प्राप्त कर्मचारीलाई सा.सु.कर छुट रकम - औषधी उपचार खर्च मिलान - वार्षिक करको १०% छुट (महिला कर्मचारीको लागि मात्र) रकम) / 12
  const annualSST = Math.max(
    0,
    round2(firstSlabSSTGross - disabilityTaxRelief - pensionSSTExemption - medicalTaxCredit - femaleTaxRebate)
  );
  const monthlySST = round2(annualSST / 12);

  // Net Annual Remuneration Tax (sum of higher slabs - applicable reliefs/rebates)
  const annualRemunerationTax = round2(
    Math.max(0, grossRemunerationTax - disabilityTaxRelief - femaleTaxRebate - medicalTaxCredit)
  );
  const monthlyRemunerationTax = round2(annualRemunerationTax / 12);

  // Net Annual Tax Liability
  const netAnnualTaxLiability = round2(
    Math.max(0, taxAfterBaseExemptions - femaleTaxRebate - medicalTaxCredit)
  );

  // Monthly Tax Deduction
  const monthlyTaxDeduction = round2(netAnnualTaxLiability / 12);

  // --- 33 Point Comprehensive Audit & Report Breakdown ---
  const items33: Calculation33Item[] = [
    {
      sn: 1,
      code: 'GRADE_AMT',
      title: 'ग्रेड रकम',
      amount: gradeAmount,
      formula: `ग्रेड दर (${salarySetup.gradeRate}) × अघिल्लो आ.व. असार सम्मको ग्रेड (${prevGradeCount})`,
      remarks: 'मासिक ग्रेड रकम',
      category: 'आय',
    },
    {
      sn: 2,
      code: 'GRADE_PERIOD',
      title: 'ग्रेड अवधि महिना',
      amount: gradePeriodMonths,
      formula: `ग्रेड बृद्धि महिना (${salarySetup.gradeIncreaseMonth}) अनुसार`,
      remarks: `${gradePeriodMonths} महिना`,
      category: 'विवरण',
    },
    {
      sn: 3,
      code: 'GRADE_INC_AMT',
      title: 'ग्रेड बृद्धि पश्चात रकम',
      amount: gradeIncreaseAmount,
      formula: `तलब प्राविधिक ग्रेड समेत + ग्रेड दर (${salarySetup.gradeRate}) × कुल ग्रेड (${prevGradeCount + incGradeCount})`,
      remarks: 'बृद्धि पश्चात मासिक कुल',
      category: 'आय',
    },
    {
      sn: 4,
      code: 'GRADE_INC_PERIOD',
      title: 'ग्रेड बृद्धि अवधि महिना',
      amount: gradeIncreasePeriodMonths,
      formula: `१२ - ग्रेड अवधि महिना (${gradePeriodMonths})`,
      remarks: `${gradeIncreasePeriodMonths} महिना`,
      category: 'विवरण',
    },
    {
      sn: 5,
      code: 'FESTIVAL_EXP',
      title: 'चाडपर्व खर्च',
      amount: festivalAllowance,
      formula: 'तलब प्राविधिक ग्रेड समेत + ग्रेड रकम (१ महिना बराबर)',
      remarks: 'दशैं / चाडपर्व भत्ता',
      category: 'आय',
    },
    {
      sn: 6,
      code: 'DEARNESS_ALL',
      title: 'मंहगी भत्ता रकम',
      amount: dearnessAllowanceAnnual,
      formula: `मासिक मंहगी भत्ता (${salarySetup.dearnessAllowance}) × १२`,
      remarks: 'वार्षिक जम्मा',
      category: 'आय',
    },
    {
      sn: 7,
      code: 'UNIFORM_ALL',
      title: 'पोशाक भत्ता रकम',
      amount: uniformAllowanceAnnual,
      formula: `वार्षिक पोशाक भत्ता`,
      remarks: 'वार्षिक १ पटक',
      category: 'आय',
    },
    {
      sn: 8,
      code: 'REMOTE_ALL',
      title: 'दुर्गम भत्ता रकम',
      amount: remoteAllowanceAnnual,
      formula: `मासिक दुर्गम भत्ता (${salarySetup.remoteAllowance}) × १२`,
      remarks: `वर्ग '${employee.remoteArea}' भत्ता`,
      category: 'आय',
    },
    {
      sn: 9,
      code: 'INCENTIVE_ALL',
      title: 'प्रोत्साहन भत्ता रकम',
      amount: incentiveAllowanceAnnual,
      formula: `मासिक प्रोत्साहन भत्ता (${salarySetup.incentiveAllowance}) × १२`,
      remarks: 'वार्षिक जम्मा',
      category: 'आय',
    },
    {
      sn: 10,
      code: 'OTHER_INC',
      title: 'अन्य आय रकम',
      amount: otherIncomeAnnual,
      formula: 'अन्य आय रकम',
      remarks: 'थप आय',
      category: 'आय',
    },
    {
      sn: 11,
      code: 'EPF_OFFICE_NORM',
      title: 'कर्मचारी संचय कोष थप',
      amount: epfOfficeContributionNormal,
      formula: isContract ? 'करार कर्मचारी भएकोले ०' : '(तलब प्राविधिक ग्रेड समेत + ग्रेड रकम) × १०%',
      remarks: 'कार्यालय थप (मासिक)',
      category: 'आय',
    },
    {
      sn: 12,
      code: 'EPF_OFFICE_INC',
      title: 'कर्मचारी संचयकोष थप ग्रेड बृद्धि पश्चात',
      amount: epfOfficeContributionPostIncrease,
      formula: isContract || gradeIncreasePeriodMonths === 0 ? '०' : 'बृद्धि पश्चात रकम × १०%',
      remarks: 'कार्यालय थप (मासिक)',
      category: 'आय',
    },
    {
      sn: 13,
      code: 'PENSION_OFFICE_NORM',
      title: 'योगदानमा आधारित निवृत्तिभरण रकम थप',
      amount: pensionOfficeContributionNormal,
      formula: hasPension ? '(तलब प्राविधिक ग्रेड समेत + ग्रेड रकम) × ६%' : 'निवृत्तिभरण नभएकोले ०',
      remarks: 'कार्यालय थप (मासिक)',
      category: 'आय',
    },
    {
      sn: 14,
      code: 'PENSION_OFFICE_INC',
      title: 'योगदानमा आधारित निवृत्तिभरण थप ग्रेड बृद्धि पश्चात',
      amount: pensionOfficeContributionPostIncrease,
      formula: hasPension && gradeIncreasePeriodMonths > 0 ? 'बृद्धि पश्चात रकम × ६%' : '०',
      remarks: 'कार्यालय थप (मासिक)',
      category: 'आय',
    },
    {
      sn: 15,
      code: 'EPF_TOTAL_NORM',
      title: 'कर्मचारी संचय कोष जम्मा (कट्टी)',
      amount: epfTotalContributionNormal,
      formula: `कर्मचारी संचय कोष थप (${epfOfficeContributionNormal}) × २`,
      remarks: 'कर्मचारी + कार्यालय जम्मा',
      category: 'कट्टी',
    },
    {
      sn: 16,
      code: 'EPF_TOTAL_INC',
      title: 'कर्मचारी संचय कोष ग्रेड बृद्धि (कट्टी)',
      amount: epfTotalContributionPostIncrease,
      formula: `कर्मचारी संचय कोष थप ग्रेड बृद्धि (${epfOfficeContributionPostIncrease}) × २`,
      remarks: 'बृद्धि अवधिमा जम्मा',
      category: 'कट्टी',
    },
    {
      sn: 17,
      code: 'PENSION_TOTAL_NORM',
      title: 'योगदानमा आधारित निवृत्तिभरण रकम (कट्टी)',
      amount: pensionTotalContributionNormal,
      formula: hasPension ? `निवृत्तिभरण थप (${pensionOfficeContributionNormal}) × २` : '०',
      remarks: 'कर्मचारी + कार्यालय जम्मा',
      category: 'कट्टी',
    },
    {
      sn: 18,
      code: 'PENSION_TOTAL_INC',
      title: 'योगदानमा आधारित निवृत्तिभरण ग्रेड बृद्धि (कट्टी)',
      amount: pensionTotalContributionPostIncrease,
      formula: hasPension && gradeIncreasePeriodMonths > 0 ? `निवृत्तिभरण थप ग्रेड बृद्धि (${pensionOfficeContributionPostIncrease}) × २` : '०',
      remarks: 'बृद्धि अवधिमा जम्मा',
      category: 'कट्टी',
    },
    {
      sn: 19,
      code: 'LIFE_INSURANCE_FUND',
      title: 'सावधिक जीवन बिमा कोष',
      amount: lifeInsuranceFundAnnual,
      formula: `सावधिक जीवन बिमा कोष मासिक (${salarySetup.lifeInsuranceFund}) × २ × १२`,
      remarks: 'वार्षिक जम्मा',
      category: 'कट्टी',
    },
    {
      sn: 20,
      code: 'CIT_DEDUCTION',
      title: 'नागरिक लगानी कोष कट्टी रकम',
      amount: citLimit,
      formula: `नागरिक लगानी कोष मासिक (${deductionSetup.citizenInvestmentTrust}) × १२ (सीमा भित्र)`,
      remarks: 'वार्षिक कट्टी',
      category: 'कट्टी',
    },
    {
      sn: 21,
      code: 'TOTAL_ANNUAL_INCOME',
      title: 'जम्मा वार्षिक आय रकम',
      amount: totalAnnualIncome,
      formula: 'तलब + ग्रेड + भत्ताहरू + चाडपर्व + कार्यालय थप कोषहरू',
      remarks: 'कुल वार्षिक आय',
      category: 'आय',
    },
    {
      sn: 22,
      code: 'TOTAL_ANNUAL_DEDUCTION',
      title: 'जम्मा वार्षिक कट्टी रकम',
      amount: totalAnnualDeductions,
      formula: 'संचय कोष + निवृत्तिभरण + बिमा + सिटिटि + दुर्गम छुट + अन्य',
      remarks: 'कुल वार्षिक कट्टी',
      category: 'कट्टी',
    },
    {
      sn: 23,
      code: 'ANNUAL_TAXABLE_INCOME',
      title: 'वार्षिक कर योग्य आय रकम',
      amount: annualTaxableIncome,
      formula: `जम्मा वार्षिक आय (${totalAnnualIncome}) - जम्मा वार्षिक कट्टी (${totalAnnualDeductions})`,
      remarks: 'कर गणना आधार',
      category: 'विवरण',
    },
    {
      sn: 24,
      code: 'SST_1_PCT',
      title: 'सामाजिक सुरक्षा कर १ प्रतिशत',
      amount: slabBreakdowns[0]?.taxAmount || 0,
      formula: `पहिलो स्ल्याब (${slabBreakdowns[0]?.taxableInSlab || 0}) × १%`,
      remarks: `${slabBreakdowns[0]?.slabName || 'पहिलो स्ल्याब'}`,
      category: 'कर_दायित्व',
    },
    {
      sn: 25,
      code: 'TAX_10_PCT',
      title: 'पारिश्रमिक आय कर १० प्रतिशत',
      amount: slabBreakdowns[1]?.taxAmount || 0,
      formula: `दोश्रो स्ल्याब (${slabBreakdowns[1]?.taxableInSlab || 0}) × १०%`,
      remarks: `${slabBreakdowns[1]?.slabName || '१०% स्ल्याब'}`,
      category: 'कर_दायित्व',
    },
    {
      sn: 26,
      code: 'TAX_20_PCT',
      title: 'पारिश्रमिक आय कर २० प्रतिशत',
      amount: slabBreakdowns[2]?.taxAmount || 0,
      formula: `तेश्रो स्ल्याब (${slabBreakdowns[2]?.taxableInSlab || 0}) × २०%`,
      remarks: `${slabBreakdowns[2]?.slabName || '२०% स्ल्याब'}`,
      category: 'कर_दायित्व',
    },
    {
      sn: 27,
      code: 'TAX_30_PCT',
      title: 'पारिश्रमिक आय कर ३०/२७ प्रतिशत',
      amount: slabBreakdowns[3]?.taxAmount || 0,
      formula: `चौथो स्ल्याब (${slabBreakdowns[3]?.taxableInSlab || 0}) × ${slabBreakdowns[3]?.ratePercent || 30}%`,
      remarks: `${slabBreakdowns[3]?.slabName || 'चौथो स्ल्याब'}`,
      category: 'कर_दायित्व',
    },
    {
      sn: 28,
      code: 'TAX_36_PCT',
      title: 'पारिश्रमिक आय कर ३६ प्रतिशत',
      amount: slabBreakdowns[4]?.taxAmount || 0,
      formula: `पाँचौं स्ल्याब (${slabBreakdowns[4]?.taxableInSlab || 0}) × ३६%`,
      remarks: `${slabBreakdowns[4]?.slabName || 'पाँचौं स्ल्याब'}`,
      category: 'कर_दायित्व',
    },
    {
      sn: 29,
      code: 'DISABILITY_RELIEF',
      title: 'अपाङ्ग व्यक्तिले पाउने छुट रकम',
      amount: disabilityTaxRelief,
      formula: employee.disability === 'अपाङ्ग भएको' ? 'अपाङ्गता कर सहुलियत' : 'लागू नहुने',
      remarks: 'कर दायित्वमा छुट',
      category: 'छुट',
    },
    {
      sn: 30,
      code: 'PENSION_SST_EXEMPT',
      title: 'योगदानमा आधारित निवृत्तिभरण सा.सु.कर छुट',
      amount: pensionSSTExemption,
      formula: hasPension ? '१% सा.सु.कर छुट' : 'लागू नहुने (निवृत्तिभरण नभएको)',
      remarks: hasPension ? 'निवृत्तिभरण भएकोले १% सा.सु.कर पूर्ण छुट' : 'निवृत्तिभरण नभएकोले १% सा.सु.कर कट्टी हुने',
      category: 'छुट',
    },
    {
      sn: 31,
      code: 'FEMALE_TAX_REBATE',
      title: `महिला कर्मचारीलाई छुट कर (${femaleRebatePercent}%)`,
      amount: femaleTaxRebate,
      formula: isFemale ? `कुल कर दायित्व × ${femaleRebatePercent}%` : 'लागू नहुने (पुरुष/अन्य)',
      remarks: isFemale ? 'महिला कर्मचारी कर छुट' : 'लागू नहुने',
      category: 'छुट',
    },
    {
      sn: 32,
      code: 'NET_ANNUAL_TAX',
      title: 'अन्तिम वार्षिक कर दायित्व',
      amount: netAnnualTaxLiability,
      formula: 'कुल कर दायित्व - सबै छुटहरू',
      remarks: 'वार्षिक तिर्नुपर्ने खुद कर',
      category: 'कर_दायित्व',
    },
    {
      sn: 33,
      code: 'MONTHLY_TAX',
      title: 'मासिक कर कट्टी',
      amount: monthlyTaxDeduction,
      formula: `अन्तिम वार्षिक कर दायित्व (${netAnnualTaxLiability}) / १२`,
      remarks: 'मासिक कट्टी हुने कर',
      category: 'कर_दायित्व',
    },
  ];

  return {
    employeeId: employee.id,
    fiscalYear: taxReference.fiscalYear,
    gradeAmount,
    gradePeriodMonths,
    gradeIncreaseAmount,
    gradeIncreasePeriodMonths,
    festivalAllowance,
    dearnessAllowanceAnnual,
    uniformAllowanceAnnual,
    remoteAllowanceAnnual,
    incentiveAllowanceAnnual,
    otherIncomeAnnual,
    epfOfficeContributionNormal,
    epfOfficeContributionPostIncrease,
    pensionOfficeContributionNormal,
    pensionOfficeContributionPostIncrease,
    epfTotalContributionNormal,
    epfTotalContributionPostIncrease,
    pensionTotalContributionNormal,
    pensionTotalContributionPostIncrease,
    lifeInsuranceFundAnnual,
    citDeductionAnnual,
    totalAnnualIncome,
    totalAnnualDeductions,
    annualTaxableIncome,
    taxSlabBreakdowns: slabBreakdowns,
    grossTaxLiabilityWithSST,
    annualSST,
    monthlySST,
    annualRemunerationTax,
    monthlyRemunerationTax,
    disabilityTaxRelief,
    pensionSSTExemption,
    femaleTaxRebate,
    medicalTaxCredit,
    netAnnualTaxLiability,
    monthlyTaxDeduction,
    items33,
  };
}

/**
 * Calculate Single Month Payroll Item for an Employee
 */
export function calculateMonthlySalaryItem(
  employee: Employee,
  salarySetup: SalarySetup,
  deductionSetup: DeductionSetup,
  annualTaxResult: AnnualTaxCalculationResult,
  month: NepaliMonth
): MonthlySalaryItem {
  const monthOrderIndex = MONTH_ORDER.indexOf(month); // 0 (श्रावण) to 11 (अषाढ)
  const incMonthIndex = MONTH_ORDER.indexOf(salarySetup.gradeIncreaseMonth);

  // Col 5 is तलब स्केल (प्राविधिक ग्रेड समेत)
  const basicSalary = salarySetup.basicSalary + (salarySetup.technicalGradeAmount || employee.technicalGradeAmount || 0);
  
  const prevGradeCount = salarySetup.previousGradeCount !== undefined
    ? salarySetup.previousGradeCount
    : (employee.previousGradeCount !== undefined ? employee.previousGradeCount : Math.max(0, salarySetup.currentGradeCount - (salarySetup.gradeIncreaseCount || 0)));

  const totalGradeCount = salarySetup.currentGradeCount !== undefined
    ? salarySetup.currentGradeCount
    : (prevGradeCount + (salarySetup.addedGradeCount ?? salarySetup.gradeIncreaseCount ?? 0));

  const addedGrade = salarySetup.addedGradeCount !== undefined
    ? salarySetup.addedGradeCount
    : (salarySetup.gradeIncreaseCount !== undefined ? salarySetup.gradeIncreaseCount : 0);

  const isGradeFull =
    (salarySetup.gradeIncreaseMonth as string) === 'ग्रेड पुरा' ||
    (employee.gradeIncreaseMonthText && employee.gradeIncreaseMonthText.includes('ग्रेड पुरा')) ||
    (employee.remarks && employee.remarks.includes('ग्रेड पुरा')) ||
    addedGrade <= 0;

  let activeGradeCount: number;

  if (isGradeFull) {
    activeGradeCount = totalGradeCount;
  } else {
    if (incMonthIndex !== -1 && monthOrderIndex >= incMonthIndex) {
      activeGradeCount = prevGradeCount + addedGrade;
    } else {
      activeGradeCount = prevGradeCount;
    }
  }

  const gradeAmount = round2(salarySetup.gradeRate * activeGradeCount);
  const gradeIncreaseAmount = 0; // included directly in gradeAmount for the month

  const currentMonthSalaryWithGrade = basicSalary + gradeAmount;

  const dearnessAllowance = salarySetup.dearnessAllowance;
  // Uniform allowance is paid only in configured uniform month (default: 'चैत्र')
  const uniformMonthName = (salarySetup.uniformAllowanceMonth || employee.uniformAllowanceMonth || 'चैत्र').replace(' महिनामा भुक्तानी', '').trim();
  const uniformAllowance = month === uniformMonthName ? salarySetup.uniformAllowance : 0;
  const remoteAllowance = salarySetup.remoteAllowance;
  const incentiveAllowance = salarySetup.incentiveAllowance;
  
  // Dashain/Festival allowance in configured festival month (default: 'असोज')
  const festMonthName = (salarySetup.festivalBonusMonth || employee.festivalBonusMonth || 'असोज').replace(' महिनामा भुक्तानी', '').trim();
  const festMonthIdx = getNepaliMonthIndex(festMonthName);
  const incMonthIdx = getNepaliMonthIndex(salarySetup.gradeIncreaseMonth);
  const isFestPostInc = addedGrade > 0 && incMonthIdx !== -1 && festMonthIdx !== -1 && incMonthIdx <= festMonthIdx;
  const festMonthSalary = isFestPostInc
    ? (basicSalary + salarySetup.gradeRate * (prevGradeCount + addedGrade))
    : (basicSalary + salarySetup.gradeRate * prevGradeCount);
  const standardFestAllowance = round2(festMonthSalary);

  let festAllowanceAmount = standardFestAllowance;
  if (salarySetup.festivalBonusCustom !== undefined && salarySetup.festivalBonusCustom > 0) {
    const buggyPostIncreaseAmount = round2(basicSalary + salarySetup.gradeRate * (prevGradeCount + addedGrade));
    if (!isFestPostInc && salarySetup.festivalBonusCustom === buggyPostIncreaseAmount) {
      festAllowanceAmount = standardFestAllowance;
    } else if (salarySetup.festivalBonusCustom === standardFestAllowance) {
      festAllowanceAmount = standardFestAllowance;
    } else {
      festAllowanceAmount = salarySetup.festivalBonusCustom;
    }
  }

  const festivalAllowance = month === festMonthName ? festAllowanceAmount : 0;
  const otherIncome = round2(salarySetup.otherIncome / 12);

  const grossSalary = round2(
    currentMonthSalaryWithGrade +
    dearnessAllowance +
    uniformAllowance +
    remoteAllowance +
    incentiveAllowance +
    festivalAllowance +
    otherIncome
  );

  // Employee Deductions
  const isContract = employee.serviceType === 'करार';
  const epfEmployee = isContract ? 0 : round2(currentMonthSalaryWithGrade * 0.10);
  const hasPension = employee.pension === 'भएको';
  const pensionEmployee = hasPension ? round2(currentMonthSalaryWithGrade * 0.06) : 0;

  const citDeduction = deductionSetup.citizenInvestmentTrust;
  const lifeInsuranceDeduction = deductionSetup.investmentInsuranceDeduction || salarySetup.lifeInsuranceFund;
  const loanDeduction = deductionSetup.loanDeduction;
  const otherDeduction = deductionSetup.otherDeduction;
  const taxDeduction = annualTaxResult.monthlyTaxDeduction;

  const totalDeduction = round2(
    epfEmployee +
    pensionEmployee +
    citDeduction +
    lifeInsuranceDeduction +
    loanDeduction +
    otherDeduction +
    taxDeduction
  );

  const netSalary = round2(grossSalary - totalDeduction);

  return {
    employeeId: employee.id,
    employeeCode: employee.code,
    employeeName: employee.name,
    designation: employee.designation,
    level: employee.level,
    month,
    basicSalary,
    gradeAmount,
    gradeIncreaseAmount,
    dearnessAllowance,
    uniformAllowance,
    remoteAllowance,
    incentiveAllowance,
    festivalAllowance,
    otherIncome,
    grossSalary,
    epfEmployee,
    pensionEmployee,
    citDeduction,
    lifeInsuranceDeduction,
    loanDeduction,
    otherDeduction,
    taxDeduction,
    totalDeduction,
    netSalary,
  };
}
