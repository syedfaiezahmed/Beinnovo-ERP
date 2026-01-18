import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Wallet as LuWallet, 
  LayoutDashboard as LuLayoutDashboard, 
  BookOpen as LuBookOpen, 
  List as LuList, 
  TrendingUp as LuTrendingUp,
  Building as LuBuilding, 
  LineChart as LuLineChart,
  Receipt as LuReceipt, 
  ShoppingBag as LuShoppingBag, 
  Box as LuBox, 
  Users as LuUsers, 
  User as LuUser, 
  Settings as LuSettings,
  DollarSign as LuDollarSign,
  BarChart3 as LuBarChart3,
  ChevronLeft as LuChevronLeft,
  ChevronRight as LuChevronRight,
  FileText as LuFileText
} from 'lucide-react';

const Sidebar = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const isActive = (path) => location.pathname === path;

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: <LuLayoutDashboard size={18} /> },
    { type: 'header', label: 'Accounting' },
    { path: '/coa', label: 'Chart of Accounts', icon: <LuList size={18} /> },
    { path: '/journal', label: 'General Journal', icon: <LuBookOpen size={18} /> },
    { path: '/gl', label: 'General Ledger', icon: <LuFileText size={18} /> },
    { path: '/tb', label: 'Trial Balance', icon: <LuList size={18} /> },
    { path: '/pl', label: 'Profit & Loss', icon: <LuTrendingUp size={18} /> },
    { path: '/bs', label: 'Balance Sheet', icon: <LuBuilding size={18} /> },
    { path: '/cf', label: 'Cash Flow Statement', icon: <LuLineChart size={18} /> },
    { path: '/ar', label: 'Accounts Receivable', icon: <LuDollarSign size={18} /> },
    { path: '/ap', label: 'Accounts Payable', icon: <LuWallet size={18} /> },
    { path: '/cost-accounting', label: 'Cost Accounting', icon: <LuBarChart3 size={18} /> },
    { type: 'header', label: 'Operations' },
    { path: '/invoicing', label: 'Invoicing', icon: <LuReceipt size={18} /> },
    { path: '/purchasing', label: 'Purchasing', icon: <LuShoppingBag size={18} /> },
    { path: '/inventory', label: 'Inventory', icon: <LuBox size={18} /> },
    { path: '/partners', label: 'Partners (CRM)', icon: <LuUsers size={18} /> },
    { path: '/hr', label: 'HR & Payroll', icon: <LuUser size={18} /> },
    { type: 'divider' },
    { path: '/settings', label: 'Settings', icon: <LuSettings size={18} /> },
  ];

  return (
    <div 
      className={`bg-[var(--color-surface)] text-[var(--color-text-muted)] flex flex-col flex-shrink-0 transition-all duration-300 shadow-xl z-20 h-full border-r border-[var(--color-border)] relative ${
        collapsed ? 'w-20' : 'w-52'
      }`}
    >
      {/* Collapse Button */}
      <button 
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-8 bg-[var(--color-surface)] text-primary p-1 rounded-full shadow-md border border-[var(--color-border)] hover:bg-primary hover:text-white transition-all z-50 transform hover:scale-110"
      >
        {collapsed ? <LuChevronRight size={14} strokeWidth={2.5} /> : <LuChevronLeft size={14} strokeWidth={2.5} />}
      </button>

      {/* Logo Area */}
      <div className={`h-16 flex items-center ${collapsed ? 'justify-center px-0' : 'px-6'} border-b border-[var(--color-border)] bg-[var(--color-surface)] transition-all duration-300`}>
        <div className="h-9 w-9 min-w-[36px] rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30 transition-transform hover:scale-105">
          <LuWallet className="text-white" size={20} />
        </div>
        {!collapsed && (
          <div className="ml-3 overflow-hidden whitespace-nowrap animate-fade-in">
            <span className="text-lg font-bold tracking-tight block leading-none text-[var(--color-text-heading)]">Beinnovo</span>
            <span className="text-[10px] text-primary font-bold uppercase tracking-[0.2em]">Enterprise</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden py-6 space-y-1 custom-scrollbar px-3">
        {menuItems.map((item, index) => {
          if (item.type === 'header') {
            if (collapsed) return <div key={index} className="h-4"></div>;
            return (
              <li key={index} className="px-3 mt-6 mb-2 list-none animate-fade-in">
                <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest opacity-80">{item.label}</span>
              </li>
            );
          }
          if (item.type === 'divider') {
            return <li key={index} className="border-t border-[var(--color-border)] my-4 mx-3 list-none opacity-50"></li>;
          }

          const active = isActive(item.path);
          return (
            <li key={index} className="list-none">
              <Link
                to={item.path}
                className={`flex items-center ${collapsed ? 'justify-center px-0 py-3' : 'px-3 py-2.5 gap-3'} min-w-0 
                  transition-all duration-200 rounded-lg group mb-0.5 relative
                  ${active 
                    ? 'bg-primary/10 text-primary font-semibold' 
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-heading)]'}`
                }
                title={collapsed ? item.label : ''}
              >
                <span className={`transition-colors duration-200 ${active ? 'text-primary' : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-text-heading)]'}`}>
                    {React.cloneElement(item.icon, { 
                      strokeWidth: active ? 2.5 : 2,
                      className: `transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`,
                      size: 20
                    })}
                </span>
                
                {!collapsed && (
                  <span className={`text-sm whitespace-nowrap overflow-hidden text-ellipsis animate-fade-in ${active ? 'text-primary' : ''}`}>
                    {item.label}
                  </span>
                )}
                
                {active && !collapsed && (
                    <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-primary"></div>
                )}
                
                {/* Tooltip for collapsed state */}
                {collapsed && (
                   <div className="absolute left-full ml-4 px-3 py-2 bg-gray-900 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-xl">
                     {item.label}
                   </div>
                )}
              </Link>
            </li>
          );
        })}
      </div>

      <div className={`p-4 border-t border-[var(--color-border)] bg-[var(--color-surface)]/30 ${collapsed ? 'flex justify-center' : ''}`}>
        {!collapsed ? (
          <div className="flex items-center justify-center text-[var(--color-text-muted)] text-xs transition-colors font-medium">
            <span>&copy; 2026 Beinnovo ERP</span>
          </div>
        ) : (
           <span className="text-[var(--color-text-muted)] text-xs font-mono">v1.0</span>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
