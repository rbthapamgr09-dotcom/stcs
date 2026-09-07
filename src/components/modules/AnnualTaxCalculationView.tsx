import React, { useState, useMemo } from 'react';
import {
  Calculator,
  Printer,
  Download,
  Search,
  Filter,
  ShieldCheck,
  CheckCircle,
  Eye,
  FileSpreadsheet,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';
import { Letterhead, ReportSignatures } from '../common/Letterhead';
import { formatNepaliCurrency, toNepaliDigits, toEnglishDigits } from '../../utils/nepaliCalendar';
import { EmployeeTaxAssessmentReportModal } from './EmployeeTaxAssessmentReportModal';

export const AnnualTaxCalculationView: React.FC = () => {
  const {
    employees,
    annualTaxResults,
    taxReferences,
    activeFiscalYear,
    useDevanagariNumerals,
    setAuditEmployeeId,
    setActiveTab,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterFiling, setFilterFiling] = useState('all');
  const [assessmentEmployeeId, setAssessmentEmployeeId] = useState<string | null>(null);

  const formatMoney = (val: number) =>
    formatNepaliCurrency(val, { useDevanagari: useDevanagariNumerals, showSymbol: false });

  // Configured progressive tax slabs from Tax Reference Setup (distinct rates or maximum slabs count)
  const configuredSlabs = useMemo(() => {
    const singleRef = taxReferences?.find((tr) => tr.filingType === 'एकल') || taxReferences?.[0];
    const coupleRef = taxReferences?.find((tr) => tr.filingType === 'दम्पत्ती') || taxReferences?.[1] || taxReferences?.[0];
    const sourceSlabs = (singleRef?.slabs && singleRef.slabs.length > 0)
      ? singleRef.slabs
      : (coupleRef?.slabs && coupleRef.slabs.length > 0)
        ? coupleRef.slabs
        : [];

    if (sourceSlabs.length > 0) {
      return sourceSlabs;
    }
    return [
      { id: 'slab_1', ratePercent: 1, description: 'पहिलो स्ल्याब (१% सा.सु.कर)' },
      { id: 'slab_2', ratePercent: 10, description: 'दोस्रो स्ल्याब (१०%)' },
      { id: 'slab_3', ratePercent: 20, description: 'तेस्रो स्ल्याब (२०%)' },
      { id: 'slab_4', ratePercent: 30, description: 'चौथो स्ल्याब (३०%)' },
      { id: 'slab_5', ratePercent: 36, description: 'पाँचौं स्ल्याब (३६%)' },
      { id: 'slab_6', ratePercent: 39, description: 'छैटौं स्ल्याब (३९%)' },
    ];
  }, [taxReferences]);

  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const qEng = toEnglishDigits(q);
    const qNep = toNepaliDigits(q);

    return employees.filter((emp) => {
      const code = String(emp.code || '');
      const codeEng = toEnglishDigits(code).toLowerCase();
      const codeNep = toNepaliDigits(code).toLowerCase();
      const empName = String(emp.name || '').toLowerCase();
      const empDesig = String(emp.designation || '').toLowerCase();

      const matchesSearch =
        !q ||
        empName.includes(q) ||
        code.toLowerCase().includes(q) ||
        codeEng.includes(qEng) ||
        codeNep.includes(qNep) ||
        empDesig.includes(q);
      const matchesFiling = filterFiling === 'all' || emp.filingType === filterFiling;
      return matchesSearch && matchesFiling;
    });
  }, [employees, searchQuery, filterFiling]);

  // Aggregate totals
  const totals = useMemo(() => {
    let totalIncome = 0;
    let totalDeductions = 0;
    let totalTaxable = 0;
    let totalGrossTax = 0;
    let totalReliefs = 0;
    let totalNetTax = 0;
    let totalMonthlyTax = 0;

    filteredEmployees.forEach((emp) => {
      const res = annualTaxResults[emp.id];
      if (res) {
        totalIncome += res.totalAnnualIncome;
        totalDeductions += res.totalAnnualDeductions;
        totalTaxable += res.annualTaxableIncome;
        totalGrossTax += res.grossTaxLiabilityWithSST;
        totalReliefs +=
          res.disabilityTaxRelief +
          res.pensionSSTExemption +
          res.femaleTaxRebate +
          res.medicalTaxCredit;
        totalNetTax += res.netAnnualTaxLiability;
        totalMonthlyTax += res.monthlyTaxDeduction;
      }
    });

    return {
      totalIncome,
      totalDeductions,
      totalTaxable,
      totalGrossTax,
      totalReliefs,
      totalNetTax,
      totalMonthlyTax,
    };
  }, [filteredEmployees, annualTaxResults]);

  // Calculate totals for each configured progressive tax slab
  const slabGrandTotals = useMemo(() => {
    return configuredSlabs.map((slab, sIdx) => {
      return filteredEmployees.reduce((sum, emp) => {
        const res = annualTaxResults[emp.id];
        if (!res?.taxSlabBreakdowns) return sum;
        const slabData =
          res.taxSlabBreakdowns[sIdx] ||
          res.taxSlabBreakdowns.find((b) => b.ratePercent === slab.ratePercent);
        return sum + (slabData?.taxAmount || 0);
      }, 0);
    });
  }, [configuredSlabs, filteredEmployees, annualTaxResults]);

  const handleExportExcel = () => {
    const dataToExport = filteredEmployees.map((emp, idx) => {
      const res = annualTaxResults[emp.id];
      const totalReliefs =
        (res?.disabilityTaxRelief || 0) +
        (res?.pensionSSTExemption || 0) +
        (res?.femaleTaxRebate || 0) +
        (res?.medicalTaxCredit || 0);

      const rowObj: Record<string, any> = {
        'क्र.सं.': idx + 1,
        'संकेत नं': emp.code,
        'कर्मचारीको नाम': emp.name,
        'पद': emp.designation,
        'श्रेणी': emp.level,
        'सेवा': emp.serviceType,
        'कर स्थिति': emp.filingType,
        'प्यान नं': emp.panNumber || '-',
        'वार्षिक कुल आय': res?.totalAnnualIncome || 0,
        'वार्षिक कुल कट्टी': res?.totalAnnualDeductions || 0,
        'वार्षिक कर योग्य आय': res?.annualTaxableIncome || 0,
      };

      // Add dynamic slab columns
      configuredSlabs.forEach((slab, sIdx) => {
        const slabData =
          res?.taxSlabBreakdowns?.[sIdx] ||
          res?.taxSlabBreakdowns?.find((b) => b.ratePercent === slab.ratePercent);
        const isFirstSlab = sIdx === 0 || slab.ratePercent === 1;
        const colTitle = isFirstSlab
          ? `सा.सु. कर (${slab.ratePercent}%)`
          : `पारिश्रमिक आय कर (${slab.ratePercent}%)`;
        rowObj[colTitle] = slabData?.taxAmount || 0;
      });

      rowObj['कर छुट तथा सहुलियत'] = totalReliefs;
      rowObj['अन्तिम वार्षिक कर'] = res?.netAnnualTaxLiability || 0;
      rowObj['मासिक कर कट्टी (TDS)'] = res?.monthlyTaxDeduction || 0;

      return rowObj;
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `वार्षिक_कर_गणना`);
    XLSX.writeFile(workbook, `Annual_Tax_Calculation_${activeFiscalYear}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Actions */}
      <div className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs flex flex-wrap items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#edf4ea] border border-[#cbdcc6] text-[#4B6043] flex items-center justify-center">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#24331C]">
              वार्षिक कर गणना प्रतिवेदन (Annual Tax Assessment Sheet)
            </h2>
            <p className="text-xs text-[#526a48]">
              आर्थिक वर्ष {toNepaliDigits(activeFiscalYear)} को समस्त कर्मचारीहरूको वार्षिक कर योग्य आय तथा कर दायित्व
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="नाम वा संकेत नं खोज्नुहोस्..."
              className="pl-8 pr-3 py-1.5 rounded-xl border border-[#c8d7c2] bg-[#fbfdfa] text-[#24331C] text-xs focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
            />
          </div>

          {/* Filing Type Filter */}
          <select
            value={filterFiling}
            onChange={(e) => setFilterFiling(e.target.value)}
            className="py-1.5 px-3 rounded-xl border border-[#c8d7c2] bg-[#fbfdfa] text-[#24331C] text-xs font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
          >
            <option value="all">सबै (All Filing)</option>
            <option value="एकल">एकल (Single)</option>
            <option value="दम्पत्ती">दम्पत्ती (Married)</option>
          </select>

          {/* Export to Excel */}
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-1.5 bg-[#edf4ea] text-[#344b2d] hover:bg-[#dbe8d6] text-xs font-bold rounded-xl border border-[#c5d7bf] transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>एक्सेल डाउनलोड</span>
          </button>

          {/* Employee Tax Assessment Form Direct Modal Trigger */}
          {filteredEmployees.length > 0 && (
            <button
              onClick={() => setAssessmentEmployeeId(filteredEmployees[0].id)}
              className="px-3.5 py-1.5 bg-blue-50 text-blue-900 hover:bg-blue-100 text-xs font-bold rounded-xl border border-blue-200 transition-colors flex items-center gap-1.5 shadow-2xs"
              title="कर्मचारीगत पारिश्रमिक आयकर निर्धारण विवरण लेटरहेडमा प्रिन्ट गर्नुहोस्"
            >
              <Printer className="w-3.5 h-3.5 text-blue-700" />
              <span>पारिश्रमिक आयकर निर्धारण फाराम</span>
            </button>
          )}

          {/* Print */}
          <button
            onClick={() => window.print()}
            className="px-4 py-1.5 bg-[#4B6043] text-white hover:bg-[#384c31] text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>प्रिन्ट गर्नुहोस्</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        <div className="bg-white p-4 rounded-2xl border border-[#d6e3d2] shadow-xs">
          <p className="text-xs text-gray-500 font-medium">कुल वार्षिक कर योग्य आय</p>
          <h3 className="text-xl font-bold text-[#24331C] mt-1">{formatMoney(totals.totalTaxable)}</h3>
          <p className="text-[11px] text-[#526a48] mt-1">आय - स्वीकृत कट्टी रकम</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#d6e3d2] shadow-xs">
          <p className="text-xs text-gray-500 font-medium">कुल वार्षिक कर दायित्व (Net Tax)</p>
          <h3 className="text-xl font-bold text-amber-700 mt-1">{formatMoney(totals.totalNetTax)}</h3>
          <p className="text-[11px] text-amber-900 mt-1">छुट तथा सहुलियत समायोजन पछिको कर</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#d6e3d2] shadow-xs">
          <p className="text-xs text-gray-500 font-medium">मासिक कर संकलन (Monthly TDS)</p>
          <h3 className="text-xl font-bold text-emerald-800 mt-1">{formatMoney(totals.totalMonthlyTax)}</h3>
          <p className="text-[11px] text-emerald-700 mt-1">प्रत्येक महिना कट्टी हुने रकम</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#d6e3d2] shadow-xs">
          <p className="text-xs text-gray-500 font-medium">कुल कर छुट तथा सहुलियत</p>
          <h3 className="text-xl font-bold text-purple-700 mt-1">{formatMoney(totals.totalReliefs)}</h3>
          <p className="text-[11px] text-purple-600 mt-1">महिला १०%, अपाङ्गता, औषधी छुट</p>
        </div>
      </div>

      {/* Printable Sheet */}
      <div
        className={`annual-tax-main-sheet bg-white p-6 rounded-2xl border border-[#d6e3d2] shadow-sm overflow-hidden print:p-0 print:border-none print:shadow-none ${
          assessmentEmployeeId ? 'no-print' : ''
        }`}
      >
        <Letterhead
          title="कर्मचारी वार्षिक कर गणना तथा कट्टी प्रतिवेदन"
          subTitle={`आर्थिक वर्ष ${toNepaliDigits(activeFiscalYear)} को वार्षिक कर निर्धारण विवरण`}
          showSignatureSection={false}
        />

        <div className="overflow-x-auto mt-4 border border-[#cadac4] rounded-xl print:border-black print:rounded-none">
          <table className="w-full text-[11px] border-collapse print:text-[9px]">
            <thead className="bg-[#eef4ea] text-[#24351e] border-b border-[#cadac4] print:bg-gray-100">
              <tr>
                <th className="p-2 border-r border-[#cadac4] text-center align-middle w-8 whitespace-nowrap font-bold">
                  क्र.सं.
                </th>
                <th className="p-2 border-r border-[#cadac4] text-center align-middle w-14 whitespace-nowrap font-bold">
                  संकेत नं
                </th>
                <th className="p-2 border-r border-[#cadac4] text-center align-middle min-w-[140px] font-bold">
                  कर्मचारीको नाम
                </th>
                <th className="p-2 border-r border-[#cadac4] text-center align-middle min-w-[120px] font-bold">
                  पद / श्रेणी
                </th>
                <th className="p-2 border-r border-[#cadac4] text-center align-middle w-14 whitespace-nowrap font-bold">
                  स्थिति
                </th>
                <th className="p-2 border-r border-[#cadac4] text-center align-middle whitespace-nowrap font-bold">
                  वार्षिक कुल आय
                </th>
                <th className="p-2 border-r border-[#cadac4] text-center align-middle whitespace-nowrap font-bold">
                  वार्षिक कुल कट्टी
                </th>
                <th className="p-2 border-r border-[#cadac4] text-center align-middle font-bold bg-[#e3ecde] whitespace-nowrap">
                  कर योग्य आय
                </th>
                {/* १. प्रगतिशील कर स्ल्याब तालिका अनुसारका % कर कलमहरू (Col ९, १०, ११, १२, १३, १४...) */}
                {configuredSlabs.map((slab, sIdx) => {
                  const isFirstSlab = sIdx === 0 || slab.ratePercent === 1;
                  const label = isFirstSlab ? 'सा.सु. कर' : 'पारिश्रमिक कर';
                  return (
                    <th
                      key={slab.id || `slab_th_${sIdx}`}
                      className="px-3 py-3 border-r border-[#cadac4] text-center align-middle whitespace-nowrap bg-[#edf4ea] min-w-[75px]"
                      title={slab.description}
                    >
                      <div className="font-bold text-center text-[10.5px] leading-tight">{label}</div>
                      <div className="text-[9.5px] font-medium text-[#3b5333] text-center leading-tight">
                        ({toNepaliDigits(slab.ratePercent)}%)
                      </div>
                    </th>
                  );
                })}
                {/* Col १५: कर छुट/सहुलियत */}
                <th className="px-3 py-3 border-r border-[#cadac4] text-center align-middle whitespace-nowrap font-bold min-w-[75px] text-[10.5px] leading-tight">
                  कर छुट/सहुलियत
                </th>
                {/* Col १६: अन्तिम वार्षिक कर */}
                <th className="px-3 py-3 border-r border-[#cadac4] text-center align-middle font-bold text-amber-900 bg-amber-50 whitespace-nowrap min-w-[75px] text-[10.5px] leading-tight">
                  अन्तिम वार्षिक कर
                </th>
                <th className="p-2 border-r border-[#cadac4] text-center align-middle font-bold text-emerald-900 bg-emerald-50 whitespace-nowrap">
                  मासिक कर (TDS)
                </th>
                <th className="p-2 text-center align-middle w-28 no-print font-bold whitespace-nowrap">
                  कार्य / आयकर निर्धारण
                </th>
              </tr>
              {/* Column Numbering Row - Plain background, italic font, no number in last column */}
              <tr className="bg-white text-gray-500 text-[10px] font-normal italic border-b border-[#cadac4] print:bg-white">
                <th className="p-1 border-r border-[#cadac4] text-center font-mono italic">
                  {toNepaliDigits(1)}
                </th>
                <th className="p-1 border-r border-[#cadac4] text-center font-mono italic">
                  {toNepaliDigits(2)}
                </th>
                <th className="p-1 border-r border-[#cadac4] text-center font-mono italic">
                  {toNepaliDigits(3)}
                </th>
                <th className="p-1 border-r border-[#cadac4] text-center font-mono italic">
                  {toNepaliDigits(4)}
                </th>
                <th className="p-1 border-r border-[#cadac4] text-center font-mono italic">
                  {toNepaliDigits(5)}
                </th>
                <th className="p-1 border-r border-[#cadac4] text-center font-mono italic">
                  {toNepaliDigits(6)}
                </th>
                <th className="p-1 border-r border-[#cadac4] text-center font-mono italic">
                  {toNepaliDigits(7)}
                </th>
                <th className="p-1 border-r border-[#cadac4] text-center font-mono italic">
                  {toNepaliDigits(8)}
                </th>
                {configuredSlabs.map((_, sIdx) => (
                  <th
                    key={`col_num_slab_${sIdx}`}
                    className="p-1 border-r border-[#cadac4] text-center font-mono italic"
                  >
                    {toNepaliDigits(8 + sIdx + 1)}
                  </th>
                ))}
                <th className="p-1 border-r border-[#cadac4] text-center font-mono italic">
                  {toNepaliDigits(8 + configuredSlabs.length + 1)}
                </th>
                <th className="p-1 border-r border-[#cadac4] text-center font-mono italic">
                  {toNepaliDigits(8 + configuredSlabs.length + 2)}
                </th>
                <th className="p-1 border-r border-[#cadac4] text-center font-mono italic">
                  {toNepaliDigits(8 + configuredSlabs.length + 3)}
                </th>
                {/* Last column without number */}
                <th className="p-1 text-center font-mono italic no-print"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#cadac4]">
              {filteredEmployees.map((emp, index) => {
                const res = annualTaxResults[emp.id];
                if (!res) return null;
                const totalReliefs =
                  res.disabilityTaxRelief +
                  res.pensionSSTExemption +
                  res.femaleTaxRebate +
                  res.medicalTaxCredit;

                return (
                  <tr key={emp.id} className="hover:bg-[#f9fcf8] print:hover:bg-transparent">
                    {/* १. क्र.सं. - Center align */}
                    <td className="p-2 border-r border-[#cadac4] text-center align-middle font-mono text-gray-500 whitespace-nowrap">
                      {toNepaliDigits(index + 1)}
                    </td>
                    {/* २. संकेत नं - Center align */}
                    <td className="p-2 border-r border-[#cadac4] text-center align-middle font-mono font-bold text-[#4B6043] whitespace-nowrap">
                      {toNepaliDigits(emp.code)}
                    </td>
                    {/* ३. कर्मचारीको नाम (Text) - Left align */}
                    <td className="p-2 border-r border-[#cadac4] text-left align-middle">
                      <div className="font-bold text-[#24331C]">{emp.name}</div>
                      <div className="text-[10px] text-gray-500">
                        {emp.panNumber ? `PAN: ${toNepaliDigits(emp.panNumber)}` : 'PAN दर्ता नभएको'}
                      </div>
                    </td>
                    {/* ४. पद / श्रेणी (Text) - Left align */}
                    <td className="p-2 border-r border-[#cadac4] text-left align-middle">
                      <div className="font-medium text-gray-900">{emp.designation}</div>
                      <div className="text-[10px] text-gray-500">{emp.level}</div>
                    </td>
                    {/* ५. स्थिति (Badge/Code) - Center align */}
                    <td className="p-2 border-r border-[#cadac4] text-center align-middle whitespace-nowrap">
                      <span className="bg-[#edf4ea] text-[#34482c] px-2 py-0.5 rounded text-[10px] font-semibold border border-[#d2e2ce]">
                        {emp.filingType}
                      </span>
                    </td>
                    {/* ६. वार्षिक कुल आय (Number) - Right align */}
                    <td className="p-2 border-r border-[#cadac4] text-right align-middle font-mono font-semibold whitespace-nowrap">
                      {formatMoney(res.totalAnnualIncome)}
                    </td>
                    {/* ७. वार्षिक कुल कट्टी (Number) - Right align */}
                    <td className="p-2 border-r border-[#cadac4] text-right align-middle font-mono text-gray-700 whitespace-nowrap">
                      {formatMoney(res.totalAnnualDeductions)}
                    </td>
                    {/* ८. कर योग्य आय (Number) - Right align */}
                    <td className="p-2 border-r border-[#cadac4] text-right align-middle font-mono font-bold bg-[#f3f8f0] text-[#1f2d1a] whitespace-nowrap">
                      {formatMoney(res.annualTaxableIncome)}
                    </td>
                    {/* ९. प्रगतिशील कर स्ल्याब अनुसारका रकमहरू (Col ९, १०, ११, १२, १३, १४...) */}
                    {configuredSlabs.map((slab, sIdx) => {
                      const slabData =
                        res.taxSlabBreakdowns?.[sIdx] ||
                        res.taxSlabBreakdowns?.find((b) => b.ratePercent === slab.ratePercent);
                      const slabTax = slabData?.taxAmount || 0;
                      return (
                        <td
                          key={slab.id || `slab_td_${sIdx}`}
                          className="px-3 py-3 border-r border-[#cadac4] text-right align-middle font-mono text-[#24331C] whitespace-nowrap min-w-[75px]"
                        >
                          {formatMoney(slabTax)}
                        </td>
                      );
                    })}
                    {/* १०/१५. कर छुट/सहुलियत (Col १५) */}
                    <td className="px-3 py-3 border-r border-[#cadac4] text-right align-middle font-mono text-purple-700 whitespace-nowrap min-w-[75px]">
                      {totalReliefs > 0 ? `-${formatMoney(totalReliefs)}` : formatMoney(0)}
                    </td>
                    {/* ११/१६. अन्तिम वार्षिक कर (Col १६) */}
                    <td className="px-3 py-3 border-r border-[#cadac4] text-right align-middle font-mono font-bold text-amber-800 bg-amber-50/50 whitespace-nowrap min-w-[75px]">
                      {formatMoney(res.netAnnualTaxLiability)}
                    </td>
                    {/* १२. मासिक कर (TDS) (Number) - Right align */}
                    <td className="p-2 border-r border-[#cadac4] text-right align-middle font-mono font-bold text-emerald-950 bg-emerald-50 whitespace-nowrap">
                      {formatMoney(res.monthlyTaxDeduction)}
                    </td>
                    {/* १३. अडिट / कार्य (Actions) - Center align */}
                    <td className="p-2 text-center align-middle no-print whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setAuditEmployeeId(emp.id)}
                          title="कर गणना अडिट तथा शुत्र विवरण"
                          className="px-2 py-0.5 text-[10px] font-bold text-[#4B6043] bg-[#edf4ea] hover:bg-[#dbe7d7] rounded border border-[#c5d7bf] transition-colors"
                        >
                          अडिट
                        </button>
                        <button
                          onClick={() => setAssessmentEmployeeId(emp.id)}
                          title="पारिश्रमिक आयकर निर्धारण विवरण लेटरहेडमा प्रिन्ट गर्नुहोस्"
                          className="px-2 py-0.5 text-[10px] font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 flex items-center gap-1 transition-colors"
                        >
                          <Printer className="w-3 h-3 text-blue-700" />
                          <span>आयकर निर्धारण</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Total Summary Row */}
              <tr className="bg-[#e4ede0] font-bold text-[#24331C] border-t-2 border-[#4B6043] print:bg-gray-200">
                <td colSpan={5} className="p-2 border-r border-[#cadac4] text-center align-middle whitespace-nowrap font-bold">
                  कुल जम्मा (Grand Total):
                </td>
                <td className="p-2 border-r border-[#cadac4] text-right align-middle font-mono whitespace-nowrap">
                  {formatMoney(totals.totalIncome)}
                </td>
                <td className="p-2 border-r border-[#cadac4] text-right align-middle font-mono whitespace-nowrap">
                  {formatMoney(totals.totalDeductions)}
                </td>
                <td className="p-2 border-r border-[#cadac4] text-right align-middle font-mono font-bold text-[#1f2e1a] whitespace-nowrap">
                  {formatMoney(totals.totalTaxable)}
                </td>
                {/* Slab Column Totals (Col ९, १०, ११, १२, १३, १४...) */}
                {slabGrandTotals.map((tot, sIdx) => {
                  return (
                    <td
                      key={`slab_grand_tot_${sIdx}`}
                      className="px-3 py-3 border-r border-[#cadac4] text-right align-middle font-mono font-bold text-[#24331C] bg-[#dbe8d6] whitespace-nowrap min-w-[75px]"
                    >
                      {formatMoney(tot)}
                    </td>
                  );
                })}
                {/* Total Reliefs (Col १५) */}
                <td className="px-3 py-3 border-r border-[#cadac4] text-right align-middle font-mono text-purple-800 whitespace-nowrap min-w-[75px]">
                  {formatMoney(totals.totalReliefs)}
                </td>
                {/* Total Net Tax (Col १६) */}
                <td className="px-3 py-3 border-r border-[#cadac4] text-right align-middle font-mono text-amber-900 bg-amber-100/50 whitespace-nowrap min-w-[75px]">
                  {formatMoney(totals.totalNetTax)}
                </td>
                <td className="p-2 border-r border-[#cadac4] text-right align-middle font-mono text-emerald-950 bg-emerald-100/60 whitespace-nowrap">
                  {formatMoney(totals.totalMonthlyTax)}
                </td>
                <td className="p-2 text-center align-middle no-print whitespace-nowrap">-</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Center Aligned Signatures Footer (Simple format: "तयार गर्ने, पेश गर्ने, सदर गर्ने" without dots/names/dates) */}
        <ReportSignatures variant="simple" className="mt-8 print:mt-10" />
      </div>

      {/* Employee Remuneration Tax Assessment Report Modal (Letterhead Print) */}
      {assessmentEmployeeId && (
        <EmployeeTaxAssessmentReportModal
          isOpen={!!assessmentEmployeeId}
          onClose={() => setAssessmentEmployeeId(null)}
          employeeId={assessmentEmployeeId}
          onSelectEmployeeId={(id) => setAssessmentEmployeeId(id)}
        />
      )}
    </div>
  );
};
