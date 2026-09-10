import { useState, useCallback, memo } from 'react';
import Sidebar from '../components/Sidebar';
import DoctorSelector from '../components/DoctorSelector';
import ErrorBoundary from '../components/ErrorBoundary';
import { FiMenu } from 'react-icons/fi';

const MainLayout = memo(function MainLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleCloseSidebar = useCallback(() => setSidebarOpen(false), []);
  const handleOpenSidebar = useCallback(() => setSidebarOpen(true), []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex app-root">
      <style>{`
        @media print {
          /* Hide app chrome for clean print */
          .app-sidebar,
          .app-mobile-header,
          .app-doctor-selector {
            display: none !important;
          }

          /* Make content fill printable area */
          .app-root {
            display: block !important;
            min-height: auto !important;
            background: #fff !important;
          }
          .app-main {
            padding: 0 !important;
            overflow: visible !important;
          }
          /* Avoid clipping due to flex/overflow wrappers */
          .app-content {
            overflow: visible !important;
          }
        }
      `}</style>
      {/* Mobile/tablet overlay — hidden on md (768px+) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
          onClick={handleCloseSidebar}
        />
      )}

      {/* Sidebar — always visible md+ (768px tablets, laptops, desktops, TV) */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out
        md:translate-x-0 md:static md:inset-0
        tv:w-72
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      app-sidebar `}>
        <Sidebar onClose={handleCloseSidebar} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden app-content">
        {/* Mobile-only header (hidden on md+) */}
        <div className="md:hidden bg-white border-b border-slate-200 shadow-sm p-4 flex items-center justify-between app-mobile-header">
          <button
            onClick={handleOpenSidebar}
            className="p-2 rounded-md text-slate-500 hover:bg-slate-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Open menu"
          >
            <FiMenu size={20} />
          </button>
          <h1 className="text-base font-bold text-slate-800">Dr Jaju Care</h1>
          <div className="w-11" />
        </div>

        {/* Doctor Selector for Admin */}
        <div className="app-doctor-selector">
          <DoctorSelector />
        </div>

        {/* Page content — responsive padding per device tier */}
        <main className="flex-1 p-4 md:p-5 lg:p-6 xl:p-7 tv:p-10 space-y-4 tv:space-y-6 overflow-y-auto app-main">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
});

export default MainLayout;
