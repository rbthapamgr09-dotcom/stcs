import React, { useState, useMemo } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Clock,
  KeyRound,
  FileText,
  Download,
  Trash2,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Info,
  Server,
  Activity,
  UserCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  SecurityAuditLogItem,
  getSecurityAuditLogs,
  clearSecurityAuditLogs,
  logSecurityEvent,
} from '../../utils/securityUtils';
import { toNepaliDigits } from '../../utils/nepaliCalendar';

export const SecuritySettingsPanel: React.FC = () => {
  const {
    currentUser,
    users,
    hasPermission,
    isPrivacyMasked,
    togglePrivacyMasking,
    lockScreen,
    inactivityTimeoutMinutes,
    setInactivityTimeoutMinutes,
    addToast,
  } = useApp();

  const [auditLogs, setAuditLogs] = useState<SecurityAuditLogItem[]>(() =>
    getSecurityAuditLogs()
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const refreshLogs = () => {
    setAuditLogs(getSecurityAuditLogs());
    addToast('info', 'अडिट लग रिफ्रेस भयो', 'पछिल्लो सुरक्षा अडिट लग लोड गरिएको छ।');
  };

  const handleClearLogs = () => {
    if (!hasPermission('MANAGE_SETTINGS')) {
      addToast('error', 'अनुमति छैन', 'अडिट लग खाली गर्ने अधिकार तपाईंलाई छैन।');
      return;
    }
    if (window.confirm('के तपाईं निश्चित हुनुहुन्छ? सम्पूर्ण सुरक्षा अडिट लग मेटिनेछ।')) {
      clearSecurityAuditLogs();
      setAuditLogs([]);
      logSecurityEvent({
        action: 'SECURITY_SETTINGS_UPDATED',
        category: 'SECURITY',
        userId: currentUser?.id,
        username: currentUser?.username,
        userRole: currentUser?.role,
        description: 'सुरक्षा अडिट लग खाली गरियो',
        status: 'WARNING',
      });
      addToast('warning', 'अडिट लग मेटियो', 'सबै पुराना लगहरू मेटाइएका छन्।');
    }
  };

  const handleExportLogs = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(auditLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `security_audit_logs_${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    addToast('success', 'लग डाउनलोड भयो', 'सुरक्षा अडिट लग सफलतापूर्वक डाउनलोड भयो।');
  };

  // Calculate Security Health Score
  const securityScore = useMemo(() => {
    let score = 50; // base score
    // Inactivity timeout active
    if (inactivityTimeoutMinutes > 0) score += 20;
    // Privacy masking enabled
    if (isPrivacyMasked) score += 15;
    // Users password health
    const weakUsers = users.filter(
      (u) =>
        u.password === 'admin123' ||
        u.password === 'account123' ||
        u.password === 'viewer123'
    );
    if (weakUsers.length === 0) score += 15;
    return Math.min(100, score);
  }, [inactivityTimeoutMinutes, isPrivacyMasked, users]);

  // Filtered Audit Logs
  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const matchCategory =
        selectedCategory === 'ALL' || log.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        log.description.toLowerCase().includes(q) ||
        log.username.toLowerCase().includes(q) ||
        log.actionTitleNepali.toLowerCase().includes(q) ||
        (log.details && log.details.toLowerCase().includes(q));
      return matchCategory && matchSearch;
    });
  }, [auditLogs, selectedCategory, searchQuery]);

  return (
    <div className="space-y-6">
      {/* 1. Security Overview Header & Health Score */}
      <div className="bg-gradient-to-br from-[#f6f9f4] to-[#edf4e8] border border-[#cbdcc6] rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#4B6043] text-white flex items-center justify-center shadow-md shadow-[#4B6043]/20 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-[#24331C]">
                सुरक्षा तथा गोपनीयता व्यवस्थापन केन्द्र (Security & Privacy Center)
              </h3>
              <p className="text-xs text-[#526b48] mt-0.5 max-w-2xl">
                कर्मचारी व्यक्तिगत विवरण (PII), वित्तीय तलब तथ्यांक, अडिट लग र खाता सुरक्षाका नियमहरू यहाँबाट नियन्त्रण गर्नुहोस्।
              </p>
            </div>
          </div>

          {/* Health Score Pill */}
          <div className="bg-white border border-[#cadac4] rounded-2xl p-3.5 flex items-center gap-4 shrink-0 shadow-xs">
            <div className="text-right">
              <span className="text-[11px] font-bold text-gray-400 block">सुरक्षा स्कोर</span>
              <span
                className={`text-xl font-black ${
                  securityScore >= 80
                    ? 'text-emerald-700'
                    : securityScore >= 60
                    ? 'text-amber-600'
                    : 'text-red-600'
                }`}
              >
                {toNepaliDigits(securityScore)}%
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#eef5eb] flex items-center justify-center text-[#4B6043]">
              <Activity className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Security Feature Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Quick Screen Lock & Inactivity Timeout */}
        <div className="bg-white border border-[#cbdcc6] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#eef4ea] text-[#4B6043] flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-[#24331C]">
                  सेसन निष्क्रियता तथा स्क्रिन लक (Session Security)
                </h4>
              </div>
              <button
                onClick={lockScreen}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4B6043] hover:bg-[#3b4e33] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                title="तपाईं कम्प्युटरबाट उठ्दा तत्काल स्क्रिन सुरक्षित गर्न क्लिक गर्नुहोस्"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>अहिले लक गर्नुहोस्</span>
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              कार्यालयमा कम्प्युटर खुला छाड्दा अनधिकृत व्यक्तिबाट विवरण सुरक्षित राख्न स्वचालित निष्क्रियता टाइमआउट तय गर्नुहोस्।
            </p>

            <div className="bg-[#f8faf6] border border-[#d6e3d2] rounded-xl p-3">
              <label className="block text-xs font-bold text-[#24331C] mb-1.5">
                स्वचालित स्क्रिन लक समय (Auto Inactivity Timeout):
              </label>
              <select
                value={inactivityTimeoutMinutes}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setInactivityTimeoutMinutes(val);
                  addToast(
                    'success',
                    'सेटिङ सुरक्षित भयो',
                    val === 0
                      ? 'स्वचालित लक बन्द गरिएको छ।'
                      : `निष्क्रियता समय ${val} मिनेट सेट गरियो।`
                  );
                }}
                className="w-full bg-white border border-[#cadac4] rounded-lg px-3 py-2 text-xs font-medium text-[#24331C] focus:ring-2 focus:ring-[#4B6043] focus:outline-none cursor-pointer"
              >
                <option value={5}>५ मिनेट (अत्यन्त कडा सुरक्षा)</option>
                <option value={15}>१५ मिनेट (सिफारिस गरिएको)</option>
                <option value={30}>३० मिनेट (मानक)</option>
                <option value={60}>६० मिनेट (१ घण्टा)</option>
                <option value={0}>बन्द (निष्क्रियता लक नगर्ने)</option>
              </select>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
            <span>अनलक विधि: खाता पासवर्ड वा ४-अंकको सुरक्षा पिन</span>
            <span className="font-semibold text-emerald-700">AES/SHA सक्रिय</span>
          </div>
        </div>

        {/* PII & Data Masking (Privacy Mode) */}
        <div className="bg-white border border-[#cbdcc6] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#eef4ea] text-[#4B6043] flex items-center justify-center">
                  {isPrivacyMasked ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </div>
                <h4 className="text-sm font-bold text-[#24331C]">
                  गोपनीयता मोड (Sensitive Data Masking)
                </h4>
              </div>
              <button
                onClick={togglePrivacyMasking}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 ${
                  isPrivacyMasked
                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {isPrivacyMasked ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{isPrivacyMasked ? 'मास्किङ चालु छ' : 'मास्किङ बन्द छ'}</span>
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              कर्मचारीहरूको बैंक खाता नं., नागरिकता नं. र प्यान नं. जस्ता संवेदनशील व्यक्तिगत विवरणहरू स्क्रिनमा लुकाउनुहोस् (उदा: •••• •••• १२३४)।
            </p>

            <div className="bg-[#f8faf6] border border-[#d6e3d2] rounded-xl p-3 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 font-medium">बैंक खाता नम्बर:</span>
                <span className="font-mono font-bold text-[#24331C]">
                  {isPrivacyMasked ? '•••• •••• ६७८९' : '०१२३४५६७८९'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 font-medium">नागरिकता नम्बर:</span>
                <span className="font-mono font-bold text-[#24331C]">
                  {isPrivacyMasked ? '••••••••-२३४५' : '२७-०१-७८-१२३४५'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 font-medium">स्थायी लेखा नम्बर (PAN):</span>
                <span className="font-mono font-bold text-[#24331C]">
                  {isPrivacyMasked ? '••••••७८९' : '१२३४५६७८९'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
            <span>सार्वजनिक ठाउँ वा प्रोजेक्टरमा प्रयोग गर्दा उपयुक्त</span>
            <span className="text-emerald-700 font-semibold">PII संरक्षण</span>
          </div>
        </div>
      </div>

      {/* 3. Security Audit Trail Section */}
      <div className="bg-white border border-[#cbdcc6] rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-gray-100">
          <div>
            <h4 className="text-sm sm:text-base font-bold text-[#24331C] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#4B6043]" />
              <span>सुरक्षा एवं अडिट लग (Security & Activity Audit Trail)</span>
            </h4>
            <p className="text-xs text-gray-500 mt-0.5">
              प्रणालीमा भएका लगइन, डाटा परिवर्तन, पासवर्ड रिसेट र संवेदनशील कार्यहरूको आधिकारिक अभिलेख
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={refreshLogs}
              className="p-2 border border-[#cadac4] hover:bg-[#eef4ea] rounded-xl text-xs font-semibold text-[#24331C] transition-colors cursor-pointer"
              title="रिफ्रेस गर्नुहोस्"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleExportLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4B6043] hover:bg-[#3d5137] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="लग JSON फाइलको रूपमा डाउनलोड गर्नुहोस्"
            >
              <Download className="w-3.5 h-3.5" />
              <span>लग डाउनलोड</span>
            </button>
            {hasPermission('MANAGE_SETTINGS') && (
              <button
                onClick={handleClearLogs}
                className="p-2 border border-red-200 hover:bg-red-50 text-red-600 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                title="सबै लग मेट्नुहोस्"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="प्रयोगकर्ता, कार्य वा विवरण खोजी गर्नुहोस्..."
              className="w-full pl-9 pr-3 py-2 bg-[#f8faf6] border border-[#cadac4] rounded-xl text-xs focus:ring-2 focus:ring-[#4B6043] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-[#f8faf6] border border-[#cadac4] rounded-xl px-3 py-2 text-xs font-medium text-[#24331C] focus:ring-2 focus:ring-[#4B6043] focus:outline-none cursor-pointer"
            >
              <option value="ALL">सबै श्रेणी (All)</option>
              <option value="AUTH">प्रमाणीकरण (Auth)</option>
              <option value="USER_MGMT">प्रयोगकर्ता (User Mgmt)</option>
              <option value="DATA_CHANGE">डाटा परिवर्तन (Data Change)</option>
              <option value="SECURITY">सुरक्षा (Security)</option>
              <option value="SYSTEM">प्रणाली (System)</option>
            </select>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="overflow-x-auto border border-[#cadac4] rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#f4f8f1] border-b border-[#cadac4] text-[#24331C] font-bold">
                <th className="p-2.5 w-12 text-center">क्र.सं.</th>
                <th className="p-2.5 w-36">समय</th>
                <th className="p-2.5 w-40">कार्य (Action)</th>
                <th className="p-2.5 w-32">प्रयोगकर्ता</th>
                <th className="p-2.5">विवरण</th>
                <th className="p-2.5 w-24 text-center">स्थिति</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-400">
                    कुनै अडिट लग भेटिएन।
                  </td>
                </tr>
              ) : (
                filteredLogs.slice(0, 100).map((log, idx) => (
                  <tr key={log.id} className="hover:bg-[#fbfdfa] transition-colors">
                    <td className="p-2.5 text-center text-gray-400 font-mono">
                      {toNepaliDigits(idx + 1)}
                    </td>
                    <td className="p-2.5 font-mono text-[11px] text-gray-600">
                      {log.nepaliTimestamp || new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="p-2.5 font-semibold text-[#24331C]">
                      {log.actionTitleNepali}
                    </td>
                    <td className="p-2.5">
                      <span className="font-medium text-[#24331C]">{log.username}</span>
                      <span className="text-[10px] text-gray-400 block font-mono">
                        {log.userRole}
                      </span>
                    </td>
                    <td className="p-2.5 text-gray-700 max-w-xs truncate" title={log.description}>
                      {log.description}
                      {log.details && (
                        <span className="block text-[10px] text-gray-400 truncate">
                          {log.details}
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.status === 'SUCCESS'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.status === 'WARNING'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {log.status === 'SUCCESS'
                          ? 'सफल'
                          : log.status === 'WARNING'
                          ? 'चेतावनी'
                          : 'असफल'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-gray-400 mt-2 text-right">
          जम्मा लग प्रविष्टिहरू: {toNepaliDigits(filteredLogs.length)} वटा
        </p>
      </div>
    </div>
  );
};
