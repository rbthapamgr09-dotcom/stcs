import React from 'react';
import { X, Calculator, ArrowRight, CheckCircle, Info, ShieldCheck, FileSpreadsheet } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatNepaliCurrency, toNepaliDigits } from '../../utils/nepaliCalendar';

export const CalculationAuditModal: React.FC = () => {
  const {
    auditEmployeeId,
    setAuditEmployeeId,
    employees,
    salarySetups,
    deductionSetups,
    annualTaxResults,
    useDevanagariNumerals,
    activeFiscalYear,
  } = useApp();

  if (!auditEmployeeId) return null;

  const employee = employees.find((e) => e.id === auditEmployeeId);
  const salary = salarySetups[auditEmployeeId];
  const deduction = deductionSetups[auditEmployeeId];
  const result = annualTaxResults[auditEmployeeId];

  if (!employee || !salary || !deduction || !result) {
    return null;
  }

  const formatMoney = (amount: number) =>
    formatNepaliCurrency(amount, { useDevanagari: useDevanagariNumerals });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-[#c8d8c3] overflow-hidden my-auto max-h-[92vh] flex flex-col"
        role="dialog"
      >
        {/* Header */}
        <div className="bg-[#4B6043] text-white p-5 flex items-start justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 rounded-xl">
              <Calculator className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded font-mono">
                  संकेत नं: {toNepaliDigits(employee.code)}
                </span>
                <span className="text-xs bg-emerald-700/80 px-2 py-0.5 rounded font-semibold">
                  आ.व. {toNepaliDigits(activeFiscalYear)}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold mt-0.5">
                {employee.name} — तलब तथा कर गणना अडिट (४ तहको परीक्षण)
              </h2>
              <p className="text-xs text-emerald-100 mt-0.5">
                {employee.designation} | {employee.level} | {employee.serviceType} सेवा | {employee.filingType}
              </p>
            </div>
          </div>
          <button
            onClick={() => setAuditEmployeeId(null)}
            className="text-white/80 hover:text-white p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-6 text-[#24331C] text-sm">
          {/* Level 1: Input Values & Pre-conditions */}
          <div className="bg-[#f7faf5] p-4 rounded-xl border border-[#d6e3d2]">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-[#4B6043] text-white text-xs font-bold flex items-center justify-center">
                १
              </span>
              <h3 className="font-bold text-[#2A3B22] text-sm uppercase tracking-wide">
                तह १: प्रारम्भिक प्रविष्टि विवरण (Input Values & Parameters)
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-2.5 rounded-lg border border-[#e0ebd9]">
                <p className="text-gray-500">तलब (प्राविधिक ग्रेड समेत)</p>
                <p className="font-bold text-[#2A3B22] mt-0.5">{formatMoney(salary.basicSalary)}</p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-[#e0ebd9]">
                <p className="text-gray-500">हालको ग्रेड (दर × संख्या)</p>
                <p className="font-bold text-[#2A3B22] mt-0.5">
                  {formatMoney(salary.gradeRate)} × {toNepaliDigits(salary.currentGradeCount)}
                </p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-[#e0ebd9]">
                <p className="text-gray-500">ग्रेड बृद्धि महिना र संख्या</p>
                <p className="font-bold text-[#2A3B22] mt-0.5">
                  {salary.gradeIncreaseMonth} (+{toNepaliDigits(salary.gradeIncreaseCount)})
                </p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-[#e0ebd9]">
                <p className="text-gray-500">मंहगी / पोशाक भत्ता</p>
                <p className="font-bold text-[#2A3B22] mt-0.5">
                  {formatMoney(salary.dearnessAllowance)} / {formatMoney(salary.uniformAllowance)}
                </p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-[#e0ebd9]">
                <p className="text-gray-500">दुर्गम / प्रोत्साहन भत्ता</p>
                <p className="font-bold text-[#2A3B22] mt-0.5">
                  {formatMoney(salary.remoteAllowance)} / {formatMoney(salary.incentiveAllowance)}
                </p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-[#e0ebd9]">
                <p className="text-gray-500">नागरिक लगानी कोष (मासिक)</p>
                <p className="font-bold text-[#2A3B22] mt-0.5">
                  {formatMoney(deduction.citizenInvestmentTrust)}
                </p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-[#e0ebd9]">
                <p className="text-gray-500">सावधिक जीवन बिमा (मासिक)</p>
                <p className="font-bold text-[#2A3B22] mt-0.5">
                  {formatMoney(salary.lifeInsuranceFund)}
                </p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-[#e0ebd9]">
                <p className="text-gray-500">सापटी / अन्य कट्टी</p>
                <p className="font-bold text-[#2A3B22] mt-0.5">
                  {formatMoney(deduction.loanDeduction)} / {formatMoney(deduction.otherDeduction)}
                </p>
              </div>
            </div>
          </div>

          {/* Level 2 & 3: Formula & Intermediate Calculations */}
          <div className="bg-[#f7faf5] p-4 rounded-xl border border-[#d6e3d2]">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-[#4B6043] text-white text-xs font-bold flex items-center justify-center">
                २ र ३
              </span>
              <h3 className="font-bold text-[#2A3B22] text-sm uppercase tracking-wide">
                तह २ र ३: सूत्र तथा मध्यवर्ती गणना (Formulas & Intermediate Breakdown)
              </h3>
            </div>

            <div className="space-y-3 text-xs">
              {/* Income summary cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded-lg border border-[#d0e0cc]">
                  <h4 className="font-bold text-[#35492d] flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    वार्षिक कुल आय गणना (Annual Income)
                  </h4>
                  <ul className="mt-2 space-y-1 text-gray-700">
                    <li>• ग्रेड रकम: {formatMoney(result.gradeAmount)}</li>
                    <li>• ग्रेड अवधि: {toNepaliDigits(result.gradePeriodMonths)} महिना, बृद्धि अवधि: {toNepaliDigits(result.gradeIncreasePeriodMonths)} महिना</li>
                    <li>• चाडपर्व खर्च (१ महिना): {formatMoney(result.festivalAllowance)}</li>
                    <li>• संचय कोष कार्यालय थप: {formatMoney(result.epfOfficeContributionNormal)}/मा.</li>
                    <li>• निवृत्तिभरण कार्यालय थप: {formatMoney(result.pensionOfficeContributionNormal)}/मा.</li>
                    <li className="pt-1 font-bold text-[#1f2d1a] border-t border-gray-100 flex justify-between">
                      <span>जम्मा वार्षिक आय:</span>
                      <span>{formatMoney(result.totalAnnualIncome)}</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-white p-3 rounded-lg border border-[#d0e0cc]">
                  <h4 className="font-bold text-[#35492d] flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    वार्षिक कुल कट्टी गणना (Annual Deductions)
                  </h4>
                  <ul className="mt-2 space-y-1 text-gray-700">
                    <li>• कुल संचय कोष (थप × २): {formatMoney(result.epfTotalContributionNormal * result.gradePeriodMonths)}</li>
                    <li>• कुल निवृत्तिभरण (थप × २): {formatMoney(result.pensionTotalContributionNormal * result.gradePeriodMonths)}</li>
                    <li>• सावधिक जीवन बिमा कोष: {formatMoney(result.lifeInsuranceFundAnnual)}</li>
                    <li>• नागरिक लगानी कोष (वार्षिक): {formatMoney(result.citDeductionAnnual)}</li>
                    <li>• दुर्गम क्षेत्र छुट (वर्ग {employee.remoteArea}): {formatMoney(deduction.remoteTaxReliefOverride || 0)}</li>
                    <li className="pt-1 font-bold text-[#1f2d1a] border-t border-gray-100 flex justify-between">
                      <span>जम्मा वार्षिक कट्टी:</span>
                      <span>{formatMoney(result.totalAnnualDeductions)}</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Taxable Income Bar */}
              <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-emerald-950">वार्षिक कर योग्य आय (Taxable Income):</span>
                  <p className="text-[11px] text-emerald-800">
                    जम्मा वार्षिक आय ({formatMoney(result.totalAnnualIncome)}) - जम्मा वार्षिक कट्टी ({formatMoney(result.totalAnnualDeductions)})
                  </p>
                </div>
                <span className="text-base font-bold text-emerald-900 bg-white px-3 py-1 rounded-md border border-emerald-300">
                  {formatMoney(result.annualTaxableIncome)}
                </span>
              </div>

              {/* Tax Slab Progressive Table */}
              <div className="mt-3">
                <p className="font-bold text-[#2A3B22] mb-1.5">कर स्ल्याब अनुसार कर गणना (Progressive Tax Slabs):</p>
                <div className="overflow-x-auto border border-[#d6e3d2] rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#eaf1e6] text-[#2c3d26]">
                      <tr>
                        <th className="p-2">स्ल्याब विवरण</th>
                        <th className="p-2 text-right">स्ल्याबमा पर्ने रकम</th>
                        <th className="p-2 text-center">कर दर (%)</th>
                        <th className="p-2 text-right">गणना भएको कर</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e9efe4] bg-white">
                      {result.taxSlabBreakdowns.map((slab, idx) => (
                        <tr key={idx} className={slab.taxAmount > 0 ? 'bg-amber-50/40' : ''}>
                          <td className="p-2 font-medium">{slab.slabName}</td>
                          <td className="p-2 text-right font-mono">{formatMoney(slab.taxableInSlab)}</td>
                          <td className="p-2 text-center font-bold text-[#4B6043]">{toNepaliDigits(slab.ratePercent)}%</td>
                          <td className="p-2 text-right font-bold font-mono text-[#24331C]">{formatMoney(slab.taxAmount)}</td>
                        </tr>
                      ))}
                      <tr className="bg-[#f0f5ec] font-bold">
                        <td colSpan={3} className="p-2 text-right text-[#2c3d26]">
                          कुल कर दायित्व (सा.सु.कर समेत):
                        </td>
                        <td className="p-2 text-right font-mono text-[#24331C]">
                          {formatMoney(result.grossTaxLiabilityWithSST)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Reliefs / Rebates Section */}
              {(result.disabilityTaxRelief > 0 || result.pensionSSTExemption > 0 || result.femaleTaxRebate > 0 || result.medicalTaxCredit > 0) && (
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-xs">
                  <p className="font-bold text-amber-900 mb-1">लागू भएका कर छुट तथा सहुलियतहरू (Tax Reliefs & Rebates):</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-amber-950">
                    {result.disabilityTaxRelief > 0 && (
                      <div>• अपाङ्गता सहुलियत: -{formatMoney(result.disabilityTaxRelief)}</div>
                    )}
                    {result.pensionSSTExemption > 0 && (
                      <div>• निवृत्तिभरण सामाजिक सुरक्षा कर (१%) समायोजन: -{formatMoney(result.pensionSSTExemption)}</div>
                    )}
                    {result.femaleTaxRebate > 0 && (
                      <div>• एकल महिला कर्मचारी कर छुट (१०%): -{formatMoney(result.femaleTaxRebate)}</div>
                    )}
                    {result.medicalTaxCredit > 0 && (
                      <div>• औषधी खर्च मिलान कर छुट: -{formatMoney(result.medicalTaxCredit)}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Level 4: Final Result */}
          <div className="bg-[#2A3B22] text-white p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center">
                ४
              </span>
              <h3 className="font-bold text-emerald-200 text-sm uppercase tracking-wide">
                तह ४: अन्तिम परिणाम (Final Assessed Results)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="bg-white/10 p-3 rounded-lg border border-white/15">
                <p className="text-xs text-emerald-200">वार्षिक कर योग्य आय</p>
                <p className="text-lg font-bold mt-1 text-white">{formatMoney(result.annualTaxableIncome)}</p>
              </div>
              <div className="bg-white/10 p-3 rounded-lg border border-white/15">
                <p className="text-xs text-emerald-200">अन्तिम वार्षिक कर दायित्व</p>
                <p className="text-lg font-bold mt-1 text-amber-300">{formatMoney(result.netAnnualTaxLiability)}</p>
              </div>
              <div className="bg-emerald-700/60 p-3 rounded-lg border border-emerald-400/40">
                <p className="text-xs text-emerald-100">मासिक कर कट्टी रकम (TDS)</p>
                <p className="text-xl font-extrabold mt-1 text-white">{formatMoney(result.monthlyTaxDeduction)}</p>
              </div>
            </div>
          </div>

          {/* Complete 33 Points Reference Accordion / Table */}
          <div>
            <h4 className="font-bold text-[#2A3B22] mb-2 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#4B6043]" />
              सम्पूर्ण ३३ बुँदे आधिकारिक प्रतिवेदन गणना तालिका (All 33 Official Points):
            </h4>
            <div className="overflow-x-auto border border-[#d6e3d2] rounded-lg max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f0f5ec] text-[#2c3d26] sticky top-0">
                  <tr>
                    <th className="p-2 w-12 text-center">क्र.सं.</th>
                    <th className="p-2">विवरण</th>
                    <th className="p-2 text-right">रकम</th>
                    <th className="p-2">गणना विधि / सुत्र</th>
                    <th className="p-2">कैफियत</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e9efe4] bg-white">
                  {result.items33.map((item) => (
                    <tr key={item.sn} className="hover:bg-gray-50">
                      <td className="p-2 text-center font-bold text-[#4B6043]">{toNepaliDigits(item.sn)}</td>
                      <td className="p-2 font-medium text-[#24331C]">{item.title}</td>
                      <td className="p-2 text-right font-bold font-mono">
                        {item.category === 'विवरण' ? toNepaliDigits(item.amount) : formatMoney(item.amount)}
                      </td>
                      <td className="p-2 text-gray-600 font-mono text-[11px]">{item.formula}</td>
                      <td className="p-2 text-gray-500 text-[11px]">{item.remarks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-[#f8faf6] border-t border-[#e2ece0] flex items-center justify-between shrink-0">
          <p className="text-xs text-[#526a48]">
            * यो गणना आयकर ऐन २०५८ तथा चालु आर्थिक वर्षको बजेट वक्तव्य अनुसार संचालित छ।
          </p>
          <button
            onClick={() => setAuditEmployeeId(null)}
            className="px-5 py-2 text-xs font-bold text-white bg-[#4B6043] hover:bg-[#3b4e33] rounded-lg transition-colors"
          >
            बन्द गर्नुहोस्
          </button>
        </div>
      </div>
    </div>
  );
};
