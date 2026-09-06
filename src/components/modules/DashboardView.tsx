import React from 'react';
import {
  Users,
  Banknote,
  Percent,
  TrendingUp,
  Building,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
  CreditCard,
  PieChart as PieIcon,
  Calculator,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';
import { useApp } from '../../context/AppContext';
import { formatNepaliCurrency, toNepaliDigits } from '../../utils/nepaliCalendar';
import { MONTH_ORDER } from '../../utils/calculationEngine';

export const DashboardView: React.FC = () => {
  const {
    employees,
    dashboardMetrics,
    annualTaxResults,
    monthlySalaryItems,
    useDevanagariNumerals,
    activeFiscalYear,
    setActiveTab,
    setAuditEmployeeId,
  } = useApp();

  const formatMoney = (amount: number) =>
    formatNepaliCurrency(amount, { useDevanagari: useDevanagariNumerals });

  // Monthly Payroll Trend Data
  const monthlyTrendData = MONTH_ORDER.map((month) => {
    let gross = 0;
    let tax = 0;
    let net = 0;
    monthlySalaryItems.forEach((item) => {
      // In Dashain month (Ashwin), add festival bonus
      const festival = month === 'असोज' ? item.festivalAllowance : 0;
      const mGross = item.basicSalary + item.gradeAmount + item.gradeIncreaseAmount + item.dearnessAllowance + item.remoteAllowance + item.incentiveAllowance + festival;
      gross += mGross;
      tax += item.taxDeduction;
      net += (mGross - item.totalDeduction);
    });
    return {
      name: month,
      कुल_तलब: Math.round(gross),
      कर_कट्टी: Math.round(tax),
      खुद_भुक्तानी: Math.round(net),
    };
  });

  // Service Type Distribution Data
  const serviceDistributionData = [
    { name: 'स्थायी सेवा', value: dashboardMetrics.permanentEmployees, color: '#4B6043' },
    { name: 'अस्थायी सेवा', value: dashboardMetrics.temporaryEmployees, color: '#8FA882' },
    { name: 'करार सेवा', value: dashboardMetrics.contractEmployees, color: '#D4A373' },
  ].filter((d) => d.value > 0);

  // Annual Income vs Deduction comparison
  const financialBreakdownData = [
    { name: 'कुल आय (Gross Income)', रकम: dashboardMetrics.totalAnnualIncome, fill: '#4B6043' },
    { name: 'कुल कट्टी (Deductions)', रकम: dashboardMetrics.totalAnnualDeductions, fill: '#8FA882' },
    { name: 'खुद तलब (Net Payable)', रकम: dashboardMetrics.totalAnnualNetSalary, fill: '#2A3B22' },
    { name: 'कर दायित्व (Total Tax)', रकम: dashboardMetrics.totalAnnualTaxLiability, fill: '#D97706' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-linear-to-r from-[#394B33] via-[#4B6043] to-[#5C7552] rounded-2xl p-6 text-white shadow-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-white/20 text-emerald-100 text-xs px-2.5 py-0.5 rounded-full font-semibold">
              आर्थिक वर्ष {toNepaliDigits(activeFiscalYear)}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black mt-2 tracking-tight">
            तलबी तथा कर गणना ड्यासबोर्ड
          </h2>
          <p className="text-xs sm:text-sm text-emerald-100 mt-1 max-w-2xl leading-relaxed">
            कर्मचारीहरूको मासिक एवं वार्षिक तलब विवरण, कर गणना तथा कर कट्टी प्रतिवेदन सारांश।
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => setActiveTab('monthly_salary')}
            className="px-4 py-2 bg-white text-[#2D3F27] font-bold text-xs rounded-xl shadow-xs hover:bg-emerald-50 transition-all flex items-center gap-1.5"
          >
            <Calendar className="w-4 h-4 text-[#4B6043]" />
            <span>मासिक तलब भरपाई</span>
          </button>
          <button
            onClick={() => setActiveTab('annual_tax')}
            className="px-4 py-2 bg-emerald-800/80 text-white font-bold text-xs rounded-xl border border-emerald-400/30 hover:bg-emerald-800 transition-all flex items-center gap-1.5"
          >
            <Calculator className="w-4 h-4 text-emerald-200" />
            <span>वार्षिक कर प्रतिवेदन</span>
          </button>
        </div>
      </div>

      {/* Top 4 Primary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Employees */}
        <div className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#5a7051]">कुल कर्मचारी (Total Staff)</p>
            <h3 className="text-2xl font-black text-[#24331C] mt-1">
              {toNepaliDigits(dashboardMetrics.totalEmployees)}{' '}
              <span className="text-xs font-normal text-gray-500">जना</span>
            </h3>
            <div className="flex items-center gap-2 mt-2 text-[11px] text-[#4d6344]">
              <span className="font-semibold">स्थायी: {toNepaliDigits(dashboardMetrics.permanentEmployees)}</span>
              <span>•</span>
              <span className="font-semibold">अस्थायी: {toNepaliDigits(dashboardMetrics.temporaryEmployees)}</span>
              <span>•</span>
              <span className="font-semibold">करार: {toNepaliDigits(dashboardMetrics.contractEmployees)}</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#edf4ea] border border-[#cbdcc6] text-[#4B6043] flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Estimated Annual Gross Income */}
        <div className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#5a7051]">चालु वर्षको अनुमानित कुल आय</p>
            <h3 className="text-xl font-black text-[#24331C] mt-1">
              {formatMoney(dashboardMetrics.totalAnnualIncome)}
            </h3>
            <p className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1 font-medium">
              <TrendingUp className="w-3 h-3" />
              <span>१२ महिना + चाडपर्व + भत्ताहरू</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#edf4ea] border border-[#cbdcc6] text-[#4B6043] flex items-center justify-center shrink-0">
            <Banknote className="w-6 h-6" />
          </div>
        </div>

        {/* Total Annual Tax Liability */}
        <div className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#5a7051]">कुल वार्षिक कर दायित्व (TDS)</p>
            <h3 className="text-xl font-black text-amber-700 mt-1">
              {formatMoney(dashboardMetrics.totalAnnualTaxLiability)}
            </h3>
            <p className="text-[11px] text-gray-500 mt-1">
              मासिक कर संकलन: {formatMoney(dashboardMetrics.totalMonthlyTax)}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
            <Percent className="w-6 h-6" />
          </div>
        </div>

        {/* Total Annual Deductions */}
        <div className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#5a7051]">कुल वार्षिक कट्टी (Deductions)</p>
            <h3 className="text-xl font-black text-[#24331C] mt-1">
              {formatMoney(dashboardMetrics.totalAnnualDeductions)}
            </h3>
            <p className="text-[11px] text-gray-500 mt-1">
              संचय कोष, सिटिटि, बिमा, सापटी
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#edf4ea] border border-[#cbdcc6] text-[#4B6043] flex items-center justify-center shrink-0">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Recharts Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Payroll & Tax Line Chart */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#24331C]">
                मासिक कुल तलब तथा कर कट्टी प्रवाह (Monthly Salary & Tax Trend)
              </h3>
              <p className="text-xs text-[#526a48]">श्रावणदेखि अषाढसम्मको प्रक्षेपण</p>
            </div>
            <span className="text-xs font-semibold text-[#4B6043] bg-[#eef5eb] px-2.5 py-1 rounded-md">
              आ.व. {toNepaliDigits(activeFiscalYear)}
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6eee2" />
                <XAxis dataKey="name" stroke="#607657" fontSize={11} tickLine={false} />
                <YAxis stroke="#607657" fontSize={10} tickFormatter={(val) => `रु.${val / 1000}k`} />
                <Tooltip
                  formatter={(value: any) => [formatMoney(Number(value) || 0), '']}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #c8d8c3' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="कुल_तलब" fill="#4B6043" radius={[4, 4, 0, 0]} name="कुल तलब (Gross)" />
                <Bar dataKey="कर_कट्टी" fill="#D97706" radius={[4, 4, 0, 0]} name="कर कट्टी (TDS)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Employee Service & Category Breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#24331C]">
              सेवा प्रकार वर्गीकरण (Staff Distribution)
            </h3>
            <p className="text-xs text-[#526a48] mb-2">स्थायी, अस्थायी तथा करार संरचना</p>

            <div className="h-52 w-full flex items-center justify-center">
              {serviceDistributionData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={serviceDistributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {serviceDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => [`${toNepaliDigits(Number(value) || 0)} जना`, '']} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-xs text-gray-400">
                  <Users className="w-8 h-8 text-gray-300 mx-auto mb-1" />
                  <p>कर्मचारी विवरण उपलब्ध छैन</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-[#eaf1e6] text-xs">
            {serviceDistributionData.length > 0 ? (
              serviceDistributionData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></span>
                    <span className="font-medium text-[#24331C]">{item.name}</span>
                  </div>
                  <span className="font-bold text-[#4B6043]">{toNepaliDigits(item.value)} जना</span>
                </div>
              ))
            ) : (
              <p className="text-center text-[11px] text-gray-400 py-1">कर्मचारी विवरण थप भएपछि तथ्यांक देखिनेछ</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Employees & Calculation Table */}
      <div className="bg-white rounded-2xl border border-[#d6e3d2] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#e6eee2] flex flex-wrap items-center justify-between gap-3 bg-[#fbfdfa]">
          <div>
            <h3 className="text-sm font-bold text-[#24331C]">
              कर्मचारी तलब तथा कर संक्षिप्त सूची (Employee Salary & Tax Summary)
            </h3>
            <p className="text-xs text-[#526a48]">प्रत्येक कर्मचारीको वार्षिक आय, कर दायित्व एवं अडिट</p>
          </div>
          <button
            onClick={() => setActiveTab('employees')}
            className="text-xs font-bold text-[#4B6043] hover:text-[#2d3f27] flex items-center gap-1 transition-colors"
          >
            <span>सबै कर्मचारी हेर्नुहोस्</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f0f6ed] text-[#2f4227]">
              <tr>
                <th className="p-3">संकेत नं</th>
                <th className="p-3">कर्मचारीको नाम</th>
                <th className="p-3">पद / श्रेणी</th>
                <th className="p-3">सेवा / वैवाहिक</th>
                <th className="p-3 text-right">वार्षिक कुल आय</th>
                <th className="p-3 text-right">वार्षिक कर योग्य आय</th>
                <th className="p-3 text-right">वार्षिक कर दायित्व</th>
                <th className="p-3 text-right">मासिक कर कट्टी</th>
                <th className="p-3 text-center">अडिट / गणना</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eaf1e6]">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-500">
                    <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="font-semibold text-sm text-[#35492d]">हालसम्म कुनै कर्मचारीको विवरण प्रविष्ट गरिएको छैन।</p>
                    <p className="text-xs text-gray-400 mt-1">कर्मचारी व्यवस्थापन मेनुबाट नयाँ कर्मचारीको विवरण प्रविष्ट गर्नुहोस्।</p>
                    <button
                      onClick={() => setActiveTab('employees')}
                      className="mt-3 px-4 py-2 text-xs font-bold text-white bg-[#4B6043] hover:bg-[#394d32] rounded-xl transition-colors inline-block shadow-xs"
                    >
                      + नयाँ कर्मचारी थप्नुहोस्
                    </button>
                  </td>
                </tr>
              ) : (
                employees.slice(0, 8).map((emp) => {
                  const res = annualTaxResults[emp.id];
                  return (
                    <tr key={emp.id} className="hover:bg-[#f8faf6] transition-colors">
                      <td className="p-3 font-mono font-bold text-[#4B6043]">
                        {toNepaliDigits(emp.code)}
                      </td>
                      <td className="p-3 font-bold text-[#24331C]">
                        {emp.name}
                        {emp.disability === 'अपाङ्ग भएको' && (
                          <span className="ml-1.5 text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-normal">
                            अपाङ्गता
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-gray-700">
                        <div>{emp.designation}</div>
                        <div className="text-[10px] text-gray-500">{emp.level}</div>
                      </td>
                      <td className="p-3 text-gray-600">
                        <span className="bg-[#eaf1e6] text-[#3d5236] px-2 py-0.5 rounded text-[11px] font-medium mr-1">
                          {emp.serviceType}
                        </span>
                        <span className="text-[11px] text-gray-500">({emp.filingType})</span>
                      </td>
                      <td className="p-3 text-right font-mono font-semibold text-[#24331C]">
                        {res ? formatMoney(res.totalAnnualIncome) : '-'}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold text-[#24331C]">
                        {res ? formatMoney(res.annualTaxableIncome) : '-'}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-amber-700">
                        {res ? formatMoney(res.netAnnualTaxLiability) : '-'}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-800 bg-emerald-50/50">
                        {res ? formatMoney(res.monthlyTaxDeduction) : '-'}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => setAuditEmployeeId(emp.id)}
                          className="px-2.5 py-1 text-[11px] font-bold text-[#4B6043] bg-[#edf4ea] hover:bg-[#dbe7d7] rounded-md transition-colors border border-[#c5d7bf]"
                        >
                          विवरण (Audit)
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
