import React, { useState, useMemo } from 'react';
import {
  CalendarDays,
  Printer,
  Download,
  Eye,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';
import { Letterhead, ReportSignatures } from '../common/Letterhead';
import { NepaliMonth } from '../../types';
import { MONTH_ORDER, round2 } from '../../utils/calculationEngine';
import { formatNepaliCurrency, toNepaliDigits } from '../../utils/nepaliCalendar';

export const MonthlySalarySheetView: React.FC = () => {
  const {
    employees,
    salarySetups,
    deductionSetups,
    annualTaxResults,
    taxReferences,
    activeFiscalYear,
    useDevanagariNumerals,
    setAuditEmployeeId,
  } = useApp();

  const [selectedMonth, setSelectedMonth] = useState<NepaliMonth>('श्रावण');
  const [filterService, setFilterService] = useState<string>('all');

  const formatMoney = (val: number) =>
    formatNepaliCurrency(val, { useDevanagari: useDevanagariNumerals, showSymbol: false });

  // Calculate monthly sheet rows for the chosen month
  const monthlyRows = useMemo(() => {
    return employees
      .filter((emp) => filterService === 'all' || emp.serviceType === filterService)
      .map((emp) => {
        const sal = salarySetups[emp.id];
        const ded = deductionSetups[emp.id];
        const taxRes = annualTaxResults[emp.id];

        if (!sal || !ded || !taxRes) return null;

        const currentMonthIdx = MONTH_ORDER.indexOf(selectedMonth);
        const gradeIncIdx = MONTH_ORDER.indexOf(sal.gradeIncreaseMonth);
        
        // अघिल्लो आ.व. असार मसान्त सम्मको ग्रेड संख्या र कुल ग्रेड संख्या
        const prevGradeCount = sal.previousGradeCount !== undefined
          ? sal.previousGradeCount
          : (emp.previousGradeCount !== undefined ? emp.previousGradeCount : Math.max(0, sal.currentGradeCount - (sal.gradeIncreaseCount || 0)));

        const totalGradeCount = sal.currentGradeCount !== undefined
          ? sal.currentGradeCount
          : (prevGradeCount + (sal.addedGradeCount ?? sal.gradeIncreaseCount ?? 0));

        const addedGrade = sal.addedGradeCount !== undefined
          ? sal.addedGradeCount
          : (sal.gradeIncreaseCount !== undefined ? sal.gradeIncreaseCount : 0);

        // ग्रेड पूरा भएको वा थप हुने ग्रेड संख्या <= ० भएको अवस्था
        const isGradeFull =
          (sal.gradeIncreaseMonth as string) === 'ग्रेड पुरा' ||
          (emp.gradeIncreaseMonthText && emp.gradeIncreaseMonthText.includes('ग्रेड पुरा')) ||
          (emp.remarks && emp.remarks.includes('ग्रेड पुरा')) ||
          addedGrade <= 0;

        let activeGradeCount: number;

        // १. यदि ग्रेड बृद्धि हुने महिना श्रावण (वा ग्रेड पूरा) छ र चालु आ.व. मा थप हुने ग्रेड संख्या <= ० छ भने:
        if (isGradeFull) {
          // श्रावण देखि अषाढ सम्म १२ महिनाको ग्रेड रकम = कुल ग्रेड संख्या (Total Grades) × ग्रेड दर
          activeGradeCount = totalGradeCount;
        } else {
          // २. यदि श्रावण, भाद्र, असोज, कार्तिक, मंसिर, पौष, माघ, फागुन, चैत्र, बैशाख, जेठ महिना छ र चालु आ.व. मा थप हुने ग्रेड संख्या > ० छ भने:
          // तोकिएको महिना अगाडिका महिनाहरुको लागि: अघिल्लो आ.व. असार सम्मको ग्रेड संख्या × ग्रेड दर
          // तोकिएको महिना देखि बाँकी महिनाहरुमा: अघिल्लो आ.व. असार सम्मको ग्रेड संख्या + थप ग्रेड दर
          if (gradeIncIdx !== -1 && currentMonthIdx >= gradeIncIdx) {
            activeGradeCount = prevGradeCount + addedGrade;
          } else {
            activeGradeCount = prevGradeCount;
          }
        }

        // 6. हालको ग्रेड रकम
        const gradeAmt = round2(sal.gradeRate * activeGradeCount);
        
        // 5. तलब स्केल (प्राविधिक ग्रेड समेत)
        const basicSalaryWithTech = round2(sal.basicSalary + (sal.technicalGradeAmount || emp.technicalGradeAmount || 0));

        // 6. हालको ग्रेड रकम
        // (gradeAmt already calculated above)

        // 7. सावधिक जीवन बिमा कोष (थप) - Govt/Office matching
        const insuranceThap = round2(sal.lifeInsuranceFund || 0);

        // 8. संचयकोष (थप) = (Col 5 तलब स्केल प्राविधिक ग्रेड समेत + Col 6 हालको ग्रेड रकम) को योग रकममा १०%
        const epfBase = basicSalaryWithTech + gradeAmt;
        const epfThap = emp.serviceType !== 'करार' ? round2(epfBase * 0.10) : 0;

        // 9. योगदानमा आधारित निवृत्तिभरण कोष (थप) - Govt/Office matching (6% for pensionable)
        const pensionThap = emp.pension === 'भएको' ? round2(epfBase * 0.06) : 0;

        // 10. महंगी भत्ता
        const dearness = round2(sal.dearnessAllowance || 0);

        // 11. प्रोत्साहन भत्ता
        const incentive = round2(sal.incentiveAllowance || 0);

        // 12. अन्य भत्ताहरू (एकमुष्ट योग) - Remote, other income/taxable, vehicle, comms, etc.
        const otherAllowances = round2(
          (sal.remoteAllowance || 0) +
          ((sal.otherIncome || 0) / 12) +
          (sal.vehicleAllowance || 0) +
          (sal.communicationAllowance || 0)
        );

        // 13. मासिक पाउने जम्मा = Col 5 + 6 + 7 + 8 + 9 + 10 + 11 + 12
        const totalMonthlyReceivable = round2(
          basicSalaryWithTech +
          gradeAmt +
          insuranceThap +
          epfThap +
          pensionThap +
          dearness +
          incentive +
          otherAllowances
        );

        // 14. चाड पर्व खर्च (कर्मचारी विवरण तथा तलब/आय Setup मा तोकिएको महिनामा भुक्तानी)
        const festMonth = (sal.festivalBonusMonth || emp.festivalBonusMonth || 'असोज').replace(' महिनामा भुक्तानी', '').trim();
        const festival = selectedMonth === festMonth ? round2(taxRes.festivalAllowance || 0) : 0;

        // 15. पोशाक भत्ता (कर्मचारी विवरण तथा तलब/आय Setup मा तोकिएको महिनामा भुक्तानी)
        const uniformMonth = (sal.uniformAllowanceMonth || emp.uniformAllowanceMonth || 'चैत्र').replace(' महिनामा भुक्तानी', '').trim();
        const uniform = selectedMonth === uniformMonth ? round2(sal.uniformAllowance || 0) : 0;

        // 16. संचयकोष (कट्टी) = Col 8 (संचयकोष थप) × २
        const epfKatti = round2(epfThap * 2);

        // 17. सावधिक जीवन बिमा कोष (कट्टी) = Col 7 (सावधिक जीवन बिमा कोष थप) × २
        const insuranceKatti = round2(insuranceThap * 2);

        // 18. निवृत्तिभरण कोष (कट्टी) = Col 9 (निवृत्तिभरण कोष थप) × २
        const pensionKatti = round2(pensionThap * 2);

        // 19. नागरिक लगानी कोष (कट्टी)
        const citKatti = round2(ded.citizenInvestmentTrust || 0);

        // 20. सापटी/ऋण (कट्टी)
        const loanKatti = round2(ded.loanDeduction || 0);

        // 21. अन्य (कट्टी)
        const otherKatti = round2(ded.otherDeduction || 0);

        // 22. सामाजिक सुरक्षा कर (कट्टी) = प्रयोगकर्ताको सूत्र: (१% ले हुने वार्षिक कर रकम - अपाङ्ग व्यक्तिले पाउने छुट रकम - योगदानमा आधारित निवृत्तिभरण कोष प्राप्त कर्मचारीलाई सा.सु.कर छुट रकम - औषधी उपचार खर्च मिलान - वार्षिक करको १०% छुट (महिला कर्मचारीको लागि मात्र) रकम) / 12
        let resolvedSST = 0;
        if (emp.pension === 'भएको') {
          // योगदानमा आधारित निवृत्तिभरण "भएको" भए १% सा.सु.कर पूर्ण छुट (कट्टी = ०)
          resolvedSST = 0;
        } else if (taxRes.monthlySST !== undefined) {
          resolvedSST = taxRes.monthlySST;
        } else if (taxRes.annualSST !== undefined) {
          resolvedSST = taxRes.annualSST / 12;
        } else if (taxRes.taxSlabBreakdowns && taxRes.taxSlabBreakdowns.length > 0) {
          const sstSlab = taxRes.taxSlabBreakdowns.find((s) => s.ratePercent === 1);
          resolvedSST = sstSlab ? (sstSlab.taxAmount / 12) : 0;
        } else {
          const empTaxRef = taxReferences?.find((tr) => tr.filingType === emp.filingType) || taxReferences?.[0];
          const slab1 = empTaxRef?.slabs?.[0] || { fromAmount: 0, toAmount: emp.filingType === 'दम्पत्ती' ? 600000 : 500000, ratePercent: 1 };
          const totalDed16to21 = epfKatti + insuranceKatti + pensionKatti + citKatti + loanKatti + otherKatti;
          const addedGradeAmount = (sal.addedGradeCount ?? sal.gradeIncreaseCount ?? 0) * (sal.gradeRate || 0);
          const monthlyNetBase = (totalMonthlyReceivable + festival + uniform + (addedGradeAmount > 0 ? addedGradeAmount : 0)) - totalDed16to21;
          const annualizedNetIncome = Math.max(0, monthlyNetBase * 12);
          const taxableInSlab1 = Math.min(annualizedNetIncome, (slab1.toAmount - (slab1.fromAmount || 0)));
          resolvedSST = (taxableInSlab1 * (slab1.ratePercent / 100)) / 12;
        }
        const sstKatti = round2(resolvedSST);

        // 23. पारिश्रमिक कर (कट्टी) = [(Col 13 जम्मा + चाडपर्व खर्च + पोशाक भत्ता + थप ग्रेड रकम) - (Col 16 देखि 21 सम्मको कट्टी)] × 12 रकम Tax Reference Setup क्र.सं. २, ३, ४, ५ आदि स्ल्याब भन्दा अधिक भएमा सोही क्र.सं. को करको दर (%) ले गणना गरी आएको रकमको योग
        const incomeTaxKatti = round2(
          taxRes.monthlyRemunerationTax !== undefined
            ? taxRes.monthlyRemunerationTax
            : (
                Math.max(
                  0,
                  (taxRes.taxSlabBreakdowns?.filter((s) => s.ratePercent !== 1).reduce((sum, s) => sum + s.taxAmount, 0) || 0) -
                    (taxRes.disabilityTaxRelief || 0) -
                    (taxRes.femaleTaxRebate || 0) -
                    (taxRes.medicalTaxCredit || 0)
                ) / 12
              )
        );

        // 24. कुल जम्मा कट्टी = Col 16 + 17 + 18 + 19 + 20 + 21 + 22 + 23
        const totalDeductions = round2(
          epfKatti +
          insuranceKatti +
          pensionKatti +
          citKatti +
          loanKatti +
          otherKatti +
          sstKatti +
          incomeTaxKatti
        );

        // 25. खुद पाउने कुल जम्मा रकम = (Col 13 जम्मा + Col 14 चाडपर्व खर्च + Col 15 पोशाक भत्ता) - Col 24 कुल कट्टी
        const netSalary = round2(totalMonthlyReceivable + festival + uniform - totalDeductions);

        return {
          emp,
          basicSalaryWithTech,
          gradeAmt,
          insuranceThap,
          epfThap,
          pensionThap,
          dearness,
          incentive,
          uniform,
          otherAllowances,
          totalMonthlyReceivable,
          festival,
          epfKatti,
          insuranceKatti,
          pensionKatti,
          citKatti,
          loanKatti,
          otherKatti,
          sstKatti,
          incomeTaxKatti,
          totalDeductions,
          netSalary,
        };
      })
      .filter(Boolean) as NonNullable<any>[];
  }, [employees, salarySetups, deductionSetups, annualTaxResults, taxReferences, selectedMonth, filterService]);

  // Calculate totals
  const totals = useMemo(() => {
    const sum = {
      basicSalaryWithTech: 0,
      gradeAmt: 0,
      insuranceThap: 0,
      epfThap: 0,
      pensionThap: 0,
      dearness: 0,
      incentive: 0,
      uniform: 0,
      otherAllowances: 0,
      totalMonthlyReceivable: 0,
      festival: 0,
      epfKatti: 0,
      insuranceKatti: 0,
      pensionKatti: 0,
      citKatti: 0,
      loanKatti: 0,
      otherKatti: 0,
      sstKatti: 0,
      incomeTaxKatti: 0,
      totalDeductions: 0,
      netSalary: 0,
    };

    monthlyRows.forEach((row) => {
      sum.basicSalaryWithTech += row.basicSalaryWithTech;
      sum.gradeAmt += row.gradeAmt;
      sum.insuranceThap += row.insuranceThap;
      sum.epfThap += row.epfThap;
      sum.pensionThap += row.pensionThap;
      sum.dearness += row.dearness;
      sum.incentive += row.incentive;
      sum.uniform += row.uniform;
      sum.otherAllowances += row.otherAllowances;
      sum.totalMonthlyReceivable += row.totalMonthlyReceivable;
      sum.festival += row.festival;
      sum.epfKatti += row.epfKatti;
      sum.insuranceKatti += row.insuranceKatti;
      sum.pensionKatti += row.pensionKatti;
      sum.citKatti += row.citKatti;
      sum.loanKatti += row.loanKatti;
      sum.otherKatti += row.otherKatti;
      sum.sstKatti += row.sstKatti;
      sum.incomeTaxKatti += row.incomeTaxKatti;
      sum.totalDeductions += row.totalDeductions;
      sum.netSalary += row.netSalary;
    });

    return sum;
  }, [monthlyRows]);

  // Export to Excel handler (Matching 26 columns)
  const handleExportExcel = () => {
    const dataToExport = monthlyRows.map((row, idx) => ({
      'क्र.सं. (1)': idx + 1,
      'कर्मचारी संकेत नं. (2)': row.emp.code,
      'नाम तथा पद (3)': `${row.emp.name} (${row.emp.designation})`,
      'पान नं. (4)': row.emp.panNumber || '-',
      'तलब स्केल प्राविधिक ग्रेड समेत (5)': Number(row.basicSalaryWithTech.toFixed(2)),
      'हालको ग्रेड रकम (6)': Number(row.gradeAmt.toFixed(2)),
      'सावधिक जीवन बिमा कोष थप (7)': Number(row.insuranceThap.toFixed(2)),
      'संचयकोष थप (8)': Number(row.epfThap.toFixed(2)),
      'योगदानमा आधारित निवृत्तिभरण कोष थप (9)': Number(row.pensionThap.toFixed(2)),
      'महंगी भत्ता (10)': Number(row.dearness.toFixed(2)),
      'प्रोत्साहन भत्ता (11)': Number(row.incentive.toFixed(2)),
      'अन्य भत्ताहरू एकमुष्ट योग (12)': Number(row.otherAllowances.toFixed(2)),
      'मासिक पाउने जम्मा (13)': Number(row.totalMonthlyReceivable.toFixed(2)),
      'चाड पर्व खर्च (14)': Number(row.festival.toFixed(2)),
      'पोशाक भत्ता (15)': Number(row.uniform.toFixed(2)),
      'संचयकोष कट्टी (16)': Number(row.epfKatti.toFixed(2)),
      'सावधिक जीवन बिमा कोष कट्टी (17)': Number(row.insuranceKatti.toFixed(2)),
      'निवृत्तिभरण कोष कट्टी (18)': Number(row.pensionKatti.toFixed(2)),
      'नागरिक लगानी कोष कट्टी (19)': Number(row.citKatti.toFixed(2)),
      'सापटी/ऋण कट्टी (20)': Number(row.loanKatti.toFixed(2)),
      'अन्य कट्टी (21)': Number(row.otherKatti.toFixed(2)),
      'सामाजिक सुरक्षा कर कट्टी (22)': Number(row.sstKatti.toFixed(2)),
      'पारिश्रमिक कर कट्टी (23)': Number(row.incomeTaxKatti.toFixed(2)),
      'कुल जम्मा कट्टी (24)': Number(row.totalDeductions.toFixed(2)),
      'खुद पाउने कुल जम्मा रकम (25)': Number(row.netSalary.toFixed(2)),
      'कैफियत (26)': row.emp.remarks || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `${selectedMonth}_मासिक_तलब_भरपाई`);
    XLSX.writeFile(workbook, `Monthly_Salary_Sheet_${selectedMonth}_${activeFiscalYear}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Action Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs flex flex-wrap items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#edf4ea] border border-[#cbdcc6] text-[#4B6043] flex items-center justify-center">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#24331C]">
              मासिक कर्मचारी तलब भरपाई (Official Monthly Salary Sheet)
              <span className="ml-2 text-xs bg-[#e0ecdc] text-[#344b2d] px-2.5 py-1 rounded-full border border-[#cbdcc6]">
                २६-महल विशिष्टीकरण
              </span>
            </h2>
            <p className="text-xs text-[#526a48] mt-1">
              आर्थिक वर्ष {toNepaliDigits(activeFiscalYear)} को आधिकारिक सरकारी ढाँचा अनुसारको २६ महल मासिक तलब भरपाई रजिष्टर
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Service Filter */}
          <select
            value={filterService}
            onChange={(e) => setFilterService(e.target.value)}
            className="py-2 px-3 rounded-xl border border-[#c8d7c2] bg-[#fbfdfa] text-[#24331C] text-xs font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none cursor-pointer"
          >
            <option value="all">सबै सेवा (All Services)</option>
            <option value="स्थायी">स्थायी (Permanent)</option>
            <option value="अस्थायी">अस्थायी (Temporary)</option>
            <option value="करार">करार (Contract)</option>
          </select>

          {/* Export to Excel */}
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-[#edf4ea] text-[#344b2d] hover:bg-[#dbe8d6] text-xs font-bold rounded-xl border border-[#c5d7bf] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>एक्सेल डाउनलोड</span>
          </button>

          {/* Print Button */}
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-[#4B6043] text-white hover:bg-[#384c31] text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>भरपाई प्रिन्ट गर्नुहोस्</span>
          </button>
        </div>
      </div>

      {/* 12 Nepali Month Horizontal Switcher Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-[#d6e3d2] shadow-xs flex items-center gap-1.5 overflow-x-auto no-print">
        {MONTH_ORDER.map((month) => {
          const isSelected = selectedMonth === month;
          return (
            <button
              key={month}
              onClick={() => setSelectedMonth(month)}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                isSelected
                  ? 'bg-[#4B6043] text-white shadow-xs'
                  : 'text-[#3f5437] hover:bg-[#edf4ea]'
              }`}
            >
              {month} महिना
              {month === 'असोज' && <span className="ml-1 text-[10px] opacity-90 font-bold bg-[#edf4ea] text-[#4B6043] px-1 rounded">(दशैं)</span>}
              {month === 'चैत्र' && <span className="ml-1 text-[10px] opacity-90 font-bold bg-[#edf4ea] text-[#4B6043] px-1 rounded">(पोशाक)</span>}
            </button>
          );
        })}
      </div>

      {/* Printable Sheet Container */}
      <div className="bg-white p-6 rounded-2xl border border-[#d6e3d2] shadow-sm overflow-hidden print:p-0 print:border-none print:shadow-none">
        {/* Printable Official Letterhead */}
        <Letterhead
          title={`कर्मचारी मासिक तलब भरपाई — ${selectedMonth} महिना`}
          subTitle={`आर्थिक वर्ष ${toNepaliDigits(activeFiscalYear)}`}
          showMetadata={false}
          showLocation={false}
          showReportDate={false}
          showSignatureSection={false}
        />

        {/* 26 Column Hierarchical Salary Table (Adjustable by entry text/number) */}
        <div className="overflow-x-auto mt-6 border border-[#cadac4] rounded-xl print:border-black print:rounded-none">
          <table className="table-auto w-max min-w-full text-left text-[10px] border-collapse print:text-[8px] print:w-full">
            <thead className="bg-[#e4ede0] text-[#24331C] border-b border-[#cadac4]">
              {/* Row 1: Group Headers */}
              <tr className="bg-[#e4ede0]">
                <th rowSpan={2} className="p-1.5 px-2 border-r border-b border-[#cadac4] text-center font-bold align-middle bg-[#e4ede0] text-[#24331C] leading-tight break-words whitespace-normal">क्र.सं.</th>
                <th rowSpan={2} className="p-1.5 px-2 border-r border-b border-[#cadac4] text-center font-bold align-middle bg-[#e4ede0] text-[#24331C] leading-tight break-words whitespace-normal">कर्मचारी<br/>संकेत नं.</th>
                <th rowSpan={2} className="p-1.5 px-2.5 border-r border-b border-[#cadac4] text-center font-bold align-middle bg-[#e4ede0] text-[#24331C] leading-tight break-words whitespace-normal">नाम तथा पद</th>
                <th rowSpan={2} className="p-1.5 px-2 border-r border-b border-[#cadac4] text-center font-bold align-middle bg-[#e4ede0] text-[#24331C] leading-tight break-words whitespace-normal">पान नं.</th>
                <th colSpan={9} className="p-1.5 border-r border-b border-[#cadac4] text-center bg-[#e4ede0] font-extrabold text-[#24331C] text-[11px]">
                  मासिक पाउने रकम
                </th>
                <th rowSpan={2} className="p-1.5 px-2 border-r border-b border-[#cadac4] text-center font-bold align-middle bg-[#e4ede0] text-[#24331C] leading-tight break-words whitespace-normal">चाड पर्व<br/>खर्च</th>
                <th rowSpan={2} className="p-1.5 px-2 border-r border-b border-[#cadac4] text-center font-bold align-middle bg-[#e4ede0] text-[#24331C] leading-tight break-words whitespace-normal">पोशाक<br/>भत्ता</th>
                <th colSpan={6} className="p-1.5 border-r border-b border-[#cadac4] text-center bg-[#e4ede0] font-extrabold text-[#24331C] text-[11px]">
                  मासिक कट्टी रकम
                </th>
                <th colSpan={2} className="p-1.5 border-r border-b border-[#cadac4] text-center bg-[#e4ede0] font-extrabold text-[#24331C] text-[11px]">
                  कर कट्टी रकम
                </th>
                <th rowSpan={2} className="p-1.5 px-2 border-r border-b border-[#cadac4] text-center font-bold align-middle bg-[#e4ede0] text-[#24331C] leading-tight break-words whitespace-normal">कुल जम्मा<br/>कट्टी</th>
                <th rowSpan={2} className="p-1.5 px-2 border-r border-b border-[#cadac4] text-center font-bold align-middle bg-[#e4ede0] text-[#24331C] text-[11px] leading-tight break-words whitespace-normal">
                  खुद पाउने<br/>कुल जम्मा
                </th>
                <th rowSpan={2} className="p-1.5 px-2 text-center font-bold align-middle bg-[#e4ede0] text-[#24331C] no-print border-b border-[#cadac4] leading-tight break-words whitespace-normal">अडिट</th>
                <th rowSpan={2} className="p-1.5 px-2 text-center font-bold align-middle bg-[#e4ede0] text-[#24331C] hidden print:table-cell border-b border-[#cadac4] leading-tight break-words whitespace-normal">कैफियत / दस्तखत</th>
              </tr>

              {/* Row 2: Sub Headers */}
              <tr className="bg-[#e4ede0]">
                {/* Columns 5-13 (मासिक पाउने रकम) */}
                <th className="p-1.5 px-2 border-r border-b border-[#cadac4] text-center font-bold text-[#24331C] bg-[#e4ede0] leading-tight break-words whitespace-normal">तलब स्केल<br/>(प्रा. ग्रेड समेत)</th>
                <th className="p-1.5 px-2 border-r border-b border-[#cadac4] text-center font-bold text-[#24331C] bg-[#e4ede0] leading-tight break-words whitespace-normal">हालको<br/>ग्रेड रकम</th>
                <th className="p-1.5 px-2 border-r border-b border-[#cadac4] text-center font-bold text-[#24331C] bg-[#e4ede0] leading-tight break-words whitespace-normal">सावधिक जीवन<br/>बिमा (थप)</th>
                <th className="p-1.5 px-2 border-r border-b border-[#cadac4] text-center font-bold text-[#24331C] bg-[#e4ede0] leading-tight break-words whitespace-normal">संचयकोष<br/>(थप)</th>
                <th className="p-1.5 px-2 border-r border-b border-[#cadac4] text-center font-bold text-[#24331C] bg-[#e4ede0] leading-tight break-words whitespace-normal">निवृत्तिभरण<br/>कोष (थप)</th>
                <th className="p-1.5 px-2 border-r border-b border-[#cadac4] text-center font-bold text-[#24331C] bg-[#e4ede0] leading-tight break-words whitespace-normal">महंगी<br/>भत्ता</th>
                <th className="p-1.5 px-2 border-r border-b border-[#cadac4] text-center font-bold text-[#24331C] bg-[#e4ede0] leading-tight break-words whitespace-normal">प्रोत्साहन<br/>भत्ता</th>
                <th className="p-1.5 px-2 border-r border-b border-[#cadac4] text-center font-bold text-[#24331C] bg-[#e4ede0] leading-tight break-words whitespace-normal">अन्य भत्ता<br/>(एकमुष्ट योग)</th>
                <th className="p-1.5 px-2 border-r border-b border-[#cadac4] text-center font-extrabold text-[#24331C] bg-[#e4ede0] leading-tight break-words whitespace-normal">जम्मा</th>

                {/* Columns 16-21 (मासिक कट्टी रकम) */}
                <th className="p-1.5 px-2 border-r border-b border-[#cadac4] text-center font-bold text-[#24331C] bg-[#e4ede0] leading-tight break-words whitespace-normal">संचयकोष<br/>(कट्टी)</th>
                <th className="p-1.5 px-2 border-r border-b border-[#cadac4] text-center font-bold text-[#24331C] bg-[#e4ede0] leading-tight break-words whitespace-normal">सावधिक जीवन<br/>बिमा (कट्टी)</th>
                <th className="p-1.5 px-2 border-r border-b border-[#cadac4] text-center font-bold text-[#24331C] bg-[#e4ede0] leading-tight break-words whitespace-normal">निवृत्तिभरण<br/>कोष (कट्टी)</th>
                <th className="p-1.5 px-2 border-r border-b border-[#cadac4] text-center font-bold text-[#24331C] bg-[#e4ede0] leading-tight break-words whitespace-normal">नागरिक लगानी<br/>कोष (कट्टी)</th>
                <th className="p-1.5 px-2 border-r border-b border-[#cadac4] text-center font-bold text-[#24331C] bg-[#e4ede0] leading-tight break-words whitespace-normal">सापटी/ऋण<br/>(कट्टी)</th>
                <th className="p-1.5 px-2 border-r border-b border-[#cadac4] text-center font-bold text-[#24331C] bg-[#e4ede0] leading-tight break-words whitespace-normal">अन्य<br/>(कट्टी)</th>

                {/* Columns 22-23 (कर कट्टी रकम) */}
                <th className="p-1.5 px-2 border-r border-b border-[#cadac4] text-center font-bold text-[#24331C] bg-[#e4ede0] leading-tight break-words whitespace-normal">सामाजिक सुरक्षा<br/>कर (कट्टी)</th>
                <th className="p-1.5 px-2 border-r border-b border-[#cadac4] text-center font-bold text-[#24331C] bg-[#e4ede0] leading-tight break-words whitespace-normal">पारिश्रमिक<br/>कर (कट्टी)</th>
              </tr>

              {/* Row 3: Column Reference Numbers (1 to 26) */}
              <tr className="bg-[#e4ede0] text-center text-[9px] text-[#24331C] font-mono font-bold">
                {Array.from({ length: 25 }, (_, i) => (
                  <td key={i} className="p-1 border-r border-b border-[#cadac4] text-center bg-[#e4ede0]">
                    {toNepaliDigits(i + 1)}
                  </td>
                ))}
                <td className="p-1 border-b border-[#cadac4] text-center bg-[#e4ede0] no-print">-</td>
                <td className="p-1 border-b border-[#cadac4] text-center bg-[#e4ede0] hidden print:table-cell">२६</td>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-[#cadac4]">
              {monthlyRows.map((row, index) => (
                <tr key={row.emp.id} className="bg-white hover:bg-[#f7faf5] transition-colors">
                  {/* Col 1 */}
                  <td className="p-1.5 px-2 border-r border-[#cadac4] text-center font-mono text-gray-700 font-bold bg-inherit whitespace-nowrap">
                    {toNepaliDigits(index + 1)}
                  </td>
                  {/* Col 2 */}
                  <td className="p-1.5 px-2 border-r border-[#cadac4] font-mono font-bold text-[#24331C] text-center bg-inherit whitespace-nowrap">
                    {toNepaliDigits(row.emp.code)}
                  </td>
                  {/* Col 3 */}
                  <td className="p-1.5 px-2.5 border-r border-[#cadac4] bg-inherit whitespace-nowrap">
                    <div className="font-bold text-[#24331C]">{row.emp.name}</div>
                    <div className="text-[9px] text-gray-500 font-semibold">
                      {row.emp.designation} {row.emp.level ? `(${row.emp.level})` : ''}
                    </div>
                  </td>
                  {/* Col 4 */}
                  <td className="p-1.5 px-2 border-r border-[#cadac4] font-mono text-center text-gray-700 bg-inherit whitespace-nowrap">
                    {toNepaliDigits(row.emp.panNumber || '-')}
                  </td>

                  {/* Monthly Receivables: Col 5 to 13 */}
                  <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono bg-inherit text-gray-800 whitespace-nowrap">{formatMoney(row.basicSalaryWithTech)}</td>
                  <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono bg-inherit text-gray-800 whitespace-nowrap">{formatMoney(row.gradeAmt)}</td>
                  <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono bg-inherit text-gray-800 whitespace-nowrap">{formatMoney(row.insuranceThap)}</td>
                  <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono bg-inherit text-gray-800 whitespace-nowrap">{formatMoney(row.epfThap)}</td>
                  <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono bg-inherit text-gray-800 whitespace-nowrap">{formatMoney(row.pensionThap)}</td>
                  <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono bg-inherit text-gray-800 whitespace-nowrap">{formatMoney(row.dearness)}</td>
                  <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono bg-inherit text-gray-800 whitespace-nowrap">{formatMoney(row.incentive)}</td>
                  <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono bg-inherit text-gray-800 whitespace-nowrap">{formatMoney(row.otherAllowances)}</td>
                  <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono font-bold bg-inherit text-[#24351e] whitespace-nowrap">
                    {formatMoney(row.totalMonthlyReceivable)}
                  </td>

                  {/* Festival Expense: Col 14 & Uniform Allowance: Col 15 */}
                  <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono bg-inherit text-gray-800 whitespace-nowrap">{formatMoney(row.festival)}</td>
                  <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono bg-inherit text-gray-800 whitespace-nowrap">{formatMoney(row.uniform)}</td>

                  {/* Monthly Deductions: Col 16 to 21 */}
                  <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono bg-inherit text-gray-800 whitespace-nowrap">{formatMoney(row.epfKatti)}</td>
                  <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono bg-inherit text-gray-800 whitespace-nowrap">{formatMoney(row.insuranceKatti)}</td>
                  <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono bg-inherit text-gray-800 whitespace-nowrap">{formatMoney(row.pensionKatti)}</td>
                  <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono bg-inherit text-gray-800 whitespace-nowrap">{formatMoney(row.citKatti)}</td>
                  <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono bg-inherit text-gray-800 whitespace-nowrap">{formatMoney(row.loanKatti)}</td>
                  <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono bg-inherit text-gray-800 whitespace-nowrap">{formatMoney(row.otherKatti)}</td>

                  {/* Tax Deductions: Col 22 & 23 */}
                  <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono bg-inherit text-gray-800 whitespace-nowrap">{formatMoney(row.sstKatti)}</td>
                  <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono bg-inherit text-gray-800 whitespace-nowrap">{formatMoney(row.incomeTaxKatti)}</td>

                  {/* Total Deductions & Net Paid: Col 24 & 25 */}
                  <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono font-bold text-gray-900 bg-inherit whitespace-nowrap">
                    {formatMoney(row.totalDeductions)}
                  </td>
                  <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono font-bold text-[#1d2d18] bg-inherit whitespace-nowrap">
                    {formatMoney(row.netSalary)}
                  </td>

                  {/* Audit Actions */}
                  <td className="p-1.5 px-2 text-center no-print bg-inherit whitespace-nowrap">
                    <button
                      onClick={() => setAuditEmployeeId(row.emp.id)}
                      className="px-2 py-0.5 text-[9px] font-bold text-[#4B6043] bg-[#edf4ea] hover:bg-[#dbe7d7] rounded border border-[#c5d7bf] cursor-pointer"
                    >
                      अडिट हेर्नुहोस्
                    </button>
                  </td>

                  {/* Printable Remarks/Signature Column */}
                  <td className="p-1.5 px-2 border-b border-[#cadac4] text-center hidden print:table-cell bg-inherit whitespace-nowrap">
                    <div className="h-6"></div>
                  </td>
                </tr>
              ))}

              {/* Grand Total Footer Row */}
              <tr className="bg-[#e4ede0] font-bold text-[#24331C] border-t-2 border-[#4B6043]">
                <td colSpan={4} className="p-2 border-r border-[#cadac4] text-center text-[11px] font-extrabold bg-[#e4ede0] whitespace-nowrap">
                  कुल जम्मा (Grand Total):
                </td>

                <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono font-bold bg-[#e4ede0] whitespace-nowrap">{formatMoney(totals.basicSalaryWithTech)}</td>
                <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono font-bold bg-[#e4ede0] whitespace-nowrap">{formatMoney(totals.gradeAmt)}</td>
                <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono font-bold bg-[#e4ede0] whitespace-nowrap">{formatMoney(totals.insuranceThap)}</td>
                <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono font-bold bg-[#e4ede0] whitespace-nowrap">{formatMoney(totals.epfThap)}</td>
                <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono font-bold bg-[#e4ede0] whitespace-nowrap">{formatMoney(totals.pensionThap)}</td>
                <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono font-bold bg-[#e4ede0] whitespace-nowrap">{formatMoney(totals.dearness)}</td>
                <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono font-bold bg-[#e4ede0] whitespace-nowrap">{formatMoney(totals.incentive)}</td>
                <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono font-bold bg-[#e4ede0] whitespace-nowrap">{formatMoney(totals.otherAllowances)}</td>
                <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono font-extrabold bg-[#e4ede0] text-[#1f2e1a] whitespace-nowrap">
                  {formatMoney(totals.totalMonthlyReceivable)}
                </td>

                <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono font-bold bg-[#e4ede0] whitespace-nowrap">{formatMoney(totals.festival)}</td>
                <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono font-bold bg-[#e4ede0] whitespace-nowrap">{formatMoney(totals.uniform)}</td>

                <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono font-bold bg-[#e4ede0] whitespace-nowrap">{formatMoney(totals.epfKatti)}</td>
                <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono font-bold bg-[#e4ede0] whitespace-nowrap">{formatMoney(totals.insuranceKatti)}</td>
                <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono font-bold bg-[#e4ede0] whitespace-nowrap">{formatMoney(totals.pensionKatti)}</td>
                <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono font-bold bg-[#e4ede0] whitespace-nowrap">{formatMoney(totals.citKatti)}</td>
                <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono font-bold bg-[#e4ede0] whitespace-nowrap">{formatMoney(totals.loanKatti)}</td>
                <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono font-bold bg-[#e4ede0] whitespace-nowrap">{formatMoney(totals.otherKatti)}</td>

                <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono font-bold bg-[#e4ede0] whitespace-nowrap">{formatMoney(totals.sstKatti)}</td>
                <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono font-bold bg-[#e4ede0] whitespace-nowrap">{formatMoney(totals.incomeTaxKatti)}</td>

                <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono font-extrabold bg-[#e4ede0] whitespace-nowrap">
                  {formatMoney(totals.totalDeductions)}
                </td>
                <td className="p-1.5 px-2 border-r border-[#cadac4] text-right font-mono font-extrabold bg-[#e4ede0] whitespace-nowrap">
                  {formatMoney(totals.netSalary)}
                </td>

                <td className="p-1.5 px-2 text-center no-print bg-[#e4ede0] whitespace-nowrap">-</td>
                <td className="p-1.5 px-2 hidden print:table-cell bg-[#e4ede0] whitespace-nowrap">-</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Center Aligned Signatures Footer (Simple format: "तयार गर्ने, पेश गर्ने, सदर गर्ने" without dots/names/dates) */}
        <ReportSignatures variant="simple" className="mt-10 print:mt-12" />
      </div>
    </div>
  );
};
