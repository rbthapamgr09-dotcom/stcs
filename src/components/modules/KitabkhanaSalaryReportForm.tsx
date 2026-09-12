import React, { useState, useMemo, useEffect } from 'react';
import {
  Printer,
  Download,
  Search,
  Edit2,
  FileSpreadsheet,
  Building2,
  Building,
  User,
  Hash,
  Briefcase,
  Layers,
  RotateCcw,
  X,
  Filter,
  Save,
  CheckCircle2,
  Clock,
  Eye,
  DollarSign,
  TrendingUp,
  Award,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';
import { NepaliMonth } from '../../types';
import { toNepaliDigits, toEnglishDigits, getCurrentDualDate } from '../../utils/nepaliCalendar';
import { NepaliNumberInput } from '../common/NepaliNumberInput';
import { NepaliTextInput } from '../common/NepaliTextInput';
import { Letterhead, ReportSignatures } from '../common/Letterhead';

interface KitabkhanaSalaryReportFormProps {
  onNavigateToEmployees?: () => void;
}

export const KitabkhanaSalaryReportForm: React.FC<KitabkhanaSalaryReportFormProps> = () => {
  const {
    employees,
    salarySetups,
    activeFiscalYear,
    organization,
    useDevanagariNumerals,
    updateSalarySetup,
    updateEmployee,
    addToast,
  } = useApp();

  // Storage key for active fiscal year
  const storageKey = `nepal_payroll_kitabkhana_report_settings_${activeFiscalYear}`;

  // Default initializers
  const getDefaultOffice1 = () => 'श्री राष्ट्रिय किताबखाना (निजामती), हरिहरभवन, ललितपुर ।';
  const getDefaultOffice2 = () => {
    const dist = organization.district || 'कञ्चनपुर';
    return `श्री कोष तथा लेखा नियन्त्रक कार्यालय, ${dist} ।`;
  };

  // Selected recipient parameters with interactive setters
  const [recipientOffice1, setRecipientOffice1] = useState<string>(getDefaultOffice1);
  const [recipientOffice2, setRecipientOffice2] = useState<string>(getDefaultOffice2);

  const [isSavedRecently, setIsSavedRecently] = useState<boolean>(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);

  // Load saved settings from localStorage on mount or when fiscal year changes
  useEffect(() => {
    try {
      const savedStr =
        localStorage.getItem(storageKey) ||
        localStorage.getItem('nepal_payroll_kitabkhana_report_settings_latest');
      if (savedStr) {
        const saved = JSON.parse(savedStr);
        if (saved.recipientOffice1) setRecipientOffice1(saved.recipientOffice1);
        if (saved.recipientOffice2) setRecipientOffice2(saved.recipientOffice2);
        if (saved.updatedAt) setLastSavedTime(saved.updatedAt);
      }
    } catch (err) {
      console.error('Failed to load saved report settings:', err);
    }
  }, [storageKey, activeFiscalYear]);

  // Handle Save Settings
  const handleSaveSettings = () => {
    try {
      const currentTime = new Date().toLocaleTimeString('ne-NP', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const payload = {
        recipientOffice1,
        recipientOffice2,
        fiscalYear: activeFiscalYear,
        updatedAt: currentTime,
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));
      localStorage.setItem('nepal_payroll_kitabkhana_report_settings_latest', JSON.stringify(payload));

      setIsSavedRecently(true);
      setLastSavedTime(currentTime);
      setTimeout(() => setIsSavedRecently(false), 3500);

      addToast(
        'success',
        'सफलतापूर्वक सुरक्षित भयो (Saved Successfully)',
        'प्रतिवेदन प्रापक कार्यालय विवरण सुरक्षित गरियो ।'
      );
    } catch (e) {
      addToast('error', 'त्रुटि', 'विवरण सुरक्षित गर्न सकिएन ।');
    }
  };

  // Handle Reset to Defaults
  const handleResetSettings = () => {
    setRecipientOffice1(getDefaultOffice1());
    setRecipientOffice2(getDefaultOffice2());
    addToast(
      'info',
      'पूर्वनिर्धारित बनाइयो',
      'प्रापक कार्यालय विवरण पूर्वनिर्धारित अवस्थामा फर्काइयो ।'
    );
  };

  // Dynamic Previous Ashadh Masanta Year derived directly from active Fiscal Year
  const previousAshadhYear = useMemo(() => {
    if (!activeFiscalYear) return '२०८१';
    const trimmed = activeFiscalYear.trim();
    const parts = trimmed.split(/[\/\-_]/);
    if (parts.length > 0 && parts[0]) {
      return toNepaliDigits(parts[0].trim());
    }
    return toNepaliDigits('२०८१');
  }, [activeFiscalYear]);

  // Search and filter parameters: Name, Code, Designation, Service Group
  const [searchName, setSearchName] = useState<string>('');
  const [searchCode, setSearchCode] = useState<string>('');
  const [searchDesignation, setSearchDesignation] = useState<string>('');
  const [selectedServiceGroup, setSelectedServiceGroup] = useState<string>('all');

  const hasActiveFilters = Boolean(
    searchName.trim() ||
    searchCode.trim() ||
    searchDesignation.trim() ||
    (selectedServiceGroup !== 'all' && selectedServiceGroup !== '')
  );

  const handleResetFilters = () => {
    setSearchName('');
    setSearchCode('');
    setSearchDesignation('');
    setSelectedServiceGroup('all');
  };

  // Inline Quick Edit state
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<{
    code: string;
    name: string;
    serviceGroup: string;
    designation: string;
    level: string;
    joinedDateBS: string;
    currentPostDateBS: string;
    basicSalary: number;
    technicalGradeAmount: number;
    previousGradeCount: number;
    addedGradeCount: number;
    gradeRate: number;
    gradeIncreaseMonthText: string;
    festivalBonusMonth: string;
    remarks: string;
  }>({
    code: '',
    name: '',
    serviceGroup: '',
    designation: '',
    level: '',
    joinedDateBS: '',
    currentPostDateBS: '',
    basicSalary: 0,
    technicalGradeAmount: 0,
    previousGradeCount: 0,
    addedGradeCount: 0,
    gradeRate: 0,
    gradeIncreaseMonthText: 'श्रावण देखि',
    festivalBonusMonth: 'असोज',
    remarks: '',
  });

  // Helper to format currency numbers to 2 decimal places with Nepali numerals option
  const formatAmount = (num: number) => {
    const formatted = (num || 0).toFixed(2);
    return useDevanagariNumerals ? toNepaliDigits(formatted) : formatted;
  };

  const formatInt = (num: number) => {
    return useDevanagariNumerals ? toNepaliDigits(num) : `${num}`;
  };

  // Unique service groups for filtering
  const serviceGroups = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.serviceGroup) set.add(e.serviceGroup);
    });
    return Array.from(set);
  }, [employees]);

  // Compute table rows for all 19 columns
  const tableRows = useMemo(() => {
    return employees
      .filter((emp) => {
        // 1. कर्मचारीको नाम (Name Filter)
        const qName = searchName.trim().toLowerCase();
        const empName = String(emp.name || '').toLowerCase();
        const matchName = !qName || empName.includes(qName);

        // 2. संकेत नम्बर (Code Filter - supports both English and Nepali digits)
        const empCode = String(emp.code || '');
        const empCodeEng = toEnglishDigits(empCode);
        const empCodeNep = toNepaliDigits(empCode);
        const queryCodeRaw = searchCode.trim();
        const queryCodeEng = toEnglishDigits(queryCodeRaw);
        const queryCodeNep = toNepaliDigits(queryCodeRaw);

        const matchCode =
          !queryCodeRaw ||
          empCode.toLowerCase().includes(queryCodeRaw.toLowerCase()) ||
          empCodeEng.includes(queryCodeEng) ||
          empCodeNep.includes(queryCodeNep);

        // 3. पद / श्रेणी / तह (Designation / Level Filter)
        const queryDesig = searchDesignation.trim().toLowerCase();
        const empDesig = String(emp.designation || '').toLowerCase();
        const empLevel = String(emp.level || '').toLowerCase();
        const matchDesignation =
          !queryDesig ||
          empDesig.includes(queryDesig) ||
          empLevel.includes(queryDesig) ||
          (`${empDesig}/${empLevel}`.toLowerCase().includes(queryDesig));

        // 4. सेवा / समूह (Service Group Filter)
        const matchGroup =
          selectedServiceGroup === 'all' || !selectedServiceGroup || emp.serviceGroup === selectedServiceGroup;

        return matchName && matchCode && matchDesignation && matchGroup;
      })
      .map((emp, index) => {
        const sal = salarySetups[emp.id];

        // 8. Basic Scale
        const basicSalary = sal?.basicSalary ?? 38203;

        // 9. Technical Grade addition (for appointments before 2057/04/01)
        const technicalGradeAmount = emp.technicalGradeAmount ?? sal?.technicalGradeAmount ?? 0;

        // 10. Total Salary Scale = Col 8 + Col 9
        const totalSalaryScale = basicSalary + technicalGradeAmount;

        // 11. Grade count until Ashadh end of previous FY
        const previousGradeCount =
          emp.previousGradeCount ?? sal?.previousGradeCount ?? sal?.currentGradeCount ?? 0;

        // 12. Added Grade Count in current FY
        const addedGradeCount =
          emp.addedGradeCount ?? sal?.addedGradeCount ?? sal?.gradeIncreaseCount ?? 0;

        // 13. Total Grade Count = Col 11 + Col 12
        const totalGradeCount = previousGradeCount + addedGradeCount;

        // 14. Grade Rate (रु.)
        const gradeRate = sal?.gradeRate ?? 1273;

        // 15. Total Grade Amount = Col 13 × Col 14
        const totalGradeAmount = totalGradeCount * gradeRate;

        // 16. Total Salary and Grade Amount = Col 10 + Col 15
        const grandTotalSalaryAndGrade = totalSalaryScale + totalGradeAmount;

        // 17. Grade Increase Month (e.g. "श्रावण देखि", "भाद्र देखि", "मंसिर देखि", "जेठ देखि", etc.)
        const gradeIncreaseMonthText =
          emp.gradeIncreaseMonthText ||
          (sal?.gradeIncreaseMonth ? `${sal.gradeIncreaseMonth} देखि` : 'श्रावण देखि');

        // 18. Festival bonus month (default "असोज")
        const festivalBonusMonth = emp.festivalBonusMonth || sal?.festivalBonusMonth || 'असोज';

        // 19. Remarks
        const remarks = emp.remarks || '';

        // Formatted Post / Rank Display
        const postRankDisplay = emp.level ? `${emp.designation}/${emp.level}` : emp.designation;

        return {
          empId: emp.id,
          sn: index + 1,
          code: emp.code,
          name: emp.name.startsWith('श्री ') ? emp.name : `श्री ${emp.name}`,
          serviceGroup: emp.serviceGroup || 'ने.ई./सिभिल/हाईवे',
          postRank: postRankDisplay,
          designation: emp.designation,
          level: emp.level,
          joinedDateBS: emp.joinedDateBS || '',
          currentPostDateBS: emp.currentPostDateBS || '',
          basicSalary,
          technicalGradeAmount,
          totalSalaryScale,
          previousGradeCount,
          addedGradeCount,
          totalGradeCount,
          gradeRate,
          totalGradeAmount,
          grandTotalSalaryAndGrade,
          gradeIncreaseMonthText,
          festivalBonusMonth,
          remarks,
        };
      });
  }, [employees, salarySetups, searchName, searchCode, searchDesignation, selectedServiceGroup]);

  // Totals calculations across all rows
  const totals = useMemo(() => {
    const totalBasicSalary = tableRows.reduce((acc, row) => acc + row.basicSalary, 0);
    const totalTechnicalGrade = tableRows.reduce((acc, row) => acc + row.technicalGradeAmount, 0);
    const totalSalaryScale = tableRows.reduce((acc, row) => acc + row.totalSalaryScale, 0);
    const totalGradeAmount = tableRows.reduce((acc, row) => acc + row.totalGradeAmount, 0);
    const grandTotalSalaryAndGrade = tableRows.reduce(
      (acc, row) => acc + row.grandTotalSalaryAndGrade,
      0
    );

    return {
      totalBasicSalary,
      totalTechnicalGrade,
      totalSalaryScale,
      totalGradeAmount,
      grandTotalSalaryAndGrade,
    };
  }, [tableRows]);

  // Export to Excel with full 19 columns and signatures
  const handleExportExcel = () => {
    const headersRow1 = [
      'क्र. सं. (१)',
      'क.सं.नं (२)',
      'कर्मचारीको नाम, थर (३)',
      'सेवा/समूह/उपसमूह (४)',
      'पद/श्रेणी/तह (५)',
      'शुरु नियुक्ति मिति (६)',
      'हालको पदमा बढुवा/स्तरवृद्धि/नियुक्ति मिति (७)',
      'तलब स्केल - हालको पदको शुरु तलब स्केल (८)',
      'तलब स्केल - ०५७/४/१ भन्दा अगाडी नियुक्त प्राविधिक कर्मचारीको तलबमानमा थप रकम (०७३ असार मसान्तसम्म खाइपाई आएको प्राविधिक ग्रेडको रकम) (९)',
      'तलब स्केल - जम्मा तलब स्केल (१०)',
      `${previousAshadhYear} साल असार मसान्तसम्म खाइपाई आएको ग्रेड संख्या (११)`,
      `चालु आ.व. ${toNepaliDigits(activeFiscalYear)} मा थप हुने ग्रेड संख्या (१२)`,
      'जम्मा ग्रेड संख्या (१३)',
      'ग्रेड दर (१४)',
      'जम्मा ग्रेड रकम (१५)',
      'तलब र ग्रेडको जम्मा रकम (१६)',
      'ग्रेड वृद्धि हुने महिना (१७)',
      'चाडपर्व खर्च पाउने महिना (१८)',
      'कैफियत (१९)',
    ];

    const dataRows = tableRows.map((row) => [
      row.sn,
      row.code,
      row.name,
      row.serviceGroup,
      row.postRank,
      row.joinedDateBS,
      row.currentPostDateBS,
      row.basicSalary,
      row.technicalGradeAmount > 0 ? row.technicalGradeAmount : '-',
      row.totalSalaryScale,
      row.previousGradeCount,
      row.addedGradeCount,
      row.totalGradeCount,
      row.gradeRate,
      row.totalGradeAmount,
      row.grandTotalSalaryAndGrade,
      row.gradeIncreaseMonthText,
      row.festivalBonusMonth,
      row.remarks,
    ]);

    const signatoryRows = [
      [],
      ['तयार गर्ने', '', '', 'पेश गर्ने', '', '', 'सदर गर्ने'],
      [],
    ];

    const sheetContent = [
      [`आ.व. ${toNepaliDigits(activeFiscalYear)} को तलबी प्रतिवेदन फाराम`],
      [recipientOffice1],
      [recipientOffice2],
      [],
      headersRow1,
      ...dataRows,
      ...signatoryRows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(sheetContent);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'तलबी प्रतिवेदन १९ स्तम्भीय');
    XLSX.writeFile(wb, `Kitabkhana_Talabi_Prativedan_19Col_${activeFiscalYear.replace(/[\/\\]/g, '_')}.xlsx`);
  };

  // Open Quick Edit modal
  const handleStartEdit = (row: (typeof tableRows)[0]) => {
    const emp = employees.find((e) => e.id === row.empId);
    if (!emp) return;
    setEditingRowId(emp.id);
    setEditFormData({
      code: emp.code,
      name: emp.name,
      serviceGroup: emp.serviceGroup || row.serviceGroup,
      designation: emp.designation,
      level: emp.level,
      joinedDateBS: emp.joinedDateBS || '',
      currentPostDateBS: emp.currentPostDateBS || '',
      basicSalary: row.basicSalary,
      technicalGradeAmount: row.technicalGradeAmount,
      previousGradeCount: row.previousGradeCount,
      addedGradeCount: row.addedGradeCount,
      gradeRate: row.gradeRate,
      gradeIncreaseMonthText: row.gradeIncreaseMonthText,
      festivalBonusMonth: row.festivalBonusMonth,
      remarks: row.remarks,
    });
  };

  // Save Quick Edit
  const handleSaveEdit = () => {
    if (!editingRowId) return;
    const emp = employees.find((e) => e.id === editingRowId);
    if (!emp) return;

    // Update employee master record
    updateEmployee({
      ...emp,
      code: editFormData.code,
      name: editFormData.name,
      serviceGroup: editFormData.serviceGroup,
      designation: editFormData.designation,
      level: editFormData.level,
      joinedDateBS: editFormData.joinedDateBS,
      currentPostDateBS: editFormData.currentPostDateBS,
      technicalGradeAmount: editFormData.technicalGradeAmount,
      previousGradeCount: editFormData.previousGradeCount,
      addedGradeCount: editFormData.addedGradeCount,
      gradeIncreaseMonthText: editFormData.gradeIncreaseMonthText,
      festivalBonusMonth: editFormData.festivalBonusMonth,
      remarks: editFormData.remarks,
    });

    // Update employee salary setup
    updateSalarySetup(editingRowId, {
      basicSalary: editFormData.basicSalary,
      technicalGradeAmount: editFormData.technicalGradeAmount,
      gradeRate: editFormData.gradeRate,
      previousGradeCount: editFormData.previousGradeCount,
      addedGradeCount: editFormData.addedGradeCount,
      currentGradeCount: editFormData.previousGradeCount + editFormData.addedGradeCount,
      gradeIncreaseCount: editFormData.addedGradeCount,
      gradeIncreaseMonth: editFormData.gradeIncreaseMonthText.replace(' देखि', '') as NepaliMonth,
      festivalBonusMonth: editFormData.festivalBonusMonth as NepaliMonth,
    });

    setEditingRowId(null);
  };

  // Reusable 19-Column Salary Report Table Component for Print and Preview Modal
  const renderSalaryReportTable = (isModalPreview = false) => (
    <div className="bg-white p-4 sm:p-6 rounded-2xl border border-[#d6e3d2] shadow-sm print:p-0 print:border-none print:shadow-none print:m-0 text-[#111827] overflow-x-auto">
      {/* Top Official Letterhead Section with Fiscal Year in Title */}
      <Letterhead
        title={`आ.व. ${toNepaliDigits(activeFiscalYear)} को तलबी प्रतिवेदन फाराम`}
        showMetadata={false}
        showSignatureSection={false}
        recipientOffice1={recipientOffice1}
        recipientOffice2={recipientOffice2}
      />

      {/* OFFICIAL 19-COLUMN SALARY REPORT TABLE */}
      <div className="overflow-x-auto border-t border-l border-black mt-4">
        <table className="w-full text-left text-[9px] border-collapse text-black print:text-[8.5px]">
          <thead>
            {/* Header Row 1: Main Category Groupings */}
            <tr className="bg-white border-b border-black text-center font-bold font-serif text-[9px]">
              <th rowSpan={2} className="p-1 px-0.5 border-r border-b border-black text-center whitespace-nowrap w-6">
                क्र. सं.
              </th>
              <th rowSpan={2} className="p-1 px-1 border-r border-b border-black text-center whitespace-nowrap">
                क.सं.नं
              </th>
              {/* Col 3: कर्मचारीको नाम, थर */}
              <th rowSpan={2} className="p-1 px-1 border-r border-b border-black text-left whitespace-nowrap">
                कर्मचारीको नाम, थर
              </th>
              {/* Col 4: सेवा/समूह/उपसमूह */}
              <th rowSpan={2} className="p-1 px-1 border-r border-b border-black text-left whitespace-nowrap text-[8.5px]">
                सेवा/समूह/उपसमूह
              </th>
              {/* Col 5: पद/श्रेणी/तह */}
              <th rowSpan={2} className="p-1 px-1 border-r border-b border-black text-left whitespace-nowrap text-[8.5px]">
                पद/श्रेणी/तह
              </th>
              {/* Col 6: शुरु नियुक्ति मिति */}
              <th rowSpan={2} className="p-1 px-1 border-r border-b border-black text-center leading-tight whitespace-nowrap text-[8.5px]">
                शुरु नियुक्ति
                <br />
                मिति
              </th>
              {/* Col 7: हालको पदमा बढुवा/स्तरवृद्धि/नियुक्ति मिति */}
              <th rowSpan={2} className="p-1 px-1 border-r border-b border-black text-center text-[8.5px] leading-tight w-[75px] min-w-[70px] max-w-[80px]">
                हालको पदमा
                <br />
                बढुवा/स्तरवृद्धि/
                <br />
                नियुक्ति मिति
              </th>

              {/* Columns 8, 9, 10 Super Header: तलब स्केल */}
              <th colSpan={3} className="p-1 px-1 border-r border-b border-black text-center whitespace-nowrap">
                तलब स्केल
              </th>

              {/* Column 11: ... साल असार मसान्तसम्म खाइपाई आएको ग्रेड संख्या */}
              <th rowSpan={2} className="p-1 px-0.5 border-r border-b border-black text-center text-[8px] leading-tight w-[54px] min-w-[48px] max-w-[58px]">
                {previousAshadhYear} असार
                <br />
                मसान्तसम्म
                <br />
                खाइपाई आएको
                <br />
                ग्रेड संख्या
              </th>

              {/* Columns 12, 13, 14 Super Header: चालु आ.व. मा पाउने ग्रेड रकम */}
              <th colSpan={3} className="p-1 px-1 border-r border-b border-black text-center whitespace-nowrap">
                चालु आ.व. {toNepaliDigits(activeFiscalYear)} मा पाउने ग्रेड रकम
              </th>

              {/* Column 15: जम्मा ग्रेड रकम */}
              <th rowSpan={2} className="p-1 px-1 border-r border-b border-black text-center whitespace-nowrap leading-tight text-[8.5px]">
                जम्मा ग्रेड
                <br />
                रकम
              </th>

              {/* Column 16: तलब र ग्रेडको जम्मा रकम */}
              <th rowSpan={2} className="p-1 px-1 border-r border-b border-black text-center whitespace-nowrap leading-tight text-[8.5px]">
                तलब र ग्रेडको
                <br />
                जम्मा रकम
              </th>

              {/* Column 17: ग्रेड वृद्धि हुने महिना */}
              <th rowSpan={2} className="p-1 px-1 border-r border-b border-black text-center whitespace-nowrap leading-tight text-[8.5px]">
                ग्रेड वृद्धि
                <br />
                हुने महिना
              </th>

              {/* Column 18: चाडपर्व खर्च पाउने महिना */}
              <th rowSpan={2} className="p-1 px-1 border-r border-b border-black text-center whitespace-nowrap leading-tight text-[8.5px]">
                चाडपर्व खर्च
                <br />
                पाउने महिना
              </th>

              {/* Column 19: कैफियत */}
              <th rowSpan={2} className="p-1 px-1 border-r border-b border-black text-center whitespace-nowrap text-[8.5px]">
                कैफियत
              </th>
            </tr>

            {/* Header Row 2: Sub-columns */}
            <tr className="bg-white border-b border-black text-center font-bold font-serif text-[9px]">
              {/* Col 8: हालको पदको शुरु तलब स्केल */}
              <th className="p-1 px-1 border-r border-b border-black text-center leading-tight whitespace-nowrap text-[8.5px]">
                हालको पदको
                <br />
                शुरु तलब
                <br />
                स्केल
              </th>

              {/* Col 9: ०५७/४/१ भन्दा अगाडी नियुक्त प्राविधिक कर्मचारीको तलबमानमा थप रकम (०७३ असार मसान्तसम्म खाइपाई आएको प्राविधिक ग्रेडको रकम) */}
              <th className="p-1 px-0.5 border-r border-b border-black text-center leading-tight font-serif text-[7.2px] w-[75px] min-w-[70px] max-w-[80px]">
                ०५७/४/१ भन्दा अगाडी
                <br />
                नियुक्त प्राविधिक
                <br />
                कर्मचारीको तलबमानमा
                <br />
                थप रकम
                <br />
                <span className="text-[6.8px] font-normal leading-none block mt-0.5">(०७३ असार मसान्तसम्म खाइपाई आएको प्राविधिक ग्रेडको रकम)</span>
              </th>

              {/* Col 10: जम्मा तलब स्केल */}
              <th className="p-1 px-1 border-r border-b border-black text-center leading-tight whitespace-nowrap text-[8.5px]">
                जम्मा
                <br />
                तलब स्केल
              </th>

              {/* Col 12: थप हुने ग्रेड संख्या */}
              <th className="p-1 px-0.5 border-r border-b border-black text-center leading-tight text-[8px] w-[54px] min-w-[48px] max-w-[58px]">
                थप हुने
                <br />
                ग्रेड संख्या
              </th>

              {/* Col 13: जम्मा ग्रेड संख्या */}
              <th className="p-1 px-0.5 border-r border-b border-black text-center leading-tight text-[8px] w-[54px] min-w-[48px] max-w-[58px]">
                जम्मा
                <br />
                ग्रेड संख्या
              </th>

              {/* Col 14: ग्रेड दर */}
              <th className="p-1 px-1 border-r border-b border-black text-center leading-tight whitespace-nowrap text-[8.5px]">
                ग्रेड दर
              </th>
            </tr>

            {/* Header Row 3: Official Column Numbering (१ देखि १९) */}
            <tr className="bg-gray-50 border-b border-black text-center font-bold text-[8.5px] print:bg-transparent">
              <td className="p-0.5 border-r border-b border-black">{toNepaliDigits(1)}</td>
              <td className="p-0.5 border-r border-b border-black">{toNepaliDigits(2)}</td>
              <td className="p-0.5 border-r border-b border-black">{toNepaliDigits(3)}</td>
              <td className="p-0.5 border-r border-b border-black">{toNepaliDigits(4)}</td>
              <td className="p-0.5 border-r border-b border-black">{toNepaliDigits(5)}</td>
              <td className="p-0.5 border-r border-b border-black">{toNepaliDigits(6)}</td>
              <td className="p-0.5 border-r border-b border-black">{toNepaliDigits(7)}</td>
              <td className="p-0.5 border-r border-b border-black">{toNepaliDigits(8)}</td>
              <td className="p-0.5 border-r border-b border-black">{toNepaliDigits(9)}</td>
              <td className="p-0.5 border-r border-b border-black">{toNepaliDigits(10)}</td>
              <td className="p-0.5 border-r border-b border-black">{toNepaliDigits(11)}</td>
              <td className="p-0.5 border-r border-b border-black">{toNepaliDigits(12)}</td>
              <td className="p-0.5 border-r border-b border-black">{toNepaliDigits(13)}</td>
              <td className="p-0.5 border-r border-b border-black">{toNepaliDigits(14)}</td>
              <td className="p-0.5 border-r border-b border-black">{toNepaliDigits(15)}</td>
              <td className="p-0.5 border-r border-b border-black">{toNepaliDigits(16)}</td>
              <td className="p-0.5 border-r border-b border-black">{toNepaliDigits(17)}</td>
              <td className="p-0.5 border-r border-b border-black">{toNepaliDigits(18)}</td>
              <td className="p-0.5 border-r border-b border-black">{toNepaliDigits(19)}</td>
            </tr>
          </thead>

          <tbody className="text-[9px]">
            {tableRows.map((row) => (
              <tr
                key={row.empId}
                className="hover:bg-amber-50/40 print:hover:bg-transparent transition-colors group"
              >
                {/* १. क्र. सं. */}
                <td className="p-1 px-0.5 border-r border-b border-black text-center font-mono font-medium whitespace-nowrap">
                  {toNepaliDigits(row.sn)}
                </td>

                {/* २. क.सं.नं */}
                <td className="p-1 px-1 border-r border-b border-black text-center font-mono font-medium whitespace-nowrap">
                  {toNepaliDigits(row.code)}
                </td>

                {/* ३. कर्मचारीको नाम, थर - Tight to text */}
                <td className="p-1 px-1 border-r border-b border-black font-normal whitespace-nowrap">
                  <div className="flex items-center justify-between gap-1">
                    <span>{row.name}</span>
                    {isModalPreview && (
                      <button
                        onClick={() => handleStartEdit(row)}
                        title="कर्मचारी विवरण सम्पादन गर्नुहोस्"
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-emerald-700 no-print transition-opacity"
                      >
                        <Edit2 className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                </td>

                {/* ४. सेवा/समूह/उपसमूह - Tight to text */}
                <td className="p-1 px-1 border-r border-b border-black text-left whitespace-nowrap text-[8.5px]">
                  {row.serviceGroup}
                </td>

                {/* ५. पद/श्रेणी/तह - Tight to text */}
                <td className="p-1 px-1 border-r border-b border-black text-left whitespace-nowrap text-[8.5px]">
                  {row.postRank}
                </td>

                {/* ६. शुरु नियुक्ति मिति - Tight to text/digits */}
                <td className="p-1 px-1 border-r border-b border-black text-center font-mono whitespace-nowrap text-[8.5px]">
                  {row.joinedDateBS ? toNepaliDigits(row.joinedDateBS) : ''}
                </td>

                {/* ७. हालको पदमा बढुवा/स्तरवृद्धि/नियुक्ति मिति */}
                <td className="p-1 px-1 border-r border-b border-black text-center font-mono whitespace-nowrap text-[8.5px] w-[75px] min-w-[70px] max-w-[80px]">
                  {row.currentPostDateBS ? toNepaliDigits(row.currentPostDateBS) : ''}
                </td>

                {/* ८. हालको पदको शुरु तलब स्केल - Tight to numbers */}
                <td className="p-1 px-1 border-r border-b border-black text-right font-mono font-medium whitespace-nowrap">
                  {formatAmount(row.basicSalary)}
                </td>

                {/* ९. ०५७/४/१ भन्दा अगाडी नियुक्त प्राविधिक कर्मचारीको तलबमानमा थप रकम */}
                <td className="p-1 px-0.5 border-r border-b border-black text-center font-mono whitespace-nowrap text-[8.5px] w-[75px] min-w-[70px] max-w-[80px]">
                  {row.technicalGradeAmount > 0 ? formatAmount(row.technicalGradeAmount) : '-'}
                </td>

                {/* १०. जम्मा तलब स्केल - Tight to numbers */}
                <td className="p-1 px-1 border-r border-b border-black text-right font-mono font-medium whitespace-nowrap">
                  {formatAmount(row.totalSalaryScale)}
                </td>

                {/* ११. अघिल्लो आ.व. सम्म खाइपाई आएको ग्रेड संख्या */}
                <td className="p-1 px-0.5 border-r border-b border-black text-center font-mono font-medium whitespace-nowrap w-[54px] min-w-[48px] max-w-[58px]">
                  {formatInt(row.previousGradeCount)}
                </td>

                {/* १२. चालु आ.व. मा थप हुने ग्रेड संख्या */}
                <td className="p-1 px-0.5 border-r border-b border-black text-center font-mono font-medium whitespace-nowrap w-[54px] min-w-[48px] max-w-[58px]">
                  {formatInt(row.addedGradeCount)}
                </td>

                {/* १३. जम्मा ग्रेड संख्या */}
                <td className="p-1 px-0.5 border-r border-b border-black text-center font-mono font-bold whitespace-nowrap w-[54px] min-w-[48px] max-w-[58px]">
                  {formatInt(row.totalGradeCount)}
                </td>

                {/* १४. ग्रेड दर */}
                <td className="p-1 px-1 border-r border-b border-black text-right font-mono font-medium whitespace-nowrap">
                  {formatAmount(row.gradeRate)}
                </td>

                {/* १५. जम्मा ग्रेड रकम - Tight to numbers */}
                <td className="p-1 px-1 border-r border-b border-black text-right font-mono font-medium whitespace-nowrap">
                  {formatAmount(row.totalGradeAmount)}
                </td>

                {/* १६. तलब र ग्रेडको जम्मा रकम - Tight to numbers */}
                <td className="p-1 px-1 border-r border-b border-black text-right font-mono font-bold whitespace-nowrap">
                  {formatAmount(row.grandTotalSalaryAndGrade)}
                </td>

                {/* १७. ग्रेड वृद्धि हुने महिना */}
                <td className="p-1 px-1 border-r border-b border-black text-center whitespace-nowrap text-[8.5px]">
                  {row.gradeIncreaseMonthText}
                </td>

                {/* १८. चाडपर्व खर्च पाउने महिना - Tight to text */}
                <td className="p-1 px-1 border-r border-b border-black text-center whitespace-nowrap text-[8.5px]">
                  {row.festivalBonusMonth}
                </td>

                {/* १९. कैफियत */}
                <td className="p-1 px-1 border-r border-b border-black text-center text-[8.5px] text-gray-700 whitespace-nowrap">
                  {row.remarks || ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Signatures & Approval Footer Block - Center Aligned "तयार गर्ने, पेश गर्ने, सदर गर्ने" without dots/names */}
      <ReportSignatures
        variant="simple"
        className="mt-12 print:mt-12"
      />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Top Main Management & Control Dashboard (Visible on screen) */}
      <div className="bg-white p-6 rounded-2xl border border-[#d6e3d2] shadow-xs no-print space-y-6">
        {/* Title & Primary Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e5efe3] pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#edf4ea] border border-[#cbdcc6] text-[#4B6043] flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg sm:text-xl font-bold text-[#24331C]">
                  आ.व. {toNepaliDigits(activeFiscalYear)} तलबी प्रतिवेदन फाराम
                </h2>
              </div>
              <p className="text-xs text-[#526a48] mt-0.5">
                राष्ट्रिय किताबखाना (निजामती) तथा कोलेनिका प्रयोजनार्थ आधिकारिक तलबी प्रतिवेदन व्यवस्थापन
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowPreviewModal(true)}
              className="px-4 py-1.5 bg-[#edf4ea] text-[#344b2d] hover:bg-[#dbe8d6] text-xs font-bold rounded-xl border border-[#c5d7bf] transition-all flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Eye className="w-4 h-4 text-[#4B6043] shrink-0" />
              <span className="flex flex-col text-left leading-tight">
                <span>फाराम पूर्वावलोकन</span>
                <span className="text-[10px] font-normal opacity-85">(Preview Form)</span>
              </span>
            </button>

            <button
              onClick={handleExportExcel}
              className="px-4 py-1.5 bg-[#edf4ea] text-[#344b2d] hover:bg-[#dbe8d6] text-xs font-bold rounded-xl border border-[#c5d7bf] transition-all flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Download className="w-4 h-4 text-[#4B6043] shrink-0" />
              <span className="flex flex-col text-left leading-tight">
                <span>एक्सेल</span>
                <span className="text-[10px] font-normal opacity-85">(Excel)</span>
              </span>
            </button>

            <button
              onClick={() => window.print()}
              className="px-5 py-1.5 bg-[#4B6043] text-white hover:bg-[#384c31] text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-98"
            >
              <Printer className="w-4 h-4 shrink-0" />
              <span className="flex flex-col text-left leading-tight">
                <span>प्रिन्ट तलबी प्रतिवेदन फाराम</span>
                <span className="text-[10px] font-normal opacity-90">(Print / PDF)</span>
              </span>
            </button>
          </div>
        </div>

        {/* 4 Summary Overview Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#f8fbf7] p-4 rounded-xl border border-[#d6e4d2] space-y-1">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span className="font-semibold">कुल कर्मचारी संख्या</span>
              <User className="w-4 h-4 text-[#4B6043]" />
            </div>
            <p className="text-xl font-bold font-mono text-[#24331C]">
              {formatInt(tableRows.length)}{' '}
              <span className="text-xs font-normal text-gray-500">जना</span>
            </p>
            <p className="text-[11px] text-gray-500">
              चालु आ.व. {toNepaliDigits(activeFiscalYear)} मा कार्यरत
            </p>
          </div>

          <div className="bg-[#f8fbf7] p-4 rounded-xl border border-[#d6e4d2] space-y-1">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span className="font-semibold">कुल शुरु तलब स्केल</span>
              <DollarSign className="w-4 h-4 text-[#4B6043]" />
            </div>
            <p className="text-xl font-bold font-mono text-[#24331C]">
              रु. {formatAmount(totals.totalSalaryScale)}
            </p>
            <p className="text-[11px] text-gray-500">
              आधारभूत तलब + प्राविधिक थप रकम
            </p>
          </div>

          <div className="bg-[#f8fbf7] p-4 rounded-xl border border-[#d6e4d2] space-y-1">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span className="font-semibold">कुल जम्मा ग्रेड रकम</span>
              <TrendingUp className="w-4 h-4 text-[#4B6043]" />
            </div>
            <p className="text-xl font-bold font-mono text-[#24331C]">
              रु. {formatAmount(totals.totalGradeAmount)}
            </p>
            <p className="text-[11px] text-gray-500">
              खाइपाई आएको र थप हुने ग्रेड रकम
            </p>
          </div>

          <div className="bg-[#eef5eb] p-4 rounded-xl border border-[#bcd2b7] space-y-1">
            <div className="flex items-center justify-between text-xs text-[#2b4421]">
              <span className="font-bold">तलब र ग्रेडको कुल रकम</span>
              <Award className="w-4 h-4 text-[#4B6043]" />
            </div>
            <p className="text-xl font-extrabold font-mono text-[#1e3415]">
              रु. {formatAmount(totals.grandTotalSalaryAndGrade)}
            </p>
            <p className="text-[11px] text-[#4d6642]">
              फारामको १६ नं. महलको कुल योग
            </p>
          </div>
        </div>

        {/* Multi-Criteria Search & Filter Panel */}
        <div className="bg-[#f8fbf7] p-4 rounded-xl border border-[#cfe0cc] space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e1ece0] pb-2">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#4B6043]" />
              <span className="font-bold text-[#24331C] text-xs">
                कर्मचारी खोजी तथा फिल्टर (कर्मचारीको नाम, संकेत नम्बर, पद वा सेवा समूहबाट)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-gray-600 font-medium">
                छानिएका कर्मचारी:{' '}
                <span className="font-bold text-[#24331C] font-mono text-xs">
                  {formatInt(tableRows.length)} / {formatInt(employees.length)} जना
                </span>
              </span>
              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="px-2.5 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg border border-red-200 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>फिल्टर खाली गर्नुहोस्</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. कर्मचारीको नाम */}
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-[#304426] flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-[#4B6043]" />
                <span>१. कर्मचारीको नाम (Name)</span>
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                <NepaliTextInput
                  value={searchName}
                  onChange={(val) => setSearchName(val)}
                  isNepali={true}
                  placeholder="नाम खोज्नुहोस्..."
                  className="w-full pl-8 pr-7 py-2 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4B6043]/30 text-xs"
                />
                {searchName && (
                  <button
                    type="button"
                    onClick={() => setSearchName('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 z-20"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* 2. संकेत नम्बर */}
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-[#304426] flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-[#4B6043]" />
                <span>२. संकेत नम्बर (Code)</span>
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                <NepaliTextInput
                  value={searchCode}
                  onChange={(val) => setSearchCode(val)}
                  isNepali={false}
                  placeholder="संकेत नं. (उदा: १०२३४)..."
                  className="w-full pl-8 pr-7 py-2 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4B6043]/30 font-mono text-xs"
                />
                {searchCode && (
                  <button
                    type="button"
                    onClick={() => setSearchCode('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 z-20"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* 3. पद / श्रेणी / तह */}
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-[#304426] flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5 text-[#4B6043]" />
                <span>३. पद / तह (Designation / Rank)</span>
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                <NepaliTextInput
                  value={searchDesignation}
                  onChange={(val) => setSearchDesignation(val)}
                  isNepali={true}
                  placeholder="पद वा तह खोज्नुहोस्..."
                  className="w-full pl-8 pr-7 py-2 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4B6043]/30 text-xs"
                />
                {searchDesignation && (
                  <button
                    type="button"
                    onClick={() => setSearchDesignation('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 z-20"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* 4. सेवा / समूह */}
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-[#304426] flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-[#4B6043]" />
                <span>४. सेवा / समूह (Service Group)</span>
              </label>
              <select
                value={selectedServiceGroup}
                onChange={(e) => setSelectedServiceGroup(e.target.value)}
                className="w-full py-2 px-3 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] focus:outline-none focus:ring-2 focus:ring-[#4B6043]/30 text-xs font-medium"
              >
                <option value="all">सबै सेवा / समूह (All Groups)</option>
                {serviceGroups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Report Recipient Offices Setup Panel */}
        <div className="p-4 bg-[#f8fbf6] rounded-xl border border-[#cfe0cc] space-y-3">
          <div className="flex items-center justify-between border-b border-[#e1ece0] pb-2">
            <h4 className="text-xs font-bold text-[#24331C] flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-[#4B6043]" />
              <span>प्रतिवेदन प्रापक कार्यालय विवरण (Report Recipients)</span>
            </h4>
            <span className="text-[11px] text-[#526a48] font-medium">
              * चालु आ.व. र स्तम्भका सालहरू आ.व. (Fiscal Year) छनोट अनुसार स्वतः परिवर्तन हुनेछन्।
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Recipient 1 Input */}
            <div className="bg-white p-3 rounded-xl border border-[#dce8d9] space-y-1.5">
              <label className="block text-[11px] text-gray-700 font-bold flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-[#4B6043]" />
                <span>प्रापक कार्यालय १ (किताबखाना)</span>
              </label>
              <NepaliTextInput
                value={recipientOffice1}
                onChange={(val) => setRecipientOffice1(val)}
                isNepali={true}
                placeholder="श्री राष्ट्रिय किताबखाना (निजामती), हरिहरभवन, ललितपुर ।"
                className="w-full p-2 text-xs rounded-lg border border-[#c8d7c2] bg-[#fdfefd] text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 focus:border-[#4B6043] outline-none"
              />
              <p className="text-[10px] text-gray-500">
                प्रतिवेदनको माथिल्लो पहिलो लाइनमा देखिने कार्यालय
              </p>
            </div>

            {/* Recipient 2 Input */}
            <div className="bg-white p-3 rounded-xl border border-[#dce8d9] space-y-1.5">
              <label className="block text-[11px] text-gray-700 font-bold flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-[#4B6043]" />
                <span>प्रापक कार्यालय २ (कोलेनिका / अन्य)</span>
              </label>
              <NepaliTextInput
                value={recipientOffice2}
                onChange={(val) => setRecipientOffice2(val)}
                isNepali={true}
                placeholder="श्री कोष तथा लेखा नियन्त्रक कार्यालय, कञ्चनपुर ।"
                className="w-full p-2 text-xs rounded-lg border border-[#c8d7c2] bg-[#fdfefd] text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 focus:border-[#4B6043] outline-none"
              />
              <p className="text-[10px] text-gray-500">
                प्रतिवेदनको माथिल्लो दोस्रो लाइनमा देखिने कार्यालय
              </p>
            </div>
          </div>

          {/* Action & Save Controls for Recipients */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#e1ece0]">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {lastSavedTime ? (
                <span className="flex items-center gap-1.5 text-[#38532f] font-medium bg-[#eef6ec] px-2.5 py-1 rounded-lg border border-[#c8dec4]">
                  <Clock className="w-3.5 h-3.5 text-[#4B6043]" />
                  <span>पछिल्लो पटक सुरक्षित: <strong className="font-mono">{toNepaliDigits(lastSavedTime)}</strong></span>
                </span>
              ) : (
                <span className="text-gray-500 text-[11px]">
                  * कार्यालय विवरण सुरक्षित गरेपछि प्रिन्ट र भविष्यका प्रतिवेदनमा सुरक्षित रहनेछ।
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5 ml-auto">
              <button
                type="button"
                onClick={handleResetSettings}
                className="px-3.5 py-1.5 border border-[#c8d7c2] bg-white text-gray-700 hover:bg-gray-50 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                <span className="flex flex-col text-left leading-tight">
                  <span>पूर्वनिर्धारित</span>
                  <span className="text-[9px] font-normal text-gray-500">(Reset)</span>
                </span>
              </button>

              <button
                type="button"
                onClick={handleSaveSettings}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer ${
                  isSavedRecently
                    ? 'bg-[#2e5e24] text-white ring-2 ring-[#4B6043]/40'
                    : 'bg-[#4B6043] hover:bg-[#3b4d35] text-white active:scale-98'
                }`}
              >
                {isSavedRecently ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-white animate-pulse shrink-0" />
                    <span className="flex flex-col text-left leading-tight">
                      <span>सुरक्षित गरियो</span>
                      <span className="text-[9px] font-normal opacity-90">(Saved)</span>
                    </span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 text-white shrink-0" />
                    <span className="flex flex-col text-left leading-tight">
                      <span>सुरक्षित गर्नुहोस</span>
                      <span className="text-[9px] font-normal opacity-90">(Save)</span>
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Official Printable Salary Report Form Container (Hidden on screen, Shown in Print) */}
      <div id="official-kitabkhana-salary-report" className="hidden print:block">
        {renderSalaryReportTable(false)}
      </div>

      {/* On-Screen Full Form Preview Modal when User Clicks "फाराम पूर्वावलोकन" */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex flex-col items-center justify-center p-2 sm:p-4 no-print animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-[96vw] h-[92vh] flex flex-col shadow-2xl border border-gray-300 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b bg-[#f6faf4] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#4B6043] text-white flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#24331C] flex items-center gap-2">
                    <span>आ.व. {toNepaliDigits(activeFiscalYear)} तलबी प्रतिवेदन फाराम पूर्वावलोकन</span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#4B6043] text-white">
                      १९ स्तम्भीय आधिकारिक ढाँचा
                    </span>
                  </h3>
                  <p className="text-[11px] text-[#526a48]">
                    प्रिन्ट हुनुपूर्व विवरण जाँच गर्नुहोस्
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={handleExportExcel}
                  className="px-3.5 py-1.5 bg-white text-[#344b2d] hover:bg-[#edf4ea] text-xs font-bold rounded-xl border border-[#c5d7bf] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>एक्सेल</span>
                </button>

                <button
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-[#4B6043] text-white hover:bg-[#384c31] text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 shrink-0" />
                  <span className="flex flex-col text-left leading-tight">
                    <span>प्रिन्ट गर्नुहोस्</span>
                    <span className="text-[9px] font-normal opacity-90">(Print / PDF)</span>
                  </span>
                </button>

                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="p-1.5 rounded-xl text-gray-500 hover:text-gray-800 hover:bg-gray-200 transition-colors ml-2 cursor-pointer"
                  title="बन्द गर्नुहोस्"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body - Scrollable Table Container */}
            <div className="flex-1 overflow-auto p-4 sm:p-6 bg-gray-100">
              <div className="max-w-[1360px] mx-auto">
                {renderSalaryReportTable(true)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Edit Modal for any Employee row */}
      {editingRowId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-[#24331C] flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-[#4B6043]" />
                <span>तलबी प्रतिवेदन विवरण सम्पादन ({editFormData.name})</span>
              </h3>
              <button
                onClick={() => setEditingRowId(null)}
                className="text-gray-400 hover:text-gray-600 font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">कर्मचारी संकेत नं (क.सं.नं)</label>
                <NepaliTextInput
                  value={editFormData.code}
                  onChange={(val) => setEditFormData({ ...editFormData, code: toNepaliDigits(val) })}
                  isNepali={false}
                  className="w-full p-2 border rounded-lg font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">कर्मचारीको नाम, थर</label>
                <NepaliTextInput
                  value={editFormData.name}
                  onChange={(val) => setEditFormData({ ...editFormData, name: val })}
                  isNepali={true}
                  className="w-full p-2 border rounded-lg font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">सेवा/समूह/उपसमूह</label>
                <NepaliTextInput
                  value={editFormData.serviceGroup}
                  onChange={(val) => setEditFormData({ ...editFormData, serviceGroup: val })}
                  isNepali={true}
                  placeholder="ने.ई./सिभिल/हाईवे वा प्रशासन/लेखा"
                  className="w-full p-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">पद / श्रेणी / तह</label>
                <NepaliTextInput
                  value={editFormData.designation}
                  onChange={(val) => setEditFormData({ ...editFormData, designation: val })}
                  isNepali={true}
                  className="w-full p-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">शुरु नियुक्ति मिति (वि.सं.)</label>
                <NepaliTextInput
                  value={editFormData.joinedDateBS}
                  onChange={(val) => setEditFormData({ ...editFormData, joinedDateBS: toNepaliDigits(val) })}
                  isNepali={false}
                  placeholder="२०६३/०१/२४"
                  className="w-full p-2 border rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  हालको पदमा बढुवा/स्तरवृद्धि मिति (वि.सं.)
                </label>
                <NepaliTextInput
                  value={editFormData.currentPostDateBS}
                  onChange={(val) =>
                    setEditFormData({ ...editFormData, currentPostDateBS: toNepaliDigits(val) })
                  }
                  isNepali={false}
                  placeholder="२०७१/०३/२२"
                  className="w-full p-2 border rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  हालको पदको शुरु तलब स्केल (रु.)
                </label>
                <NepaliNumberInput
                  value={editFormData.basicSalary}
                  onChange={(val) =>
                    setEditFormData({ ...editFormData, basicSalary: val })
                  }
                  placeholder="०"
                  className="w-full p-2 border rounded-lg font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  ०५७/४/१ भन्दा अगाडी नियुक्त प्राविधिक कर्मचारीको तलबमानमा थप रकम
                </label>
                <NepaliNumberInput
                  value={editFormData.technicalGradeAmount}
                  onChange={(val) =>
                    setEditFormData({
                      ...editFormData,
                      technicalGradeAmount: val,
                    })
                  }
                  placeholder="०"
                  className="w-full p-2 border rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  अघिल्लो आ.व. सम्म खाइपाई आएको ग्रेड संख्या
                </label>
                <NepaliNumberInput
                  value={editFormData.previousGradeCount}
                  onChange={(val) =>
                    setEditFormData({
                      ...editFormData,
                      previousGradeCount: val,
                    })
                  }
                  allowDecimals={false}
                  placeholder="०"
                  className="w-full p-2 border rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  चालु आ.व. मा थप हुने ग्रेड संख्या
                </label>
                <NepaliNumberInput
                  value={editFormData.addedGradeCount}
                  onChange={(val) =>
                    setEditFormData({
                      ...editFormData,
                      addedGradeCount: val,
                    })
                  }
                  allowDecimals={false}
                  placeholder="०"
                  className="w-full p-2 border rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">ग्रेड दर (रु.)</label>
                <NepaliNumberInput
                  value={editFormData.gradeRate}
                  onChange={(val) =>
                    setEditFormData({ ...editFormData, gradeRate: val })
                  }
                  placeholder="०"
                  className="w-full p-2 border rounded-lg font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">ग्रेड वृद्धि हुने महिना</label>
                <NepaliTextInput
                  value={editFormData.gradeIncreaseMonthText}
                  onChange={(val) =>
                    setEditFormData({
                      ...editFormData,
                      gradeIncreaseMonthText: val,
                    })
                  }
                  isNepali={true}
                  placeholder="श्रावण देखि"
                  className="w-full p-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">चाडपर्व खर्च पाउने महिना</label>
                <NepaliTextInput
                  value={editFormData.festivalBonusMonth}
                  onChange={(val) =>
                    setEditFormData({
                      ...editFormData,
                      festivalBonusMonth: val,
                    })
                  }
                  isNepali={true}
                  placeholder="असोज"
                  className="w-full p-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">कैफियत</label>
                <NepaliTextInput
                  value={editFormData.remarks}
                  onChange={(val) => setEditFormData({ ...editFormData, remarks: val })}
                  isNepali={true}
                  placeholder="ग्रेड पूरा भएको"
                  className="w-full p-2 border rounded-lg"
                />
              </div>
            </div>

            {/* Calculated Preview Box */}
            <div className="bg-[#edf4ea] p-3 rounded-xl border border-[#cbdcc6] flex items-center justify-between text-xs font-bold text-[#24331C]">
              <div>
                जम्मा ग्रेड रकम: रु. {formatAmount((editFormData.previousGradeCount + editFormData.addedGradeCount) * editFormData.gradeRate)}
              </div>
              <div>
                तलब र ग्रेडको जम्मा रकम: रु. {formatAmount(editFormData.basicSalary + editFormData.technicalGradeAmount + (editFormData.previousGradeCount + editFormData.addedGradeCount) * editFormData.gradeRate)}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <button
                onClick={() => setEditingRowId(null)}
                className="px-4 py-2 border rounded-xl text-gray-600 hover:bg-gray-100 font-medium text-xs cursor-pointer"
              >
                रद्द गर्नुहोस्
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-5 py-1.5 bg-[#4B6043] text-white rounded-xl font-bold hover:bg-[#384c31] shadow-xs cursor-pointer"
              >
                <span className="flex flex-col text-left leading-tight">
                  <span className="text-xs">विवरण सुरक्षित गर्नुहोस्</span>
                  <span className="text-[9px] font-normal opacity-90">(Save)</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

