import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { SpeedInsights } from '@vercel/speed-insights/react';
import MainLayout from './layouts/MainLayout';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from './context/ThemeContext';

// Lazy load pages
const Login = lazy(() => import('./pages/Login'));
const SuperAdminDashboard = lazy(() => import('./pages/SuperAdminDashboard'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const GeneralJournal = lazy(() => import('./pages/GeneralJournal'));
const ChartOfAccounts = lazy(() => import('./pages/ChartOfAccounts'));
const GeneralLedger = lazy(() => import('./pages/GeneralLedger'));
const TrialBalance = lazy(() => import('./pages/TrialBalance'));
const ProfitLoss = lazy(() => import('./pages/ProfitLoss'));
const BalanceSheet = lazy(() => import('./pages/BalanceSheet'));
const Invoicing = lazy(() => import('./pages/Invoicing'));
const Purchasing = lazy(() => import('./pages/Purchasing'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Partners = lazy(() => import('./pages/Partners'));
const HR = lazy(() => import('./pages/HR'));
const Settings = lazy(() => import('./pages/Settings'));
const AccountsReceivable = lazy(() => import('./pages/AccountsReceivable'));
const AccountsPayable = lazy(() => import('./pages/AccountsPayable'));
const CostAccounting = lazy(() => import('./pages/CostAccounting'));
const CashFlowStatement = lazy(() => import('./pages/CashFlowStatement'));

// Loading component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen bg-[var(--color-background)]">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

// Placeholder components for routes
const Placeholder = ({ title }) => (
  <div className="p-6 bg-[var(--color-surface)] rounded-xl shadow-sm border border-[var(--color-border)]">
    <h2 className="text-2xl font-bold mb-4 text-[var(--color-text-heading)]">{title}</h2>
    <p className="text-[var(--color-text-muted)]">This module is under development.</p>
  </div>
);

const ProtectedRoute = ({ allowedRoles }) => {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  
  if (!token || !userStr) {
    return <Navigate to="/login" replace />;
  }
  
  let user;
  try {
    user = JSON.parse(userStr);
  } catch {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect based on their actual role
    if (user.role === 'super_admin') {
      return <Navigate to="/super-admin" replace />;
    } else {
      return <Navigate to="/" replace />;
    }
  }

  return <Outlet />;
};

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <ErrorBoundary>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute allowedRoles={['super_admin']} />}>
              <Route path="/super-admin" element={<SuperAdminDashboard />} />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={['admin', 'user']} />}>
              <Route path="/" element={<MainLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="journal" element={<GeneralJournal />} />
                <Route path="coa" element={<ChartOfAccounts />} />
                <Route path="gl" element={<GeneralLedger />} />
                <Route path="tb" element={<TrialBalance />} />
                <Route path="pl" element={<ProfitLoss />} />
                <Route path="bs" element={<BalanceSheet />} />
                <Route path="cf" element={<CashFlowStatement />} />
                <Route path="ar" element={<AccountsReceivable />} />
                <Route path="ap" element={<AccountsPayable />} />
                <Route path="cost-accounting" element={<CostAccounting />} />
                <Route path="invoicing" element={<Invoicing />} />
                <Route path="purchasing" element={<Purchasing />} />
                <Route path="inventory" element={<Inventory />} />
                <Route path="partners" element={<Partners />} />
                <Route path="hr" element={<HR />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
      <SpeedInsights />
    </ThemeProvider>
  );
}

export default App;
