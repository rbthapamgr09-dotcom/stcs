import React, { useState, useEffect } from 'react';
import {
  Percent,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  ShieldCheck,
  TableProperties,
  Users,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TaxReference, TaxSlab, DeductionSetup } from '../../types';
import { DEFAULT_TAX_REFERENCES } from '../../data/demoData';
import { toNepaliDigits, toEnglishDigits, toDisplayDigits, formatNepaliNumber } from '../../utils/nepaliCalendar';
import { NepaliNumberInput } from '../common/NepaliNumberInput';
import { NepaliTextInput } from '../common/NepaliTextInput';

interface UnifiedSlabRow {
  id: string;
  description: string;
  singleFrom: number;
  singleTo: number;
  coupleFrom: number;
  coupleTo: number;
  ratePercent: number;
}

export const TaxReferenceSetupView: React.FC = () => {
  const {
    taxReferences,
    saveTaxReference,
    activeFiscalYear,
    useDevanagariNumerals,
    employees,
    deductionSetups,
    updateDeductionSetup,
    addToast,
    hasPermission,
  } = useApp();

  const displayDigits = (val: string | number | null | undefined) =>
    toDisplayDigits(val, useDevanagariNumerals);

  // Find existing single and couple tax references for current FY
  const singleRef =
    taxReferences.find(
      (r) => r.fiscalYear === activeFiscalYear && r.filingType === 'एकल'
    ) ||
    taxReferences.find((r) => r.filingType === 'एकल') ||
    DEFAULT_TAX_REFERENCES[0];

  const coupleRef =
    taxReferences.find(
      (r) => r.fiscalYear === activeFiscalYear && r.filingType === 'दम्पत्ती'
    ) ||
    taxReferences.find((r) => r.filingType === 'दम्पत्ती') ||
    DEFAULT_TAX_REFERENCES[1];

  // Combined slabs state
  const [unifiedSlabs, setUnifiedSlabs] = useState<UnifiedSlabRow[]>([]);
  const [singleConfig, setSingleConfig] = useState<TaxReference>({ ...singleRef });
  const [coupleConfig, setCoupleConfig] = useState<TaxReference>({ ...coupleRef });

  // Employee-specific deduction limits local state
  const [empCeilingsState, setEmpCeilingsState] = useState<Record<string, Partial<DeductionSetup>>>({});
  const [empSearchTerm, setEmpSearchTerm] = useState('');

  // Sync employee deduction setups into local editable state
  useEffect(() => {
    const initial: Record<string, Partial<DeductionSetup>> = {};
    employees.forEach((emp) => {
      const existing = deductionSetups[emp.id];
      if (existing) {
        initial[emp.id] = {
          lifeInsuranceCeilingLimit: existing.lifeInsuranceCeilingLimit,
          citCeilingLimit: existing.citCeilingLimit,
          healthInsuranceCeilingLimit: existing.healthInsuranceCeilingLimit,
          homeInsuranceCeilingLimit: existing.homeInsuranceCeilingLimit,
          medicalTaxCreditCeilingLimit: existing.medicalTaxCreditCeilingLimit,
        };
      }
    });
    setEmpCeilingsState(initial);
  }, [employees, deductionSetups]);

  const handleEmpCeilingChange = (
    empId: string,
    field: keyof DeductionSetup,
    value: number | undefined
  ) => {
    setEmpCeilingsState((prev) => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        [field]: value,
      },
    }));
  };

  const handleSaveSingleEmployeeCeiling = (empId: string) => {
    const emp = employees.find((e) => e.id === empId);
    const existing = deductionSetups[empId];
    if (!existing) return;

    const changes = empCeilingsState[empId] || {};
    const updated: DeductionSetup = {
      ...existing,
      ...changes,
      updatedAt: new Date().toISOString(),
    };

    updateDeductionSetup(empId, updated);
    addToast('success', 'कट्टी सीमा सुरक्षित भयो', `${emp?.name || 'कर्मचारी'}को वैधानिक कट्टी सीमा सफलतापूर्वक सुरक्षित गरियो।`);
  };

  const handleResetEmployeeCeiling = (empId: string) => {
    const emp = employees.find((e) => e.id === empId);
    const existing = deductionSetups[empId];
    if (!existing) return;

    const updated: DeductionSetup = {
      ...existing,
      lifeInsuranceCeilingLimit: undefined,
      citCeilingLimit: undefined,
      healthInsuranceCeilingLimit: undefined,
      homeInsuranceCeilingLimit: undefined,
      medicalTaxCreditCeilingLimit: undefined,
      updatedAt: new Date().toISOString(),
    };

    setEmpCeilingsState((prev) => ({
      ...prev,
      [empId]: {
        lifeInsuranceCeilingLimit: undefined,
        citCeilingLimit: undefined,
        healthInsuranceCeilingLimit: undefined,
        homeInsuranceCeilingLimit: undefined,
        medicalTaxCreditCeilingLimit: undefined,
      },
    }));

    updateDeductionSetup(empId, updated);
    addToast('info', 'मानक सीमा लागू गरियो', `${emp?.name || 'कर्मचारी'}को कट्टी सीमा सामान्य मानक नियममा रिसेट गरियो।`);
  };

  const handleSaveAllEmployeeCeilings = () => {
    let count = 0;
    employees.forEach((emp) => {
      const existing = deductionSetups[emp.id];
      if (existing) {
        const changes = empCeilingsState[emp.id] || {};
        const updated: DeductionSetup = {
          ...existing,
          ...changes,
          updatedAt: new Date().toISOString(),
        };
        updateDeductionSetup(emp.id, updated);
        count++;
      }
    });
    addToast('success', 'सबै कर्मचारीको कट्टी सीमा सुरक्षित', `कुल ${count} जना कर्मचारीको कर्मचारीगत वैधानिक कट्टी सीमा सुरक्षित गरियो।`);
  };

  const filteredEmployees = employees.filter(
    (e) =>
      String(e.name || '').toLowerCase().includes(empSearchTerm.toLowerCase()) ||
      String(e.code || '').toLowerCase().includes(empSearchTerm.toLowerCase()) ||
      String(e.designation || '').toLowerCase().includes(empSearchTerm.toLowerCase())
  );

  // Initialize unified slabs from single and couple references
  useEffect(() => {
    const sRef =
      taxReferences.find(
        (r) => r.fiscalYear === activeFiscalYear && r.filingType === 'एकल'
      ) ||
      taxReferences.find((r) => r.filingType === 'एकल') ||
      DEFAULT_TAX_REFERENCES[0];

    const cRef =
      taxReferences.find(
        (r) => r.fiscalYear === activeFiscalYear && r.filingType === 'दम्पत्ती'
      ) ||
      taxReferences.find((r) => r.filingType === 'दम्पत्ती') ||
      DEFAULT_TAX_REFERENCES[1];

    setSingleConfig({ ...sRef });
    setCoupleConfig({ ...cRef });

    const maxLen = Math.max(sRef.slabs.length, cRef.slabs.length);
    const combined: UnifiedSlabRow[] = [];

    for (let i = 0; i < maxLen; i++) {
      const s = sRef.slabs[i];
      const c = cRef.slabs[i];
      const desc = s?.description || c?.description || `स्ल्याब ${i + 1}`;

      combined.push({
        id: s?.id || c?.id || `slab_uni_${i + 1}_${Date.now()}`,
        description: desc,
        singleFrom: s ? s.fromAmount : 0,
        singleTo: s ? s.toAmount : 0,
        coupleFrom: c ? c.fromAmount : 0,
        coupleTo: c ? c.toAmount : 0,
        ratePercent: s ? s.ratePercent : c ? c.ratePercent : 1,
      });
    }

    setUnifiedSlabs(combined);
  }, [activeFiscalYear, taxReferences]);

  const handleRowChange = (
    index: number,
    field: keyof UnifiedSlabRow,
    value: string | number
  ) => {
    setUnifiedSlabs((prev) => {
      const copy = [...prev];
      const row = { ...copy[index] };

      if (field === 'description') {
        row[field] = String(value);
      } else if (field === 'id') {
        row[field] = String(value);
      } else {
        const numVal = typeof value === 'number' ? value : Number(value);
        row[field] = isNaN(numVal) ? 0 : numVal;
      }

      copy[index] = row;
      return copy;
    });
  };

  const handleAddRow = () => {
    const lastRow = unifiedSlabs[unifiedSlabs.length - 1];
    const newSingleFrom = lastRow ? lastRow.singleTo : 0;
    const newCoupleFrom = lastRow ? lastRow.coupleTo : 0;

    const newRow: UnifiedSlabRow = {
      id: `slab_row_${Date.now()}`,
      description: `थप स्ल्याब ${displayDigits(unifiedSlabs.length + 1)}`,
      singleFrom: newSingleFrom,
      singleTo: 999999999,
      coupleFrom: newCoupleFrom,
      coupleTo: 999999999,
      ratePercent: 39,
    };

    setUnifiedSlabs((prev) => [...prev, newRow]);
  };

  const handleDeleteRow = (index: number) => {
    if (!hasPermission('DELETE_DATA')) {
      addToast('error', 'अनाधिकृत कार्य', 'कर स्ल्याब हटाउन Super Admin वा Admin अधिकार आवश्यक पर्दछ।');
      return;
    }
    if (unifiedSlabs.length <= 1) {
      addToast('error', 'हटाउन मिल्दैन', 'कम्तिमा एउटा कर स्ल्याब अनिवार्य छ।');
      return;
    }
    setUnifiedSlabs((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleRemoteChange = (area: 'क' | 'ख' | 'ग' | 'घ' | 'ङ', value: number) => {
    const updatedRemote = {
      ...singleConfig.remoteExemptions,
      [area]: value,
    };
    setSingleConfig((prev) => ({
      ...prev,
      remoteExemptions: updatedRemote,
    }));
    setCoupleConfig((prev) => ({
      ...prev,
      remoteExemptions: updatedRemote,
    }));
  };

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();

    // Map unified slabs back to single and couple TaxReference objects
    const singleSlabs: TaxSlab[] = unifiedSlabs.map((row, idx) => ({
      id: `single_slab_${idx + 1}_${row.id}`,
      fromAmount: row.singleFrom,
      toAmount: row.singleTo,
      ratePercent: row.ratePercent,
      description: row.description || `एकल स्ल्याब ${idx + 1}`,
    }));

    const coupleSlabs: TaxSlab[] = unifiedSlabs.map((row, idx) => ({
      id: `couple_slab_${idx + 1}_${row.id}`,
      fromAmount: row.coupleFrom,
      toAmount: row.coupleTo,
      ratePercent: row.ratePercent,
      description: row.description || `दम्पत्ती स्ल्याब ${idx + 1}`,
    }));

    const updatedSingleRef: TaxReference = {
      ...singleConfig,
      fiscalYear: activeFiscalYear,
      filingType: 'एकल',
      slabs: singleSlabs,
    };

    const updatedCoupleRef: TaxReference = {
      ...coupleConfig,
      fiscalYear: activeFiscalYear,
      filingType: 'दम्पत्ती',
      slabs: coupleSlabs,
    };

    saveTaxReference(updatedSingleRef);
    saveTaxReference(updatedCoupleRef);

    addToast(
      'success',
      'कर स्ल्याब तथा नियम सुरक्षित',
      `आर्थिक वर्ष ${displayDigits(activeFiscalYear)} को लागि एकल र दम्पत्ती दुवै कर स्ल्याब सफलतापूर्वक सुरक्षित भयो।`
    );
  };

  const handleResetToGovernmentDefaults = () => {
    const defaultSingle = DEFAULT_TAX_REFERENCES.find((r) => r.filingType === 'एकल');
    const defaultCouple = DEFAULT_TAX_REFERENCES.find((r) => r.filingType === 'दम्पत्ती');

    if (defaultSingle && defaultCouple) {
      const sRef = {
        ...defaultSingle,
        id: singleConfig.id,
        fiscalYear: activeFiscalYear,
      };
      const cRef = {
        ...defaultCouple,
        id: coupleConfig.id,
        fiscalYear: activeFiscalYear,
      };

      setSingleConfig(sRef);
      setCoupleConfig(cRef);

      const maxLen = Math.max(sRef.slabs.length, cRef.slabs.length);
      const combined: UnifiedSlabRow[] = [];

      for (let i = 0; i < maxLen; i++) {
        const s = sRef.slabs[i];
        const c = cRef.slabs[i];
        const desc = s?.description || c?.description || `स्ल्याब ${i + 1}`;

        combined.push({
          id: s?.id || c?.id || `slab_uni_${i + 1}`,
          description: desc,
          singleFrom: s ? s.fromAmount : 0,
          singleTo: s ? s.toAmount : 0,
          coupleFrom: c ? c.fromAmount : 0,
          coupleTo: c ? c.toAmount : 0,
          ratePercent: s ? s.ratePercent : c ? c.ratePercent : 1,
        });
      }

      setUnifiedSlabs(combined);
      saveTaxReference(sRef);
      saveTaxReference(cRef);
      addToast(
        'info',
        'मानक स्ल्याब रिसेट',
        'आधिकारिक कर स्ल्याबहरू रिसेट गरियो।'
      );
    }
  };

  // Helper to calculate difference (फरक)
  const calculateDifference = (row: UnifiedSlabRow) => {
    if (row.singleTo >= 999999990 || row.singleTo === 0 || row.singleFrom >= row.singleTo) {
      return '-';
    }
    const diff = row.singleTo - row.singleFrom;
    if (diff <= 0) return '-';
    return formatNepaliNumber(diff, { useDevanagari: useDevanagariNumerals, decimals: 2 });
  };

  return (
    <div className="space-y-6" id="tax-reference-setup-container">
      {/* Header Banner */}
      <div
        id="tax-reference-header-banner"
        className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#edf4ea] border border-[#cbdcc6] text-[#4B6043] flex items-center justify-center">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#24331C]">
              कर स्ल्याब तथा वैधानिक नियमहरू (Tax Reference Setup)
            </h2>
            <p className="text-xs text-[#526a48]">
              आर्थिक वर्ष {displayDigits(activeFiscalYear)} को आयकर ऐन अनुसार एकल तथा दम्पत्ती करदाताको प्रगतिशील कर दर तालिका
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-reset-gov-defaults"
            type="button"
            onClick={handleResetToGovernmentDefaults}
            className="px-3 py-1.5 bg-[#edf4ea] text-[#344c2d] hover:bg-[#dbe8d6] rounded-xl border border-[#c5d7bf] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="आधिकारिक पूर्वनिर्धारित स्ल्याब रिसेट गर्नुहोस्"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>मानक रिसेट (Reset Defaults)</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSaveAll} className="space-y-6" id="tax-reference-form">
        {/* Section 1: Progressive Tax Slabs Table */}
        <div
          id="tax-slabs-table-section"
          className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e9efe4] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#24331C] flex items-center gap-2">
                <TableProperties className="w-4 h-4 text-[#4B6043]" />
                <span>१. प्रगतिशील कर स्ल्याब तालिका (Progressive Tax Slabs Setup)</span>
              </h3>
              <p className="text-xs text-gray-500">
                एकल (Single) र दम्पत्ती (Married) दुवै करदाताका लागि
              </p>
            </div>
            <button
              id="btn-add-tax-slab-row"
              type="button"
              onClick={handleAddRow}
              className="px-3 py-1.5 bg-[#edf4ea] hover:bg-[#dbe8d6] text-[#344b2d] text-xs font-bold rounded-lg border border-[#c5d7bf] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>नयाँ स्ल्याब थप्नुहोस् (Add Slab)</span>
            </button>
          </div>

          {/* Unified Table styled accurately like Excel sheet */}
          <div className="overflow-x-auto border-2 border-[#82a378] rounded-xl shadow-xs">
            <table className="w-full text-left text-xs border-collapse min-w-[850px]" id="tax-slabs-grid-table">
              <thead>
                {/* Level 1 Header: एकल, दम्पत्ती, फरक, करको दर */}
                <tr className="bg-[#b3d4aa] text-[#1b3017] font-bold divide-x divide-[#82a378] border-b border-[#82a378]">
                  <th
                    rowSpan={2}
                    className="p-2.5 text-center w-10 border-r border-[#82a378] bg-[#a8cc9e]"
                  >
                    क्र.सं.
                  </th>
                  <th
                    rowSpan={2}
                    className="p-2.5 border-r border-[#82a378] min-w-[200px] bg-[#a8cc9e]"
                  >
                    स्ल्याब विवरण (Description)
                  </th>
                  <th
                    colSpan={2}
                    className="p-2 text-center text-sm border-r border-[#82a378] bg-[#b3d4aa]"
                  >
                    एकल
                  </th>
                  <th
                    colSpan={2}
                    className="p-2 text-center text-sm border-r border-[#82a378] bg-[#b3d4aa]"
                  >
                    दम्पत्ती
                  </th>
                  <th
                    rowSpan={2}
                    className="p-2.5 text-center w-36 border-r border-[#82a378] bg-[#a8cc9e]"
                  >
                    फरक
                  </th>
                  <th
                    rowSpan={2}
                    className="p-2.5 text-center w-28 border-r border-[#82a378] bg-[#a8cc9e]"
                  >
                    करको दर
                  </th>
                  <th
                    rowSpan={2}
                    className="p-2.5 text-center w-14 bg-[#a8cc9e]"
                  >
                    कार्य
                  </th>
                </tr>
                {/* Level 2 Header: देखि | सम्म | देखि | सम्म */}
                <tr className="bg-[#c2e0b9] text-[#22391e] font-bold divide-x divide-[#82a378] border-b-2 border-[#82a378]">
                  <th className="p-2 text-center w-32 border-r border-[#82a378]">देखि</th>
                  <th className="p-2 text-center w-32 border-r border-[#82a378]">सम्म</th>
                  <th className="p-2 text-center w-32 border-r border-[#82a378]">देखि</th>
                  <th className="p-2 text-center w-32 border-r border-[#82a378]">सम्म</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#9ebd93] bg-[#fcfdfa]">
                {unifiedSlabs.map((row, index) => {
                  const diffText = calculateDifference(row);
                  return (
                    <tr
                      key={row.id || index}
                      id={`slab-row-${index}`}
                      className="hover:bg-[#f2f8ee] divide-x divide-[#9ebd93] transition-colors"
                    >
                      {/* S.N. */}
                      <td className="p-2 text-center font-bold text-[#24331C] bg-[#f7faf5]">
                        {displayDigits(index + 1)}
                      </td>

                      {/* Description */}
                      <td className="p-1.5">
                        <NepaliTextInput
                          id={`input-slab-desc-${index}`}
                          value={row.description}
                          onChange={(val) =>
                            handleRowChange(index, 'description', val)
                          }
                          isNepali={true}
                          placeholder={`स्ल्याब ${displayDigits(index + 1)} विवरण`}
                          className="w-full px-2 py-1.5 text-xs rounded border border-[#b3ccac] bg-white text-[#24331C] font-medium focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                        />
                      </td>

                      {/* Single: देखि (From) */}
                      <td className="p-1.5 bg-[#fefefe]">
                        <NepaliNumberInput
                          id={`input-single-from-${index}`}
                          value={row.singleFrom}
                          onChange={(val) => handleRowChange(index, 'singleFrom', val)}
                          placeholder="०"
                          className="w-full px-2 py-1.5 text-xs rounded border border-[#b3ccac] bg-white text-right text-[#24331C] font-semibold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                        />
                      </td>

                      {/* Single: सम्म (To) */}
                      <td className="p-1.5 bg-[#fefefe]">
                        <NepaliNumberInput
                          id={`input-single-to-${index}`}
                          value={row.singleTo}
                          isInfinityAllowed={true}
                          onChange={(val) => handleRowChange(index, 'singleTo', val)}
                          placeholder="माथिको सबै"
                          className="w-full px-2 py-1.5 text-xs rounded border border-[#b3ccac] bg-white text-right text-[#24331C] font-semibold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                        />
                      </td>

                      {/* Couple: देखि (From) */}
                      <td className="p-1.5 bg-[#fafff8]">
                        <NepaliNumberInput
                          id={`input-couple-from-${index}`}
                          value={row.coupleFrom}
                          onChange={(val) => handleRowChange(index, 'coupleFrom', val)}
                          placeholder="०"
                          className="w-full px-2 py-1.5 text-xs rounded border border-[#b3ccac] bg-white text-right text-[#24331C] font-semibold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                        />
                      </td>

                      {/* Couple: सम्म (To) */}
                      <td className="p-1.5 bg-[#fafff8]">
                        <NepaliNumberInput
                          id={`input-couple-to-${index}`}
                          value={row.coupleTo}
                          isInfinityAllowed={true}
                          onChange={(val) => handleRowChange(index, 'coupleTo', val)}
                          placeholder="माथिको सबै"
                          className="w-full px-2 py-1.5 text-xs rounded border border-[#b3ccac] bg-white text-right text-[#24331C] font-semibold focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                        />
                      </td>

                      {/* फरक (Difference) */}
                      <td className="p-2 text-right font-bold text-[#314a2a] bg-[#f5faf2]">
                        {diffText}
                      </td>

                      {/* करको दर (%) */}
                      <td className="p-1.5 text-center bg-[#fdfefc]">
                        <div className="flex items-center justify-center gap-1">
                          <NepaliNumberInput
                            id={`input-rate-percent-${index}`}
                            value={row.ratePercent}
                            allowDecimals={false}
                            decimalPlaces={0}
                            onChange={(val) => handleRowChange(index, 'ratePercent', val)}
                            placeholder="०"
                            className="w-16 px-1.5 py-1.5 rounded border border-[#b3ccac] bg-white text-center font-bold text-[#35522e] focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                          />
                          <span className="text-gray-600 font-bold">%</span>
                        </div>
                      </td>

                      {/* कार्य (Action) */}
                      <td className="p-2 text-center bg-[#fafdf8]">
                        {hasPermission('DELETE_DATA') ? (
                          <button
                            id={`btn-delete-slab-${index}`}
                            type="button"
                            onClick={() => handleDeleteRow(index)}
                            className="p-1.5 text-red-600 hover:bg-red-100/70 rounded-md transition-colors cursor-pointer"
                            title="यो स्ल्याब हटाउनुहोस्"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-gray-300 text-[10px]">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-[#f7faf5] p-3 rounded-xl border border-[#d8e6d4] text-[11px] text-[#415a38] flex flex-wrap items-center justify-between gap-2">
            <span>
              💡 <strong>सुझाव:</strong> अन्तिम स्ल्याबको 'सम्म' रकम खाली छाड्दा प्रणालीले स्वतः 'माथिको सबै रकम (Infinity)' मान्दछ।
            </span>
            <span className="font-semibold">
              कुल सक्रिय स्ल्याबहरू: {displayDigits(unifiedSlabs.length)}
            </span>
          </div>
        </div>

        {/* Section 2: Statutory Reliefs & Deductions Limits */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="statutory-exemptions-grid">
          {/* Remote Area Exemptions */}
          <div
            id="remote-exemptions-card"
            className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs space-y-4 text-xs"
          >
            <h3 className="text-sm font-bold text-[#24331C] border-b border-[#e9efe4] pb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#4B6043]" />
              <span>२. भौगोलिक दुर्गम क्षेत्र कर छुट सीमा (Remote Allowances Exemptions)</span>
            </h3>
            <div className="space-y-3">
              {(['क', 'ख', 'ग', 'घ', 'ङ'] as const).map((area) => (
                <div key={area} className="flex items-center justify-between">
                  <label className="font-semibold text-[#304426]">
                    दुर्गम क्षेत्र वर्ग '{area}' (Class {area}):
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-500 font-semibold">{useDevanagariNumerals ? 'रु.' : 'Rs.'}</span>
                    <NepaliNumberInput
                      id={`input-remote-exemption-${area}`}
                      value={singleConfig.remoteExemptions[area]}
                      onChange={(val) => handleRemoteChange(area, val)}
                      placeholder="०"
                      className="w-28 p-1.5 rounded-lg border border-[#c8d7c2] bg-white font-semibold text-right text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Special Reliefs & Ceilings */}
          <div
            id="statutory-ceilings-card"
            className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs space-y-4 text-xs"
          >
            <h3 className="text-sm font-bold text-[#24331C] border-b border-[#e9efe4] pb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#4B6043]" />
              <span>३. वैधानिक छुट तथा अधिकतम कट्टी सीमा (Statutory Ceilings)</span>
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-[#304426]">
                  महिला करदाता छुट दर (Female Tax Rebate):
                </label>
                <div className="flex items-center gap-1">
                  <NepaliNumberInput
                    id="input-female-tax-rebate"
                    value={singleConfig.femaleTaxRebatePercent}
                    allowDecimals={true}
                    onChange={(val) => {
                      setSingleConfig((p) => ({ ...p, femaleTaxRebatePercent: val }));
                      setCoupleConfig((p) => ({ ...p, femaleTaxRebatePercent: val }));
                    }}
                    placeholder="१०"
                    className="w-20 p-1.5 rounded-lg border border-[#c8d7c2] bg-white text-center font-bold text-[#4B6043] focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                  />
                  <span className="text-gray-600 font-bold">%</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="font-semibold text-[#304426]">
                  अपाङ्गता अतिरिक्त स्ल्याब छुट (Disability Relief):
                </label>
                <div className="flex items-center gap-1">
                  <NepaliNumberInput
                    id="input-disability-exemption"
                    value={singleConfig.disabilityExemptionPercent}
                    allowDecimals={true}
                    onChange={(val) => {
                      setSingleConfig((p) => ({ ...p, disabilityExemptionPercent: val }));
                      setCoupleConfig((p) => ({ ...p, disabilityExemptionPercent: val }));
                    }}
                    placeholder="५०"
                    className="w-20 p-1.5 rounded-lg border border-[#c8d7c2] bg-white text-center font-bold text-[#4B6043] focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                  />
                  <span className="text-gray-600 font-bold">%</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="font-semibold text-[#304426]">
                  सावधिक जीवन बिमा अधिकतम कट्टी (Life Insurance Max):
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500 font-semibold">{useDevanagariNumerals ? 'रु.' : 'Rs.'}</span>
                  <NepaliNumberInput
                    id="input-life-insurance-max"
                    value={singleConfig.lifeInsuranceMaxDeduction}
                    onChange={(val) => {
                      setSingleConfig((p) => ({ ...p, lifeInsuranceMaxDeduction: val }));
                      setCoupleConfig((p) => ({ ...p, lifeInsuranceMaxDeduction: val }));
                    }}
                    placeholder="४०,०००"
                    className="w-28 p-1.5 rounded-lg border border-[#c8d7c2] bg-white font-semibold text-right text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="font-semibold text-[#304426]">
                  ना.ल.कोष/संचय कोष अधिकतम कट्टी सीमा (Retirement Limit):
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500 font-semibold">{useDevanagariNumerals ? 'रु.' : 'Rs.'}</span>
                  <NepaliNumberInput
                    id="input-cit-max-deduction"
                    value={singleConfig.citMaxDeductionAmount}
                    onChange={(val) => {
                      setSingleConfig((p) => ({ ...p, citMaxDeductionAmount: val }));
                      setCoupleConfig((p) => ({ ...p, citMaxDeductionAmount: val }));
                    }}
                    placeholder="३,००,०००"
                    className="w-28 p-1.5 rounded-lg border border-[#c8d7c2] bg-white font-semibold text-right text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="font-semibold text-[#304426]">
                  औषधी उपचार कर मिलान अधिकतम (Medical Tax Credit Max):
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500 font-semibold">{useDevanagariNumerals ? 'रु.' : 'Rs.'}</span>
                  <NepaliNumberInput
                    id="input-medical-tax-credit-max"
                    value={singleConfig.medicalTaxCreditMaxAmount}
                    onChange={(val) => {
                      setSingleConfig((p) => ({ ...p, medicalTaxCreditMaxAmount: val }));
                      setCoupleConfig((p) => ({ ...p, medicalTaxCreditMaxAmount: val }));
                    }}
                    placeholder="७५०"
                    className="w-28 p-1.5 rounded-lg border border-[#c8d7c2] bg-white font-semibold text-right text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Global Save Button */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            id="btn-save-tax-reference-all"
            type="submit"
            className="px-6 py-2.5 bg-[#4B6043] hover:bg-[#384c31] text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>कर नियम, दुर्गम छुट तथा सामान्य सीमा सुरक्षित गर्नुहोस्</span>
          </button>
        </div>
      </form>

      {/* SECTION 3.2: Comprehensive Employee-Specific Statutory Ceilings (कर्मचारीगत वैधानिक कट्टी सीमा व्यवस्थापन) */}
      <div
        id="employee-specific-ceilings-section"
        className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e9efe4] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#edf4ea] border border-[#cbdcc6] text-[#4B6043] flex items-center justify-center">
              <Users className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#24331C] flex items-center gap-2">
                <span>३.२ प्रत्येक कर्मचारीको कर्मचारीगत कट्टी सीमा (Employee-Specific Statutory Ceilings)</span>
                <span className="px-2 py-0.5 rounded-full bg-[#edf4ea] text-[#34482b] text-[10px] font-bold">
                  {displayDigits(employees.length)} जना कर्मचारी
                </span>
              </h3>
              <p className="text-[11px] text-[#556e4c]">
                कुनै कर्मचारीको लागि विशेष वैधानिक सीमा लागू गर्नु परेमा सो कर्मचारीको व्यक्तिगत कट्टी सीमा यहाँ प्रविष्टि गरी सुरक्षित गर्न सकिन्छ।
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-bulk-save-employee-ceilings"
              type="button"
              onClick={handleSaveAllEmployeeCeilings}
              className="px-4 py-2 bg-[#4B6043] hover:bg-[#384c31] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>सबै कर्मचारीको कट्टी सीमा एकमुष्ठ सुरक्षित गर्नुहोस्</span>
            </button>
          </div>
        </div>

        {/* Search & Stats Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#fbfdfa] p-3 rounded-xl border border-[#e4ede0]">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 z-10" />
            <NepaliTextInput
              value={empSearchTerm}
              onChange={(val) => setEmpSearchTerm(val)}
              isNepali={true}
              placeholder="कर्मचारीको नाम, संकेत नं. वा पद खोजी गर्नुहोस्..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-[#c8d7c2] bg-white text-xs text-[#24331C] focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
            />
          </div>

          <div className="flex items-center gap-3 text-xs text-[#526a48]">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>मानक सीमा (Default)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span>अनुकूलित सीमा (Custom)</span>
            </div>
          </div>
        </div>

        {/* Employee Ceilings Table */}
        <div className="overflow-x-auto rounded-xl border border-[#d6e3d2]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#f4f7f2] text-[#24331C] border-b border-[#d6e3d2]">
                <th className="p-2.5 text-center font-bold w-12 border-r border-[#d6e3d2]">क्र.सं.</th>
                <th className="p-2.5 font-bold border-r border-[#d6e3d2] min-w-[180px]">कर्मचारीको विवरण</th>
                <th className="p-2.5 text-center font-bold border-r border-[#d6e3d2] min-w-[130px]">
                  सावधिक जीवन बिमा सीमा
                  <div className="text-[10px] text-[#556e4c] font-normal">मानक: रु. ४०,०००</div>
                </th>
                <th className="p-2.5 text-center font-bold border-r border-[#d6e3d2] min-w-[130px]">
                  ना.ल.कोष / अवकाश सीमा
                  <div className="text-[10px] text-[#556e4c] font-normal">मानक: रु. ३,००,०००</div>
                </th>
                <th className="p-2.5 text-center font-bold border-r border-[#d6e3d2] min-w-[120px]">
                  स्वास्थ्य बिमा सीमा
                  <div className="text-[10px] text-[#556e4c] font-normal">मानक: रु. २०,०००</div>
                </th>
                <th className="p-2.5 text-center font-bold border-r border-[#d6e3d2] min-w-[120px]">
                  निजी घर बिमा सीमा
                  <div className="text-[10px] text-[#556e4c] font-normal">मानक: रु. ५,०००</div>
                </th>
                <th className="p-2.5 text-center font-bold border-r border-[#d6e3d2] min-w-[120px]">
                  औषधी उपचार कर मिलान
                  <div className="text-[10px] text-[#556e4c] font-normal">मानक: रु. ७५०</div>
                </th>
                <th className="p-2.5 text-center font-bold min-w-[100px]">कार्य</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e9efe4]">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-gray-500">
                    कुनै कर्मचारी फेला परेन।
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp, idx) => {
                  const state = empCeilingsState[emp.id] || {};
                  const isCustom =
                    (state.lifeInsuranceCeilingLimit !== undefined && state.lifeInsuranceCeilingLimit > 0) ||
                    (state.citCeilingLimit !== undefined && state.citCeilingLimit > 0) ||
                    (state.healthInsuranceCeilingLimit !== undefined && state.healthInsuranceCeilingLimit > 0) ||
                    (state.homeInsuranceCeilingLimit !== undefined && state.homeInsuranceCeilingLimit > 0) ||
                    (state.medicalTaxCreditCeilingLimit !== undefined && state.medicalTaxCreditCeilingLimit > 0);

                  return (
                    <tr key={emp.id} className="hover:bg-[#fbfdfa] transition-colors">
                      {/* S.N. */}
                      <td className="p-2.5 text-center font-semibold text-gray-500 border-r border-[#e9efe4]">
                        {displayDigits(idx + 1)}
                      </td>

                      {/* Employee Info */}
                      <td className="p-2.5 border-r border-[#e9efe4]">
                        <div className="font-bold text-[#24331C]">{emp.name}</div>
                        <div className="text-[11px] text-[#526a48] flex items-center gap-2">
                          <span>संकेत: {displayDigits(emp.code)}</span>
                          <span>•</span>
                          <span>{emp.designation}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            isCustom
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}>
                            {isCustom ? 'अनुकूलित सीमा' : 'मानक सीमा'}
                          </span>
                          <span className="text-[10px] text-gray-500">{emp.filingType}</span>
                        </div>
                      </td>

                      {/* Life Insurance Ceiling */}
                      <td className="p-2 border-r border-[#e9efe4]">
                        <NepaliNumberInput
                          id={`input-emp-life-ceil-${emp.id}`}
                          value={state.lifeInsuranceCeilingLimit || 0}
                          placeholder="मानक (४०,०००)"
                          onChange={(val) =>
                            handleEmpCeilingChange(emp.id, 'lifeInsuranceCeilingLimit', val > 0 ? val : undefined)
                          }
                          className={`w-full p-1.5 rounded-lg border text-xs font-semibold text-right outline-none focus:ring-2 focus:ring-[#4B6043]/30 ${
                            state.lifeInsuranceCeilingLimit && state.lifeInsuranceCeilingLimit > 0
                              ? 'border-blue-300 bg-blue-50/50 text-blue-900 font-bold'
                              : 'border-[#c8d7c2] bg-white text-[#24331C]'
                          }`}
                        />
                      </td>

                      {/* CIT / Retirement Ceiling */}
                      <td className="p-2 border-r border-[#e9efe4]">
                        <NepaliNumberInput
                          id={`input-emp-cit-ceil-${emp.id}`}
                          value={state.citCeilingLimit || 0}
                          placeholder="मानक (३,००,०००)"
                          onChange={(val) =>
                            handleEmpCeilingChange(emp.id, 'citCeilingLimit', val > 0 ? val : undefined)
                          }
                          className={`w-full p-1.5 rounded-lg border text-xs font-semibold text-right outline-none focus:ring-2 focus:ring-[#4B6043]/30 ${
                            state.citCeilingLimit && state.citCeilingLimit > 0
                              ? 'border-blue-300 bg-blue-50/50 text-blue-900 font-bold'
                              : 'border-[#c8d7c2] bg-white text-[#24331C]'
                          }`}
                        />
                      </td>

                      {/* Health Insurance Ceiling */}
                      <td className="p-2 border-r border-[#e9efe4]">
                        <NepaliNumberInput
                          id={`input-emp-health-ceil-${emp.id}`}
                          value={state.healthInsuranceCeilingLimit || 0}
                          placeholder="मानक (२०,०००)"
                          onChange={(val) =>
                            handleEmpCeilingChange(emp.id, 'healthInsuranceCeilingLimit', val > 0 ? val : undefined)
                          }
                          className={`w-full p-1.5 rounded-lg border text-xs font-semibold text-right outline-none focus:ring-2 focus:ring-[#4B6043]/30 ${
                            state.healthInsuranceCeilingLimit && state.healthInsuranceCeilingLimit > 0
                              ? 'border-blue-300 bg-blue-50/50 text-blue-900 font-bold'
                              : 'border-[#c8d7c2] bg-white text-[#24331C]'
                          }`}
                        />
                      </td>

                      {/* Home Insurance Ceiling */}
                      <td className="p-2 border-r border-[#e9efe4]">
                        <NepaliNumberInput
                          id={`input-emp-home-ceil-${emp.id}`}
                          value={state.homeInsuranceCeilingLimit || 0}
                          placeholder="मानक (५,०००)"
                          onChange={(val) =>
                            handleEmpCeilingChange(emp.id, 'homeInsuranceCeilingLimit', val > 0 ? val : undefined)
                          }
                          className={`w-full p-1.5 rounded-lg border text-xs font-semibold text-right outline-none focus:ring-2 focus:ring-[#4B6043]/30 ${
                            state.homeInsuranceCeilingLimit && state.homeInsuranceCeilingLimit > 0
                              ? 'border-blue-300 bg-blue-50/50 text-blue-900 font-bold'
                              : 'border-[#c8d7c2] bg-white text-[#24331C]'
                          }`}
                        />
                      </td>

                      {/* Medical Tax Credit Ceiling */}
                      <td className="p-2 border-r border-[#e9efe4]">
                        <NepaliNumberInput
                          id={`input-emp-med-ceil-${emp.id}`}
                          value={state.medicalTaxCreditCeilingLimit || 0}
                          placeholder="मानक (७५०)"
                          onChange={(val) =>
                            handleEmpCeilingChange(emp.id, 'medicalTaxCreditCeilingLimit', val > 0 ? val : undefined)
                          }
                          className={`w-full p-1.5 rounded-lg border text-xs font-semibold text-right outline-none focus:ring-2 focus:ring-[#4B6043]/30 ${
                            state.medicalTaxCreditCeilingLimit && state.medicalTaxCreditCeilingLimit > 0
                              ? 'border-blue-300 bg-blue-50/50 text-blue-900 font-bold'
                              : 'border-[#c8d7c2] bg-white text-[#24331C]'
                          }`}
                        />
                      </td>

                      {/* Action Buttons */}
                      <td className="p-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleSaveSingleEmployeeCeiling(emp.id)}
                            className="p-1.5 bg-[#4B6043] hover:bg-[#384c31] text-white rounded-lg transition-colors cursor-pointer"
                            title="यो कर्मचारीको कट्टी सीमा सुरक्षित गर्नुहोस्"
                          >
                            <Save className="w-3.5 h-3.5" />
                          </button>

                          {isCustom && (
                            <button
                              type="button"
                              onClick={() => handleResetEmployeeCeiling(emp.id)}
                              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="मानक सीमामा रिसेट गर्नुहोस्"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
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
      </div>
    </div>
  );
};
