import React, { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { PageNavigationHeader } from './components/common/PageNavigationHeader';
import { ConfirmationModal } from './components/common/ConfirmationModal';
import { ToastNotification } from './components/common/ToastNotification';
import { CalculationAuditModal } from './components/common/CalculationAuditModal';
import { AuthModal } from './components/common/AuthModal';
import { ScreenLockOverlay } from './components/common/ScreenLockOverlay';
import { UnauthorizedDomainModal } from './components/common/UnauthorizedDomainModal';
import { LoginPage } from './components/auth/LoginPage';

// Modules
import { DashboardView } from './components/modules/DashboardView';
import { OrganizationSetupView } from './components/modules/OrganizationSetupView';
import { EmployeeManagementView } from './components/modules/EmployeeManagementView';
import { DeductionSetupView } from './components/modules/DeductionSetupView';
import { TaxReferenceSetupView } from './components/modules/TaxReferenceSetupView';
import { MonthlySalarySheetView } from './components/modules/MonthlySalarySheetView';
import { AnnualTaxCalculationView } from './components/modules/AnnualTaxCalculationView';
import { SalaryReportView } from './components/modules/SalaryReportView';
import { GoogleSheetsSyncView } from './components/modules/GoogleSheetsSyncView';
import { SettingsView } from './components/modules/SettingsView';

const MainLayout: React.FC = () => {
  const { activeTab, setActiveTab, currentUser } = useApp();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);

  const handleToggleSidebar = () => {
    if (window.innerWidth < 1024) {
      setIsSidebarOpen((prev) => !prev);
    } else {
      setIsDesktopCollapsed((prev) => !prev);
    }
  };

  const renderActiveModule = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'organization':
        return <OrganizationSetupView />;
      case 'employees':
      case 'salary_income':
        return <EmployeeManagementView />;
      case 'deductions':
        return <DeductionSetupView />;
      case 'tax_reference':
        return <TaxReferenceSetupView />;
      case 'monthly_salary':
        return <MonthlySalarySheetView />;
      case 'annual_tax':
      case 'employee_tax_report':
        return <AnnualTaxCalculationView />;
      case 'salary_reports':
        return <SalaryReportView />;
      case 'google_sheets':
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
              <div className="pt-2">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="px-4 py-2 bg-[#4B6043] hover:bg-[#384c31] text-white text-xs font-bold rounded-xl shadow transition-all cursor-pointer"
                >
                  गृहपृष्ठ (Dashboard) मा फर्कनुहोस्
                </button>
              </div>
            </div>
          );
        }
        return <GoogleSheetsSyncView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="h-screen bg-[#F6F8F3] text-[#24331C] font-sans flex flex-col antialiased selection:bg-[#4B6043] selection:text-white overflow-hidden print:h-auto print:overflow-visible">
      {/* Top Application Header */}
      <Header onToggleSidebar={handleToggleSidebar} />

      {/* Main Body: Sidebar + Dynamic Content Container */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          isDesktopCollapsed={isDesktopCollapsed}
          onToggleDesktopCollapse={() => setIsDesktopCollapsed((prev) => !prev)}
        />

        <main className="flex-1 h-full overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full overscroll-contain">
          {activeTab !== 'dashboard' && <PageNavigationHeader />}
          {renderActiveModule()}
        </main>
      </div>

      {/* Global Modals & Toasts */}
      <ScreenLockOverlay />
      <AuthModal />
      <CalculationAuditModal />
      <ConfirmationModal />
      <UnauthorizedDomainModal />
      <ToastNotification />
    </div>
  );
};

const AppContent: React.FC = () => {
  const { isAuthenticated, currentUser } = useApp();

  // Authentication Gate: Render dedicated Login Page prior to loading main application
  if (!isAuthenticated || !currentUser) {
    return (
      <>
        <LoginPage />
        <UnauthorizedDomainModal />
        <ToastNotification />
      </>
    );
  }

  return <MainLayout />;
};

export function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
