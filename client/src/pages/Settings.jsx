import React, { useState, useEffect } from 'react';
import { 
  Building as LuBuilding, 
  Settings as LuSettings, 
  Receipt as LuReceipt, 
  Package as LuPackage, 
  Database as LuDatabase, 
  Save as LuSave, 
  RotateCcw as LuRotateCcw, 
  Check as LuCheck, 
  AlertTriangle as LuAlertTriangle, 
  AlertCircle as LuAlertCircle, 
  Trash2 as LuTrash2
} from 'lucide-react';
import { getTenantSettings, updateTenantSettings } from '../services/api';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Default Settings State
  const [settings, setSettings] = useState({
    // General
    companyName: '',
    companyEmail: '',
    companyPhone: '',
    companyAddress: '',
    companyCity: '',
    companyCountry: '',
    currency: 'USD',
    currencySymbol: '$',
    dateFormat: 'YYYY-MM-DD',
    
    // Accounting
    fiscalYearStart: '01-01',
    defaultTaxRate: 10,
    enableTax: true,
    
    // Sales & Purchasing
    invoicePrefix: 'INV-',
    invoiceNextNumber: 1001,
    billPrefix: 'BILL-',
    defaultPaymentTerms: 30, // days
    invoiceFooter: 'Thank you for your business!',
    
    // Inventory
    enableLowStockAlert: true,
    lowStockThreshold: 10,
    allowNegativeStock: false,
    valuationMethod: 'FIFO', // FIFO, LIFO, AVG
    
    // System
    theme: 'light',
    enableNotifications: true
  });

  // Load settings from Backend & localStorage on mount
  useEffect(() => {
    const fetchSettings = async () => {
        try {
            // 1. Get from Backend (Source of Truth for Company Info)
            const response = await getTenantSettings();
            const tenant = response?.data || {};
            
            // 2. Get from LocalStorage (Preferences)
            const localSettings = JSON.parse(localStorage.getItem('appSettings') || '{}');

            setSettings(prev => ({
                ...prev,
                ...localSettings, // Apply local prefs first
                // Override company info from backend
                companyName: tenant.name || prev.companyName,
                companyAddress: tenant.address || prev.companyAddress,
                companyPhone: tenant.phone || prev.companyPhone,
                companyEmail: tenant.email || prev.companyEmail,
                currency: tenant.currency || prev.currency,
            }));
        } catch (error) {
            console.error("Failed to load settings", error);
            // Fallback to local storage
             const localSettings = JSON.parse(localStorage.getItem('appSettings') || '{}');
             setSettings(prev => ({ ...prev, ...localSettings }));
        }
    };
    fetchSettings();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
        // 1. Update Backend (Company Info)
        const companyData = {
            name: settings.companyName,
            address: settings.companyAddress,
            phone: settings.companyPhone,
            email: settings.companyEmail,
            currency: settings.currency,
        };
        await updateTenantSettings(companyData);

        // 2. Update LocalStorage (All Settings)
        localStorage.setItem('appSettings', JSON.stringify(settings));

        setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch (error) {
        console.error("Failed to save settings", error);
        setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
        setLoading(false);
        setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all settings to default? This cannot be undone.')) {
      localStorage.removeItem('appSettings');
      window.location.reload();
    }
  };

  const handleClearData = () => {
    if (window.confirm('DANGER: This will wipe all application data (Local Storage). Are you absolutely sure?')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  // --- Render Tabs ---
  const renderGeneralTab = () => (
    <div className="space-y-3 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2 pb-1 border-b border-[var(--color-border)]/50">
            <LuBuilding className="text-[var(--color-primary)]" size={16} />
            <h3 className="text-lg font-bold text-[var(--color-text-heading)]">Company Information</h3>
          </div>
          
          <div>
            <label className="block text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Company Name</label>
            <input 
              type="text" name="companyName" value={settings.companyName} onChange={handleChange}
              className="input-base w-full text-sm py-2.5 px-3"
              placeholder="e.g. Acme Corp"
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Email Address</label>
            <input 
              type="email" name="companyEmail" value={settings.companyEmail} onChange={handleChange}
              className="input-base w-full text-sm py-2.5 px-3"
              placeholder="contact@acme.com"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Phone Number</label>
            <input 
              type="text" name="companyPhone" value={settings.companyPhone} onChange={handleChange}
              className="input-base w-full text-sm py-2.5 px-3"
              placeholder="+1 (555) 000-0000"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 pb-1 border-b border-[var(--color-border)]/50">
            <LuBuilding className="text-[var(--color-secondary)]" size={16} />
            <h3 className="text-lg font-bold text-[var(--color-text-heading)]">Location & Locale</h3>
          </div>
          
          <div>
            <label className="block text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Address</label>
            <textarea 
              name="companyAddress" value={settings.companyAddress} onChange={handleChange} rows="2"
              className="input-base w-full resize-none text-sm py-2.5 leading-tight h-14 px-3"
              placeholder="123 Business Ave"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">City</label>
              <input 
                type="text" name="companyCity" value={settings.companyCity} onChange={handleChange}
                className="input-base w-full text-sm py-2.5 px-3"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Country</label>
              <input 
                type="text" name="companyCountry" value={settings.companyCountry} onChange={handleChange}
                className="input-base w-full text-sm py-2.5 px-3"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Currency Code</label>
              <select 
                name="currency" value={settings.currency} onChange={handleChange}
                className="input-base w-full bg-[var(--color-input-bg)] text-sm py-2.5 px-3"
              >
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="PKR">PKR - Pakistani Rupee</option>
                <option value="INR">INR - Indian Rupee</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Symbol</label>
              <input 
                type="text" name="currencySymbol" value={settings.currencySymbol} onChange={handleChange}
                className="input-base w-full text-sm py-2.5 px-3"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAccountingTab = () => (
    <div className="space-y-4 animate-fade-in max-w-xl">
      <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-border)]/50">
        <LuSettings className="text-[var(--color-primary)]" size={16} />
        <h3 className="text-lg font-bold text-[var(--color-text-heading)]">Financial Settings</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Fiscal Year Start</label>
          <input 
            type="date" name="fiscalYearStart" value={`2023-${settings.fiscalYearStart}`} onChange={(e) => handleChange({ target: { name: 'fiscalYearStart', value: e.target.value.slice(5) } })}
            className="input-base w-full text-sm py-2.5"
          />
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Select the starting day and month.</p>
        </div>

        <div>
          <label className="block text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Default Tax Rate (%)</label>
          <input 
            type="number" name="defaultTaxRate" value={settings.defaultTaxRate} onChange={handleChange}
            className="input-base w-full text-sm py-2.5"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 p-3 bg-[var(--color-surface-hover)] rounded-lg border border-[var(--color-border)]/50 transition-colors duration-300">
        <input 
          type="checkbox" id="enableTax" name="enableTax" checked={settings.enableTax} onChange={handleChange}
          className="w-4 h-4 text-[var(--color-primary)] border-[var(--color-border)] rounded focus:ring-primary bg-[var(--color-surface)]"
        />
        <label htmlFor="enableTax" className="text-sm font-medium text-[var(--color-text)] cursor-pointer select-none">Enable Tax Calculations globally</label>
      </div>
    </div>
  );

  const renderSalesTab = () => (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-border)]/50">
            <LuReceipt className="text-[var(--color-primary)]" size={16} />
            <h3 className="text-lg font-bold text-[var(--color-text-heading)]">Invoicing</h3>
          </div>
          
          <div>
            <label className="block text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Invoice Prefix</label>
            <input 
              type="text" name="invoicePrefix" value={settings.invoicePrefix} onChange={handleChange}
              className="input-base w-full text-sm py-2.5 px-3 h-9"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Next Invoice Number</label>
            <input 
              type="number" name="invoiceNextNumber" value={settings.invoiceNextNumber} onChange={handleChange}
              className="input-base w-full text-sm py-2.5 px-3 h-9"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Default Payment Terms (Days)</label>
            <input 
              type="number" name="defaultPaymentTerms" value={settings.defaultPaymentTerms} onChange={handleChange}
              className="input-base w-full text-sm py-2.5 px-3 h-9"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-border)]/50">
             <LuReceipt className="text-[var(--color-secondary)]" size={16} />
             <h3 className="text-lg font-bold text-[var(--color-text-heading)]">Purchasing & Documents</h3>
          </div>
          
          <div>
            <label className="block text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Bill Prefix</label>
            <input 
              type="text" name="billPrefix" value={settings.billPrefix} onChange={handleChange}
              className="input-base w-full text-sm py-2.5 px-3 h-9"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Default Invoice Footer</label>
            <textarea 
              name="invoiceFooter" value={settings.invoiceFooter} onChange={handleChange} rows="3"
              className="input-base w-full resize-none text-sm py-2.5 px-3 leading-tight"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderInventoryTab = () => (
    <div className="space-y-2.5 animate-fade-in max-w-xl">
      <div className="flex items-center gap-2 pb-2.5 border-b border-[var(--color-border)]/50">
        <LuPackage className="text-[var(--color-primary)]" size={16} />
        <h3 className="text-lg font-bold text-[var(--color-text-heading)]">Inventory Control</h3>
      </div>
      
      <div className="space-y-2.5">
        <div>
          <label className="block text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Inventory Valuation Method</label>
          <select 
            name="valuationMethod" value={settings.valuationMethod} onChange={handleChange}
            className="input-base w-full bg-[var(--color-input-bg)] text-sm py-2.5 px-2.5"
          >
            <option value="FIFO">FIFO (First-In, First-Out)</option>
            <option value="LIFO">LIFO (Last-In, First-Out)</option>
            <option value="AVG">Weighted Average Cost</option>
          </select>
          <p className="text-sm text-warning mt-1.5 flex items-center gap-1 font-medium bg-warning/10 p-1.5 rounded border border-warning/20 transition-colors duration-300">
            <LuAlertTriangle size={14} /> Changing this may affect historical profit reports.
          </p>
        </div>

        <div>
          <label className="block text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Low Stock Threshold</label>
          <input 
            type="number" name="lowStockThreshold" value={settings.lowStockThreshold} onChange={handleChange}
            className="input-base w-full text-sm py-2.5 px-2.5"
          />
        </div>

        <div className="flex flex-col gap-1 mt-2.5">
          <div className="flex items-center gap-2 p-1.5 rounded hover:bg-[var(--color-surface-hover)] transition-colors">
            <input 
              type="checkbox" id="enableLowStockAlert" name="enableLowStockAlert" checked={settings.enableLowStockAlert} onChange={handleChange}
              className="w-3.5 h-3.5 text-[var(--color-primary)] border-[var(--color-border)] rounded focus:ring-primary bg-[var(--color-surface)]"
            />
            <label htmlFor="enableLowStockAlert" className="text-sm font-medium text-[var(--color-text)] cursor-pointer">Enable Low Stock Alerts on Dashboard</label>
          </div>

          <div className="flex items-center gap-2 p-1.5 rounded hover:bg-[var(--color-surface-hover)] transition-colors">
            <input 
              type="checkbox" id="allowNegativeStock" name="allowNegativeStock" checked={settings.allowNegativeStock} onChange={handleChange}
              className="w-3.5 h-3.5 text-[var(--color-primary)] border-[var(--color-border)] rounded focus:ring-primary bg-[var(--color-surface)]"
            />
            <label htmlFor="allowNegativeStock" className="text-sm font-medium text-[var(--color-text)] cursor-pointer">Allow Negative Stock (Sell items not in stock)</label>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSystemTab = () => (
    <div className="space-y-2.5 animate-fade-in max-w-xl">
      <div className="space-y-2.5">
        <div>
          <div className="flex items-center gap-2 pb-2.5 border-b border-[var(--color-border)]/50 mb-2">
            <LuDatabase className="text-[var(--color-primary)]" size={16} />
            <h3 className="text-lg font-bold text-[var(--color-text-heading)]">Application Preferences</h3>
          </div>
          <div className="flex items-center gap-3 p-2 rounded hover:bg-[var(--color-surface-hover)] transition-colors">
            <input 
              type="checkbox" id="enableNotifications" name="enableNotifications" checked={settings.enableNotifications} onChange={handleChange}
              className="w-4 h-4 text-[var(--color-primary)] border-[var(--color-border)] rounded focus:ring-primary bg-[var(--color-surface)]"
            />
            <label htmlFor="enableNotifications" className="text-sm font-medium text-[var(--color-text)] cursor-pointer">Enable Browser Notifications</label>
          </div>
        </div>

        <div className="pt-2.5 border-t border-[var(--color-border)]">
          <div className="flex items-center gap-2 pb-2.5 border-b border-danger/20 mb-2.5">
            <LuAlertCircle className="text-danger" size={16} />
            <h3 className="text-lg font-bold text-danger">Danger Zone</h3>
          </div>
          
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between p-2.5 bg-danger/5 border border-danger/10 rounded-lg hover:bg-danger/10 transition-colors">
              <div>
                <p className="text-sm font-bold text-danger">Reset Settings</p>
                <p className="text-sm text-danger/80 mt-1">Revert all settings to their default values.</p>
              </div>
              <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-surface)] border border-danger/20 text-danger rounded hover:bg-danger/10 font-medium text-sm font-medium transition-colors shadow-sm">
              <LuRotateCcw size={16} /> Reset Defaults
            </button>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-danger/5 border border-danger/10 rounded-lg hover:bg-danger/10 transition-colors">
              <div>
                <p className="text-sm font-bold text-danger">Wipe All Data</p>
                <p className="text-sm text-danger/80 mt-1">Delete all local storage data.</p>
              </div>
              <button onClick={handleClearData} className="flex items-center gap-2 py-2.5 px-4 bg-[var(--color-surface)] border border-danger/20 text-danger rounded hover:bg-danger/10 font-medium text-sm font-medium transition-colors shadow-sm">
                <LuTrash2 size={16} /> Wipe Data
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in space-y-3 pb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-[var(--color-text-heading)] tracking-tight transition-colors duration-300">System Settings</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1 font-medium transition-colors duration-300">Configure your ERP preferences and company details</p>
        </div>
        <button 
          onClick={handleSave} 
          disabled={loading}
          className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 disabled:opacity-50 text-sm font-medium font-bold"
        >
          {loading ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div> : <LuSave size={16} />}
          <span>Save Changes</span>
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-3 text-sm font-bold animate-fade-in ${
          message.type === 'success' ? 'bg-success/10 text-success border border-success/20' : 'bg-danger/10 text-danger border border-danger/20'
        }`}>
          {message.type === 'success' ? <LuCheck size={16} /> : <LuAlertTriangle size={16} />}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar Tabs */}
        <div className="md:col-span-1 space-y-2">
          {[
            { id: 'general', label: 'General', icon: LuBuilding },
            { id: 'accounting', label: 'Accounting', icon: LuSettings },
            { id: 'sales', label: 'Sales & Purchasing', icon: LuReceipt },
            { id: 'inventory', label: 'Inventory', icon: LuPackage },
            { id: 'system', label: 'System', icon: LuDatabase },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-sm font-bold ${
                activeTab === tab.id 
                  ? 'bg-primary text-white shadow-md transform scale-105' 
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="md:col-span-3 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-sm p-6 relative overflow-hidden">
          {activeTab === 'general' && renderGeneralTab()}
          {activeTab === 'accounting' && renderAccountingTab()}
          {activeTab === 'sales' && renderSalesTab()}
          {activeTab === 'inventory' && renderInventoryTab()}
          {activeTab === 'system' && renderSystemTab()}
        </div>
      </div>
    </div>
  );
};

export default Settings;
