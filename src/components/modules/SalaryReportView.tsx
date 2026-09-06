import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Printer,
  Download,
  Filter,
  PieChart as PieIcon,
  TrendingUp,
  Layers,
  Building,
  FileSpreadsheet,
  Table,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';
import { Letterhead, ReportSignatures } from '../common/Letterhead';
import { formatNepaliCurrency, toNepaliDigits } from '../../utils/nepaliCalendar';
import { KitabkhanaSalaryReportForm } from './KitabkhanaSalaryReportForm';

type MainReportTab = 'kitabkhana_form' | 'dimension_analysis' | 'employee_summary';
type ReportDimension = 'service' | 'level' | 'remote' | 'gender';

export const SalaryReportView: React.FC = () => {
  const {
    employees,
    salarySetups,
    deductionSetups,
    annualTaxResults,
    activeFiscalYear,
    useDevanagariNumerals,
  } = useApp();

  const [activeTab, setActiveTab] = useState<MainReportTab>('kitabkhana_form');
  const [dimension, setDimension] = useState<ReportDimension>('service');

  const formatMoney = (val: number) =>
    formatNepaliCurrency(val, { useDevanagari: useDevanagariNumerals });

  const formatMoneyNoSymbol = (val: number) =>
    formatNepaliCurrency(val, { useDevanagari: useDevanagariNumerals, showSymbol: false });

  // Compute aggregation based on selected dimension
  const reportData = useMemo(() => {
    const map = new Map<
      string,
      { count: number; gross: number; deductions: number; tax: number; net: number }
    >();

    employees.forEach((emp) => {
      const res = annualTaxResults[emp.id];
      if (!res) return;

      let key = '';
      if (dimension === 'service') key = `${emp.serviceType} सेवा`;
      else if (dimension === 'gender') key = emp.gender;
      else if (dimension === 'remote')
        key = emp.remoteArea === 'दुर्गम नभएको' ? 'दुर्गम नभएको (सामान्य)' : `वर्ग '${emp.remoteArea}'`;
      else if (dimension === 'level') key = emp.level;

      if (!map.has(key)) {
        map.set(key, { count: 0, gross: 0, deductions: 0, tax: 0, net: 0 });
      }

      const entry = map.get(key)!;
      entry.count += 1;
      entry.gross += res.totalAnnualIncome;
      entry.deductions += res.totalAnnualDeductions;
      entry.tax += res.netAnnualTaxLiability;
      entry.net += (res.totalAnnualIncome - res.totalAnnualDeductions - res.netAnnualTaxLiability);
    });

    return Array.from(map.entries()).map(([name, data]) => ({
      name,
      कर्मचारी_संख्या: data.count,
      वार्षिक_कुल_आय: Math.round(data.gross),
      वार्षिक_कट्टी: Math.round(data.deductions),
      वार्षिक_कर: Math.round(data.tax),
      खुद_रकम: Math.round(data.net),
    }));
  }, [employees, annualTaxResults, dimension]);

  const handleExportExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Salary_Report_${dimension}`);
    XLSX.writeFile(workbook, `Salary_Analysis_${dimension}_${activeFiscalYear}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Top Tab Navigation (Hidden in Print) */}
      <div className="bg-white p-2 rounded-2xl border border-[#d6e3d2] shadow-xs flex items-center gap-2 no-print overflow-x-auto">
        <button
          onClick={() => setActiveTab('kitabkhana_form')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'kitabkhana_form'
              ? 'bg-[#4B6043] text-white shadow-xs'
              : 'text-[#354b2d] hover:bg-[#eef4ea]'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>आ.व. {toNepaliDigits(activeFiscalYear)} तलबी प्रतिवेदन फाराम (किताबखाना / कोलेनिका ढाँचा)</span>
        </button>

        <button
          onClick={() => setActiveTab('dimension_analysis')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'dimension_analysis'
              ? 'bg-[#4B6043] text-white shadow-xs'
              : 'text-[#354b2d] hover:bg-[#eef4ea]'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>समष्टिगत विश्लेषण तथा ग्राफ (Analytics)</span>
        </button>

        <button
          onClick={() => setActiveTab('employee_summary')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'employee_summary'
              ? 'bg-[#4B6043] text-white shadow-xs'
              : 'text-[#354b2d] hover:bg-[#eef4ea]'
          }`}
        >
          <Table className="w-4 h-4" />
          <span>कर्मचारीगत वार्षिक तलब तथा कर सारांश</span>
        </button>
      </div>

      {/* Tab 1: Official Kitabkhana 11-column Salary Report Form */}
      {activeTab === 'kitabkhana_form' && <KitabkhanaSalaryReportForm />}

      {/* Tab 2: Dimension Analytics */}
      {activeTab === 'dimension_analysis' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs flex flex-wrap items-center justify-between gap-4 no-print">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#edf4ea] border border-[#cbdcc6] text-[#4B6043] flex items-center justify-center">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#24331C]">
                  तलब तथा कर विश्लेषणात्मक प्रतिवेदन
                </h2>
                <p className="text-xs text-[#526a48]">
                  सेवा, तह, दुर्गम क्षेत्र तथा लिङ्ग अनुसारको बहुआयामिक तलब विश्लेषण
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-[#f5f8f3] p-1 rounded-xl border border-[#c8d7c2]">
                <button
                  onClick={() => setDimension('service')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    dimension === 'service' ? 'bg-[#4B6043] text-white shadow-xs' : 'text-[#35492d]'
                  }`}
                >
                  सेवा प्रकार
                </button>
                <button
                  onClick={() => setDimension('level')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    dimension === 'level' ? 'bg-[#4B6043] text-white shadow-xs' : 'text-[#35492d]'
                  }`}
                >
                  तह / श्रेणी
                </button>
                <button
                  onClick={() => setDimension('remote')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    dimension === 'remote' ? 'bg-[#4B6043] text-white shadow-xs' : 'text-[#35492d]'
                  }`}
                >
                  दुर्गम क्षेत्र
                </button>
                <button
                  onClick={() => setDimension('gender')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    dimension === 'gender' ? 'bg-[#4B6043] text-white shadow-xs' : 'text-[#35492d]'
                  }`}
                >
                  लिङ्ग अनुसार
                </button>
              </div>

              <button
                onClick={handleExportExcel}
                className="px-3.5 py-2 bg-[#edf4ea] text-[#344b2d] hover:bg-[#dbe8d6] text-xs font-bold rounded-xl border border-[#c5d7bf] transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>एक्सेल</span>
              </button>

              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-[#4B6043] text-white hover:bg-[#384c31] text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>प्रिन्ट</span>
              </button>
            </div>
          </div>

          {/* Chart Section */}
          <div className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs no-print">
            <h3 className="text-sm font-bold text-[#24331C] mb-4">
              वर्ग अनुसार कुल वार्षिक आय तथा कर दायित्व तुलना (Comparative Financial Chart)
            </h3>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reportData} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e6eee2" />
                  <XAxis dataKey="name" stroke="#607657" fontSize={11} angle={-15} textAnchor="end" />
                  <YAxis stroke="#607657" fontSize={10} tickFormatter={(val) => `रु.${val / 1000}k`} />
                  <Tooltip
                    formatter={(val: any) => [formatMoney(Number(val) || 0), '']}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #c8d8c3' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="वार्षिक_कुल_आय" fill="#4B6043" name="वार्षिक कुल आय" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="वार्षिक_कर" fill="#D97706" name="वार्षिक कर दायित्व" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Printable Report Table */}
          <div className="bg-white p-6 rounded-2xl border border-[#d6e3d2] shadow-sm overflow-hidden print:p-0 print:border-none print:shadow-none">
            <Letterhead
              title={`तलब तथा कर विश्लेषण प्रतिवेदन — ${
                dimension === 'service'
                  ? 'सेवा प्रकार अनुसार'
                  : dimension === 'level'
                  ? 'तह तथा श्रेणी अनुसार'
                  : dimension === 'remote'
                  ? 'दुर्गम क्षेत्र वर्गीकरण अनुसार'
                  : 'लिङ्ग अनुसार'
              }`}
              subTitle={`आर्थिक वर्ष ${toNepaliDigits(activeFiscalYear)} को विस्तृत समष्टिगत विश्लेषण`}
              showMetadata={true}
              showSignatureSection={false}
            />

            <div className="overflow-x-auto mt-4 border border-[#cadac4] rounded-xl print:border-black print:rounded-none">
              <table className="w-full text-left text-xs border-collapse print:text-[10px]">
                <thead className="bg-[#eef4ea] text-[#24351e] border-b border-[#cadac4] print:bg-gray-100">
                  <tr>
                    <th className="p-3 border-r border-[#cadac4] text-center w-12">क्र.सं.</th>
                    <th className="p-3 border-r border-[#cadac4]">वर्गीकरण समूह (Group Name)</th>
                    <th className="p-3 border-r border-[#cadac4] text-center">कर्मचारी संख्या</th>
                    <th className="p-3 border-r border-[#cadac4] text-right font-bold">वार्षिक कुल आय</th>
                    <th className="p-3 border-r border-[#cadac4] text-right">वार्षिक कट्टी</th>
                    <th className="p-3 border-r border-[#cadac4] text-right font-bold text-amber-900 bg-amber-50">
                      वार्षिक कर (TDS)
                    </th>
                    <th className="p-3 text-right font-bold text-emerald-950 bg-emerald-50">
                      खुद भुक्तानी
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#cadac4]">
                  {reportData.map((row, index) => (
                    <tr key={index} className="hover:bg-[#f9fcf8] print:hover:bg-transparent">
                      <td className="p-3 border-r border-[#cadac4] text-center font-mono text-gray-500">
                        {toNepaliDigits(index + 1)}
                      </td>
                      <td className="p-3 border-r border-[#cadac4] font-bold text-[#24331C]">{row.name}</td>
                      <td className="p-3 border-r border-[#cadac4] text-center font-semibold text-[#4B6043]">
                        {toNepaliDigits(row.कर्मचारी_संख्या)} जना
                      </td>
                      <td className="p-3 border-r border-[#cadac4] text-right font-mono font-bold text-[#1f2d1a]">
                        {formatMoney(row.वार्षिक_कुल_आय)}
                      </td>
                      <td className="p-3 border-r border-[#cadac4] text-right font-mono text-gray-700">
                        {formatMoney(row.वार्षिक_कट्टी)}
                      </td>
                      <td className="p-3 border-r border-[#cadac4] text-right font-mono font-bold text-amber-800 bg-amber-50/50">
                        {formatMoney(row.वार्षिक_कर)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-950 bg-emerald-50/50">
                        {formatMoney(row.खुद_रकम)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Center Aligned Signatures Footer */}
            <ReportSignatures className="mt-8 print:mt-10" />
          </div>
        </div>
      )}

      {/* Tab 3: Employee Summary */}
      {activeTab === 'employee_summary' && (
        <div className="bg-white p-6 rounded-2xl border border-[#d6e3d2] shadow-sm">
          <Letterhead
            title="कर्मचारीगत वार्षिक तलब तथा कर सारांश फाँटवारी"
            subTitle={`आर्थिक वर्ष ${toNepaliDigits(activeFiscalYear)}`}
            showMetadata={true}
            showSignatureSection={false}
          />
          <div className="overflow-x-auto mt-4 border border-[#cadac4] rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#eef4ea] text-[#24351e] border-b border-[#cadac4]">
                <tr>
                  <th className="p-2.5 border-r border-[#cadac4] text-center w-10">क्र.सं.</th>
                  <th className="p-2.5 border-r border-[#cadac4] text-center">क.सं.नं</th>
                  <th className="p-2.5 border-r border-[#cadac4]">कर्मचारीको नाम</th>
                  <th className="p-2.5 border-r border-[#cadac4]">पद / तह</th>
                  <th className="p-2.5 border-r border-[#cadac4] text-right">सुरु तलब स्केल</th>
                  <th className="p-2.5 border-r border-[#cadac4] text-right font-bold">वार्षिक कुल आय</th>
                  <th className="p-2.5 border-r border-[#cadac4] text-right">वार्षिक कट्टी</th>
                  <th className="p-2.5 border-r border-[#cadac4] text-right font-bold text-amber-900 bg-amber-50">
                    वार्षिक कर (TDS)
                  </th>
                  <th className="p-2.5 text-right font-bold text-emerald-950 bg-emerald-50">खुद भुक्तानी</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#cadac4]">
                {employees.map((emp, index) => {
                  const res = annualTaxResults[emp.id];
                  const sal = salarySetups[emp.id];
                  if (!res) return null;
                  return (
                    <tr key={emp.id} className="hover:bg-[#f9fcf8]">
                      <td className="p-2.5 border-r border-[#cadac4] text-center font-mono text-gray-500">
                        {toNepaliDigits(index + 1)}
                      </td>
                      <td className="p-2.5 border-r border-[#cadac4] text-center font-mono">
                        {toNepaliDigits(emp.code)}
                      </td>
                      <td className="p-2.5 border-r border-[#cadac4] font-bold text-[#24331C]">
                        {emp.name}
                      </td>
                      <td className="p-2.5 border-r border-[#cadac4] text-gray-700">
                        {emp.designation} ({emp.level})
                      </td>
                      <td className="p-2.5 border-r border-[#cadac4] text-right font-mono">
                        {formatMoneyNoSymbol(sal?.basicSalary || 0)}
                      </td>
                      <td className="p-2.5 border-r border-[#cadac4] text-right font-mono font-bold text-[#1f2d1a]">
                        {formatMoneyNoSymbol(res.totalAnnualIncome)}
                      </td>
                      <td className="p-2.5 border-r border-[#cadac4] text-right font-mono text-gray-700">
                        {formatMoneyNoSymbol(res.totalAnnualDeductions)}
                      </td>
                      <td className="p-2.5 border-r border-[#cadac4] text-right font-mono font-bold text-amber-800 bg-amber-50/50">
                        {formatMoneyNoSymbol(res.netAnnualTaxLiability)}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-emerald-950 bg-emerald-50/50">
                        {formatMoneyNoSymbol(res.totalAnnualIncome - res.totalAnnualDeductions - res.netAnnualTaxLiability)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Center Aligned Signatures Footer */}
          <ReportSignatures className="mt-8 print:mt-10" />
        </div>
      )}
    </div>
  );
};
