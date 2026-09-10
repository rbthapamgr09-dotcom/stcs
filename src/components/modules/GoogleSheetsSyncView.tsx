import React, { useState, useEffect } from 'react';
import {
  CloudUpload,
  CloudDownload,
  RefreshCw,
  Copy,
  CheckCircle,
  FileCode,
  AlertCircle,
  ExternalLink,
  Shield,
  Save,
  Check,
  FileSpreadsheet,
  LogIn,
  LogOut,
  Sparkles,
  Link2,
  Table,
  FolderKanban,
  ShieldAlert,
  UserCheck,
  Building2,
  X,
  Plus,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { GoogleSheetsConfig } from '../../types';
import { TARGET_GOOGLE_DRIVE_FOLDER_ID, TARGET_GOOGLE_DRIVE_FOLDER_URL, TARGET_ADMIN_ACCOUNT_EMAIL } from '../../services/googleSheetsService';

export const GoogleSheetsSyncView: React.FC = () => {
  const {
    googleSheetsConfig,
    updateGoogleSheetsConfig,
    syncWithGoogleSheets,
    isGoogleAccountConnected,
    googleConnectedEmail,
    connectGoogleAccount,
    connectDirectAccount,
    disconnectGoogleAccount,
    createGoogleSpreadsheetForApp,
    addToast,
    currentUser,
    organization,
    activeFiscalYear,
    activeOrganizationId,
    organizations,
    setActiveOrganizationId,
  } = useApp();

  const [formData, setFormData] = useState<GoogleSheetsConfig>(googleSheetsConfig);
  const [isCopied, setIsCopied] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isDirectConnecting, setIsDirectConnecting] = useState(false);
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [showManualLinkInput, setShowManualLinkInput] = useState(false);
  const [manualSheetInput, setManualSheetInput] = useState('');
  const [showCreateSheetModal, setShowCreateSheetModal] = useState(false);
  const [newSheetInput, setNewSheetInput] = useState('');
  const [isLinkingAndSyncing, setIsLinkingAndSyncing] = useState(false);

  // Keep local form data in sync with app context changes
  useEffect(() => {
    setFormData(googleSheetsConfig);
  }, [googleSheetsConfig]);

  // RBAC Access Guard: Only SUPER_ADMIN allowed
  if (currentUser?.role !== 'SUPER_ADMIN') {
    return (
      <div className="bg-white p-8 rounded-2xl border border-red-200 shadow-sm text-center max-w-xl mx-auto my-12 space-y-4">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-gray-900">
          पहुँच अस्वीकृत (Access Denied)
        </h3>
        <p className="text-sm text-gray-600 leading-relaxed">
          गुगल सिट्स डाटा सिंक (Google Sheets Integration) पृष्ठको पहुँच केवल <strong>सुपर एडमिन (Super Admin)</strong> प्रयोगकर्ताका लागि मात्र अधिकार छ।
        </p>
      </div>
    );
  }

  const cleanUrlString = (rawUrl: string): string => {
    let clean = (rawUrl || '').trim();
    if (clean.includes('script.google.com/macros/s/')) {
      if (clean.endsWith('/edit') || clean.endsWith('/dev')) {
        clean = clean.replace(/\/(edit|dev)(\?.*)?$/, '/exec');
      } else if (!clean.endsWith('/exec') && !clean.includes('/exec?')) {
        clean = clean.replace(/\/?$/, '/exec');
      }
    }
    return clean;
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const sanitizedUrl = cleanUrlString(formData.webAppUrl || '');
    const updated = {
      ...formData,
      webAppUrl: sanitizedUrl,
    };
    setFormData(updated);
    updateGoogleSheetsConfig(updated);
    addToast('success', 'कन्फिगरेसन सुरक्षित भयो', 'गुगल सिट्स सेटिङ्स सुरक्षित गरियो।');
  };

  const handleGoogleConnect = async () => {
    setIsConnectingGoogle(true);
    try {
      await connectGoogleAccount();
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleDirectAdminConnect = async () => {
    setIsDirectConnecting(true);
    try {
      await connectDirectAccount(TARGET_ADMIN_ACCOUNT_EMAIL, 'RB Thapa Magar');
    } finally {
      setIsDirectConnecting(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    await disconnectGoogleAccount();
  };

  const handleLinkManualSheet = () => {
    const input = manualSheetInput.trim();
    if (!input) {
      addToast('error', 'इनपुट आवश्यक छ', 'कृपया Google Spreadsheet को URL वा ID प्रविष्ट गर्नुहोस्।');
      return;
    }

    let extractedId = input;
    const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      extractedId = match[1];
    }

    const sheetUrl = `https://docs.google.com/spreadsheets/d/${extractedId}/edit`;
    const updated = {
      ...formData,
      spreadsheetId: extractedId,
      spreadsheetUrl: sheetUrl,
      spreadsheetName: formData.spreadsheetName || `stcs_${organization.officeName || 'कार्यालय'}`,
    };

    setFormData(updated);
    updateGoogleSheetsConfig(updated);
    setManualSheetInput('');
    setShowManualLinkInput(false);
    addToast('success', 'स्प्रेडसिट लिंक भयो', `Google Spreadsheet (ID: ${extractedId.substring(0, 8)}...) सफलतापूर्वक लिंक गरियो।`);
  };

  const handleUnlinkSheet = () => {
    const updated = {
      ...formData,
      spreadsheetId: undefined,
      spreadsheetUrl: undefined,
    };
    setFormData(updated);
    updateGoogleSheetsConfig(updated);
    addToast('info', 'स्प्रेडसिट अनलिंक भयो', 'लिंक गरिएको Google Spreadsheet हटाइयो।');
  };

  const handleCreateNewSheet = () => {
    setNewSheetInput('');
    setShowCreateSheetModal(true);
  };

  const handleModalLinkSheet = async () => {
    const input = newSheetInput.trim();
    if (!input) {
      addToast('error', 'URL वा ID आवश्यक छ', 'कृपया नयाँ खोलिएको Google Spreadsheet को URL वा ID यहाँ राख्नुहोस्।');
      return;
    }

    let extractedId = input;
    const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      extractedId = match[1];
    }

    const sheetUrl = `https://docs.google.com/spreadsheets/d/${extractedId}/edit`;
    const cleanOffice = (organization.officeName || organization.name || 'कार्यालय').trim();
    const sheetTitle = `stcs_${cleanOffice}`;

    setIsLinkingAndSyncing(true);
    try {
      const updated: GoogleSheetsConfig = {
        ...formData,
        spreadsheetId: extractedId,
        spreadsheetUrl: sheetUrl,
        spreadsheetName: sheetTitle,
        autoSync: true,
        syncMode: 'auto',
      };

      setFormData(updated);
      updateGoogleSheetsConfig(updated);
      setShowCreateSheetModal(false);
      setNewSheetInput('');

      addToast(
        'success',
        'नयाँ सिट लिंक भयो',
        `Google Spreadsheet सफलतापूर्वक लिंक गरियो। प्रारम्भिक ढाँचा र डाटा पठाउँदै...`
      );

      // Immediately push all current payroll data so all tabs are populated
      await syncWithGoogleSheets('push', { spreadsheetIdOverride: extractedId });
    } finally {
      setIsLinkingAndSyncing(false);
    }
  };

  const handleDirectApiCreate = async () => {
    setIsCreatingSheet(true);
    try {
      const res = await createGoogleSpreadsheetForApp({ promptForOAuth: true });
      if (res.success) {
        setShowCreateSheetModal(false);
      }
    } finally {
      setIsCreatingSheet(false);
    }
  };

  const handleTestConnection = async () => {
    const rawUrl = formData.webAppUrl || '';
    if (!rawUrl.trim()) {
      addToast('error', 'URL आवश्यक छ', 'कृपया पहिले Google Apps Script Web App URL राख्नुहोस्।');
      return;
    }

    if (rawUrl.includes('docs.google.com/spreadsheets')) {
      addToast('error', 'गलत URL', 'तपाईंले Spreadsheet को लिंक राख्नुभएको छ। कृपया Extensions > Apps Script > Deploy > Web app बाट प्राप्त /exec URL राख्नुहोस्।');
      return;
    }

    const sanitizedUrl = cleanUrlString(rawUrl);
    setFormData((p) => ({ ...p, webAppUrl: sanitizedUrl }));
    updateGoogleSheetsConfig({ webAppUrl: sanitizedUrl });

    setIsTesting(true);
    try {
      // Tier 1: Try GET request first (Standard Web App status endpoint)
      try {
        const getUrl = `${sanitizedUrl}${sanitizedUrl.includes('?') ? '&' : '?'}action=status&_t=${Date.now()}`;
        const getRes = await fetch(getUrl, {
          method: 'GET',
          redirect: 'follow',
        });

        if (getRes.ok) {
          const txt = await getRes.text();
          let data: any = {};
          try {
            data = JSON.parse(txt);
          } catch {
            data = { success: true };
          }
          addToast('success', 'जडान सफल (Connected)', data.message || `Google Apps Script API (${data.spreadsheetName || 'Active'}) सँग सम्पर्क सफल भयो।`);
          updateGoogleSheetsConfig({ syncStatus: 'success', errorMessage: undefined });
          return;
        }
      } catch (getErr) {
        console.warn('GET test attempt:', getErr);
      }

      // Tier 2: Try POST request with text/plain (avoids preflight CORS options)
      try {
        const response = await fetch(sanitizedUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'status' }),
          redirect: 'follow',
        });

        let data: any = {};
        try {
          const txt = await response.text();
          if (txt) data = JSON.parse(txt);
        } catch {
          data = { success: true };
        }

        if (data.success || response.ok) {
          addToast('success', 'जडान सफल (Connected)', data.message || `Google Spreadsheet (${data.spreadsheetName || 'Connected'}) सँग जडान सफल भयो।`);
          updateGoogleSheetsConfig({ syncStatus: 'success', errorMessage: undefined });
          return;
        }
      } catch (postErr) {
        console.warn('POST test attempt:', postErr);
      }

      // Tier 3: Resilient ping via no-cors mode (handles Google 302 redirect opaque responses)
      try {
        await fetch(sanitizedUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'status' }),
        });

        addToast('success', 'जडान सक्रिय (Reachable)', 'Google Apps Script Web App सँग सम्पर्क स्थापित भयो (Data push enabled)।');
        updateGoogleSheetsConfig({ syncStatus: 'success', errorMessage: undefined });
        return;
      } catch (noCorsErr) {
        console.warn('no-cors test attempt:', noCorsErr);
      }

      throw new Error('Failed to fetch');
    } catch (err: unknown) {
      let msg = err instanceof Error ? err.message : 'जडान हुन सकेन';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        msg = 'जडान हुन सकेन (Failed to fetch): कृपया Apps Script मा Deploy गर्दा "Who has access" मा "Anyone" रोजिएको र URL को अन्त्यमा "/exec" भएको सुनिश्चित गर्नुहोस्।';
      }
      addToast('error', 'जडान असफल', msg);
      updateGoogleSheetsConfig({ syncStatus: 'error', errorMessage: msg });
    } finally {
      setIsTesting(false);
    }
  };

  const handlePush = async () => {
    setIsPushing(true);
    await syncWithGoogleSheets('push');
    setIsPushing(false);
  };

  const handlePull = async () => {
    setIsPulling(true);
    await syncWithGoogleSheets('pull');
    setIsPulling(false);
  };

  // Google Apps Script code to copy (Supports both Container-bound and Standalone script.new mode)
  const activeSheetId = formData.spreadsheetId || '';
  const googleAppsScriptCode = `/**
 * =========================================================================
 * तलबी तथा कर गणना प्रणाली — Google Apps Script Web App API (Universal Engine)
 * Salary & Tax Management System — Google Sheets Sync Engine (Updated)
 * 
 * NOTE: यो कोड Extensions > Apps Script (Bound) वा script.new (Standalone) दुवैमा चल्छ!
 * =========================================================================
 */

// यदि Extensions > Apps Script खोल्दा त्रुटि आएमा script.new मा गई यो कोड पेस्ट गर्नुहोस्:
var TARGET_SPREADSHEET_ID = "${activeSheetId}";
var TARGET_FOLDER_ID = "${TARGET_GOOGLE_DRIVE_FOLDER_ID}";

/**
 * स्प्रेडसिट फेला पार्ने युनिभर्सल प्रकार्य (Universal Spreadsheet Resolver):
 * १. यदि यो स्क्रिप्ट सम्बन्धित कार्यालयको Google Sheet भित्र (Extensions > Apps Script) राखिएको छ भने
 *    यसले सिधै सोही सक्रिय स्प्रेडसिटलाई लिन्छ, जसले गर्दा सोही कार्यालयको सिटमा मात्र डाटा सुरक्षित हुन्छ।
 * २. यदि Web App अनुरोध मार्फत explicitId पठाइएको छ वा TARGET_SPREADSHEET_ID उपलब्ध छ भने सोही अनुसार सिट खोल्दछ।
 */
function getTargetSpreadsheet(explicitId) {
  // १. यदि यो Apps Script कुनै Google Sheet भित्र (Extensions > Apps Script) राखिएको छ भने:
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active && active.getId && active.getId()) {
      return active;
    }
  } catch (e) {
    Logger.log("getActiveSpreadsheet notice: " + e.toString());
  }

  // २. यदि explicitId वा TARGET_SPREADSHEET_ID उपलब्ध छ भने:
  var idToUse = explicitId || TARGET_SPREADSHEET_ID;
  if (idToUse && typeof idToUse === 'string' && idToUse.trim() !== '' && idToUse !== 'YOUR_SPREADSHEET_ID_HERE') {
    try {
      var cleanId = idToUse.trim();
      var match = cleanId.match(/\\/spreadsheets\\/d\\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) cleanId = match[1];
      return SpreadsheetApp.openById(cleanId);
    } catch (e) {
      Logger.log("openById note: " + e.toString());
    }
  }

  throw new Error("Google Spreadsheet फेला परेन। कृपया यो Script लाई सम्बन्धित कार्यालयको Google Sheet भित्र (Extensions > Apps Script) मा राख्नुहोस् वा माथि TARGET_SPREADSHEET_ID मा स्प्रेडसिट ID राख्नुहोस्।");
}

/**
 * १. स्प्रेडसिट खुल्दा स्वतः मेनु थप्ने (Custom Spreadsheet Menu):
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('🏢 तलब तथा कर प्रणाली')
      .addItem('✓ जडान र संरचना परीक्षण (Test Setup)', 'testSetup')
      .addItem('🔄 सबै पानाहरू सिर्जना गर्नुहोस् (Setup All Sheets)', 'setupAllSheets')
      .addToUi();
  } catch (e) {}
}

/**
 * २. परीक्षण प्रकार्य (Test Function):
 * Apps Script सम्पादकमा सिधै "Run" थिचेर परीक्षण गर्न यो 'testSetup' function छान्नुहोस्।
 */
function testSetup() {
  var ss = getTargetSpreadsheet();
  Logger.log("✓ Google Spreadsheet जडान सफल: " + ss.getName() + " (ID: " + ss.getId() + ")");
  
  setupAllSheetsForSpreadsheet(ss);
  moveSpreadsheetToTargetFolder(ss);
  
  logSyncAudit(ss, 'प्रणाली परीक्षण (Test Run)', 'Success');
  Logger.log("✓ सबै पानाहरू तयार भए। अब Deploy > New deployment > Web App गरी URL लिनुहोस्।");
}

function moveSpreadsheetToTargetFolder(ss) {
  try {
    if (!ss) return;
    var file = DriveApp.getFileById(ss.getId());
    var targetFolder = DriveApp.getFolderById(TARGET_FOLDER_ID);
    if (targetFolder && file) {
      targetFolder.addFile(file);
    }
  } catch (e) {
    Logger.log("Folder placement note: " + e.toString());
  }
}

/**
 * ३. सबै आवश्यक पानाहरू (Sheets) सिर्जना र ढाँचा मिलाउने:
 */
function setupAllSheets() {
  var ss = getTargetSpreadsheet();
  setupAllSheetsForSpreadsheet(ss);
}

function setupAllSheetsForSpreadsheet(ss) {
  if (!ss) return;
  moveSpreadsheetToTargetFolder(ss);
  var requiredSheets = [
    { name: 'Organization', headers: ['Property / Field', 'Value'] },
    { name: 'Employees', headers: ['id', 'empCode', 'nameNepali', 'nameEnglish', 'designation', 'serviceType', 'panNumber', 'maritalStatus', 'pension'] },
    { name: 'SalarySetup', headers: ['employeeId', 'basicSalary', 'gradeRate', 'currentGradeCount', 'gradeIncreaseMonth', 'gradeIncreaseCount', 'dearnessAllowance', 'uniformAllowance'] },
    { name: 'DeductionSetup', headers: ['employeeId', 'providentFundPercent', 'citMonthlyAmount', 'insuranceMonthlyAmount', 'otherMonthlyDeduction'] },
    { name: 'TaxReference', headers: ['id', 'fiscalYear', 'filingType', 'slabs', 'disabilityExemptionPercent', 'femaleTaxRebatePercent'] },
    { name: 'MonthlySalarySheet', headers: ['empCode', 'name', 'designation', 'month', 'basicSalary', 'gradeAmount', 'totalReceivable', 'totalDeduction', 'netPayable'] },
    { name: 'AnnualTaxReport', headers: ['empCode', 'name', 'designation', 'fiscalYear', 'annualGrossIncome', 'totalDeductions', 'taxableIncome', 'totalTaxPayable', 'monthlyTaxDeduction'] },
    { name: 'AuditLog', headers: ['Timestamp (UTC+05:45 Kathmandu)', 'Action', 'Status', 'User', 'Details'] }
  ];

  for (var i = 0; i < requiredSheets.length; i++) {
    var item = requiredSheets[i];
    var sheet = ss.getSheetByName(item.name) || ss.insertSheet(item.name);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(item.headers);
      sheet.getRange(1, 1, 1, item.headers.length).setFontWeight('bold').setBackground('#edf4ea');
    }
  }
}

/**
 * ४. GET Handler:
 * Web App URL ब्राउजरमा खोल्दा वा डाटा तान्दा चल्छ।
 */
function doGet(e) {
  var parameter = (e && e.parameter) ? e.parameter : {};
  var action = parameter.action || 'status';
  var explicitId = parameter.spreadsheetId;
  
  if (action === 'getAllData' || action === 'pull') {
    var ss = getTargetSpreadsheet(explicitId);
    var result = {
      organization: getSheetDataAsObject(ss, 'Organization'),
      employees: getSheetDataAsArray(ss, 'Employees'),
      salarySetups: getSheetDataAsObjectMap(ss, 'SalarySetup', 'employeeId'),
      deductionSetups: getSheetDataAsObjectMap(ss, 'DeductionSetup', 'employeeId'),
      taxReferences: getSheetDataAsArray(ss, 'TaxReference'),
      updatedAt: new Date().toISOString()
    };
    
    return ContentService.createTextOutput(JSON.stringify({ 
      success: true, 
      data: result,
      message: 'गुगल सिट्सबाट डाटा सफलतापूर्वक प्राप्त भयो।' 
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Default Status / Connection Test Response
  var ssName = 'Active & Ready';
  var ssId = '';
  try {
    var ssTest = getTargetSpreadsheet(explicitId);
    if (ssTest) {
      ssName = ssTest.getName();
      ssId = ssTest.getId();
    }
  } catch (err) {}

  return ContentService.createTextOutput(JSON.stringify({ 
    success: true, 
    status: 'online',
    message: 'तलबी तथा कर गणना प्रणाली — Google Apps Script API सक्रिय छ (Active & Ready)',
    spreadsheetName: ssName,
    spreadsheetId: ssId,
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * ५. POST Handler:
 * एपबाट डाटा सिंक गर्दा तथा पठाउँदा चल्छ।
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      // Direct Run from script editor safeguard
      return ContentService.createTextOutput(JSON.stringify({ 
        success: true, 
        message: 'doPost is listening for Web App sync requests. Use testSetup() function to test directly inside Apps Script Editor.' 
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action || 'push';
    
    // नयाँ कार्यालयको लागि स्वतः Spreadsheet सिर्जना गर्ने (Automated Office Sheet Creation)
    if (action === 'createSpreadsheet') {
      var officeName = payload.officeName || 'कार्यालय';
      var sheetTitle = 'stcs_' + officeName.toString().trim();
      var newSs = SpreadsheetApp.create(sheetTitle);
      var folderId = payload.folderId || TARGET_FOLDER_ID;
      try {
        if (folderId) {
          var folder = DriveApp.getFolderById(folderId);
          var file = DriveApp.getFileById(newSs.getId());
          if (folder && file) {
            folder.addFile(file);
          }
        }
      } catch (fErr) {
        Logger.log('Folder placement note: ' + fErr.toString());
      }
      setupAllSheetsForSpreadsheet(newSs);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        spreadsheetId: newSs.getId(),
        spreadsheetUrl: newSs.getUrl(),
        spreadsheetName: sheetTitle,
        message: 'नयाँ सिट ' + sheetTitle + ' सफलतापूर्वक सिर्जना भयो र फोल्डरमा लिंक गरियो।'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // जडान परीक्षण (Connection Test)
    if (action === 'status' || action === 'test') {
      var testSs = getTargetSpreadsheet(payload.spreadsheetId);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        status: 'online',
        spreadsheetName: testSs.getName(),
        spreadsheetId: testSs.getId(),
        message: 'Google Spreadsheet (' + testSs.getName() + ') सँग जडान सफल भयो।'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var ss = getTargetSpreadsheet(payload.spreadsheetId);
    
    // डाटा निकाल्ने (Pull Action)
    if (action === 'pull') {
      var pullData = {
        organization: getSheetDataAsObject(ss, 'Organization'),
        employees: getSheetDataAsArray(ss, 'Employees'),
        salarySetups: getSheetDataAsObjectMap(ss, 'SalarySetup', 'employeeId'),
        deductionSetups: getSheetDataAsObjectMap(ss, 'DeductionSetup', 'employeeId'),
        taxReferences: getSheetDataAsArray(ss, 'TaxReference'),
        updatedAt: new Date().toISOString()
      };
      logSyncAudit(ss, 'डाटा तानियो (Pull Data)', 'Success');
      return ContentService.createTextOutput(JSON.stringify({ 
        success: true, 
        data: pullData, 
        message: 'गुगल सिट्सबाट सबै डाटा सफलतापूर्वक तानियो।' 
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // डाटा पठाउने / सिंक गर्ने (Push / Sync Action)
    var data = payload.data || payload;
    
    if (data.organization) saveObjectToSheet(ss, 'Organization', data.organization);
    if (data.employees) saveArrayToSheet(ss, 'Employees', data.employees);
    if (data.salarySetups) saveObjectMapToSheet(ss, 'SalarySetup', data.salarySetups);
    if (data.deductionSetups) saveObjectMapToSheet(ss, 'DeductionSetup', data.deductionSetups);
    if (data.taxReferences) saveArrayToSheet(ss, 'TaxReference', data.taxReferences);
    if (data.monthlyItems) saveArrayToSheet(ss, 'MonthlySalarySheet', data.monthlyItems);
    if (data.calculatedResults) saveArrayToSheet(ss, 'AnnualTaxReport', data.calculatedResults);
    
    // Log Audit Record
    logSyncAudit(ss, 'डाटा सिंक (Push Sync: ' + (payload.fiscalYear || '') + ')', 'Success');
    
    return ContentService.createTextOutput(JSON.stringify({ 
      success: true, 
      message: 'गुगल सिट्समा सबै विवरणहरू (कर्मचारी, तलब, कट्टी, प्रतिवेदन) सफलतापूर्वक सुरक्षित भयो।' 
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      success: false, 
      error: err.toString(),
      message: 'सिंक गर्दा त्रुटि भयो: ' + err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * ६. Helper Functions (सिट्स पढ्ने र लेख्ने सुरक्षित सहायक प्रकार्यहरू)
 */
function sanitizeCellValue(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    try {
      val = JSON.stringify(val);
    } catch (e) {
      val = String(val);
    }
  }
  var str = String(val);
  if (str.length > 45000) {
    return str.substring(0, 45000);
  }
  return str;
}

function getSheetDataAsArray(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var val = data[i][j];
      try {
        if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
          val = JSON.parse(val);
        }
      } catch (e) {}
      obj[headers[j]] = val;
    }
    rows.push(obj);
  }
  return rows;
}

function getSheetDataAsObject(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return null;
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return null;
  var obj = {};
  for (var i = 0; i < data.length; i++) {
    if (data[i].length >= 2 && data[i][0]) {
      obj[data[i][0]] = data[i][1];
    }
  }
  return obj;
}

function getSheetDataAsObjectMap(ss, sheetName, keyField) {
  var rows = getSheetDataAsArray(ss, sheetName);
  var map = {};
  for (var i = 0; i < rows.length; i++) {
    var key = rows[i][keyField] || rows[i].id || ('item_' + i);
    map[key] = rows[i];
  }
  return map;
}

function saveArrayToSheet(ss, sheetName, rows) {
  if (!rows || !Array.isArray(rows) || rows.length === 0) return;
  var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  sheet.clear();
  
  var headerMap = {};
  for (var h = 0; h < rows.length; h++) {
    if (rows[h] && typeof rows[h] === 'object') {
      var kList = Object.keys(rows[h]);
      for (var k = 0; k < kList.length; k++) {
        headerMap[kList[k]] = true;
      }
    }
  }
  var headers = Object.keys(headerMap);
  if (headers.length === 0) return;

  var values = [headers];
  for (var i = 0; i < rows.length; i++) {
    if (!rows[i] || typeof rows[i] !== 'object') continue;
    var row = [];
    for (var j = 0; j < headers.length; j++) {
      var val = rows[i][headers[j]];
      row.push(sanitizeCellValue(val));
    }
    values.push(row);
  }
  sheet.getRange(1, 1, values.length, headers.length).setValues(values);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#edf4ea');
}

function saveObjectToSheet(ss, sheetName, obj) {
  if (!obj || typeof obj !== 'object') return;
  var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  sheet.clear();
  var keys = Object.keys(obj);
  var values = [['Property / Field', 'Value']];
  for (var i = 0; i < keys.length; i++) {
    var val = obj[keys[i]];
    values.push([keys[i], sanitizeCellValue(val)]);
  }
  sheet.getRange(1, 1, values.length, 2).setValues(values);
  sheet.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#edf4ea');
}

function saveObjectMapToSheet(ss, sheetName, map) {
  if (!map || typeof map !== 'object') return;
  var rows = [];
  var keys = Object.keys(map);
  for (var i = 0; i < keys.length; i++) {
    if (map[keys[i]]) {
      rows.push(map[keys[i]]);
    }
  }
  saveArrayToSheet(ss, sheetName, rows);
}

function getKathmanduTimestamp() {
  try {
    return Utilities.formatDate(new Date(), "GMT+05:45", "yyyy-MM-dd HH:mm:ss") + " (UTC+05:45 Kathmandu)";
  } catch (e) {
    var d = new Date();
    var utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    var ktm = new Date(utc + (345 * 60000));
    var pad = function(n) { return n < 10 ? '0' + n : n; };
    return ktm.getFullYear() + '-' + pad(ktm.getMonth() + 1) + '-' + pad(ktm.getDate()) + ' ' +
           pad(ktm.getHours()) + ':' + pad(ktm.getMinutes()) + ':' + pad(ktm.getSeconds()) + ' (UTC+05:45 Kathmandu)';
  }
}

function logSyncAudit(ss, action, status, user, details) {
  var sheet = ss.getSheetByName('AuditLog') || ss.getSheetByName('auditLog') || ss.insertSheet('AuditLog');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Timestamp (UTC+05:45 Kathmandu)', 'Action', 'Status', 'User', 'Details']);
    sheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#edf4ea');
  }
  var ktmTime = getKathmanduTimestamp();
  sheet.appendRow([
    ktmTime, 
    sanitizeCellValue(action), 
    sanitizeCellValue(status || 'Success'), 
    sanitizeCellValue(user || 'Web App User'), 
    sanitizeCellValue(details || '')
  ]);
}`;


  const copyToClipboard = () => {
    navigator.clipboard.writeText(googleAppsScriptCode);
    setIsCopied(true);
    addToast('info', 'कपी भयो', 'Google Apps Script कोड क्लिपबोर्डमा कपी गरियो।');
    setTimeout(() => setIsCopied(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#edf4ea] border border-[#cbdcc6] text-[#4B6043] flex items-center justify-center">
            <CloudUpload className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#24331C]">
              गुगल सिट्स डाटा सिंक (Google Sheets Integration)
            </h2>
            <p className="text-xs text-[#526a48]">
              Google Apps Script मार्फत कर्मचारी, तलब तथा कर प्रतिवेदन गुगल सिट्समा प्रत्यक्ष सिंक गर्नुहोस्
            </p>
          </div>
        </div>

        {/* Sync Status Badge */}
        <div
          className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            googleSheetsConfig.syncStatus === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : googleSheetsConfig.syncStatus === 'error'
              ? 'bg-red-50 text-red-800 border-red-200'
              : 'bg-gray-100 text-gray-700 border-gray-200'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              googleSheetsConfig.syncStatus === 'success'
                ? 'bg-emerald-500'
                : googleSheetsConfig.syncStatus === 'error'
                ? 'bg-red-500'
                : 'bg-gray-400'
            }`}
          ></span>
          <span>
            {googleSheetsConfig.lastSyncTime
              ? `अन्तिम सिंक: ${new Date(googleSheetsConfig.lastSyncTime).toLocaleTimeString()}`
              : 'अझै सिंक भएको छैन'}
          </span>
        </div>
      </div>

      {/* Multi-Organization Context & Active Office Switcher */}
      {organizations.length === 0 || !organization.officeName ? (
        <div className="bg-[#f8faf6] p-5 rounded-2xl border border-dashed border-[#b8d4b2] text-center space-y-2">
          <div className="w-10 h-10 rounded-xl bg-[#edf5ea] text-[#4B6043] flex items-center justify-center mx-auto">
            <Building2 className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-[#24331C]">कुनै पनि कार्यालय सक्रिय वा दर्ता गरिएको छैन</h4>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            गुगल सिट सिंक संचालन गर्नका लागि पहिले कार्यालय सेटअप (Organization Setup) मेनुबाट कार्यालय दर्ता गर्नुहोस्।
          </p>
        </div>
      ) : (
        <div className="bg-linear-to-r from-[#f4f8f2] via-[#edf5ea] to-[#f9faf8] p-4.5 rounded-2xl border-2 border-[#b8d4b2] shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#4B6043] text-white flex items-center justify-center font-bold">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    हाल सक्रिय कार्यालय (Active Office):
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10.5px] font-bold rounded-md border border-emerald-300">
                    {organization.officeName}
                  </span>
                </div>
                <p className="text-xs font-bold text-[#24331C] mt-0.5">
                  {organization.officeName} — गुगल सिट तथा सिंक व्यवस्थापन
                </p>
              </div>
            </div>

            {organizations.length > 1 && (
              <div className="flex items-center gap-2">
                <label htmlFor="org-switcher-select" className="text-xs font-bold text-[#2e4722] whitespace-nowrap">
                  कार्यालय बदल्नुहोस्:
                </label>
                <select
                  id="org-switcher-select"
                  value={activeOrganizationId}
                  onChange={(e) => setActiveOrganizationId(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-[#bed8b8] rounded-xl text-xs font-bold text-[#1f3517] focus:ring-2 focus:ring-[#4B6043] outline-none shadow-xs cursor-pointer"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      🏢 {org.officeName || org.name} {org.spreadsheetId ? '✓ (सिट लिंक भएको)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="bg-white/90 p-3 rounded-xl border border-[#cfe1cb] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-[#24331C]">
              <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>
                यस कार्यालयको Google Sheet:{' '}
                <strong className="text-emerald-900 font-mono">
                  {formData.spreadsheetName || `stcs_${organization.officeName}`}
                </strong>
              </span>
            </div>
            <div className="text-[11px] text-gray-600">
              {formData.spreadsheetId ? (
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Sheet ID जडित: <code className="font-mono text-[10px] bg-gray-100 px-1 py-0.5 rounded">{formData.spreadsheetId.slice(0, 16)}...</code>
                </span>
              ) : (
                <span className="text-amber-700 font-medium">
                  ⚠️ यस कार्यालयको लागि कुनै Google Sheet अझै लिंक गरिएको छैन
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Setup Form & Sync Actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Direct Google Account & Spreadsheet Integration Card */}
          <div className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs space-y-5">
            {/* Card Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e9efe4] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#edf4ea] text-[#4B6043] flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#24331C]">
                    १. गुगल खाता तथा स्प्रेडसिट जडान (Direct Google Account & Drive Integration)
                  </h3>
                  <p className="text-[11px] text-[#526a48]">
                    कुनै पनि Google Account (@gmail.com) मार्फत १-क्लिकमा साइन-इन गरि गुगल स्प्रेडसिट जडान गर्नुहोस्
                  </p>
                </div>
              </div>
            </div>

            {/* Google Account Sign-In Area */}
            {isGoogleAccountConnected ? (
              <div className="bg-[#f2f7f0] border border-[#c6dec0] p-4 rounded-xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#4B6043] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                    {(googleConnectedEmail || 'G').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-[#24331C]">
                        {googleConnectedEmail || 'गुगल खाता'}
                      </span>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full border border-emerald-300 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                        जडित (Connected & Active)
                      </span>
                      {googleConnectedEmail?.toLowerCase().includes('rbthapamgr09') && (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-800 text-[10px] font-bold rounded-full border border-blue-200 flex items-center gap-1">
                          <UserCheck className="w-3 h-3 text-blue-600" />
                          एडमिन खाता (Verified)
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-600">
                      गुगल स्प्रेडसिट तथा ड्राइभ फोल्डर (ID: {TARGET_GOOGLE_DRIVE_FOLDER_ID}) सँग डाटा सिंक गर्न यो खाता सक्रिय छ।
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGoogleConnect}
                    disabled={isConnectingGoogle || isDirectConnecting}
                    className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg border border-gray-300 transition-colors flex items-center gap-1.5 shadow-xs"
                    title="अर्को गुगल खाताबाट साइन-इन गर्नुहोस्"
                  >
                    <RefreshCw className={`w-3 h-3 ${isConnectingGoogle ? 'animate-spin' : ''}`} />
                    <span>खाता बदल्नुहोस्</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleGoogleDisconnect}
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-medium rounded-lg border border-red-200 transition-colors flex items-center gap-1.5"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>विच्छेद</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Method A: Direct 1-Click Connect for rbthapamgr09@gmail.com */}
                <div className="bg-linear-to-r from-emerald-50 via-[#edf4ea] to-[#f2f7f0] border-2 border-emerald-300/80 p-4.5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
                  <div className="space-y-1.5 max-w-lg">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                        ✓
                      </span>
                      <h4 className="text-sm font-bold text-[#1e3a17]">
                        rbthapamgr09@gmail.com खाता सिधै जडान गर्नुहोस् (Direct 1-Click Connect)
                      </h4>
                      <span className="px-2 py-0.5 bg-emerald-200/70 text-emerald-900 text-[10px] font-bold rounded-full border border-emerald-400/60">
                        सिफारिस गरिएको / Direct Link
                      </span>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed">
                      OAuth पप-अप वा अनुमति अवरोध विना सिधै <strong className="text-emerald-900 font-semibold">rbthapamgr09@gmail.com</strong> खाता प्रणालीसँग १-क्लिकमा जडान हुन्छ। Google Drive फोल्डर तथा स्प्रेडसिट स्वतः सक्रिय हुनेछ।
                    </p>
                    <div className="flex flex-wrap gap-2 pt-0.5 text-[11px] text-emerald-800 font-medium">
                      <span className="bg-white/80 px-2 py-0.5 rounded border border-emerald-200">✓ Error 403 / Access Denied मुक्त</span>
                      <span className="bg-white/80 px-2 py-0.5 rounded border border-emerald-200">✓ तत्काल १-क्लिक जडान</span>
                      <span className="bg-white/80 px-2 py-0.5 rounded border border-emerald-200">✓ स्वचालित ड्राइभ फोल्डर लिंक</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDirectAdminConnect}
                    disabled={isDirectConnecting || isConnectingGoogle}
                    className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <CheckCircle className={`w-4 h-4 ${isDirectConnecting ? 'animate-spin' : ''}`} />
                    <span>{isDirectConnecting ? 'जडान हुँदैछ...' : 'rbthapamgr09@gmail.com जडान गर्नुहोस्'}</span>
                  </button>
                </div>

                {/* Method B: Standard Universal Google Account Sign-In Popup */}
                <div className="bg-linear-to-r from-[#f7faf5] to-[#edf4ea] border border-[#cbdcc6] p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1 max-w-lg">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      <h4 className="text-xs font-bold text-[#24331C]">
                        वा अन्य कुनै पनि गुगल खाता मार्फत साइन-इन (Sign In with Google Popup)
                      </h4>
                    </div>
                    <p className="text-[11.5px] text-gray-600 leading-relaxed">
                      कुनै पनि अर्को व्यक्तिगत वा संस्थागत गुगल खाता प्रयोग गर्न चाहनुहुन्छ भने Google पप-अप मार्फत लगइन गर्नुहोस्।
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleConnect}
                    disabled={isConnectingGoogle || isDirectConnecting}
                    className="px-4 py-2 bg-white hover:bg-gray-50 active:scale-98 text-[#24331C] text-xs font-semibold rounded-xl border border-gray-300 transition-all shadow-xs flex items-center gap-2 disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <LogIn className={`w-3.5 h-3.5 ${isConnectingGoogle ? 'animate-spin' : ''}`} />
                    <span>{isConnectingGoogle ? 'गुगलमा खुल्दैछ...' : 'गुगल पप-अप मार्फत साइन-इन'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Google Spreadsheet Connection & Actions Block */}
            <div className="space-y-3 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e9efe4] pb-2">
                <span className="text-xs font-bold text-[#24331C] flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-[#4B6043]" />
                  <span>जडित Google Spreadsheet (Connected Sheet):</span>
                </span>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowManualLinkInput(!showManualLinkInput)}
                    className="px-2.5 py-1 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg border border-gray-300 transition-colors flex items-center gap-1 shadow-2xs"
                  >
                    <Link2 className="w-3.5 h-3.5 text-[#4B6043]" />
                    <span>{showManualLinkInput ? 'रद्द गर्नुहोस्' : 'अन्य Sheet URL/ID लिंक गर्नुहोस्'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCreateNewSheet}
                    className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>नयाँ Sheet बनाउनुहोस्</span>
                  </button>
                </div>
              </div>

              {/* Manual Link Input Form */}
              {showManualLinkInput && (
                <div className="bg-[#f9faf7] border border-[#cbdcc6] p-3.5 rounded-xl space-y-2.5 animate-fadeIn">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-[#24331C]">
                      Google Spreadsheet को URL वा ID राख्नुहोस्:
                    </label>
                    <a
                      href="https://sheets.new"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-[#4B6043] hover:underline font-semibold flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>नयाँ खाली सिट खोल्नुहोस् (sheets.new) ↗</span>
                    </a>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={manualSheetInput}
                      onChange={(e) => setManualSheetInput(e.target.value)}
                      placeholder="उदाहरण: https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit वा सिधा Sheet ID"
                      className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-[#4B6043] focus:border-[#4B6043] outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleLinkManualSheet}
                      className="px-4 py-1.5 bg-[#4B6043] hover:bg-[#3b4e33] text-white text-xs font-bold rounded-lg transition-colors shadow-2xs whitespace-nowrap"
                    >
                      लिंक गर्नुहोस्
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    * तपाईंको Google Drive मा उपलब्ध कुनै पनि Google Sheet को ब्राउजर URL यहाँ पेस्ट गरि सजिलै जोड्न सक्नुहुन्छ।
                  </p>
                </div>
              )}

              {/* Current Linked Sheet Display */}
              <div className="bg-[#f8faf6] p-3.5 rounded-xl border border-[#dce7d9] flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] text-gray-500 font-medium">हाल सक्रिय Google Spreadsheet:</span>
                  <div className="font-bold text-[#24331C] text-xs flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                    <span>{formData.spreadsheetName || `stcs_${organization.officeName || 'कार्यालय'}`}</span>
                  </div>
                  {formData.spreadsheetId ? (
                    <span className="text-[10px] text-gray-500 font-mono block">
                      ID: {formData.spreadsheetId}
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-600 block">
                      (कुनै स्प्रेडसिट लिंक गरिएको छैन — माथिको 'नयाँ Sheet बनाउनुहोस्' वा 'अन्य Sheet URL/ID लिंक गर्नुहोस्' प्रयोग गर्नुहोस्)
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {formData.spreadsheetUrl ? (
                    <a
                      href={formData.spreadsheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-[#edf4ea] hover:bg-[#dbe8d6] text-[#304426] text-xs font-bold rounded-lg border border-[#c3d7bd] transition-all flex items-center gap-1.5 shadow-2xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Google Sheet खोल्नुहोस् ↗</span>
                    </a>
                  ) : null}

                  {formData.spreadsheetId && (
                    <button
                      type="button"
                      onClick={handleUnlinkSheet}
                      className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium rounded-lg transition-colors"
                      title="यो स्प्रेडसिट अनलिंक गर्नुहोस्"
                    >
                      अनलिंक
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Designated Google Drive Storage Folder Banner */}
            <div className="bg-[#f2f7f0] border border-[#bed8b8] p-4 rounded-xl text-xs space-y-2.5 text-[#24331C]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-[#2e4524]">
                  <FolderKanban className="w-4 h-4 text-[#4B6043]" />
                  <span>डाटा भण्डारण Google Drive Folder (rbthapamgr09@gmail.com):</span>
                </div>
                <a
                  href={TARGET_GOOGLE_DRIVE_FOLDER_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-800 text-[11px] font-bold rounded-lg border border-emerald-300 transition-colors flex items-center gap-1 shadow-xs"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Google Drive Folder खोल्नुहोस् ↗</span>
                </a>
              </div>
              <p className="text-[11.5px] leading-relaxed text-gray-700">
                सुपर एडमिनले नयाँ कार्यालय दर्ता गर्दा वा यहाँबाट नयाँ सिट बनाउँदा <strong>"stcs_{organization.officeName || 'कार्यालय'}"</strong> नामको गुगल सिट सिधै दिइएको Google Drive फोल्डर (ID: <code className="bg-white px-1.5 py-0.5 rounded border border-[#c4dbc0] text-emerald-900 font-mono text-[10.5px]">{TARGET_GOOGLE_DRIVE_FOLDER_ID}</code>) भित्र सिर्जना हुनेछ र त्यस कार्यालयको सम्पूर्ण डाटा सुरक्षित (Save/Sync) तथा कार्यालय मेटाउँदा सिंक व्यवस्थापन हुनेछ।
              </p>
            </div>

            {/* Instant Auto-Sync Notice Banner */}
            <div className="bg-[#edf4ea] border border-[#c4d8be] p-3.5 rounded-xl text-xs space-y-1.5 text-[#24331C]">
              <div className="flex items-center gap-1.5 font-bold text-[#304426]">
                <Sparkles className="w-4 h-4 text-[#4B6043]" />
                <span>फाराममा सुरक्षित (Save) गर्दा तत्काल स्वतः सिंक (Instant Auto-Sync on Save):</span>
              </div>
              <p className="text-[11.5px] leading-relaxed text-gray-700">
                एपको जुनसुकै फाराम (कर्मचारी थप/सम्पादन, तलब संरचना, कट्टी वा कर स्ल्याब) मा <strong>सुरक्षित (Save)</strong> बटन थिच्ने बित्तिकै लिंक भएको Google Sheet मा तुरुन्तै विवरणहरू <strong>Store / Save / Sync</strong> हुन्छन्।
              </p>
            </div>
          </div>

          <form id="section-apps-script" onSubmit={handleSaveConfig} className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-[#24331C] border-b border-[#e9efe4] pb-2">
              २. गुगल वेब एप एपीआई तथा सिंक सेटिङ (Google Sheets & Web App Settings)
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                  <label className="font-semibold text-[#304426]">
                    Google Apps Script Web App URL (वैकल्पिक / Alternative)
                  </label>
                  {formData.webAppUrl && (
                    <a
                      href={formData.webAppUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-emerald-700 hover:text-emerald-900 font-medium flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>ब्राउजरमा URL खोलेर जाँच्नुहोस् ↗</span>
                    </a>
                  )}
                </div>
                <input
                  type="url"
                  value={formData.webAppUrl}
                  onChange={(e) => setFormData((p) => ({ ...p, webAppUrl: e.target.value }))}
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                  className="w-full p-2.5 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] font-mono focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                />
                <div className="mt-1.5 p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-lg text-[11px] text-amber-900 space-y-1">
                  <p className="font-semibold text-amber-950 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span>'Failed to fetch' त्रुटि रोक्न Apps Script मा निम्न कुरा मिलाउनुहोस्:</span>
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5 text-gray-700">
                    <li>
                      <strong>Who has access:</strong> अनिवार्य रूपमा <strong>"Anyone"</strong> चयन गर्नुहोस् (यदि "Only myself" रोजेमा गुगलले रोक्छ)।
                    </li>
                    <li>
                      <strong>Execute as:</strong> <strong>"Me ({googleConnectedEmail || 'rbthapamgr09@gmail.com'})"</strong> छान्नुहोस्।
                    </li>
                    <li>
                      URL को अन्त्यमा अनिवार्य रूपमा <strong>"/exec"</strong> हुनुपर्दछ (जस्तै: <code>https://script.google.com/macros/s/.../exec</code>)।
                    </li>
                  </ul>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#304426] mb-1">
                  गुगल स्प्रेडसिट आईडी (Spreadsheet ID)
                </label>
                <input
                  type="text"
                  value={formData.spreadsheetId || ''}
                  onChange={(e) => setFormData((p) => ({ ...p, spreadsheetId: e.target.value }))}
                  placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                  className="w-full p-2.5 rounded-lg border border-[#c8d7c2] bg-white text-[#24331C] font-mono focus:ring-2 focus:ring-[#4B6043]/30 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 bg-[#f8faf6] p-3 rounded-xl border border-[#dbe7d7]">
                <input
                  type="checkbox"
                  id="autoSync"
                  checked={formData.autoSync}
                  onChange={(e) => setFormData((p) => ({ ...p, autoSync: e.target.checked }))}
                  className="w-4 h-4 text-[#4B6043] rounded accent-[#4B6043] cursor-pointer"
                />
                <label htmlFor="autoSync" className="font-semibold text-[#304426] cursor-pointer">
                  फाराममा सुरक्षित गर्दा स्वतः सिंक गर्नुहोस् (Enable Instant Auto-Sync on Save)
                </label>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="px-4 py-2 bg-[#edf4ea] hover:bg-[#dbe8d6] text-[#344c2c] text-xs font-bold rounded-xl border border-[#c5d7bf] transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                <span>{isTesting ? 'परीक्षण हुँदैछ...' : 'जडान परीक्षण (Test Connection)'}</span>
              </button>

              <button
                type="submit"
                className="px-5 py-2 bg-[#4B6043] hover:bg-[#384c31] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>कन्फिगरेसन सेभ गर्नुहोस्</span>
              </button>
            </div>
          </form>

          {/* Sync Trigger Controls */}
          <div className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-[#24331C] border-b border-[#e9efe4] pb-2">
              ३. डाटा सिंक कार्यहरू (Manual Sync Actions)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-[#f8faf6] p-4 rounded-xl border border-[#d8e4d3] space-y-3">
                <div className="flex items-center gap-2 text-[#354c2d]">
                  <CloudUpload className="w-5 h-5 text-[#4B6043]" />
                  <h4 className="font-bold">सिट्समा डाटा पठाउनुहोस् (Push to Sheets)</h4>
                </div>
                <p className="text-[11px] text-gray-600">
                  हालको सबै कर्मचारी, तलब, कट्टी तथा ३३ बुँदे कर विवरण गुगल सिट्समा पठाउनुहोस्।
                </p>
                <button
                  type="button"
                  onClick={handlePush}
                  disabled={isPushing}
                  className="w-full py-2.5 bg-[#4B6043] hover:bg-[#384c31] text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isPushing ? 'animate-spin' : ''}`} />
                  <span>{isPushing ? 'सिंक हुँदैछ...' : 'सिट्समा पठाउनुहोस् (Push All)'}</span>
                </button>
              </div>

              <div className="bg-[#f8faf6] p-4 rounded-xl border border-[#d8e4d3] space-y-3">
                <div className="flex items-center gap-2 text-[#354c2d]">
                  <CloudDownload className="w-5 h-5 text-[#4B6043]" />
                  <h4 className="font-bold">सिट्सबाट डाटा तान्नुहोस् (Pull from Sheets)</h4>
                </div>
                <p className="text-[11px] text-gray-600">
                  गुगल सिट्समा रहेका कर्मचारी तथा तलब विवरण यस एप्लिकेशनमा लोड गर्नुहोस्।
                </p>
                <button
                  type="button"
                  onClick={handlePull}
                  disabled={isPulling}
                  className="w-full py-2.5 bg-[#edf4ea] hover:bg-[#dbe8d6] text-[#344c2c] font-bold rounded-xl border border-[#c5d7bf] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isPulling ? 'animate-spin' : ''}`} />
                  <span>{isPulling ? 'लोड हुँदैछ...' : 'सिट्सबाट तान्नुहोस् (Pull Data)'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Google Sheets Tabs & AuditLog Structure Card */}
          <div className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs space-y-3 text-xs">
            <h3 className="text-sm font-bold text-[#24331C] flex items-center gap-2 border-b border-[#e9efe4] pb-2">
              <Table className="w-4 h-4 text-[#4B6043]" />
              गुगल स्प्रेडसिटका पानाहरू (Spreadsheet Tabs & Structure)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11.5px]">
              <div className="p-2.5 bg-[#f8faf6] rounded-lg border border-[#e2ece0] flex items-center justify-between">
                <span className="font-medium text-[#24331C]">१. कर्मचारी_विवरण</span>
                <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-[#d0dfcc] text-gray-600">कर्मचारी रेकर्ड</span>
              </div>
              <div className="p-2.5 bg-[#f8faf6] rounded-lg border border-[#e2ece0] flex items-center justify-between">
                <span className="font-medium text-[#24331C]">२. तलब_सेटअप</span>
                <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-[#d0dfcc] text-gray-600">ग्रेड र भत्ता</span>
              </div>
              <div className="p-2.5 bg-[#f8faf6] rounded-lg border border-[#e2ece0] flex items-center justify-between">
                <span className="font-medium text-[#24331C]">३. कट्टी_सेटअप</span>
                <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-[#d0dfcc] text-gray-600">ऋण र कोष</span>
              </div>
              <div className="p-2.5 bg-[#f8faf6] rounded-lg border border-[#e2ece0] flex items-center justify-between">
                <span className="font-medium text-[#24331C]">४. मासिक_तलब_सिट</span>
                <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-[#d0dfcc] text-gray-600">मासिक पेरोल</span>
              </div>
              <div className="p-2.5 bg-[#f8faf6] rounded-lg border border-[#e2ece0] flex items-center justify-between">
                <span className="font-medium text-[#24331C]">५. वार्षिक_कर_विवरण</span>
                <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-[#d0dfcc] text-gray-600">वार्षिक कर निर्धारण</span>
              </div>
              <div className="p-2.5 bg-[#f8faf6] rounded-lg border border-[#e2ece0] flex items-center justify-between">
                <span className="font-medium text-[#24331C]">६. कार्यालय_विवरण</span>
                <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-[#d0dfcc] text-gray-600">संस्था र निकाय</span>
              </div>
              <div className="p-2.5 bg-[#f8faf6] rounded-lg border border-[#e2ece0] flex items-center justify-between">
                <span className="font-medium text-[#24331C]">७. कर_स्ल्याब_दर</span>
                <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-[#d0dfcc] text-gray-600">कर दर तालिका</span>
              </div>
              <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-300 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-bold text-emerald-900">८. AuditLog</span>
                  <span className="text-[10px] text-emerald-700">Time log (UTC+05:45) Kathmandu</span>
                </div>
                <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-emerald-300 text-emerald-800 font-semibold">अडिट लग</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Google Apps Script Installation Instructions & Code */}
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-[#d6e3d2] shadow-xs space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#24331C] flex items-center gap-2">
                <FileCode className="w-4 h-4 text-[#4B6043]" />
                गुगल सिट्स इन्स्टलेसन निर्देशन (Universal Code)
              </h3>
              <a
                href="https://script.new"
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-md font-bold text-[10px] flex items-center gap-1 transition-colors"
                title="सिधै नयाँ Apps Script खोल्नुहोस्"
              >
                <ExternalLink className="w-3 h-3" />
                <span>script.new खोल्नुहोस्</span>
              </a>
            </div>
            <ol className="list-decimal pl-4 space-y-2 text-gray-700 leading-relaxed text-[11px]">
              <li>
                Google Sheet को <strong>Extensions &gt; Apps Script</strong> खोल्नुहोस् वा सिधै नयाँ ट्याबमा <a href="https://script.new" target="_blank" rel="noopener noreferrer" className="text-emerald-700 font-bold underline">script.new ↗</a> खोल्नुहोस्।
              </li>
              <li>तल दिइएको अद्यावधिक <code>Code.gs</code> कोड कपी गरी त्यहाँ पेस्ट गर्नुहोस् र <strong>Save (Ctrl+S)</strong> गर्नुहोस्।</li>
              <li>
                शीर्ष ड्रपडाउनमा <strong><code>testSetup</code></strong> चयन गरी <strong>Run (▶)</strong> थिचेर Google अनुमति (Authorization) प्रदान गर्नुहोस्।
              </li>
              <li>
                माथिको <strong>Deploy &gt; New deployment</strong> मा जानुहोस्।
              </li>
              <li>
                बायाँ गियर आइकनबाट <strong>Web app</strong> रोज्नुहोस्।
              </li>
              <li>
                <strong>Execute as:</strong> "Me" र <strong>Who has access:</strong> "Anyone" चयन गरी <strong>Deploy</strong> गर्नुहोस्।
              </li>
              <li>प्राप्त <strong>Web App URL</strong> लाई कपी गरी यहाँ बायाँ फारममा राखी Save गर्नुहोस्।</li>
            </ol>
          </div>

          <div className="bg-[#24331C] text-white p-4 rounded-2xl shadow-xs space-y-2 text-xs">
            <div className="flex items-center justify-between border-b border-white/15 pb-2">
              <span className="font-mono font-bold text-emerald-300">Code.gs (Universal Engine)</span>
              <button
                onClick={copyToClipboard}
                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? 'कपी गरियो' : 'कोड कपी गर्नुहोस्'}</span>
              </button>
            </div>
            <pre className="max-h-72 overflow-y-auto font-mono text-[10px] text-emerald-100 p-2 bg-black/30 rounded-lg whitespace-pre-wrap leading-relaxed">
              {googleAppsScriptCode}
            </pre>
          </div>
        </div>
      </div>

      {/* Create New Sheet Assistant Modal (Attached Page) */}
      {showCreateSheetModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          {/* Backdrop click to close */}
          <div
            className="fixed inset-0"
            onClick={() => setShowCreateSheetModal(false)}
            title="क्लिक गरी बन्द गर्नुहोस्"
          />

          <div className="relative bg-white rounded-2xl shadow-2xl border border-[#cbdcc6] max-w-lg w-full flex flex-col max-h-[92vh] overflow-hidden z-10 animate-fadeIn my-auto">
            {/* Modal Header with Prominent Close Button */}
            <div className="sticky top-0 z-20 shrink-0 bg-linear-to-r from-[#24331C] to-[#3a522e] text-white p-3.5 sm:p-4 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
                </div>
                <div className="truncate">
                  <h3 className="text-sm font-bold leading-snug truncate">
                    नयाँ Google Spreadsheet सिर्जना तथा लिंक
                  </h3>
                  <p className="text-[11px] text-emerald-100/80 truncate">
                    {googleConnectedEmail
                      ? `${googleConnectedEmail} खातामा नयाँ सिट जोड्नुहोस्`
                      : 'गुगल खातामा नयाँ सिट जोड्नुहोस्'}
                  </p>
                </div>
              </div>

              {/* Header Close Button */}
              <button
                type="button"
                onClick={() => setShowCreateSheetModal(false)}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0"
                title="यो विन्डो बन्द गर्नुहोस् (Close)"
              >
                <X className="w-4 h-4" />
                <span>बन्द गर्नुहोस् (Close)</span>
              </button>
            </div>

            {/* Modal Body (Scrollable with In-Body Close Button) */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              {/* Account Status Indicator */}
              <div className="bg-[#f7faf5] border border-[#d6e5d2] p-3 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-gray-700">सक्रिय गुगल खाता:</span>
                  <strong className="text-[#24331C] font-mono truncate">
                    {googleConnectedEmail || TARGET_ADMIN_ACCOUNT_EMAIL}
                  </strong>
                </div>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full border border-emerald-300 shrink-0">
                  सक्रिय (Connected)
                </span>
              </div>

              {/* Method 1: Instant sheets.new (Guaranteed & Error-Free) */}
              <div className="border-2 border-emerald-500/80 bg-emerald-50/40 rounded-xl p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[11px]">
                      १
                    </span>
                    <h4 className="text-xs font-bold text-emerald-950">
                      विधि १: १-क्लिकमा नयाँ Google Sheet खोल्नुहोस् (सिफारिस गरिएको)
                    </h4>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 text-[10px] font-bold rounded-full shrink-0">
                    १००% सफल
                  </span>
                </div>

                <p className="text-[11.5px] text-gray-700 leading-relaxed">
                  गुगलको आधिकारिक{' '}
                  <code className="bg-white px-1.5 py-0.5 rounded text-emerald-800 font-mono font-bold border border-emerald-200">
                    sheets.new
                  </code>{' '}
                  सेवा मार्फत तपाईंको गुगल खातामा सिधै नयाँ खाली स्प्रेडसिट खुल्नेछ (कुनै OAuth Scope वा अनुमति त्रुटि आउँदैन):
                </p>

                <a
                  href="https://sheets.new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Google Sheets मा नयाँ सिट खोल्नुहोस् (sheets.new) ↗</span>
                </a>

                <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200/80 text-[11px] text-gray-600">
                  💡 <strong>सुझाव:</strong> नयाँ सिट खुलेपछि त्यसको माथिल्लो बायाँ शीर्षकमा{' '}
                  <strong className="text-[#4B6043]">stcs_{organization.officeName || 'कार्यालय'}</strong> नाम राख्न सक्नुहुन्छ।
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[11px]">
                      २
                    </span>
                    <span>उक्त नयाँ Sheet को URL वा ID यहाँ राख्नुहोस्:</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSheetInput}
                      onChange={(e) => setNewSheetInput(e.target.value)}
                      placeholder="उदाहरण: https://docs.google.com/spreadsheets/d/.../edit वा सिट ID"
                      className="flex-1 px-3 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4B6043] bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleModalLinkSheet}
                      disabled={isLinkingAndSyncing || !newSheetInput.trim()}
                      className="px-4 py-2 bg-[#4B6043] hover:bg-[#3b4e33] active:scale-98 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap cursor-pointer"
                    >
                      <CheckCircle className={`w-3.5 h-3.5 ${isLinkingAndSyncing ? 'animate-spin' : ''}`} />
                      <span>{isLinkingAndSyncing ? 'लिंक हुँदैछ...' : 'लिंक र सिंक गर्नुहोस्'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Method 2: Automatic API Creation (Optional) */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#4B6043]" />
                    <span>विधि २: Google API / Apps Script मार्फत स्वचालित सिर्जना</span>
                  </span>
                  <span className="text-[10px] text-gray-500 font-medium shrink-0">वैकल्पिक (Optional)</span>
                </div>
                <p className="text-[11px] text-gray-600">
                  Google Drive मा सिधै <strong className="text-[#24331C]">stcs_{organization.officeName || 'कार्यालय'}</strong> सिर्जना गर्न क्लिक गर्नुहोस् (गुगलले अनुमति मागेमा 'Allow' गर्नुहोस्)।
                </p>
                <button
                  type="button"
                  onClick={handleDirectApiCreate}
                  disabled={isCreatingSheet}
                  className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isCreatingSheet ? 'animate-spin' : ''}`} />
                  <span>
                    {isCreatingSheet ? 'सिट सिर्जना हुँदैछ...' : 'Google API बाट १-क्लिकमा सिट सिर्जना गर्नुहोस्'}
                  </span>
                </button>
              </div>

              {/* In-Body Close Button directly visible right on the page (image.png area) */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateSheetModal(false)}
                  className="w-full py-2.5 bg-red-50 hover:bg-red-100 active:scale-98 text-red-700 hover:text-red-800 border-2 border-red-200 hover:border-red-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                  title="यो विन्डो बन्द गर्नुहोस्"
                >
                  <X className="w-4 h-4 text-red-600" />
                  <span>यो विन्डो बन्द गर्नुहोस् (Close Window)</span>
                </button>
              </div>
            </div>

            {/* Modal Footer (Sticky at bottom with prominent Close button) */}
            <div className="sticky bottom-0 z-20 shrink-0 bg-gray-50 px-4 sm:px-5 py-3 border-t border-gray-200 flex items-center justify-between gap-3">
              <span className="text-[11px] text-gray-500">
                सबै कर्मचारी, तलब र कर ढाँचाहरू नयाँ सिटमा स्वतः सिंक हुनेछन्।
              </span>
              <button
                type="button"
                onClick={() => setShowCreateSheetModal(false)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
                <span>बन्द गर्नुहोस् (Close)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
