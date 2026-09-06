import React, { useState } from 'react';
import { Scissors, Save, ShieldAlert, CheckCircle, Calculator, Info, AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DeductionSetup } from '../../types';
import { formatNepaliCurrency, toNepaliDigits } from '../../utils/nepaliCalendar';
import { NepaliNumberInput } from '../common/NepaliNumberInput';

export const DeductionSetupView: React.FC = () => {
  const {
    employees,
    deductionSetups,
    updateDeductionSetup,
    salarySetups,
    annualTaxResults,
    useDevanagariNumerals,
    setAuditEmployeeId,
    addToast,
  } = useApp();

  const [selectedEmpId, setSelectedEmpId] = useState<string>(
    employees.length > 0 ? employees[0].id : ''
  );

  const selectedEmp = employees.find((e) => e.id === selectedEmpId);
  const currentSetup = selectedEmpId ? deductionSetups[selectedEmpId] : null;
  const currentSalary = selectedEmpId ? salarySetups[selectedEmpId] : null;
  const currentResult = selectedEmpId ? annualTaxResults[selectedEmpId] : null;

  const [formData, setFormData] = useState<DeductionSetup | null>(currentSetup || null);

  React.useEffect(() => {
    if (selectedEmpId && deductionSetups[selectedEmpId]) {
      setFormData({ ...deductionSetups[selectedEmpId] });
    }
  }, [selectedEmpId, deductionSetups]);

  if (!selectedEmp || !formData || !currentSalary) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-[#d6e3d2]">
        <p className="text-gray-500">कर्मचारी विवरण फेला परेन।</p>
      </div>
    );
  }

  const handleNumericFieldChange = (field: keyof DeductionSetup, val: number) => {
    setFormData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [field]: val,
      };
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData) {
      updateDeductionSetup(selectedEmp.id, formData);
      addToast('success', 'कट्टी विवरण सुरक्षित गरियो', `${selectedEmp.name}को कट्टी विवरण सुरक्षित गरियो।`);
    }
  };

  const formatMoney = (val: number) =>
    formatNepaliCurrency(val, { useDevanagari: useDevanagariNumerals });

  // Statutory limits verification
  const annualCitEpfPension = currentResult
    ? currentResult.epfTotalContributionNormal * 12 + (formData.citizenInvestmentTrust * 12) + currentResult.pensionTotalContributionNormal * 12
    : 0;
  const maxRetirementLimit = 300000;
  const oneThirdIncomeLimit = currentResult ? currentResult.totalAnnualIncome / 3 : 0;
  const allowableRetirement = Math.min(annualCitEpfPension, maxRetirementLimit, oneThirdIncomeLimit);

  return (
    <div className="space-y-6">
      {/* Top Banner & Switcher */}
      <div className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#edf4ea] border border-[#cbdcc6] text-[#4B6043] flex items-center justify-center">
            <Scissors className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#24331C]">
              कट्टी तथा कर छुट व्यवस्थापन (Deduction Setup)
            </h2>
            <p className="text-xs text-[#526a48]">
              नागरिक लगानी कोष, संचय कोष, जीवन बिमा, सापटी तथा दुर्गम कर छुट सीमा व्यवस्थापन
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-[#35492d]">कर्मचारी चयन:</label>
          <select
            value={selectedEmpId}
            onChange={(e) => setSelectedEmpId(e.target.value)}
            className="py-1.5 px-3 rounded-xl border border-[#c8d7c2] bg-[#fbfdfa] text-[#24331C] text-xs font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
          >
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name} ({toNepaliDigits(emp.code)} - {emp.designation})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Deduction Form (Left 2 Cols) */}
        <form onSubmit={handleSave} className="lg:col-span-2 space-y-6">
          {/* Section 1: Retirement & Savings Deductions */}
          <div className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#e9efe4] pb-2">
              <h3 className="text-sm font-bold text-[#24331C]">
                १. अवकाश कोष तथा बचत कट्टीहरू (Retirement Funds & Savings)
              </h3>
              <span className="text-xs text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                आयकर ऐन दफा ६३
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-[#304426] mb-1">
                  नागरिक लगानी कोष (मासिक रकम)
                </label>
                <NepaliNumberInput
                  value={formData.citizenInvestmentTrust}
                  onChange={(val) => handleNumericFieldChange('citizenInvestmentTrust', val)}
                  placeholder="०"
                  className="w-full p-2.5 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] font-mono font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  कर्मचारीको इच्छा अनुसार मासिक कट्टी हुने सीआईटी रकम
                </p>
              </div>

              <div>
                <label className="block font-semibold text-[#304426] mb-1">
                  व्यक्तिगत जीवन बिमा प्रिमियम (वार्षिक)
                </label>
                <NepaliNumberInput
                  value={formData.investmentInsuranceDeduction || 0}
                  onChange={(val) => handleNumericFieldChange('investmentInsuranceDeduction', val)}
                  placeholder="०"
                  className="w-full p-2.5 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] font-mono font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  जीवन बिमा प्रिमियम भुक्तानी (अधिकतम रु. ४०,००० सम्म छुट)
                </p>
              </div>

              <div>
                <label className="block font-semibold text-[#304426] mb-1">
                  सापटी / ऋण कट्टी (मासिक)
                </label>
                <NepaliNumberInput
                  value={formData.loanDeduction}
                  onChange={(val) => handleNumericFieldChange('loanDeduction', val)}
                  placeholder="०"
                  className="w-full p-2.5 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] font-mono font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  संचय कोष सापटी, बैंक ऋण वा कर्मचारी सापटी किस्ता
                </p>
              </div>

              <div>
                <label className="block font-semibold text-[#304426] mb-1">
                  अन्य विविध कट्टी (मासिक)
                </label>
                <NepaliNumberInput
                  value={formData.otherDeduction}
                  onChange={(val) => handleNumericFieldChange('otherDeduction', val)}
                  placeholder="०"
                  className="w-full p-2.5 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] font-mono font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  कल्याणकारी कोष, युनियन शुल्क वा अन्य कट्टी
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Tax Reliefs, Remote & Medical Expenses */}
          <div className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-[#24331C] border-b border-[#e9efe4] pb-2">
              २. कर छुट तथा औषधी उपचार खर्च (Tax Reliefs & Credits)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-[#304426] mb-1">
                  दुर्गम क्षेत्र कर छुट रकम (वार्षिक)
                </label>
                <NepaliNumberInput
                  value={formData.remoteTaxReliefOverride || 0}
                  onChange={(val) => handleNumericFieldChange('remoteTaxReliefOverride', val)}
                  placeholder="०"
                  className="w-full p-2.5 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] font-mono font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  वर्ग क: ५०,०००, ख: ४०,०००, ग: ३०,०००, घ: २०,०००, ङ: १०,०००
                </p>
              </div>

              <div>
                <label className="block font-semibold text-[#304426] mb-1">
                  वास्तविक स्वीकृत औषधी उपचार खर्च (वार्षिक)
                </label>
                <NepaliNumberInput
                  value={formData.medicalExpenseActual || 0}
                  onChange={(val) => handleNumericFieldChange('medicalExpenseActual', val)}
                  placeholder="०"
                  className="w-full p-2.5 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] font-mono font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  १५% औषधी कर मिलान (अधिकतम रु. ७५० सम्म कर छुट)
                </p>
              </div>

              <div>
                <label className="block font-semibold text-[#304426] mb-1">
                  अपाङ्ग व्यक्ति कर छुट रकम (वार्षिक)
                </label>
                <NepaliNumberInput
                  value={formData.disabilityReliefOverride || 0}
                  onChange={(val) => handleNumericFieldChange('disabilityReliefOverride', val)}
                  placeholder="०"
                  className="w-full p-2.5 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] font-mono font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  अपाङ्गता भएका कर्मचारीका लागि (खाली राखेमा स्वतः गणना हुनेछ)
                </p>
              </div>

              <div>
                <label className="block font-semibold text-[#304426] mb-1">
                  महिला कर्मचारी १०% कर छुट रकम (वार्षिक)
                </label>
                <NepaliNumberInput
                  value={formData.femaleTaxRebateOverride || 0}
                  onChange={(val) => handleNumericFieldChange('femaleTaxRebateOverride', val)}
                  placeholder="०"
                  className="w-full p-2.5 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] font-mono font-bold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  महिला कर्मचारीको लागि (खाली राखेमा वार्षिक कर दायित्वको स्वतः १०% गणना हुनेछ)
                </p>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setAuditEmployeeId(selectedEmpId)}
              className="px-4 py-2 text-xs font-bold text-[#4B6043] bg-[#edf4ea] hover:bg-[#dbe8d7] rounded-xl border border-[#c5d7bf] transition-colors flex items-center gap-1.5"
            >
              <Calculator className="w-4 h-4" />
              <span>४-तहको कर गणना हेर्नुहोस्</span>
            </button>

            <button
              type="submit"
              className="px-6 py-2.5 text-xs font-bold text-white bg-[#4B6043] hover:bg-[#384c31] rounded-xl transition-colors shadow-sm flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>कट्टी विवरण सुरक्षित गर्नुहोस्</span>
            </button>
          </div>
        </form>

        {/* Right Sidebar: Deductions & Statutory Limits Audit */}
        <div className="space-y-6">
          <div className="bg-[#2C3E26] text-white p-5 rounded-2xl shadow-sm space-y-4 text-xs">
            <div className="flex items-center gap-2 text-emerald-300 border-b border-white/10 pb-3">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="font-bold text-sm text-white">
                कट्टी तथा छुट वैधानिक सीमा विश्लेषण (Statutory Limit Audit)
              </h3>
            </div>

            <div className="space-y-3">
              <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                <p className="text-emerald-200 text-[11px]">अवकाश कोष (संचय कोष + सिटिटि + पेन्सन):</p>
                <p className="text-base font-bold text-white font-mono mt-0.5">
                  {formatMoney(annualCitEpfPension)}
                </p>
                <div className="mt-2 text-[10px] text-emerald-300/80 space-y-1">
                  <div>• अधिकतम स्वीकृत सीमा: रु. ३,००,०००/-</div>
                  <div>• कुल आयको १/३ सीमा: {formatMoney(oneThirdIncomeLimit)}</div>
                  <div className="font-bold text-white pt-1 border-t border-white/10">
                    स्वीकृत कट्टी रकम: {formatMoney(allowableRetirement)}
                  </div>
                </div>
              </div>

              <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                <p className="text-emerald-200 text-[11px]">सावधिक जीवन बिमा कोष (वार्षिक):</p>
                <p className="text-sm font-bold text-white font-mono mt-0.5">
                  {formatMoney(currentSalary.lifeInsuranceFund * 12)}
                </p>
              </div>

              <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                <p className="text-emerald-200 text-[11px]">दुर्गम क्षेत्र कर छुट:</p>
                <p className="text-sm font-bold text-white font-mono mt-0.5">
                  {formatMoney(formData.remoteTaxReliefOverride || 0)}
                </p>
              </div>

              <div className="pt-2 border-t border-white/15">
                <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-emerald-200">जम्मा वार्षिक कट्टी:</span>
                  <span className="text-amber-300 font-mono">
                    {formatMoney(currentResult ? currentResult.totalAnnualDeductions : 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#d6e3d2] shadow-xs text-xs space-y-2">
            <h4 className="font-bold text-[#24331C] flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              आयकर छुट नियम (नेपाल आयकर ऐन २०५८):
            </h4>
            <ul className="text-gray-600 space-y-1.5 text-[11px] leading-relaxed">
              <li>• स्वीकृत अवकाश कोषमा जम्मा भएको रकम मध्ये वास्तविक रकम, कुल आयको १/३ वा रु. ३,००,००० मध्ये जुन कम हुन्छ सोही रकम मात्र कर योग्य आयबाट कट्टी पाउनेछ।</li>
              <li>• जीवन बिमा प्रिमियम बापत अधिकतम रु. ४०,००० सम्म कट्टी दाबी गर्न पाइन्छ।</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
