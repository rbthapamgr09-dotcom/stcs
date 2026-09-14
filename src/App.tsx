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
import { ErrorBoundary } from './components/common/ErrorBoundary';
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
import { SettingsView } from './components/modules/SettingsView';

const MainLayout: React.FC = () => {
  const { activeTab, setActiveTab } = useApp();
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
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
