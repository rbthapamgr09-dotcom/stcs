import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Eye,
  CheckCircle2,
  X,
  Building,
  Phone,
  Mail,
  CreditCard,
  Calendar,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Banknote,
  Scissors,
  Percent,
  Coins,
  ShieldCheck,
  Award,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Save,
  Info,
  Download,
  Upload,
  FileSpreadsheet,
  FileText,
  ChevronDown,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { GOVT_LEVELS } from '../../data/ranks';
import {
  Employee,
  SalarySetup,
  DeductionSetup,
  NepaliMonth,
} from '../../types';
import { DualDatePicker } from '../common/DualDatePicker';
import { NepaliNumberInput } from '../common/NepaliNumberInput';
import { NepaliTextInput } from '../common/NepaliTextInput';
import {
  formatNepaliCurrency,
  toNepaliDigits,
  toEnglishDigits,
} from '../../utils/nepaliCalendar';
import { EmployeeExcelExportModal } from './EmployeeExcelExportModal';
import { EmployeeExcelImportModal } from './EmployeeExcelImportModal';
import { downloadEmployeeRegistrationTemplate } from '../../services/employeeExcelTemplateService';
import { maskSensitiveData } from '../../utils/securityUtils';

// Grade Increment Month Dropdown List (श्रावण देखि अषाढ)
const GRADE_MONTHS: NepaliMonth[] = [
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

// Festival Bonus Month Dropdown List (बैशाख महिनामा भुक्तानी देखि चैत्र महिनामा भुक्तानी सम्म)
const FESTIVAL_PAYMENT_MONTHS: string[] = [
  'बैशाख महिनामा भुक्तानी',
  'जेठ महिनामा भुक्तानी',
  'अषाढ महिनामा भुक्तानी',
  'श्रावण महिनामा भुक्तानी',
  'भाद्र महिनामा भुक्तानी',
  'असोज महिनामा भुक्तानी',
  'कार्तिक महिनामा भुक्तानी',
  'मंसिर महिनामा भुक्तानी',
  'पौष महिनामा भुक्तानी',
  'माघ महिनामा भुक्तानी',
  'फागुन महिनामा भुक्तानी',
  'चैत्र महिनामा भुक्तानी',
];

// Uniform Allowance Month Dropdown List (बैशाख महिनामा भुक्तानी देखि चैत्र महिनामा भुक्तानी सम्म)
const UNIFORM_PAYMENT_MONTHS: string[] = [
  'बैशाख महिनामा भुक्तानी',
  'जेठ महिनामा भुक्तानी',
  'अषाढ महिनामा भुक्तानी',
  'श्रावण महिनामा भुक्तानी',
  'भाद्र महिनामा भुक्तानी',
  'असोज महिनामा भुक्तानी',
  'कार्तिक महिनामा भुक्तानी',
  'मंसिर महिनामा भुक्तानी',
  'पौष महिनामा भुक्तानी',
  'माघ महिनामा भुक्तानी',
  'फागुन महिनामा भुक्तानी',
  'चैत्र महिनामा भुक्तानी',
];

export const EmployeeManagementView: React.FC = () => {
  const {
    employees,
    salarySetups,
    deductionSetups,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    annualTaxResults,
    setAuditEmployeeId,
    useDevanagariNumerals,
    hasPermission,
    activeFiscalYear,
    organization,
    activeOrganization,
    isPrivacyMasked,
  } = useApp();

  // Search, Filter & Pagination states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterService, setFilterService] = useState<string>('all');
  const [filterGender, setFilterGender] = useState<string>('all');
  const [filterRemote, setFilterRemote] = useState<string>('all');
  const [filterPension, setFilterPension] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);

  // Step 1: Employee Details State
  const [employeeFormData, setEmployeeFormData] = useState<Omit<Employee, 'id' | 'createdAt'>>({
    code: '',
    name: '',
    serviceGroup: '',
    designation: '',
    level: '',
    serviceType: 'स्थायी',
    gender: 'पुरुष',
    disability: 'अपाङ्ग नभएको',
    remoteArea: 'दुर्गम नभएको',
    pension: 'भएको',
    filingType: 'एकल',
    panNumber: '',
    bankAccount: '',
    bankName: 'राष्ट्रिय वाणिज्य बैंक लिमिटेड',
    joinedDateBS: '२०६३/०१/२४',
    joinedDateAD: '2006-05-07',
    currentPostDateBS: '२०७१/०३/२२',
    currentPostDateAD: '2014-07-06',
    phone: '',
    email: '',
    remarks: '',
  });

  // Step 2 & 3: Salary & Allowance State
  const [salaryFormData, setSalaryFormData] = useState<Partial<SalarySetup>>({
    basicSalary: 35000,
    technicalGradeAmount: 0,
    gradeRate: 1100,
    previousGradeCount: 2,
    addedGradeCount: 1,
    currentGradeCount: 3,
    gradeIncreaseCount: 1,
    gradeIncreaseMonth: 'श्रावण',
    salaryMonthsCount: 12,
    lifeInsuranceFund: 400,
    dearnessAllowance: 2000,
    uniformAllowance: 10000,
    uniformAllowanceMonth: 'चैत्र महिनामा भुक्तानी',
    remoteAllowance: 0,
    incentiveAllowance: 0,
    vehicleAllowance: 0,
    communicationAllowance: 0,
    otherMonthlyAllowance: 0,
    festivalBonusMonth: 'असोज महिनामा भुक्तानी',
    festivalBonusCustom: 0,
    otherIncome: 0,
    otherTaxableIncome: 0,
  });

  // Step 4: Deductions & Tax Reliefs State
  const [deductionFormData, setDeductionFormData] = useState<Partial<DeductionSetup>>({
    citizenInvestmentTrust: 0,
    investmentInsuranceDeduction: 0,
    loanDeduction: 0,
    otherDeduction: 0,
    disabilityReliefOverride: 0,
    pensionSSTExemptOverride: 0,
    medicalExpenseActual: 0,
    femaleTaxRebateOverride: 0,
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Auto calculate total grade count = previousGradeCount + addedGradeCount
  useEffect(() => {
    const prevG = Number(salaryFormData.previousGradeCount || 0);
    const addG = Number(salaryFormData.addedGradeCount || 0);
    const totalG = prevG + addG;
    setSalaryFormData((prev) => ({
      ...prev,
      currentGradeCount: totalG,
      gradeIncreaseCount: addG,
    }));
  }, [salaryFormData.previousGradeCount, salaryFormData.addedGradeCount]);

  // Auto calculate Festival bonus (1 month salary + all grades + tech grade)
  useEffect(() => {
    const totalGrades = (Number(salaryFormData.previousGradeCount) || 0) + (Number(salaryFormData.addedGradeCount) || 0);
    const oneMonthTotal =
      (Number(salaryFormData.basicSalary) || 0) +
      totalGrades * (Number(salaryFormData.gradeRate) || 0) +
      (Number(salaryFormData.technicalGradeAmount) || 0);

    setSalaryFormData((prev) => ({
      ...prev,
      festivalBonusCustom: oneMonthTotal,
    }));
  }, [
    salaryFormData.basicSalary,
    salaryFormData.previousGradeCount,
    salaryFormData.addedGradeCount,
    salaryFormData.gradeRate,
    salaryFormData.technicalGradeAmount,
  ]);

  // Real-time calculation of monthly EPF & Pension for Step 2 preview
  const monthlySalaryWithCurrentGrade = useMemo(() => {
    const basic = Number(salaryFormData.basicSalary || 0);
    const gradeRate = Number(salaryFormData.gradeRate || 0);
    const prevG = Number(salaryFormData.previousGradeCount || 0);
    const addG = Number(salaryFormData.addedGradeCount || 0);
    const tech = Number(salaryFormData.technicalGradeAmount || 0);
    return basic + (prevG + addG) * gradeRate + tech;
  }, [
    salaryFormData.basicSalary,
    salaryFormData.previousGradeCount,
    salaryFormData.addedGradeCount,
    salaryFormData.gradeRate,
    salaryFormData.technicalGradeAmount,
  ]);

  const isContractEmployee = employeeFormData.serviceType === 'करार';
  const hasPensionEmployee = employeeFormData.pension === 'भएको';

  const computedEpfMonthly = useMemo(() => {
    return isContractEmployee ? 0 : Math.round(monthlySalaryWithCurrentGrade * 0.10);
  }, [isContractEmployee, monthlySalaryWithCurrentGrade]);

  const computedPensionMonthly = useMemo(() => {
    return hasPensionEmployee ? Math.round(monthlySalaryWithCurrentGrade * 0.06) : 0;
  }, [hasPensionEmployee, monthlySalaryWithCurrentGrade]);

  // Filtered and searched employees
  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const qEng = toEnglishDigits(q);
    const qNep = toNepaliDigits(q);

    return employees.filter((emp) => {
      const code = String(emp.code || '');
      const codeEng = toEnglishDigits(code).toLowerCase();
      const codeNep = toNepaliDigits(code).toLowerCase();
      const pan = String(emp.panNumber || '').toLowerCase();
      const phone = String(emp.phone || '').toLowerCase();
      const empName = String(emp.name || '').toLowerCase();
      const empDesig = String(emp.designation || '').toLowerCase();
      const empLevel = String(emp.level || '').toLowerCase();
      const empGroup = String(emp.serviceGroup || '').toLowerCase();

      const matchSearch =
        !q ||
        empName.includes(q) ||
        code.toLowerCase().includes(q) ||
        codeEng.includes(qEng) ||
        codeNep.includes(qNep) ||
        empDesig.includes(q) ||
        empLevel.includes(q) ||
        empGroup.includes(q) ||
        pan.includes(q) ||
        pan.includes(qNep) ||
        phone.includes(q) ||
        phone.includes(qNep);

      const matchService = filterService === 'all' || emp.serviceType === filterService;
      const matchGender = filterGender === 'all' || emp.gender === filterGender;
      const matchRemote = filterRemote === 'all' || emp.remoteArea === filterRemote;
      const matchPension = filterPension === 'all' || emp.pension === filterPension;

      return matchSearch && matchService && matchGender && matchRemote && matchPension;
    });
  }, [employees, searchQuery, filterService, filterGender, filterRemote, filterPension]);

  // Paginated records
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage) || 1;
  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredEmployees.slice(start, start + itemsPerPage);
  }, [filteredEmployees, currentPage, itemsPerPage]);

  const handleOpenAdd = () => {
    setEditingEmployee(null);
    setActiveStep(1);
    setEmployeeFormData({
      code: '',
      name: '',
      serviceGroup: '',
      designation: '',
      level: '',
      serviceType: 'स्थायी',
      gender: 'पुरुष',
      disability: 'अपाङ्ग नभएको',
      remoteArea: 'दुर्गम नभएको',
      pension: 'भएको',
      filingType: 'एकल',
      panNumber: '',
      bankAccount: '',
      bankName: 'राष्ट्रिय वाणिज्य बैंक लिमिटेड',
      joinedDateBS: '२०६३/०१/२४',
      joinedDateAD: '2006-05-07',
      currentPostDateBS: '२०७१/०३/२२',
      currentPostDateAD: '2014-07-06',
      phone: '',
      email: '',
      remarks: '',
    });
    setSalaryFormData({
      basicSalary: 35000,
      technicalGradeAmount: 0,
      gradeRate: 1100,
      previousGradeCount: 2,
      addedGradeCount: 1,
      currentGradeCount: 3,
      gradeIncreaseCount: 1,
      gradeIncreaseMonth: 'श्रावण',
      salaryMonthsCount: 12,
      lifeInsuranceFund: 400,
      dearnessAllowance: 2000,
      uniformAllowance: 10000,
      uniformAllowanceMonth: 'चैत्र महिनामा भुक्तानी',
      remoteAllowance: 0,
      incentiveAllowance: 0,
      vehicleAllowance: 0,
      communicationAllowance: 0,
      otherMonthlyAllowance: 0,
      festivalBonusMonth: 'असोज महिनामा भुक्तानी',
      festivalBonusCustom: 38300,
      otherIncome: 0,
      otherTaxableIncome: 0,
    });
    setDeductionFormData({
      citizenInvestmentTrust: 0,
      investmentInsuranceDeduction: 0,
      loanDeduction: 0,
      otherDeduction: 0,
      disabilityReliefOverride: 0,
      pensionSSTExemptOverride: 0,
      medicalExpenseActual: 0,
      femaleTaxRebateOverride: 0,
      healthInsuranceDeduction: 0,
      homeInsuranceDeduction: 0,
    });
    setFormErrors({});
    setIsFormOpen(true);
  };

  const handleOpenEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setActiveStep(1);

    const sal = salarySetups[emp.id];
    const ded = deductionSetups[emp.id];

    setEmployeeFormData({
      ...emp,
      code: toNepaliDigits(emp.code || ''),
      panNumber: toNepaliDigits(emp.panNumber || ''),
      bankAccount: toNepaliDigits(emp.bankAccount || ''),
      serviceGroup: emp.serviceGroup || 'ने.ई./सिभिल/हाईवे',
      currentPostDateBS: emp.currentPostDateBS || '',
      currentPostDateAD: emp.currentPostDateAD || '',
      phone: toNepaliDigits(emp.phone || ''),
      email: emp.email || '',
      remarks: emp.remarks || '',
    });

    const prevG = sal?.previousGradeCount !== undefined ? sal.previousGradeCount : (emp.previousGradeCount || 0);
    const addG = sal?.addedGradeCount !== undefined ? sal.addedGradeCount : (emp.addedGradeCount || 0);

    setSalaryFormData({
      basicSalary: sal?.basicSalary !== undefined ? sal.basicSalary : 35000,
      technicalGradeAmount: sal?.technicalGradeAmount !== undefined ? sal.technicalGradeAmount : (emp.technicalGradeAmount || 0),
      gradeRate: sal?.gradeRate !== undefined ? sal.gradeRate : 1100,
      previousGradeCount: prevG,
      addedGradeCount: addG,
      currentGradeCount: sal?.currentGradeCount !== undefined ? sal.currentGradeCount : (prevG + addG),
      gradeIncreaseCount: addG,
      gradeIncreaseMonth: sal?.gradeIncreaseMonth || 'श्रावण',
      salaryMonthsCount: sal?.salaryMonthsCount || 12,
      lifeInsuranceFund: sal?.lifeInsuranceFund !== undefined ? sal.lifeInsuranceFund : 400,
      dearnessAllowance: sal?.dearnessAllowance !== undefined ? sal.dearnessAllowance : 2000,
      uniformAllowance: sal?.uniformAllowance !== undefined ? sal.uniformAllowance : 10000,
      uniformAllowanceMonth: sal?.uniformAllowanceMonth || (emp.uniformAllowanceMonth ? `${emp.uniformAllowanceMonth} महिनामा भुक्तानी` : 'चैत्र महिनामा भुक्तानी'),
      remoteAllowance: sal?.remoteAllowance || 0,
      incentiveAllowance: sal?.incentiveAllowance || 0,
      vehicleAllowance: sal?.vehicleAllowance || 0,
      communicationAllowance: sal?.communicationAllowance || 0,
      otherMonthlyAllowance: sal?.otherMonthlyAllowance || 0,
      festivalBonusMonth: sal?.festivalBonusMonth || (emp.festivalBonusMonth ? `${emp.festivalBonusMonth} महिनामा भुक्तानी` : 'असोज महिनामा भुक्तानी'),
      festivalBonusCustom: sal?.festivalBonusCustom || 0,
      otherIncome: sal?.otherIncome || 0,
      otherTaxableIncome: sal?.otherTaxableIncome || 0,
    });

    setDeductionFormData({
      citizenInvestmentTrust: ded?.citizenInvestmentTrust || 0,
      investmentInsuranceDeduction: ded?.investmentInsuranceDeduction || 0,
      loanDeduction: ded?.loanDeduction || 0,
      otherDeduction: ded?.otherDeduction || 0,
      disabilityReliefOverride: ded?.disabilityReliefOverride || 0,
      pensionSSTExemptOverride: ded?.pensionSSTExemptOverride || 0,
      medicalExpenseActual: ded?.medicalExpenseActual || 0,
      femaleTaxRebateOverride: ded?.femaleTaxRebateOverride || 0,
      healthInsuranceDeduction: ded?.healthInsuranceDeduction || 0,
      homeInsuranceDeduction: ded?.homeInsuranceDeduction || 0,
    });

    setFormErrors({});
    setIsFormOpen(true);
  };

  const handleEmployeeFieldChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (name === 'code' || name === 'panNumber' || name === 'bankAccount' || name === 'phone') {
      const nepaliVal = toNepaliDigits(value);
      setEmployeeFormData((prev) => ({ ...prev, [name]: nepaliVal }));
    } else {
      setEmployeeFormData((prev) => ({ ...prev, [name]: value }));
    }
    if (name === 'pension') {
      if (value === 'नभएको') {
        setDeductionFormData((prev) => ({ ...prev, pensionSSTExemptOverride: 0 }));
      } else if (value === 'भएको') {
        setDeductionFormData((prev) => ({
          ...prev,
          pensionSSTExemptOverride: employeeFormData.filingType === 'दम्पत्ती' ? 6000 : 5000,
        }));
      }
    }
    if (formErrors[name]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  // Validate Step 1 Before proceeding
  const validateStep1 = (): boolean => {
    const errors: Record<string, string> = {};
    if (!String(employeeFormData.code || '').trim()) {
      errors.code = 'कर्मचारी संकेत नम्बर अनिवार्य छ।';
    }
    if (!String(employeeFormData.name || '').trim()) {
      errors.name = 'कर्मचारीको पूरा नाम अनिवार्य छ।';
    }
    if (!String(employeeFormData.serviceGroup || '').trim()) {
      errors.serviceGroup = 'सेवा / समूह / उपसमूह अनिवार्य छ।';
    }
    if (!String(employeeFormData.designation || '').trim()) {
      errors.designation = 'पद अनिवार्य छ।';
    }
    if (!employeeFormData.level) {
      errors.level = 'श्रेणी / तह अनिवार्य छ।';
    }
    if (!employeeFormData.serviceType) {
      errors.serviceType = 'सेवा प्रकार अनिवार्य छ।';
    }
    if (!employeeFormData.gender) {
      errors.gender = 'लिङ्ग अनिवार्य छ।';
    }
    if (!employeeFormData.filingType) {
      errors.filingType = 'वैवाहिक स्थिती अनिवार्य छ।';
    }
    if (!employeeFormData.disability) {
      errors.disability = 'अपाङ्गता स्थिति अनिवार्य छ।';
    }
    if (!employeeFormData.remoteArea) {
      errors.remoteArea = 'दुर्गम क्षेत्र अनिवार्य छ।';
    }
    if (!employeeFormData.pension) {
      errors.pension = 'योगदानमा आधारित निवृत्तिभरण अनिवार्य छ।';
    }
    if (!String(employeeFormData.joinedDateBS || '').trim()) {
      errors.joinedDateBS = 'सुरु नियुक्ति मिति अनिवार्य छ।';
    }
    if (!String(employeeFormData.currentPostDateBS || '').trim()) {
      errors.currentPostDateBS = 'हालको पदमा बढुवा/सरुवा/नियुक्ति मिति अनिवार्य छ।';
    }
    if (!String(employeeFormData.panNumber || '').trim()) {
      errors.panNumber = 'प्यान नम्बर अनिवार्य छ।';
    }
    if (!String(employeeFormData.bankAccount || '').trim()) {
      errors.bankAccount = 'बैंक खाता नम्बर अनिवार्य छ।';
    }
    if (!String(employeeFormData.bankName || '').trim()) {
      errors.bankName = 'बैंकको नाम अनिवार्य छ।';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return false;
    }
    setFormErrors({});
    return true;
  };

  // Validate Step 2 Before proceeding
  const validateStep2 = (): boolean => {
    const errors: Record<string, string> = {};
    if (salaryFormData.basicSalary === undefined || salaryFormData.basicSalary === null || isNaN(salaryFormData.basicSalary)) {
      errors.basicSalary = 'हालको पदको शुरु तलब स्केल अनिवार्य छ।';
    }
    if (salaryFormData.technicalGradeAmount === undefined || salaryFormData.technicalGradeAmount === null || isNaN(salaryFormData.technicalGradeAmount)) {
      errors.technicalGradeAmount = 'प्राविधिक थप रकम अनिवार्य छ।';
    }
    if (salaryFormData.gradeRate === undefined || salaryFormData.gradeRate === null || isNaN(salaryFormData.gradeRate)) {
      errors.gradeRate = 'ग्रेड दर अनिवार्य छ।';
    }
    if (salaryFormData.previousGradeCount === undefined || salaryFormData.previousGradeCount === null || isNaN(salaryFormData.previousGradeCount)) {
      errors.previousGradeCount = 'अघिल्लो आ.व. सम्मको ग्रेड संख्या अनिवार्य छ।';
    }
    if (salaryFormData.addedGradeCount === undefined || salaryFormData.addedGradeCount === null || isNaN(salaryFormData.addedGradeCount)) {
      errors.addedGradeCount = 'चालु आ.व. मा थप हुने ग्रेड संख्या अनिवार्य छ।';
    }
    if (!salaryFormData.gradeIncreaseMonth) {
      errors.gradeIncreaseMonth = 'ग्रेड बृद्धि हुने महिना अनिवार्य छ।';
    }
    if (!salaryFormData.salaryMonthsCount || isNaN(salaryFormData.salaryMonthsCount) || salaryFormData.salaryMonthsCount <= 0) {
      errors.salaryMonthsCount = 'तलबको अवधि (महिना) अनिवार्य छ।';
    }
    if (salaryFormData.lifeInsuranceFund === undefined || salaryFormData.lifeInsuranceFund === null || isNaN(salaryFormData.lifeInsuranceFund)) {
      errors.lifeInsuranceFund = 'सावधिक जीवन बिमा कोष रकम अनिवार्य छ।';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return false;
    }
    setFormErrors({});
    return true;
  };

  // Validate Step 3 Before proceeding
  const validateStep3 = (): boolean => {
    const errors: Record<string, string> = {};
    if (salaryFormData.dearnessAllowance === undefined || isNaN(salaryFormData.dearnessAllowance)) {
      errors.dearnessAllowance = 'महङ्गी भत्ता अनिवार्य छ।';
    }
    if (salaryFormData.uniformAllowance === undefined || isNaN(salaryFormData.uniformAllowance)) {
      errors.uniformAllowance = 'पोशाक भत्ता अनिवार्य छ।';
    }
    if (!salaryFormData.uniformAllowanceMonth) {
      salaryFormData.uniformAllowanceMonth = 'चैत्र महिनामा भुक्तानी';
    }
    if (salaryFormData.remoteAllowance === undefined || isNaN(salaryFormData.remoteAllowance)) {
      errors.remoteAllowance = 'स्थानीय/दुर्गम भत्ता अनिवार्य छ।';
    }
    if (salaryFormData.incentiveAllowance === undefined || isNaN(salaryFormData.incentiveAllowance)) {
      errors.incentiveAllowance = 'प्रोत्साहन/विशेष भत्ता अनिवार्य छ।';
    }
    if (salaryFormData.vehicleAllowance === undefined || isNaN(salaryFormData.vehicleAllowance)) {
      errors.vehicleAllowance = 'सवारी/इन्धन भत्ता अनिवार्य छ।';
    }
    if (salaryFormData.communicationAllowance === undefined || isNaN(salaryFormData.communicationAllowance)) {
      errors.communicationAllowance = 'सञ्चार/टेलिफोन भत्ता अनिवार्य छ।';
    }
    if (salaryFormData.otherMonthlyAllowance === undefined || isNaN(salaryFormData.otherMonthlyAllowance)) {
      errors.otherMonthlyAllowance = 'अन्य भत्ता अनिवार्य छ।';
    }
    if (!salaryFormData.festivalBonusMonth) {
      errors.festivalBonusMonth = 'चाडपर्व खर्च पाउने महिना अनिवार्य छ।';
    }
    if (salaryFormData.festivalBonusCustom === undefined || isNaN(salaryFormData.festivalBonusCustom)) {
      errors.festivalBonusCustom = 'चाडपर्व खर्च रकम अनिवार्य छ।';
    }
    if (salaryFormData.otherIncome === undefined || isNaN(salaryFormData.otherIncome)) {
      errors.otherIncome = 'अन्य अतिरिक्त आय अनिवार्य छ।';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return false;
    }
    setFormErrors({});
    return true;
  };

  // Validate Step 4 Before saving
  const validateStep4 = (): boolean => {
    const errors: Record<string, string> = {};
    if (deductionFormData.citizenInvestmentTrust === undefined || isNaN(deductionFormData.citizenInvestmentTrust)) {
      errors.citizenInvestmentTrust = 'नागरिक लगानी कोष रकम अनिवार्य छ।';
    }
    if (deductionFormData.investmentInsuranceDeduction === undefined || isNaN(deductionFormData.investmentInsuranceDeduction)) {
      errors.investmentInsuranceDeduction = 'व्यक्तिगत जीवन बिमा प्रिमियम अनिवार्य छ।';
    }
    if (deductionFormData.loanDeduction === undefined || isNaN(deductionFormData.loanDeduction)) {
      errors.loanDeduction = 'सापटी / ऋण कट्टी अनिवार्य छ।';
    }
    if (deductionFormData.otherDeduction === undefined || isNaN(deductionFormData.otherDeduction)) {
      errors.otherDeduction = 'अन्य विविध कट्टी अनिवार्य छ।';
    }
    if (deductionFormData.disabilityReliefOverride === undefined || isNaN(deductionFormData.disabilityReliefOverride)) {
      errors.disabilityReliefOverride = 'अपाङ्ग व्यक्तिले पाउने कर छुट रकम अनिवार्य छ।';
    }
    if (deductionFormData.pensionSSTExemptOverride === undefined || isNaN(deductionFormData.pensionSSTExemptOverride)) {
      errors.pensionSSTExemptOverride = 'सा.सु.कर छुट रकम अनिवार्य छ।';
    }
    if (deductionFormData.medicalExpenseActual === undefined || isNaN(deductionFormData.medicalExpenseActual)) {
      errors.medicalExpenseActual = 'औषधी उपचार खर्च मिलान रकम अनिवार्य छ।';
    }
    if (deductionFormData.femaleTaxRebateOverride === undefined || isNaN(deductionFormData.femaleTaxRebateOverride)) {
      errors.femaleTaxRebateOverride = 'महिला कर्मचारी कर छुट रकम अनिवार्य छ।';
    }
    if (deductionFormData.healthInsuranceDeduction === undefined || isNaN(deductionFormData.healthInsuranceDeduction || 0)) {
      errors.healthInsuranceDeduction = 'स्वास्थ्य बिमा प्रिमियम छुट अनिवार्य छ।';
    }
    if (deductionFormData.homeInsuranceDeduction === undefined || isNaN(deductionFormData.homeInsuranceDeduction || 0)) {
      errors.homeInsuranceDeduction = 'निजी घर बिमा प्रिमियम छुट अनिवार्य छ।';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return false;
    }
    setFormErrors({});
    return true;
  };

  const handleNextFromStep1 = () => {
    if (validateStep1()) {
      setActiveStep(2);
    }
  };

  const handleNextFromStep2 = () => {
    if (validateStep2()) {
      setActiveStep(3);
    }
  };

  const handleNextFromStep3 = () => {
    if (validateStep3()) {
      setActiveStep(4);
    }
  };

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep1()) {
      setActiveStep(1);
      return;
    }
    if (!validateStep2()) {
      setActiveStep(2);
      return;
    }
    if (!validateStep3()) {
      setActiveStep(3);
      return;
    }
    if (!validateStep4()) {
      setActiveStep(4);
      return;
    }

    // Embed key salary fields back to employee model for Kitabkhana salary report backwards compatibility
    const totalGrades = (Number(salaryFormData.previousGradeCount) || 0) + (Number(salaryFormData.addedGradeCount) || 0);
    const updatedEmployeePayload: Omit<Employee, 'id' | 'createdAt'> = {
      ...employeeFormData,
      technicalGradeAmount: Number(salaryFormData.technicalGradeAmount || 0),
      previousGradeCount: Number(salaryFormData.previousGradeCount || 0),
      addedGradeCount: Number(salaryFormData.addedGradeCount || 0),
      gradeIncreaseMonthText: salaryFormData.gradeIncreaseMonth
        ? `${salaryFormData.gradeIncreaseMonth} देखि`
        : 'श्रावण देखि',
      festivalBonusMonth: salaryFormData.festivalBonusMonth
        ? salaryFormData.festivalBonusMonth.replace(' महिनामा भुक्तानी', '')
        : 'असोज',
      uniformAllowanceMonth: salaryFormData.uniformAllowanceMonth
        ? salaryFormData.uniformAllowanceMonth.replace(' महिनामा भुक्तानी', '')
        : 'चैत्र',
    };

    if (editingEmployee) {
      const fullEmp: Employee = {
        ...updatedEmployeePayload,
        id: editingEmployee.id,
        createdAt: editingEmployee.createdAt,
      };
      const ok = updateEmployee(fullEmp, salaryFormData, deductionFormData);
      if (ok) {
        setIsFormOpen(false);
      }
    } else {
      const ok = addEmployee(updatedEmployeePayload, salaryFormData, deductionFormData);
      if (ok) {
        setIsFormOpen(false);
      }
    }
  };

  const formatMoney = (val: number) =>
    formatNepaliCurrency(val, { useDevanagari: useDevanagariNumerals });

  return (
    <div className="space-y-2">
      {/* Top Action & Search Bar (Frozen / Sticky Header) */}
      <div className="sticky -top-4 sm:-top-6 lg:-top-8 z-20 bg-[#F6F8F3] pt-1 sm:pt-2 lg:pt-3 pb-1 -mt-4 sm:-mt-6 lg:-mt-8 space-y-1.5">
        {/* Top Info & Filter Card */}
        <div className="bg-white p-2 rounded-xl border border-[#d6e3d2] shadow-xs space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#edf4ea] border border-[#cbdcc6] text-[#4B6043] flex items-center justify-center shadow-xs">
                <Users className="w-3.5 h-3.5" />
              </div>
              <h2 className="text-xs sm:text-sm font-bold text-[#24331C]">
                कर्मचारी विवरण तथा तलब/आय (Employees Details and Salary Setup)
              </h2>
            </div>
          </div>

          {/* Search & Multi-Filters Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-1.5 pt-1.5 border-t border-[#eaf1e6] text-xs">
            {/* Search Box */}
            <div className="relative lg:col-span-5">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
              <NepaliTextInput
                value={searchQuery}
                onChange={(val) => {
                  setSearchQuery(val);
                  setCurrentPage(1);
                }}
                isNepali={true}
                placeholder="नाम, संकेत नं, पद वा तहबाट खोज्नुहोस्..."
                className="w-full pl-8 pr-10 py-1 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#4B6043]/30 focus:border-[#4B6043]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Service Filter */}
            <div className="lg:col-span-2">
              <select
                value={filterService}
                onChange={(e) => {
                  setFilterService(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full py-1 px-2 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] focus:outline-none focus:ring-1 focus:ring-[#4B6043]/30"
              >
                <option value="all">सबै सेवा (All Services)</option>
                <option value="स्थायी">स्थायी (Permanent)</option>
                <option value="अस्थायी">अस्थायी (Temporary)</option>
                <option value="करार">करार (Contract)</option>
              </select>
            </div>

            {/* Remote Area Filter */}
            <div className="lg:col-span-3">
              <select
                value={filterRemote}
                onChange={(e) => {
                  setFilterRemote(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full py-1 px-2 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] focus:outline-none focus:ring-1 focus:ring-[#4B6043]/30"
              >
                <option value="all">सबै क्षेत्र (All Areas)</option>
                <option value="क">क वर्ग (दुर्गम)</option>
                <option value="ख">ख वर्ग</option>
                <option value="ग">ग वर्ग</option>
                <option value="घ">घ वर्ग</option>
                <option value="ङ">ङ वर्ग</option>
                <option value="दुर्गम नभएको">दुर्गम नभएको</option>
              </select>
            </div>

            {/* Pension Filter */}
            <div className="lg:col-span-2">
              <select
                value={filterPension}
                onChange={(e) => {
                  setFilterPension(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full py-1 px-2 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] focus:outline-none focus:ring-1 focus:ring-[#4B6043]/30"
              >
                <option value="all">निवृत्तिभरण (All)</option>
                <option value="भएको">भएको (Yes)</option>
                <option value="नभएको">नभएको (No)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Action Button Row - Small Compact Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
          <div className="flex flex-wrap items-center gap-1">
            {/* Template Download Dropdown Button */}
            <div className="relative">
              <button
                id="btn-employee-template-download"
                type="button"
                onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                className="px-2 py-1 bg-white hover:bg-emerald-50 text-emerald-800 text-[11px] font-bold rounded-lg transition-all shadow-xs flex items-center gap-1 cursor-pointer border border-emerald-300 dark:border-emerald-700"
                title="नयाँ कर्मचारी दर्ताका लागि Excel Template डाउनलोड गर्नुहोस्"
              >
                <Download className="w-3 h-3 text-emerald-600" />
                <span>Excel Template डाउनलोड</span>
                <ChevronDown className="w-3 h-3 text-emerald-600" />
              </button>

              {showTemplateDropdown && (
                <div
                  id="template-options-dropdown"
                  className="absolute left-0 mt-1 w-64 bg-white rounded-xl shadow-xl border border-[#cbdcc6] py-1 z-30"
                  onClick={() => setShowTemplateDropdown(false)}
                >
                  <button
                    type="button"
                    onClick={() => {
                      downloadEmployeeRegistrationTemplate({
                        fiscalYear: activeFiscalYear,
                        organization,
                        activeOrganization,
                      });
                    }}
                    className="w-full text-left px-3 py-1.5 text-[11px] text-slate-700 hover:bg-[#edf4ea] flex items-center gap-2 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <div>
                      <div className="font-bold text-[#24331C]">खाली दर्ता टेम्प्लेट (नमुना सहित)</div>
                      <div className="text-[9px] text-slate-500">नयाँ कर्मचारीहरूको विवरण भर्नका लागि</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      downloadEmployeeRegistrationTemplate({
                        fiscalYear: activeFiscalYear,
                        organization,
                        activeOrganization,
                        prefillEmployees: employees,
                        salarySetups,
                        deductionSetups,
                      });
                    }}
                    className="w-full text-left px-3 py-1.5 text-[11px] text-slate-700 hover:bg-[#edf4ea] flex items-center gap-2 border-t border-[#eaf1e6] cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <div>
                      <div className="font-bold text-[#24331C]">हालका कर्मचारीहरूको डाटा भरिएको टेम्प्लेट</div>
                      <div className="text-[9px] text-slate-500">
                        विद्यमान {toNepaliDigits(employees.length)} जना कर्मचारीहरूको डाटा सम्पादन गर्न
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Excel Import Button */}
            {hasPermission('EDIT_EMPLOYEE_SALARY') && (
              <button
                id="btn-employee-excel-import"
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className="px-2 py-1 bg-[#0f5132] hover:bg-[#0c4128] text-white text-[11px] font-bold rounded-lg transition-all shadow-xs flex items-center gap-1 cursor-pointer border border-[#0c4128]"
                title="Excel फाइलबाट कर्मचारी विवरण तथा तलब/आय एकमुष्ठ Import गर्नुहोस्"
              >
                <Upload className="w-3 h-3 text-emerald-300" />
                <span>एक्सेल Import</span>
              </button>
            )}

            {/* Excel Export Button */}
            <button
              id="btn-employee-excel-export"
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              className="px-2 py-1 bg-[#1f5a34] hover:bg-[#164326] text-white text-[11px] font-bold rounded-lg transition-all shadow-xs flex items-center gap-1 cursor-pointer border border-[#164326]"
              title="कर्मचारी विवरण तथा तलब/आय Excel मा डाउनलोड गर्नुहोस्"
            >
              <FileSpreadsheet className="w-3 h-3 text-emerald-300" />
              <span>एक्सेल Export</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {hasPermission('EDIT_EMPLOYEE_SALARY') ? (
              <button
                onClick={handleOpenAdd}
                className="px-2.5 py-1 bg-[#2d4029] hover:bg-[#22311f] text-white text-[11px] font-bold rounded-lg transition-all shadow-sm flex items-center gap-1 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>नयाँ कर्मचारी दर्ता</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-medium">
                <span>अवलोकनकर्ता (Viewer) मोड</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Employee Table with Expanded Scrolling Height */}
      <div className="bg-white rounded-xl border border-[#d6e3d2] shadow-xs overflow-hidden flex flex-col" style={{ minHeight: 'calc(100vh - 210px)' }}>
        <div className="p-2.5 border-b border-[#eaf1e6] flex items-center justify-between text-xs text-[#4e6446] bg-[#fbfdfa]">
          <span>
            जम्मा कर्मचारी:{' '}
            <strong className="text-[#24331C]">{toNepaliDigits(filteredEmployees.length)} जना</strong>
          </span>
          <span>
            पृष्ठ {toNepaliDigits(currentPage)} / {toNepaliDigits(totalPages)}
          </span>
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f0f6ed] text-[#2f4227]">
              <tr>
                <th className="p-3 w-12 text-center">क्र.सं.</th>
                <th className="p-3">संकेत नं</th>
                <th className="p-3">कर्मचारीको नाम</th>
                <th className="p-3">पद</th>
                <th className="p-3">श्रेणी/तह</th>
                <th className="p-3">शुरु तलब स्केल</th>
                <th className="p-3 text-center">ग्रेड संख्या</th>
                <th className="p-3">सेवा प्रकार</th>
                <th className="p-3">लिङ्ग / वैवाहिक</th>
                <th className="p-3 text-center">कार्यहरू (Actions)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eaf1e6]">
              {paginatedEmployees.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-gray-500">
                    कुनै कर्मचारी फेला परेन।
                  </td>
                </tr>
              ) : (
                paginatedEmployees.map((emp, index) => {
                  const serialNo = (currentPage - 1) * itemsPerPage + index + 1;
                  const sal = salarySetups[emp.id];
                  const basicSal = sal ? sal.basicSalary : 35000;
                  const totalG = sal ? sal.currentGradeCount : ((emp.previousGradeCount || 0) + (emp.addedGradeCount || 0));

                  return (
                    <tr key={emp.id} className="hover:bg-[#f8faf6] transition-colors">
                      <td className="p-3 text-center text-gray-500 font-mono">
                        {toNepaliDigits(serialNo)}
                      </td>
                      <td className="p-3 font-mono font-bold text-[#4B6043]">
                        {toNepaliDigits(emp.code)}
                      </td>
                      <td className="p-3 font-bold text-[#24331C]">
                        <div>{emp.name}</div>
                        <div className="text-[10px] text-gray-500 font-normal">
                          {emp.serviceGroup || 'सेवा खुला'}{' '}
                          {emp.panNumber &&
                            `| PAN: ${toNepaliDigits(
                              isPrivacyMasked ? maskSensitiveData(emp.panNumber, 'pan') : emp.panNumber
                            )}`}
                        </div>
                      </td>
                      <td className="p-3 text-gray-700 font-medium">{emp.designation}</td>
                      <td className="p-3 text-gray-600 text-[11px]">{emp.level}</td>
                      <td className="p-3 font-mono font-semibold text-[#24331C]">
                        {formatNepaliCurrency(basicSal)}
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-[#4B6043]">
                        {toNepaliDigits(totalG)}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            emp.serviceType === 'स्थायी'
                              ? 'bg-emerald-100 text-emerald-800'
                              : emp.serviceType === 'अस्थायी'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {emp.serviceType}
                        </span>
                      </td>
                      <td className="p-3 text-gray-700">
                        {emp.gender} ({emp.filingType})
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setViewingEmployee(emp)}
                            title="सम्पूर्ण विवरण हेर्नुहोस्"
                            className="p-1.5 text-[#4B6043] hover:bg-[#edf4ea] rounded-lg transition-colors border border-[#cbdcc6] cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {hasPermission('EDIT_EMPLOYEE_SALARY') && (
                            <button
                              onClick={() => handleOpenEdit(emp)}
                              title="सम्पादन गर्नुहोस्"
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200 cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {hasPermission('DELETE_EMPLOYEE') && (
                            <button
                              onClick={() => deleteEmployee(emp.id)}
                              title="हटाउनुहोस् (Delete)"
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3 border-t border-[#eaf1e6] flex flex-wrap items-center justify-between gap-3 text-xs bg-[#fbfdfa]">
          <div className="flex items-center gap-2">
            <span className="text-gray-600 font-medium">प्रति पृष्ठ देखाउने संख्या:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="py-1 px-2 rounded-lg border border-[#ccdcc7] bg-white text-[#24331C] text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#4B6043]"
            >
              <option value={8}>८ जना</option>
              <option value={10}>१० जना</option>
              <option value={25}>२५ जना</option>
              <option value={50}>५० जना</option>
              <option value={100}>१०० जना</option>
              <option value={9999}>सबै (All)</option>
            </select>
            <span className="text-gray-500 text-[11px]">
              (जम्मा {toNepaliDigits(filteredEmployees.length)} मध्ये {toNepaliDigits((currentPage - 1) * itemsPerPage + 1)} - {toNepaliDigits(Math.min(currentPage * itemsPerPage, filteredEmployees.length))})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 border border-[#ccdcc7] rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#edf4ea] flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> अघिल्लो
            </button>
            <span className="font-semibold text-[#4B6043] px-2">
              पृष्ठ {toNepaliDigits(currentPage)} / {toNepaliDigits(totalPages)}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 border border-[#ccdcc7] rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#edf4ea] flex items-center gap-1 cursor-pointer"
            >
              पछिल्लो <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4-Step Registration / Edit Multi-Step Popup Modal */}
      {/* ========================================================================= */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/65 backdrop-blur-xs overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl lg:max-w-6xl w-full border border-[#c8d8c3] overflow-hidden my-auto max-h-[95vh] flex flex-col animate-scaleUp">
            {/* Modal Header Banner */}
            <div className="bg-[#4B6043] text-white px-6 py-4 flex items-center justify-between shrink-0 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingEmployee
                      ? `कर्मचारी विवरण सम्पादन: ${editingEmployee.name}`
                      : 'नयाँ कर्मचारी दर्ता (New Employee Registration)'}
                  </h3>
                  <p className="text-[11px] text-emerald-100">
                    ४-चरणीय दर्ता फाराम (व्यक्तिगत, तलब/ग्रेड, भत्ता/चाडपर्व खर्च, कट्टी तथा कर छुट)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!editingEmployee && (
                  <div className="hidden sm:flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        downloadEmployeeRegistrationTemplate({
                          fiscalYear: activeFiscalYear,
                          organization,
                          activeOrganization,
                        });
                      }}
                      className="px-2.5 py-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer border border-white/20"
                      title="एक्सेल टेम्प्लेट डाउनलोड गर्नुहोस्"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Template</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsFormOpen(false);
                        setIsImportModalOpen(true);
                      }}
                      className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="एक्सेल फाइलबाट एकमुष्ठ दर्ता गर्नुहोस्"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Excel Import</span>
                    </button>
                  </div>
                )}

                <button
                  onClick={() => setIsFormOpen(false)}
                  className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/15 transition-colors cursor-pointer ml-1"
                  title="फाराम बन्द गर्नुहोस्"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 4-Step Indicator Bar */}
            <div className="bg-[#f0f6ed] px-4 sm:px-6 py-3 border-b border-[#d8e5d4] shrink-0">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {/* Step 1 Tab */}
                <button
                  type="button"
                  onClick={() => setActiveStep(1)}
                  className={`p-2.5 rounded-xl text-left transition-all flex items-center gap-2 cursor-pointer ${
                    activeStep === 1
                      ? 'bg-[#4B6043] text-white font-bold shadow-xs'
                      : 'bg-white text-gray-700 hover:bg-[#e4ede1] border border-[#cbdcc6]'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                      activeStep === 1 ? 'bg-white text-[#4B6043]' : 'bg-[#d8e5d4] text-[#24331C]'
                    }`}
                  >
                    १
                  </div>
                  <div className="min-w-0 truncate">
                    <p className="text-[11px] leading-tight truncate">कर्मचारी विवरण</p>
                    <p className={`text-[9px] truncate ${activeStep === 1 ? 'text-emerald-100' : 'text-gray-500'}`}>
                      General Info
                    </p>
                  </div>
                </button>

                {/* Step 2 Tab */}
                <button
                  type="button"
                  onClick={() => {
                    if (validateStep1()) setActiveStep(2);
                  }}
                  className={`p-2.5 rounded-xl text-left transition-all flex items-center gap-2 cursor-pointer ${
                    activeStep === 2
                      ? 'bg-[#4B6043] text-white font-bold shadow-xs'
                      : 'bg-white text-gray-700 hover:bg-[#e4ede1] border border-[#cbdcc6]'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                      activeStep === 2 ? 'bg-white text-[#4B6043]' : 'bg-[#d8e5d4] text-[#24331C]'
                    }`}
                  >
                    २
                  </div>
                  <div className="min-w-0 truncate">
                    <p className="text-[11px] leading-tight truncate">तलब तथा ग्रेड विवरण</p>
                    <p className={`text-[9px] truncate ${activeStep === 2 ? 'text-emerald-100' : 'text-gray-500'}`}>
                      Salary & Grades
                    </p>
                  </div>
                </button>

                {/* Step 3 Tab */}
                <button
                  type="button"
                  onClick={() => {
                    if (validateStep1()) setActiveStep(3);
                  }}
                  className={`p-2.5 rounded-xl text-left transition-all flex items-center gap-2 cursor-pointer ${
                    activeStep === 3
                      ? 'bg-[#4B6043] text-white font-bold shadow-xs'
                      : 'bg-white text-gray-700 hover:bg-[#e4ede1] border border-[#cbdcc6]'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                      activeStep === 3 ? 'bg-white text-[#4B6043]' : 'bg-[#d8e5d4] text-[#24331C]'
                    }`}
                  >
                    ३
                  </div>
                  <div className="min-w-0 truncate">
                    <p className="text-[11px] leading-tight truncate">भत्ता तथा चाडपर्व खर्च</p>
                    <p className={`text-[9px] truncate ${activeStep === 3 ? 'text-emerald-100' : 'text-gray-500'}`}>
                      Allowances & Bonus
                    </p>
                  </div>
                </button>

                {/* Step 4 Tab */}
                <button
                  type="button"
                  onClick={() => {
                    if (validateStep1()) setActiveStep(4);
                  }}
                  className={`p-2.5 rounded-xl text-left transition-all flex items-center gap-2 cursor-pointer ${
                    activeStep === 4
                      ? 'bg-[#4B6043] text-white font-bold shadow-xs'
                      : 'bg-white text-gray-700 hover:bg-[#e4ede1] border border-[#cbdcc6]'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                      activeStep === 4 ? 'bg-white text-[#4B6043]' : 'bg-[#d8e5d4] text-[#24331C]'
                    }`}
                  >
                    ४
                  </div>
                  <div className="min-w-0 truncate">
                    <p className="text-[11px] leading-tight truncate">कट्टी तथा कर छुट</p>
                    <p className={`text-[9px] truncate ${activeStep === 4 ? 'text-emerald-100' : 'text-gray-500'}`}>
                      Deductions & Reliefs
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Modal Body Container with Step-Specific Render */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs">
              {/* ========================================================================= */}
              {/* STEP 1: कर्मचारीको विवरण (Employee Details) */}
              {/* ========================================================================= */}
              {activeStep === 1 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="bg-[#f7faf5] p-3.5 rounded-xl border border-[#dce8d9] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#4B6043]" />
                      <h4 className="font-bold text-sm text-[#24331C]">
                        १. कर्मचारीको व्यक्तिगत तथा सेवा सम्बन्धी विवरण (Employee Details)
                      </h4>
                    </div>
                    <span className="text-[11px] text-red-600 font-semibold">
                      * रातो तारा भएका सबै फिल्ड अनिवार्य छन्
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-[#304426] mb-1">
                        कर्मचारी संकेत नम्बर (Code) <span className="text-red-500 font-bold">*</span>
                      </label>
                      <NepaliTextInput
                        name="code"
                        value={employeeFormData.code}
                        onChange={(val) => setEmployeeFormData((prev) => ({ ...prev, code: val }))}
                        isNepali={false}
                        placeholder="क.सं.नं."
                        className={`w-full p-2 rounded-lg border bg-white text-[#24331C] font-mono focus:ring-2 focus:ring-[#4B6043]/30 focus:border-[#4B6043] outline-none ${
                          formErrors.code ? 'border-red-400 bg-red-50/20' : 'border-[#c8d7c2]'
                        }`}
                      />
                      {formErrors.code && <p className="text-red-500 text-[11px] mt-0.5">{formErrors.code}</p>}
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-[#304426] mb-1">
                        कर्मचारीको पूरा नाम (Employee Name) <span className="text-red-500 font-bold">*</span>
                      </label>
                      <NepaliTextInput
                        name="name"
                        value={employeeFormData.name}
                        onChange={(val) => setEmployeeFormData((prev) => ({ ...prev, name: val }))}
                        isNepali={true}
                        placeholder="नाम, थर"
                        className={`w-full p-2 rounded-lg border bg-white text-[#24331C] font-bold focus:ring-2 focus:ring-[#4B6043]/30 focus:border-[#4B6043] outline-none ${
                          formErrors.name ? 'border-red-400 bg-red-50/20' : 'border-[#c8d7c2]'
                        }`}
                      />
                      {formErrors.name && <p className="text-red-500 text-[11px] mt-0.5">{formErrors.name}</p>}
                    </div>

                    <div>
                      <label className="block font-semibold text-[#304426] mb-1">
                        सेवा / समूह / उपसमूह (Service / Group) <span className="text-red-500 font-bold">*</span>
                      </label>
                      <NepaliTextInput
                        name="serviceGroup"
                        value={employeeFormData.serviceGroup || ''}
                        onChange={(val) => setEmployeeFormData((prev) => ({ ...prev, serviceGroup: val }))}
                        isNepali={true}
                        placeholder="ने.ई./सिभिल/हाईवे"
                        className={`w-full p-2 rounded-lg border bg-white text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 focus:border-[#4B6043] outline-none ${
                          formErrors.serviceGroup ? 'border-red-400 bg-red-50/20' : 'border-[#c8d7c2]'
                        }`}
                      />
                      {formErrors.serviceGroup && (
                        <p className="text-red-500 text-[11px] mt-0.5">{formErrors.serviceGroup}</p>
                      )}
                    </div>

                    <div>
                      <label className="block font-semibold text-[#304426] mb-1">
                        पद (Designation) <span className="text-red-500 font-bold">*</span>
                      </label>
                      <NepaliTextInput
                        name="designation"
                        value={employeeFormData.designation}
                        onChange={(val) => setEmployeeFormData((prev) => ({ ...prev, designation: val }))}
                        isNepali={true}
                        placeholder="पद (जस्तै: इन्जिनियर / लेखापाल)"
                        className={`w-full p-2 rounded-lg border bg-white text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 focus:border-[#4B6043] outline-none ${
                          formErrors.designation ? 'border-red-400 bg-red-50/20' : 'border-[#c8d7c2]'
                        }`}
                      />
                      {formErrors.designation && (
                        <p className="text-red-500 text-[11px] mt-0.5">{formErrors.designation}</p>
                      )}
                    </div>

                    <div>
                      <label className="block font-semibold text-[#304426] mb-1">
                        श्रेणी / तह (Rank / Level) <span className="text-red-500 font-bold">*</span>
                      </label>
                      <select
                        name="level"
                        value={employeeFormData.level}
                        onChange={handleEmployeeFieldChange}
                        className={`w-full p-2 rounded-lg border bg-white focus:ring-2 focus:ring-[#4B6043]/30 focus:border-[#4B6043] outline-none ${
                          !employeeFormData.level ? 'text-gray-400' : 'text-[#24331C]'
                        } ${formErrors.level ? 'border-red-400 bg-red-50/20' : 'border-[#c8d7c2]'}`}
                      >
                        <option value="" disabled className="text-gray-400">
                          श्रेणी / तह छान्नुहोस्
                        </option>
                        {GOVT_LEVELS.map((lvl) => (
                          <option key={lvl} value={lvl} className="text-[#24331C]">
                            {lvl}
                          </option>
                        ))}
                      </select>
                      {formErrors.level && <p className="text-red-500 text-[11px] mt-0.5">{formErrors.level}</p>}
                    </div>

                    <div>
                      <label className="block font-semibold text-[#304426] mb-1">
                        सेवा प्रकार (Service) <span className="text-red-500 font-bold">*</span>
                      </label>
                      <select
                        name="serviceType"
                        value={employeeFormData.serviceType}
                        onChange={handleEmployeeFieldChange}
                        className="w-full p-2 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                      >
                        <option value="स्थायी">स्थायी (Permanent)</option>
                        <option value="अस्थायी">अस्थायी (Temporary)</option>
                        <option value="करार">करार (Contract)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#304426] mb-1">
                        लिङ्ग (Gender) <span className="text-red-500 font-bold">*</span>
                      </label>
                      <select
                        name="gender"
                        value={employeeFormData.gender}
                        onChange={handleEmployeeFieldChange}
                        className="w-full p-2 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                      >
                        <option value="पुरुष">पुरुष (Male)</option>
                        <option value="महिला">महिला (Female)</option>
                        <option value="अन्य">अन्य (Others)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#304426] mb-1">
                        वैवाहिक स्थिती (Marital Status) <span className="text-red-500 font-bold">*</span>
                      </label>
                      <select
                        name="filingType"
                        value={employeeFormData.filingType}
                        onChange={handleEmployeeFieldChange}
                        className="w-full p-2 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                      >
                        <option value="दम्पत्ती">दम्पत्ती (Couple)</option>
                        <option value="एकल">एकल (Single)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#304426] mb-1">
                        अपाङ्गता स्थिति (Disability Status) <span className="text-red-500 font-bold">*</span>
                      </label>
                      <select
                        name="disability"
                        value={employeeFormData.disability}
                        onChange={handleEmployeeFieldChange}
                        className="w-full p-2 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                      >
                        <option value="अपाङ्ग नभएको">अपाङ्ग नभएको (No)</option>
                        <option value="अपाङ्ग भएको">अपाङ्ग भएको (Yes)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#304426] mb-1">
                        दुर्गम क्षेत्र (Remote) <span className="text-red-500 font-bold">*</span>
                      </label>
                      <select
                        name="remoteArea"
                        value={employeeFormData.remoteArea}
                        onChange={handleEmployeeFieldChange}
                        className="w-full p-2 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                      >
                        <option value="दुर्गम नभएको">दुर्गम नभएको</option>
                        <option value="क">क वर्ग</option>
                        <option value="ख">ख वर्ग</option>
                        <option value="ग">ग वर्ग</option>
                        <option value="घ">घ वर्ग</option>
                        <option value="ङ">ङ वर्ग</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#304426] mb-1">
                        योगदानमा आधारित निवृत्तिभरण <span className="text-red-500 font-bold">*</span>
                      </label>
                      <select
                        name="pension"
                        value={employeeFormData.pension}
                        onChange={handleEmployeeFieldChange}
                        className="w-full p-2 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                      >
                        <option value="भएको">भएको</option>
                        <option value="नभएको">नभएको</option>
                      </select>
                    </div>
                  </div>

                  {/* Dual BS / AD Appointment & Promotion Dates */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#eaf1e6]">
                    <DualDatePicker
                      label="सुरु नियुक्ति मिति (Initial Appointment Date)"
                      bsValue={employeeFormData.joinedDateBS}
                      adValue={employeeFormData.joinedDateAD}
                      required={true}
                      error={formErrors.joinedDateBS}
                      onChange={({ bs, ad }) =>
                        setEmployeeFormData((prev) => ({ ...prev, joinedDateBS: bs, joinedDateAD: ad }))
                      }
                    />
                    <DualDatePicker
                      label="हालको पदमा बढुवा/सरुवा/नियुक्ति मिति (Current Post Date)"
                      bsValue={employeeFormData.currentPostDateBS || ''}
                      adValue={employeeFormData.currentPostDateAD || ''}
                      required={true}
                      error={formErrors.currentPostDateBS}
                      onChange={({ bs, ad }) =>
                        setEmployeeFormData((prev) => ({ ...prev, currentPostDateBS: bs, currentPostDateAD: ad }))
                      }
                    />
                  </div>

                  {/* Identification and Bank Accounts */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#eaf1e6]">
                    <div>
                      <label className="block font-semibold text-[#304426] mb-1">
                        प्यान नम्बर (PAN) <span className="text-red-500 font-bold">*</span>
                      </label>
                      <NepaliTextInput
                        name="panNumber"
                        value={employeeFormData.panNumber || ''}
                        onChange={(val) => setEmployeeFormData((prev) => ({ ...prev, panNumber: val }))}
                        isNepali={false}
                        placeholder="१०२३४५६७८"
                        className={`w-full p-2 rounded-lg border bg-white text-[#24331C] font-mono focus:ring-2 focus:ring-[#4B6043]/30 outline-none ${
                          formErrors.panNumber ? 'border-red-400 bg-red-50/20' : 'border-[#c8d7c2]'
                        }`}
                      />
                      {formErrors.panNumber && (
                        <p className="text-red-500 text-[11px] mt-0.5">{formErrors.panNumber}</p>
                      )}
                    </div>

                    <div>
                      <label className="block font-semibold text-[#304426] mb-1">
                        बैंक खाता नम्बर <span className="text-red-500 font-bold">*</span>
                      </label>
                      <NepaliTextInput
                        name="bankAccount"
                        value={employeeFormData.bankAccount || ''}
                        onChange={(val) => setEmployeeFormData((prev) => ({ ...prev, bankAccount: val }))}
                        isNepali={false}
                        placeholder="००१२३४५६७८९०१"
                        className={`w-full p-2 rounded-lg border bg-white text-[#24331C] font-mono focus:ring-2 focus:ring-[#4B6043]/30 outline-none ${
                          formErrors.bankAccount ? 'border-red-400 bg-red-50/20' : 'border-[#c8d7c2]'
                        }`}
                      />
                      {formErrors.bankAccount && (
                        <p className="text-red-500 text-[11px] mt-0.5">{formErrors.bankAccount}</p>
                      )}
                    </div>

                    <div>
                      <label className="block font-semibold text-[#304426] mb-1">
                        बैंकको नाम <span className="text-red-500 font-bold">*</span>
                      </label>
                      <NepaliTextInput
                        name="bankName"
                        value={employeeFormData.bankName || ''}
                        onChange={(val) => setEmployeeFormData((prev) => ({ ...prev, bankName: val }))}
                        isNepali={true}
                        placeholder="राष्ट्रिय वाणिज्य बैंक लिमिटेड"
                        className={`w-full p-2 rounded-lg border bg-white text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 outline-none ${
                          formErrors.bankName ? 'border-red-400 bg-red-50/20' : 'border-[#c8d7c2]'
                        }`}
                      />
                      {formErrors.bankName && (
                        <p className="text-red-500 text-[11px] mt-0.5">{formErrors.bankName}</p>
                      )}
                    </div>
                  </div>

                  {/* Optional contact and remarks */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#eaf1e6]">
                    <div>
                      <label className="block font-semibold text-[#304426] mb-1">फोन / मोबाइल नं.</label>
                      <NepaliTextInput
                        name="phone"
                        value={employeeFormData.phone || ''}
                        onChange={(val) => setEmployeeFormData((prev) => ({ ...prev, phone: val }))}
                        isNepali={false}
                        placeholder="९८४१००००००"
                        className="w-full p-2 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] font-mono focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#304426] mb-1">इमेल ठेगाना</label>
                      <NepaliTextInput
                        type="email"
                        name="email"
                        value={employeeFormData.email || ''}
                        onChange={(val) => setEmployeeFormData((prev) => ({ ...prev, email: val }))}
                        isNepali={false}
                        placeholder="employee@gov.np"
                        className="w-full p-2 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#304426] mb-1">कैफियत (Remarks)</label>
                      <NepaliTextInput
                        name="remarks"
                        value={employeeFormData.remarks || ''}
                        onChange={(val) => setEmployeeFormData((prev) => ({ ...prev, remarks: val }))}
                        isNepali={true}
                        placeholder="जस्तै: ग्रेड पूरा भएको / विशेष व्यवस्था"
                        className="w-full p-2 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                      />
                    </div>
                  </div>

                  {/* Step 1 Actions */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#d8e4d3]">
                    <button
                      type="button"
                      onClick={() => setIsFormOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                    >
                      रद्द गर्नुहोस् (Cancel)
                    </button>
                    <button
                      type="button"
                      onClick={handleNextFromStep1}
                      className="px-6 py-2 text-xs font-bold text-white bg-[#4B6043] hover:bg-[#384c31] rounded-lg transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
                    >
                      <span>अगाडी जानुहोस् (Next)</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* STEP 2: तलब, प्राविधिक थप तथा ग्रेड विवरण (Basic salary & Grades) */}
              {/* ========================================================================= */}
              {activeStep === 2 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="bg-[#f7faf5] p-3.5 rounded-xl border border-[#dce8d9] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Banknote className="w-4 h-4 text-[#4B6043]" />
                      <h4 className="font-bold text-sm text-[#24331C]">
                        २. तलब, प्राविधिक थप तथा ग्रेड विवरण (Basic salary & Grades)
                      </h4>
                    </div>
                    <span className="text-[11px] text-emerald-800 font-medium">
                      नेपाली युनिकोड अंकमा स्वतः गणना
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Basic Monthly Salary */}
                    <div className="bg-white p-3 rounded-xl border border-[#c8d7c2] space-y-1">
                      <label className="block font-semibold text-[#304426]">
                        हालको पदको शुरु तलब स्केल (मासिक)
                      </label>
                      <NepaliNumberInput
                        value={salaryFormData.basicSalary}
                        onChange={(val) => setSalaryFormData((prev) => ({ ...prev, basicSalary: val }))}
                        placeholder="३५,०००"
                        className="w-full p-2 text-xs rounded-lg border border-[#c8d7c2] bg-[#fbfdfa] text-[#24331C] font-mono font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                      />
                      <p className="text-[10px] text-gray-500">मासिक आधारभूत तलब स्केल</p>
                    </div>

                    {/* Technical Grade Amount */}
                    <div className="bg-white p-3 rounded-xl border border-[#c8d7c2] space-y-1">
                      <label className="block font-semibold text-[#304426] leading-tight">
                        ०५७/४/१ भन्दा अगाडी नियुक्त प्राविधिक कर्मचारीको तलबमानमा थप रकम (०७३ असार मसान्तसम्म खाइपाई आएको प्राविधिक ग्रेडको रकम)
                      </label>
                      <NepaliNumberInput
                        value={salaryFormData.technicalGradeAmount}
                        onChange={(val) => setSalaryFormData((prev) => ({ ...prev, technicalGradeAmount: val }))}
                        placeholder="०"
                        className="w-full p-2 text-xs rounded-lg border border-[#c8d7c2] bg-[#fbfdfa] text-[#24331C] font-mono font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                      />
                      <p className="text-[10px] text-gray-500">०५७/०४/०१ भन्दा अगाडीका प्राविधिक पदको खाइपाई आएको थप रकम</p>
                    </div>

                    {/* Grade Rate */}
                    <div className="bg-white p-3 rounded-xl border border-[#c8d7c2] space-y-1">
                      <label className="block font-semibold text-[#304426]">
                        ग्रेड दर (Grade Rate)
                      </label>
                      <NepaliNumberInput
                        value={salaryFormData.gradeRate}
                        onChange={(val) => setSalaryFormData((prev) => ({ ...prev, gradeRate: val }))}
                        placeholder="१,१००"
                        className="w-full p-2 text-xs rounded-lg border border-[#c8d7c2] bg-[#fbfdfa] text-[#24331C] font-mono font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                      />
                      <p className="text-[10px] text-gray-500">प्रति ग्रेड मासिक रकम</p>
                    </div>

                    {/* Previous FY Grade Count */}
                    <div className="bg-white p-3 rounded-xl border border-[#c8d7c2] space-y-1">
                      <label className="block font-semibold text-[#304426]">
                        अघिल्लो आ.व. असार सम्मको ग्रेड संख्या
                      </label>
                      <NepaliNumberInput
                        value={salaryFormData.previousGradeCount}
                        onChange={(val) => setSalaryFormData((prev) => ({ ...prev, previousGradeCount: val }))}
                        allowDecimals={false}
                        formatDecimalOnBlur={false}
                        placeholder="०"
                        className="w-full p-2 text-xs rounded-lg border border-[#c8d7c2] bg-[#fbfdfa] text-[#24331C] font-mono font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                      />
                      <p className="text-[10px] text-gray-500">अघिल्लो आ.व. सम्म खाइपाई आएको</p>
                    </div>

                    {/* Added Grade in Current FY */}
                    <div className="bg-white p-3 rounded-xl border border-[#c8d7c2] space-y-1">
                      <label className="block font-semibold text-[#304426]">
                        चालु आ.व. मा थप हुने ग्रेड संख्या
                      </label>
                      <NepaliNumberInput
                        value={salaryFormData.addedGradeCount}
                        onChange={(val) => setSalaryFormData((prev) => ({ ...prev, addedGradeCount: val }))}
                        allowDecimals={false}
                        formatDecimalOnBlur={false}
                        placeholder="०"
                        className="w-full p-2 text-xs rounded-lg border border-[#c8d7c2] bg-[#fbfdfa] text-[#24331C] font-mono font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                      />
                      <p className="text-[10px] text-gray-500">चालु आ.व. मा वृद्धि हुने ग्रेड</p>
                    </div>

                    {/* Total Grade Count (Auto-calculated) */}
                    <div className="bg-[#edf5eb] p-3 rounded-xl border border-[#b8d4b3] space-y-1">
                      <label className="block font-bold text-[#1f3817] flex items-center justify-between">
                        <span>कुल ग्रेड संख्या (Total Grades)</span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                          स्वतः योग
                        </span>
                      </label>
                      <div className="p-2 text-xs rounded-lg bg-white border border-[#b8d4b3] text-[#24331C] font-mono font-extrabold text-sm">
                        {toNepaliDigits(salaryFormData.currentGradeCount || 0)}
                      </div>
                      <p className="text-[10px] text-[#426139]">
                        (अघिल्लो {toNepaliDigits(salaryFormData.previousGradeCount || 0)} + चालु {toNepaliDigits(salaryFormData.addedGradeCount || 0)})
                      </p>
                    </div>

                    {/* Grade Increment Month Dropdown List (श्रावण देखि अषाढ) */}
                    <div className="bg-white p-3 rounded-xl border border-[#c8d7c2] space-y-1">
                      <label className="block font-semibold text-[#304426]">
                        ग्रेड बृद्धि हुने महिना
                      </label>
                      <select
                        value={salaryFormData.gradeIncreaseMonth || 'श्रावण'}
                        onChange={(e) =>
                          setSalaryFormData((prev) => ({
                            ...prev,
                            gradeIncreaseMonth: e.target.value as NepaliMonth,
                          }))
                        }
                        className="w-full p-2 text-xs rounded-lg border border-[#c8d7c2] bg-[#fbfdfa] text-[#24331C] font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                      >
                        {GRADE_MONTHS.map((m) => (
                          <option key={m} value={m}>
                            {m} महिना देखि
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-gray-500">श्रावण देखि अषाढ सम्म छान्नुहोस्</p>
                    </div>

                    {/* Salary Duration (Months) */}
                    <div className="bg-white p-3 rounded-xl border border-[#c8d7c2] space-y-1">
                      <label className="block font-semibold text-[#304426]">
                        तलबको अवधि (महिना)
                      </label>
                      <NepaliNumberInput
                        value={salaryFormData.salaryMonthsCount}
                        onChange={(val) => setSalaryFormData((prev) => ({ ...prev, salaryMonthsCount: val }))}
                        allowDecimals={false}
                        formatDecimalOnBlur={false}
                        placeholder="१२"
                        className="w-full p-2 text-xs rounded-lg border border-[#c8d7c2] bg-[#fbfdfa] text-[#24331C] font-mono font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                      />
                      <p className="text-[10px] text-gray-500">सामान्यतया १२ महिना</p>
                    </div>

                    {/* Spacer / Empty Div to align next elements to a fresh row */}
                    <div className="hidden sm:block" />

                    {/* कर्मचारी संचय कोष (मासिक) */}
                    <div className="bg-[#f0f7f4] p-3 rounded-xl border border-[#bcdcc9] space-y-1">
                      <label className="block font-bold text-[#1f402b] flex items-center justify-between">
                        <span>कर्मचारी संचय कोष (मासिक)</span>
                        <span className="text-[9px] bg-[#dbebe1] text-[#1f402b] px-1.5 py-0.5 rounded font-bold">
                          स्वतः गणना
                        </span>
                      </label>
                      <div className="p-2 text-xs rounded-lg bg-white border border-[#bcdcc9] text-[#24331C] font-mono font-extrabold text-sm min-h-[34px] flex items-center">
                        {isContractEmployee ? 'रु. ०.००' : formatNepaliCurrency(computedEpfMonthly, { useDevanagari: useDevanagariNumerals, showSymbol: true })}
                      </div>
                      <p className="text-[10px] text-gray-500">
                        {isContractEmployee ? 'करार कर्मचारी भएकोले कोष कट्टी हुँदैन' : '(तलब + ग्रेड) को १०% कट्टी'}
                      </p>
                    </div>

                    {/* सावधिक जीवन बिमा कोष (मासिक) */}
                    <div className="bg-white p-3 rounded-xl border border-[#c8d7c2] space-y-1">
                      <label className="block font-semibold text-[#304426]">
                        सावधिक जीवन बिमा कोष (मासिक)
                      </label>
                      <NepaliNumberInput
                        value={salaryFormData.lifeInsuranceFund}
                        onChange={(val) => setSalaryFormData((prev) => ({ ...prev, lifeInsuranceFund: val }))}
                        placeholder="४००"
                        className="w-full p-2 text-xs rounded-lg border border-[#c8d7c2] bg-[#fbfdfa] text-[#24331C] font-mono font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                      />
                      <p className="text-[10px] text-gray-500">सावधिक जीवन बिमा कोष मासिक कट्टी (उदा: रु ४००)</p>
                    </div>

                    {/* योगदानमा आधारित निवृत्तिभरण कोष (मासिक) */}
                    <div className="bg-[#f0f7f4] p-3 rounded-xl border border-[#bcdcc9] space-y-1">
                      <label className="block font-bold text-[#1f402b] flex items-center justify-between">
                        <span>योगदानमा आधारित निवृत्तिभरण कोष (मासिक)</span>
                        <span className="text-[9px] bg-[#dbebe1] text-[#1f402b] px-1.5 py-0.5 rounded font-bold">
                          स्वतः गणना
                        </span>
                      </label>
                      <div className="p-2 text-xs rounded-lg bg-white border border-[#bcdcc9] text-[#24331C] font-mono font-extrabold text-sm min-h-[34px] flex items-center">
                        {!hasPensionEmployee ? 'रु. ०.००' : formatNepaliCurrency(computedPensionMonthly, { useDevanagari: useDevanagariNumerals, showSymbol: true })}
                      </div>
                      <p className="text-[10px] text-gray-500">
                        {!hasPensionEmployee ? 'निवृत्तिभरण लागू नभएको' : '(तलब + ग्रेड) को ६% कट्टी'}
                      </p>
                    </div>
                  </div>

                  {/* Summary calculation card */}
                  <div className="bg-[#f0f6ed] p-3 rounded-xl border border-[#cfe0cc] text-xs flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#4B6043]" />
                      <span className="font-bold text-[#24331C]">
                        हालको ग्रेड सहित मासिक तलब:{' '}
                        <strong className="text-[#4B6043] font-mono text-sm">
                          {formatNepaliCurrency((salaryFormData.basicSalary || 0) + (salaryFormData.gradeRate || 0) * (salaryFormData.currentGradeCount || 0) + (salaryFormData.technicalGradeAmount || 0))}
                        </strong>
                      </span>
                    </div>
                    <span className="text-[11px] text-gray-600">
                      (शुरु तलब + ग्रेड रकम + प्राविधिक थप)
                    </span>
                  </div>

                  {/* Step 2 Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-[#d8e4d3]">
                    <button
                      type="button"
                      onClick={() => setIsFormOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                    >
                      रद्द गर्नुहोस् (Cancel)
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveStep(1)}
                        className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>पछाडी जानुहोस् (Previous)</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleNextFromStep2}
                        className="px-6 py-2 text-xs font-bold text-white bg-[#4B6043] hover:bg-[#384c31] rounded-lg transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
                      >
                        <span>अगाडी जानुहोस् (Next)</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* STEP 3: मासिक तथा वार्षिक नियमित भत्ताहरू & चाडपर्व खर्च तथा अन्य अतिरिक्त आय */}
              {/* ========================================================================= */}
              {activeStep === 3 && (
                <div className="space-y-5 animate-fadeIn">
                  {/* Subsection 1: Allowances & Benefits */}
                  <div className="space-y-3">
                    <div className="bg-[#f7faf5] p-3.5 rounded-xl border border-[#dce8d9] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-[#4B6043]" />
                        <h4 className="font-bold text-sm text-[#24331C]">
                          ३.१ मासिक तथा वार्षिक नियमित भत्ताहरू (Allowances & Benefits)
                        </h4>
                      </div>
                      <span className="text-[11px] text-emerald-800 font-medium">
                        नियमित भत्ता तथा सुविधाहरू
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {/* Dearness Allowance */}
                      <div className="bg-white p-3 rounded-xl border border-[#c8d7c2] space-y-1">
                        <label className="block font-semibold text-[#304426]">
                          महङ्गी भत्ता (मासिक)
                        </label>
                        <NepaliNumberInput
                          value={salaryFormData.dearnessAllowance}
                          onChange={(val) => setSalaryFormData((prev) => ({ ...prev, dearnessAllowance: val }))}
                          placeholder="२,०००"
                          className="w-full p-2 text-xs rounded-lg border border-[#c8d7c2] bg-[#fbfdfa] text-[#24331C] font-mono font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                        />
                        <p className="text-[10px] text-gray-500">मासिक महङ्गी भत्ता (उदा: रु २०००)</p>
                      </div>

                      {/* Uniform Allowance */}
                      <div className="bg-white p-3 rounded-xl border border-[#c8d7c2] space-y-1">
                        <label className="block font-semibold text-[#304426]">
                          पोशाक भत्ता (वार्षिक एकमुष्ठ)
                        </label>
                        <NepaliNumberInput
                          value={salaryFormData.uniformAllowance}
                          onChange={(val) => setSalaryFormData((prev) => ({ ...prev, uniformAllowance: val }))}
                          placeholder="१०,०००"
                          className="w-full p-2 text-xs rounded-lg border border-[#c8d7c2] bg-[#fbfdfa] text-[#24331C] font-mono font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                        />
                        <p className="text-[10px] text-gray-500">वार्षिक पोशाक भत्ता (उदा: रु १००००)</p>
                      </div>

                      {/* Uniform Allowance Month */}
                      <div className="bg-white p-3 rounded-xl border border-[#c8d7c2] space-y-1">
                        <label className="block font-semibold text-[#304426]">
                          पोशाक भत्ता पाउने महिना
                        </label>
                        <select
                          value={salaryFormData.uniformAllowanceMonth || 'चैत्र महिनामा भुक्तानी'}
                          onChange={(e) =>
                            setSalaryFormData((prev) => ({
                              ...prev,
                              uniformAllowanceMonth: e.target.value,
                            }))
                          }
                          className="w-full p-2 text-xs rounded-lg border border-[#c8d7c2] bg-[#fbfdfa] text-[#24331C] font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                        >
                          {UNIFORM_PAYMENT_MONTHS.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-gray-500">पोशाक भत्ता भुक्तानी महिना (उदा: चैत्र)</p>
                      </div>

                      {/* Remote Allowance */}
                      <div className="bg-white p-3 rounded-xl border border-[#c8d7c2] space-y-1">
                        <label className="block font-semibold text-[#304426]">
                          स्थानीय / दुर्गम भत्ता (मासिक)
                        </label>
                        <NepaliNumberInput
                          value={salaryFormData.remoteAllowance}
                          onChange={(val) => setSalaryFormData((prev) => ({ ...prev, remoteAllowance: val }))}
                          placeholder="०"
                          className="w-full p-2 text-xs rounded-lg border border-[#c8d7c2] bg-[#fbfdfa] text-[#24331C] font-mono font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                        />
                        <p className="text-[10px] text-gray-500">दुर्गम वा स्थानीय भत्ता मासिक</p>
                      </div>

                      {/* Incentive Allowance */}
                      <div className="bg-white p-3 rounded-xl border border-[#c8d7c2] space-y-1">
                        <label className="block font-semibold text-[#304426]">
                          प्रोत्साहन / विशेष भत्ता (मासिक)
                        </label>
                        <NepaliNumberInput
                          value={salaryFormData.incentiveAllowance}
                          onChange={(val) => setSalaryFormData((prev) => ({ ...prev, incentiveAllowance: val }))}
                          placeholder="०"
                          className="w-full p-2 text-xs rounded-lg border border-[#c8d7c2] bg-[#fbfdfa] text-[#24331C] font-mono font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                        />
                        <p className="text-[10px] text-gray-500">विशेष वा प्रोत्साहन भत्ता मासिक</p>
                      </div>

                      {/* Vehicle Allowance */}
                      <div className="bg-white p-3 rounded-xl border border-[#c8d7c2] space-y-1">
                        <label className="block font-semibold text-[#304426]">
                          सवारी / इन्धन भत्ता (मासिक)
                        </label>
                        <NepaliNumberInput
                          value={salaryFormData.vehicleAllowance}
                          onChange={(val) => setSalaryFormData((prev) => ({ ...prev, vehicleAllowance: val }))}
                          placeholder="०"
                          className="w-full p-2 text-xs rounded-lg border border-[#c8d7c2] bg-[#fbfdfa] text-[#24331C] font-mono font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                        />
                        <p className="text-[10px] text-gray-500">सवारी तथा इन्धन सुविधा</p>
                      </div>

                      {/* Communication Allowance */}
                      <div className="bg-white p-3 rounded-xl border border-[#c8d7c2] space-y-1">
                        <label className="block font-semibold text-[#304426]">
                          सञ्चार / टेलिफोन भत्ता (मासिक)
                        </label>
                        <NepaliNumberInput
                          value={salaryFormData.communicationAllowance}
                          onChange={(val) => setSalaryFormData((prev) => ({ ...prev, communicationAllowance: val }))}
                          placeholder="०"
                          className="w-full p-2 text-xs rounded-lg border border-[#c8d7c2] bg-[#fbfdfa] text-[#24331C] font-mono font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                        />
                        <p className="text-[10px] text-gray-500">इन्टरनेट तथा फोन सुविधा</p>
                      </div>

                      {/* Other Monthly Allowance */}
                      <div className="bg-white p-3 rounded-xl border border-[#c8d7c2] space-y-1 sm:col-span-2">
                        <label className="block font-semibold text-[#304426]">
                          अन्य भत्ता (मासिक)
                        </label>
                        <NepaliNumberInput
                          value={salaryFormData.otherMonthlyAllowance}
                          onChange={(val) => setSalaryFormData((prev) => ({ ...prev, otherMonthlyAllowance: val }))}
                          placeholder="०"
                          className="w-full p-2 text-xs rounded-lg border border-[#c8d7c2] bg-[#fbfdfa] text-[#24331C] font-mono font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                        />
                        <p className="text-[10px] text-gray-500">अन्य कुनै मासिक नियमित भत्ता</p>
                      </div>
                    </div>
                  </div>

                  {/* Subsection 2: Festival Bonus & Other Incomes */}
                  <div className="space-y-3 pt-2 border-t border-[#eaf1e6]">
                    <div className="bg-[#f7faf5] p-3.5 rounded-xl border border-[#dce8d9] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Coins className="w-4 h-4 text-[#4B6043]" />
                        <h4 className="font-bold text-sm text-[#24331C]">
                          ३.२ चाडपर्व खर्च तथा अन्य अतिरिक्त आय (Festival Bonus & Other Incomes)
                        </h4>
                      </div>
                      <span className="text-[11px] text-emerald-800 font-medium">
                        दशैं/चाडपर्व खर्च र अतिरिक्त करयोग्य आम्दानी
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Festival Bonus Month Dropdown List */}
                      <div className="bg-white p-3 rounded-xl border border-[#c8d7c2] space-y-1">
                        <label className="block font-semibold text-[#304426]">
                          चाडपर्व खर्च पाउने महिना
                        </label>
                        <select
                          value={salaryFormData.festivalBonusMonth || 'असोज महिनामा भुक्तानी'}
                          onChange={(e) =>
                            setSalaryFormData((prev) => ({
                              ...prev,
                              festivalBonusMonth: e.target.value,
                            }))
                          }
                          className="w-full p-2 text-xs rounded-lg border border-[#c8d7c2] bg-[#fbfdfa] text-[#24331C] font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                        >
                          {FESTIVAL_PAYMENT_MONTHS.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-gray-500">बैशाख देखि चैत्र सम्म भुक्तानी महिना</p>
                      </div>

                      {/* Festival Bonus Amount */}
                      <div className="bg-white p-3 rounded-xl border border-[#c8d7c2] space-y-1">
                        <label className="block font-semibold text-[#304426] flex items-center justify-between">
                          <span>चाडपर्व खर्च रकम (रु.)</span>
                          <span className="text-[10px] text-[#4B6043]">१ महिना तलब बराबर</span>
                        </label>
                        <NepaliNumberInput
                          value={
                            salaryFormData.festivalBonusCustom ||
                            ((salaryFormData.basicSalary || 0) +
                              (salaryFormData.gradeRate || 0) * (salaryFormData.currentGradeCount || 0) +
                              (salaryFormData.technicalGradeAmount || 0))
                          }
                          onChange={(val) => setSalaryFormData((prev) => ({ ...prev, festivalBonusCustom: val }))}
                          placeholder="०"
                          className="w-full p-2 text-xs rounded-lg border border-[#c8d7c2] bg-[#fbfdfa] text-[#24331C] font-mono font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                        />
                        <p className="text-[10px] text-gray-500">स्वतः १ महिनाको तलब बराबर वा फरक भए परिवर्तन गर्नुहोस्</p>
                      </div>

                      {/* Other Additional Income */}
                      <div className="bg-white p-3 rounded-xl border border-[#c8d7c2] space-y-1">
                        <label className="block font-semibold text-[#304426]">
                          अन्य अतिरिक्त आय (वार्षिक)
                        </label>
                        <NepaliNumberInput
                          value={salaryFormData.otherTaxableIncome || salaryFormData.otherIncome}
                          onChange={(val) =>
                            setSalaryFormData((prev) => ({
                              ...prev,
                              otherIncome: val,
                              otherTaxableIncome: val,
                            }))
                          }
                          placeholder="०"
                          className="w-full p-2 text-xs rounded-lg border border-[#c8d7c2] bg-[#fbfdfa] text-[#24331C] font-mono font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                        />
                        <p className="text-[10px] text-gray-500">बैठक भत्ता, परामर्श वा अन्य करयोग्य आय</p>
                      </div>
                    </div>
                  </div>

                  {/* Step 3 Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-[#d8e4d3]">
                    <button
                      type="button"
                      onClick={() => setIsFormOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                    >
                      रद्द गर्नुहोस् (Cancel)
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveStep(2)}
                        className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>पछाडी जानुहोस् (Previous)</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleNextFromStep3}
                        className="px-6 py-2 text-xs font-bold text-white bg-[#4B6043] hover:bg-[#384c31] rounded-lg transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
                      >
                        <span>अगाडी जानुहोस् (Next)</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* STEP 4: कट्टी तथा कर छुट व्यवस्थापन (Deductions & Tax Reliefs) */}
              {/* ========================================================================= */}
              {activeStep === 4 && (
                <div className="space-y-5 animate-fadeIn">
                  {/* Subsection 1: Deduction Setup */}
                  <div className="space-y-3">
                    <div className="bg-[#f7faf5] p-3.5 rounded-xl border border-[#dce8d9] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Scissors className="w-4 h-4 text-[#4B6043]" />
                        <h4 className="font-bold text-sm text-[#24331C]">
                          ४.१ कट्टी व्यवस्थापन (Deduction Setup)
                        </h4>
                      </div>
                      <span className="text-[11px] text-emerald-800 font-medium">
                        मासिक तथा वार्षिक कट्टीहरू
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      {/* CIT Monthly Deduction */}
                      <div className="bg-white p-3 rounded-xl border border-[#c8d7c2] space-y-1">
                        <label className="block font-semibold text-[#304426]">
                          नागरिक लगानी कोष रकम (मासिक)
                        </label>
                        <NepaliNumberInput
                          value={deductionFormData.citizenInvestmentTrust}
                          onChange={(val) =>
                            setDeductionFormData((prev) => ({ ...prev, citizenInvestmentTrust: val }))
                          }
                          placeholder="०"
                          className="w-full p-2 text-xs rounded-lg border border-[#c8d7c2] bg-[#fbfdfa] text-[#24331C] font-mono font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                        />
                        <p className="text-[10px] text-gray-500">CIT मासिक कट्टी रकम</p>
                      </div>

                      {/* Life Insurance Premium Annual */}
                      <div className="bg-white p-3 rounded-xl border border-[#c8d7c2] space-y-1">
                        <label className="block font-semibold text-[#304426]">
                          व्यक्तिगत जीवन बिमा प्रिमियम (वार्षिक एकमुष्ठ)
                        </label>
                        <NepaliNumberInput
                          value={deductionFormData.investmentInsuranceDeduction}
                          onChange={(val) =>
                            setDeductionFormData((prev) => ({
                              ...prev,
                              investmentInsuranceDeduction: val,
                            }))
                          }
                          placeholder="०"
                          className="w-full p-2 text-xs rounded-lg border border-[#c8d7c2] bg-[#fbfdfa] text-[#24331C] font-mono font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                        />
                        <p className="text-[10px] text-gray-500">अधिकतम रु. ४०,००० सम्म कर छुट योग्य</p>
                      </div>

                      {/* Loan Deduction Monthly */}
                      <div className="bg-white p-3 rounded-xl border border-[#c8d7c2] space-y-1">
                        <label className="block font-semibold text-[#304426]">
                          सापटी / ऋण कट्टी (मासिक)
                        </label>
                        <NepaliNumberInput
                          value={deductionFormData.loanDeduction}
                          onChange={(val) =>
                            setDeductionFormData((prev) => ({ ...prev, loanDeduction: val }))
                          }
                          placeholder="०"
                          className="w-full p-2 text-xs rounded-lg border border-[#c8d7c2] bg-[#fbfdfa] text-[#24331C] font-mono font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                        />
                        <p className="text-[10px] text-gray-500">मासिक सापटी वा ऋण कट्टी</p>
                      </div>

                      {/* Other Monthly Deduction */}
                      <div className="bg-white p-3 rounded-xl border border-[#c8d7c2] space-y-1">
                        <label className="block font-semibold text-[#304426]">
                          अन्य विविध कट्टी (मासिक)
                        </label>
                        <NepaliNumberInput
                          value={deductionFormData.otherDeduction}
                          onChange={(val) =>
                            setDeductionFormData((prev) => ({ ...prev, otherDeduction: val }))
                          }
                          placeholder="०"
                          className="w-full p-2 text-xs rounded-lg border border-[#c8d7c2] bg-[#fbfdfa] text-[#24331C] font-mono font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                        />
                        <p className="text-[10px] text-gray-500">अन्य विविध कट्टी रकम</p>
                      </div>
                    </div>
                  </div>

                  {/* Subsection 2: Tax Reliefs & Credits */}
                  <div className="space-y-3 pt-2 border-t border-[#eaf1e6]">
                    <div className="bg-[#f7faf5] p-3.5 rounded-xl border border-[#dce8d9] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-[#4B6043]" />
                        <h4 className="font-bold text-sm text-[#24331C]">
                          ४.२ कर छुट (Tax Reliefs & Credits)
                        </h4>
                      </div>
                      <span className="text-[11px] text-emerald-800 font-medium">
                        आयकर ऐन २०५८ अनुसारका विशेष छुटहरू
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Disability Tax Relief */}
                      <div className="bg-white p-3 rounded-xl border border-[#c8d7c2] space-y-1">
                        <label className="block font-semibold text-[#304426] flex items-center justify-between">
                          <span>अपाङ्ग व्यक्तिले पाउने छुट रकम (वार्षिक)</span>
                          <span className="text-[10px] text-purple-700 font-semibold">
                            {employeeFormData.disability === 'अपाङ्ग भएको' ? '५०% थप स्ल्याब छुट' : 'लागू नभएको'}
                          </span>
                        </label>
                        <NepaliNumberInput
                          value={
                            deductionFormData.disabilityReliefOverride ||
                            (employeeFormData.disability === 'अपाङ्ग भएको'
                              ? employeeFormData.filingType === 'दम्पत्ती'
                                ? 300000
                                : 250000
                              : 0)
                          }
                          onChange={(val) =>
                            setDeductionFormData((prev) => ({
                              ...prev,
                              disabilityReliefOverride: val,
                            }))
                          }
                          placeholder="०"
                          className="w-full p-2 text-xs rounded-lg border border-[#c8d7c2] bg-[#fbfdfa] text-[#24331C] font-mono font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                        />
                        <p className="text-[10px] text-gray-500">
                          अपाङ्गता भएका कर्मचारीको हकमा आधारभूत कर स्ल्याबमा ५०% थप कर छुट
                        </p>
                      </div>

                      {/* Pension SST Exemption */}
                      <div className="bg-white p-3 rounded-xl border border-[#c8d7c2] space-y-1">
                        <label className="block font-semibold text-[#304426] flex items-center justify-between">
                          <span>योगदानमा आधारित निवृत्तिभरण सा.सु.कर छुट (वार्षिक)</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${employeeFormData.pension === 'भएको' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                            {employeeFormData.pension === 'भएको' ? '१% सा.सु.कर छुट (कट्टी नहुने)' : '१% सा.सु.कर कट्टी हुने (छुट नभएको)'}
                          </span>
                        </label>
                        <NepaliNumberInput
                          value={
                            employeeFormData.pension === 'भएको'
                              ? (deductionFormData.pensionSSTExemptOverride ?? (employeeFormData.filingType === 'दम्पत्ती' ? 6000 : 5000))
                              : 0
                          }
                          disabled={employeeFormData.pension === 'नभएको'}
                          onChange={(val) =>
                            setDeductionFormData((prev) => ({
                              ...prev,
                              pensionSSTExemptOverride: employeeFormData.pension === 'भएको' ? val : 0,
                            }))
                          }
                          placeholder="०"
                          className={`w-full p-2 text-xs rounded-lg border border-[#c8d7c2] font-mono font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none ${
                            employeeFormData.pension === 'नभएको' ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-[#fbfdfa] text-[#24331C]'
                          }`}
                        />
                        <p className="text-[10px] text-gray-500">
                          {employeeFormData.pension === 'भएको'
                            ? 'योगदानमा आधारित निवृत्तिभरण "भएको" कर्मचारीलाई १% सामाजिक सुरक्षा कर छुट हुने भएकोले सा.सु.कर कट्टी हुँदैन।'
                            : 'योगदानमा आधारित निवृत्तिभरण "नभएको" कर्मचारीको १% सामाजिक सुरक्षा कर कट्टी हुने व्यवस्था छ।'}
                        </p>
                      </div>

                      {/* Medical Tax Credit */}
                      <div className="bg-white p-3 rounded-xl border border-[#c8d7c2] space-y-1">
                        <label className="block font-semibold text-[#304426] flex items-center justify-between">
                          <span>औषधी उपचार खर्च मिलान रकम (वार्षिक)</span>
                          <span className="text-[10px] text-[#4B6043]">अधिकतम रु. ७५०</span>
                        </label>
                        <NepaliNumberInput
                          value={deductionFormData.medicalExpenseActual}
                          onChange={(val) =>
                            setDeductionFormData((prev) => ({
                              ...prev,
                              medicalExpenseActual: val,
                            }))
                          }
                          placeholder="०"
                          className="w-full p-2 text-xs rounded-lg border border-[#c8d7c2] bg-[#fbfdfa] text-[#24331C] font-mono font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                        />
                        <p className="text-[10px] text-gray-500">
                          दाबी गरिएको वास्तविक औषधी उपचार खर्चको १५% (अधिकतम रु ७५० सम्म कर मिलान)
                        </p>
                      </div>

                      {/* Female 10% Tax Rebate */}
                      <div className="bg-white p-3 rounded-xl border border-[#c8d7c2] space-y-1">
                        <label className="block font-semibold text-[#304426] flex items-center justify-between">
                          <span>महिला कर्मचारी कर छुट रकम (वार्षिक)</span>
                          <span className="text-[10px] text-pink-700 font-semibold">
                            {(employeeFormData.gender === 'महिला' || String(employeeFormData.gender).includes('महिला') || String(employeeFormData.gender).toLowerCase() === 'female')
                              ? '१०% कर छुट लागू'
                              : 'लागू नभएको (पुरुष/अन्य)'}
                          </span>
                        </label>
                        <NepaliNumberInput
                          value={deductionFormData.femaleTaxRebateOverride}
                          onChange={(val) =>
                            setDeductionFormData((prev) => ({
                              ...prev,
                              femaleTaxRebateOverride: val,
                            }))
                          }
                          placeholder="०"
                          className="w-full p-2 text-xs rounded-lg border border-[#c8d7c2] bg-[#fbfdfa] text-[#24331C] font-mono font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                        />
                        <p className="text-[10px] text-gray-500">
                          महिला कर्मचारीको लागि वार्षिक कर दायित्व रकममा १०% कर छुट (खाली राखेमा स्वतः गणना हुनेछ)
                        </p>
                      </div>

                      {/* Health Insurance Tax Relief */}
                      <div className="bg-white p-3 rounded-xl border border-[#c8d7c2] space-y-1">
                        <label className="block font-semibold text-[#304426] flex items-center justify-between">
                          <span>स्वास्थ्य बिमा प्रिमियम छुट (वार्षिक)</span>
                          <span className="text-[10px] text-[#4B6043]">अधिकतम रु. २०,०००</span>
                        </label>
                        <NepaliNumberInput
                          value={deductionFormData.healthInsuranceDeduction || 0}
                          onChange={(val) =>
                            setDeductionFormData((prev) => ({
                              ...prev,
                              healthInsuranceDeduction: val,
                            }))
                          }
                          placeholder="०"
                          className="w-full p-2 text-xs rounded-lg border border-[#c8d7c2] bg-[#fbfdfa] text-[#24331C] font-mono font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                        />
                        <p className="text-[10px] text-gray-500">
                          स्वास्थ्य बिमा प्रिमियम वापत अधिकतम रु. २०,००० सम्म कर छुट योग्य
                        </p>
                      </div>

                      {/* Home Insurance Tax Relief */}
                      <div className="bg-white p-3 rounded-xl border border-[#c8d7c2] space-y-1">
                        <label className="block font-semibold text-[#304426] flex items-center justify-between">
                          <span>निजी घर बिमा प्रिमियम छुट (वार्षिक)</span>
                          <span className="text-[10px] text-[#4B6043]">अधिकतम रु. ५,०००</span>
                        </label>
                        <NepaliNumberInput
                          value={deductionFormData.homeInsuranceDeduction || 0}
                          onChange={(val) =>
                            setDeductionFormData((prev) => ({
                              ...prev,
                              homeInsuranceDeduction: val,
                            }))
                          }
                          placeholder="०"
                          className="w-full p-2 text-xs rounded-lg border border-[#c8d7c2] bg-[#fbfdfa] text-[#24331C] font-mono font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                        />
                        <p className="text-[10px] text-gray-500">
                          आफ्नो आवासीय घरको बिमा प्रिमियम वापत अधिकतम रु. ५,००० सम्म कर छुट योग्य
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Step 4 Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-[#d8e4d3]">
                    <button
                      type="button"
                      onClick={() => setIsFormOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                    >
                      रद्द गर्नुहोस् (Cancel)
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveStep(3)}
                        className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>पछाडी जानुहोस् (Previous)</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveAll}
                        className="px-6 py-2.5 text-xs font-bold text-white bg-[#4B6043] hover:bg-[#384c31] rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                      >
                        <Save className="w-4 h-4" />
                        <span>विवरण सुरक्षित गर्नुहोस् (Save Employee Details)</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* View Employee Full Profile Modal */}
      {/* ========================================================================= */}
      {viewingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-[#c8d8c3] overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-[#4B6043] text-white p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold text-lg">
                  {viewingEmployee.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-base font-bold">{viewingEmployee.name}</h3>
                  <p className="text-xs text-emerald-100">
                    संकेत नं: {toNepaliDigits(viewingEmployee.code)} | {viewingEmployee.designation} ({viewingEmployee.level})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingEmployee(null)}
                className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* General details grid */}
              <div className="bg-[#f8faf6] p-4 rounded-xl border border-[#e2ece0] grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-gray-500">सेवा / समूह:</p>
                  <p className="font-bold text-[#24331C] mt-0.5">{viewingEmployee.serviceGroup || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">श्रेणी / तह:</p>
                  <p className="font-bold text-[#24331C] mt-0.5">{viewingEmployee.level}</p>
                </div>
                <div>
                  <p className="text-gray-500">सेवा प्रकार:</p>
                  <p className="font-bold text-[#24331C] mt-0.5">{viewingEmployee.serviceType}</p>
                </div>
                <div>
                  <p className="text-gray-500">लिङ्ग / वैवाहिक:</p>
                  <p className="font-bold text-[#24331C] mt-0.5">
                    {viewingEmployee.gender} ({viewingEmployee.filingType})
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">दुर्गम क्षेत्र:</p>
                  <p className="font-bold text-[#24331C] mt-0.5">
                    {viewingEmployee.remoteArea === 'दुर्गम नभएको' ? 'खुला/सामान्य' : `वर्ग '${viewingEmployee.remoteArea}'`}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">अपाङ्गता स्थिति:</p>
                  <p className="font-bold text-[#24331C] mt-0.5">{viewingEmployee.disability}</p>
                </div>
                <div>
                  <p className="text-gray-500">निवृत्तिभरण:</p>
                  <p className="font-bold text-[#24331C] mt-0.5">{viewingEmployee.pension}</p>
                </div>
                <div>
                  <p className="text-gray-500">सेवा सुरु मिति:</p>
                  <p className="font-bold text-[#24331C] mt-0.5">
                    वि.सं. {toNepaliDigits(viewingEmployee.joinedDateBS)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">हालको पद मिति:</p>
                  <p className="font-bold text-[#24331C] mt-0.5">
                    वि.सं. {viewingEmployee.currentPostDateBS ? toNepaliDigits(viewingEmployee.currentPostDateBS) : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">प्यान नम्बर:</p>
                  <p className="font-bold font-mono text-[#24331C] mt-0.5">
                    {viewingEmployee.panNumber
                      ? toNepaliDigits(
                          isPrivacyMasked
                            ? maskSensitiveData(viewingEmployee.panNumber, 'pan')
                            : viewingEmployee.panNumber
                        )
                      : '-'}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-gray-500">बैंक खाता विवरण:</p>
                  <p className="font-bold text-[#24331C] mt-0.5">
                    {viewingEmployee.bankName}{' '}
                    {viewingEmployee.bankAccount
                      ? `- ${toNepaliDigits(
                          isPrivacyMasked
                            ? maskSensitiveData(viewingEmployee.bankAccount, 'bank')
                            : viewingEmployee.bankAccount
                        )}`
                      : '-'}
                  </p>
                </div>
                {viewingEmployee.phone && (
                  <div>
                    <p className="text-gray-500">सम्पर्क फोन:</p>
                    <p className="font-bold font-mono text-[#24331C] mt-0.5">
                      {toNepaliDigits(
                        isPrivacyMasked
                          ? maskSensitiveData(viewingEmployee.phone, 'phone')
                          : viewingEmployee.phone
                      )}
                    </p>
                  </div>
                )}
                {viewingEmployee.email && (
                  <div className="sm:col-span-2">
                    <p className="text-gray-500">इमेल ठेगाना:</p>
                    <p className="font-bold font-mono text-[#24331C] mt-0.5">
                      {isPrivacyMasked
                        ? maskSensitiveData(viewingEmployee.email, 'email')
                        : viewingEmployee.email}
                    </p>
                  </div>
                )}
              </div>

              {/* Salary & Grades Snapshot */}
              {salarySetups[viewingEmployee.id] && (
                <div className="bg-[#f0f6ed] p-4 rounded-xl border border-[#cfe0cc] space-y-2">
                  <h4 className="font-bold text-xs text-[#24331C] flex items-center gap-1.5">
                    <Banknote className="w-4 h-4 text-[#4B6043]" />
                    <span>तलब तथा ग्रेड विवरण (Salary Setup)</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-white p-2.5 rounded-lg border border-[#d2e2ce]">
                      <p className="text-[11px] text-gray-500">शुरु तलब:</p>
                      <p className="font-bold font-mono text-[#24331C]">
                        {formatNepaliCurrency(salarySetups[viewingEmployee.id].basicSalary)}
                      </p>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-[#d2e2ce]">
                      <p className="text-[11px] text-gray-500">ग्रेड दर:</p>
                      <p className="font-bold font-mono text-[#24331C]">
                        {formatNepaliCurrency(salarySetups[viewingEmployee.id].gradeRate)}
                      </p>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-[#d2e2ce]">
                      <p className="text-[11px] text-gray-500">कुल ग्रेड संख्या:</p>
                      <p className="font-bold font-mono text-[#4B6043]">
                        {toNepaliDigits(salarySetups[viewingEmployee.id].currentGradeCount)}
                      </p>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-[#d2e2ce]">
                      <p className="text-[11px] text-gray-500">महङ्गी भत्ता (मासिक):</p>
                      <p className="font-bold font-mono text-[#24331C]">
                        {formatNepaliCurrency(salarySetups[viewingEmployee.id].dearnessAllowance)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tax calculation quick preview */}
              {annualTaxResults[viewingEmployee.id] && (
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-emerald-900">वार्षिक कर दायित्व (Annual TDS):</p>
                    <p className="text-base font-bold font-mono text-emerald-800">
                      {formatNepaliCurrency(annualTaxResults[viewingEmployee.id].netAnnualTaxLiability)}
                    </p>
                    <p className="text-[10px] text-emerald-700">
                      मासिक कर कट्टी: {formatNepaliCurrency(annualTaxResults[viewingEmployee.id].monthlyTaxDeduction)}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setAuditEmployeeId(viewingEmployee.id);
                      setViewingEmployee(null);
                    }}
                    className="px-3 py-1.5 bg-[#4B6043] hover:bg-[#384c31] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    ३३ बुँदे कर हिसाब हेर्नुहोस्
                  </button>
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsExportModalOpen(true);
                }}
                className="px-3.5 py-2 bg-[#1f5a34] hover:bg-[#164326] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
                <span>एक्सेल Export (Excel)</span>
              </button>

              <button
                onClick={() => setViewingEmployee(null)}
                className="px-4 py-2 bg-[#4B6043] hover:bg-[#394a33] text-white text-xs font-bold rounded-lg cursor-pointer transition-colors"
              >
                बन्द गर्नुहोस्
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Export Modal */}
      <EmployeeExcelExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        allEmployees={employees}
        filteredEmployees={filteredEmployees}
        salarySetups={salarySetups}
        deductionSetups={deductionSetups}
        activeFiscalYear={activeFiscalYear}
        organization={organization}
        activeOrganization={activeOrganization}
      />

      {/* Excel Import Modal */}
      <EmployeeExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </div>
  );
};
