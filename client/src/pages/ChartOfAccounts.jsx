import React, { useState, useEffect } from 'react';
import { 
  Plus as LuPlus, 
  Pencil as LuPencil, 
  Trash2 as LuTrash2, 
  Search as LuSearch, 
  RefreshCw as LuRefreshCw, 
  FolderOpen as LuFolderOpen, 
  Folder as LuFolder,
  Filter as LuFilter, 
  BookOpen as LuBookOpen,
  X as LuX,
  AlertCircle as LuAlertCircle,
  CheckCircle2 as LuCheckCircle2,
  ChevronDown as LuChevronDown,
  Download as LuDownload,
  Lock as LuLock
} from 'lucide-react';
import api, { getAccounts, createAccount, updateAccount, deleteAccount, getLedger } from '../services/api';
import { exportToExcel } from '../utils/exportUtils';

const ChartOfAccounts = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [originalCode, setOriginalCode] = useState(null);
  const [error, setError] = useState('');
  // Ledger Modal State
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [ledgerAccount, setLedgerAccount] = useState(null);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [ledgerOpeningBalance, setLedgerOpeningBalance] = useState(0);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerDateRange, setLedgerDateRange] = useState({ startDate: '', endDate: '' });

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'Asset',
    category: ''
  });

  const accountTypes = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];
  
  // Basic Categories mapping for suggestions (optional)
  const categoriesByType = {
    Asset: ['Current Asset', 'Fixed Asset', 'Other Asset'],
    Liability: ['Current Liability', 'Long-term Liability'],
    Equity: ['Equity'],
    Revenue: ['Operating Revenue', 'Other Income'],
    Expense: ['Operating Expense', 'Cost of Sales', 'Other Expense']
  };

  const fetchAccounts = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getAccounts();
      // console.log('Accounts API Response:', res); 
      
      let data = res.data;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
         if (Array.isArray(data.data)) data = data.data;
         else if (Array.isArray(data.accounts)) data = data.accounts;
      }
      
      setAccounts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching accounts:', err);
      let msg = 'Failed to load accounts. Please try refreshing.';
      if (err.response) {
          if (err.response.data && err.response.data.message) {
              msg = err.response.data.message;
          } else if (err.response.statusText) {
              msg = `Server Error: ${err.response.statusText} (${err.response.status})`;
          } else {
              msg = `Request failed with status ${err.response.status}`;
          }
      } else if (err.message) {
          msg = err.message;
      }
      setError(msg);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value.toLowerCase());
  };

  const filteredAccounts = accounts.filter(acc => 
    acc.code.toLowerCase().includes(searchTerm) || 
    acc.name.toLowerCase().includes(searchTerm) ||
    acc.type.toLowerCase().includes(searchTerm)
  );

  const handleOpenModal = (account = null) => {
    setError('');
    if (account) {
      setEditMode(true);
      setOriginalCode(account.code);
      setFormData({ ...account });
    } else {
      setEditMode(false);
      setOriginalCode(null);
      setFormData({
        code: '',
        name: '',
        type: 'Asset',
        category: 'Current Asset'
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditMode(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      // Auto-set category if type changes
      if (name === 'type') {
        newData.category = categoriesByType[value][0];
      }
      return newData;
    });
  };

  const fetchLedger = async (code, start = '', end = '') => {
    setLedgerLoading(true);
    try {
      const res = await getLedger({ accountCode: code, startDate: start, endDate: end });
      setLedgerEntries(res.data?.entries || []);
      setLedgerOpeningBalance(res.data?.openingBalance || 0);
    } catch (err) {
      console.error('Failed to load ledger', err);
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleOpenLedger = (account) => {
    setLedgerAccount(account);
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]; // Start of year
    const end = now.toISOString().split('T')[0];
    setLedgerDateRange({ startDate: start, endDate: end });
    setShowLedgerModal(true);
    fetchLedger(account.code, start, end);
  };

  const handleCloseLedger = () => {
    setShowLedgerModal(false);
    setLedgerAccount(null);
    setLedgerEntries([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Duplicate Check
    const duplicate = accounts.find(a => a.code === formData.code);
    if (duplicate) {
      if (!editMode) {
        setError("This account already exists in the system.");
        return;
      } else if (originalCode !== formData.code) {
        setError("This account already exists in the system.");
        return;
      }
    }

    try {
      if (editMode) {
        // API expects code as identifier for updates
        await updateAccount(originalCode, formData); 
      } else {
        await createAccount(formData);
      }
      fetchAccounts();
      handleCloseModal();
    } catch (err) {
      setError(err.response?.data?.message || 'Operation failed');
    }
  };

  const handleDelete = async (code) => {
    if (window.confirm('Are you sure you want to delete this account? This cannot be undone.')) {
      try {
        await deleteAccount(code);
        fetchAccounts();
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to delete account');
      }
    }
  };

  const handleExport = () => {
    const data = accounts.map(acc => ({
        'Account Code': acc.code,
        'Name': acc.name,
        'Type': acc.type,
        'Category': acc.category,
        'Balance': acc.balance || 0
    }));
    exportToExcel(data, 'Chart of Accounts', 'chart_of_accounts.xlsx');
  };

  const getTypeBadgeStyle = (type) => {
    switch (type) {
      case 'Asset': return 'bg-success/10 text-success border border-success/20';
      case 'Liability': return 'bg-danger/10 text-danger border border-danger/20';
      case 'Equity': return 'bg-info/10 text-info border border-info/20';
      case 'Revenue': return 'bg-primary/10 text-primary border border-primary/20';
      case 'Expense': return 'bg-warning/10 text-warning border border-warning/20';
      default: return 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] border border-[var(--color-border)]';
    }
  };

  const getTypeBorderColor = (type) => {
    switch (type) {
      case 'Asset': return 'border-l-success';
      case 'Liability': return 'border-l-danger';
      case 'Equity': return 'border-l-info';
      case 'Revenue': return 'border-l-primary';
      case 'Expense': return 'border-l-warning';
      default: return 'border-l-[var(--color-border)]';
    }
  };

  // Helper for currency format
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD', // You might want to make this dynamic based on settings
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatAccountBalance = (balance, type) => {
    // API returns "Normal Balance" as positive.
    // Asset/Expense: Positive = Dr, Negative = Cr
    // Liability/Equity/Revenue: Positive = Cr, Negative = Dr
    const absVal = Math.abs(balance || 0);
    const str = formatCurrency(absVal);
    
    if (balance === 0) return str;

    if (['Asset', 'Expense'].includes(type)) {
        return balance >= 0 ? `${str} Dr` : `${str} Cr`;
    } else {
        return balance >= 0 ? `${str} Cr` : `${str} Dr`;
    }
  };

  const formatLedgerBalance = (amount) => {
      const absVal = Math.abs(amount || 0);
      const str = formatCurrency(absVal);
      if (amount === 0) return str;
      return amount < 0 ? `${str} Cr` : `${str} Dr`;
  };

  return (
    <div className="p-4 max-w-[1600px] mx-auto space-y-4 animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
            <h1 className="text-2xl font-black text-[var(--color-text-heading)] tracking-tight flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl border border-primary/10">
                <LuBookOpen className="text-primary" size={24} />
              </div>
              Chart of Accounts
            </h1>
            <p className="text-[var(--color-text-muted)] mt-1 ml-1 text-sm font-medium">Manage your financial structure and GL accounts</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
            <button 
                onClick={handleExport}
                className="btn-secondary flex items-center gap-2 justify-center px-4 py-2.5 text-sm font-medium transition-all hover:bg-[var(--color-surface-hover)]"
                title="Export to Excel"
            >
                <LuDownload size={16} />
                <span className="hidden sm:inline">Export</span>
            </button>
            <button 
                onClick={fetchAccounts}
                className="btn-secondary flex items-center gap-2 justify-center px-4 py-2.5 text-sm font-medium transition-all hover:bg-[var(--color-surface-hover)]"
                title="Refresh List"
            >
                <LuRefreshCw className={`${loading ? 'animate-spin' : ''}`} size={16} />
                <span className="hidden sm:inline">Refresh</span>
            </button>
            <button 
                onClick={() => handleOpenModal()}
                className="btn-primary flex items-center gap-2 shadow-lg shadow-primary/25 hover:shadow-primary/40 justify-center px-5 py-2.5 text-sm transition-all transform hover:-translate-y-0.5"
            >
                <LuPlus size={18} />
                <span>New Account</span>
            </button>
        </div>
      </div>

      {/* Summary Cards and Balance Check Removed for Master List View */}

      <div className="flex flex-col lg:flex-row gap-6">
          {/* Main Content */}
          <div className="flex-1 space-y-6">
            
            {/* Search & Filter Bar */}
            <div className="bg-[var(--color-surface)] p-4 rounded-xl border border-[var(--color-border)] shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center sticky top-4 z-20 backdrop-blur-md bg-opacity-95">
                <div className="relative w-full max-w-md group">
                    <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-primary transition-colors pointer-events-none" size={18} />
                    <input 
                    type="text" 
                    placeholder="Search accounts..." 
                    className="input-base pl-10 w-full transition-all focus:shadow-md py-2.5 text-sm border-[var(--color-border)]"
                    value={searchTerm}
                    onChange={handleSearch}
                    />
                </div>
                <div className="flex gap-2">
                    <button className="px-4 py-2.5 text-sm font-medium text-[var(--color-text)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors flex items-center gap-2">
                        <LuFilter size={16} />
                        <span>Filter</span>
                    </button>
                </div>
            </div>

            {/* Account List - QuickBooks Style Single Table */}
            <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden animate-fade-in">
                {loading ? (
                     <div className="p-12 text-center text-[var(--color-text-muted)]">
                        <div className="flex flex-col items-center justify-center gap-3">
                            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <p className="animate-pulse font-medium text-sm">Loading financial data...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="p-8 text-center bg-danger/5 border border-danger/10 rounded-xl m-4">
                        <div className="flex flex-col items-center justify-center gap-2 text-danger">
                            <LuAlertCircle size={32} />
                            <p className="font-bold">{error}</p>
                            <div className="flex gap-2 mt-2">
                                <button onClick={fetchAccounts} className="btn-danger text-xs px-3 py-1.5 rounded-lg">Retry Connection</button>
                                <button onClick={() => alert('AI Diagnosis: This error is likely due to a database connection failure. Please check your internet connection or server logs.')} className="btn-secondary text-xs px-3 py-1.5 rounded-lg bg-white border border-danger/20 text-danger hover:bg-danger/5">
                                    Explain with AI
                                </button>
                            </div>
                        </div>
                    </div>
                ) : filteredAccounts.length === 0 ? (
                    <div className="p-12 text-center text-[var(--color-text-muted)] flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-[var(--color-surface-hover)] rounded-full flex items-center justify-center mb-4">
                            <LuFolderOpen size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-[var(--color-text-heading)]">No accounts found</h3>
                        <p className="max-w-xs mx-auto mt-2 text-sm">Try adjusting your search terms or create a new account to get started.</p>
                        <button onClick={() => handleOpenModal()} className="mt-6 text-primary font-bold hover:underline flex items-center gap-2 text-sm">
                            <LuPlus size={16} /> Create New Account
                        </button>
                    </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-[var(--color-surface-hover)] border-b border-[var(--color-border)] sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-6 py-3 font-bold text-[var(--color-text-muted)] uppercase tracking-wider text-xs w-64">Name</th>
                                <th className="px-6 py-3 font-bold text-[var(--color-text-muted)] uppercase tracking-wider text-xs">Type</th>
                                <th className="px-6 py-3 font-bold text-[var(--color-text-muted)] uppercase tracking-wider text-xs">Detail Type</th>
                                <th className="px-6 py-3 font-bold text-[var(--color-text-muted)] uppercase tracking-wider text-xs text-right">Balance</th>
                                <th className="px-6 py-3 font-bold text-[var(--color-text-muted)] uppercase tracking-wider text-xs text-center w-40">Action</th>
                            </tr>
                        </thead>
                        <tbody className="bg-[var(--color-surface)]">
                            {/* Sort by Type then Name for standard accounting view */}
                            {[...filteredAccounts]
                              .sort((a, b) => {
                                // Custom sort order for types: Asset -> Liability -> Equity -> Revenue -> Expense
                                const typeOrder = { 'Asset': 1, 'Liability': 2, 'Equity': 3, 'Revenue': 4, 'Expense': 5 };
                                if (typeOrder[a.type] !== typeOrder[b.type]) return typeOrder[a.type] - typeOrder[b.type];
                                return a.code.localeCompare(b.code);
                              })
                              .map((acc) => (
                                <tr key={acc._id || acc.code} className="group hover:bg-[var(--color-surface-hover)] transition-all duration-200 border-b border-[var(--color-border)] last:border-0">
                                    <td className={`px-6 py-3.5 align-middle border-l-[4px] ${getTypeBorderColor(acc.type)}`}>
                                        <div className="flex flex-col">
                                            <span className="font-bold text-[var(--color-text-heading)] text-[15px] group-hover:text-primary transition-colors cursor-pointer" onClick={() => handleOpenModal(acc)}>
                                                {acc.name}
                                            </span>
                                            <span className="text-xs text-[var(--color-text-muted)] font-mono mt-0.5">{acc.code}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-3.5 align-middle">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeBadgeStyle(acc.type)}`}>
                                            {acc.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3.5 align-middle text-[var(--color-text-muted)] font-medium text-sm">
                                        {acc.category}
                                    </td>
                                    <td className="px-6 py-3.5 align-middle text-right">
                                        <span className={`font-mono font-bold text-sm ${acc.balance < 0 ? 'text-danger' : 'text-[var(--color-text-heading)]'}`}>
                                            {formatCurrency(Math.abs(acc.balance || 0))}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3.5 align-middle text-center">
                                        <div className="flex items-center justify-end gap-3 opacity-60 group-hover:opacity-100 transition-opacity">
                                            {['Asset', 'Liability', 'Equity'].includes(acc.type) ? (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleOpenLedger(acc); }}
                                                    className="text-xs font-semibold text-primary hover:text-primary-dark transition-colors whitespace-nowrap px-2 py-1 rounded hover:bg-primary/5"
                                                >
                                                    View Register
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleOpenLedger(acc); }}
                                                    className="text-xs font-semibold text-primary hover:text-primary-dark transition-colors whitespace-nowrap px-2 py-1 rounded hover:bg-primary/5"
                                                >
                                                    Run Report
                                                </button>
                                            )}
                                            
                                            <div className="h-4 w-[1px] bg-[var(--color-border)]"></div>
                                            
                                            {acc.isSystemAccount ? (
                                                <div title="System Account cannot be edited" className="text-[var(--color-text-muted)] p-1.5 opacity-50 cursor-not-allowed">
                                                    <LuLock size={16} />
                                                </div>
                                            ) : (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleOpenModal(acc); }}
                                                    className="text-[var(--color-text-muted)] hover:text-primary transition-colors p-1.5 rounded-full hover:bg-[var(--color-surface-hover)]"
                                                    title="Edit"
                                                >
                                                    <LuPencil size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                  </div>
                )}
            </div>
          </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
            onClick={handleCloseModal}
        >
            <div 
                className="bg-[var(--color-surface)] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-[var(--color-border)] ring-1 ring-black/5"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-6 py-5 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-surface-hover)]">
                    <h3 className="font-bold text-xl text-[var(--color-text-heading)] flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl shadow-sm ${editMode ? 'bg-warning/10 text-warning ring-1 ring-warning/20' : 'bg-primary/10 text-primary ring-1 ring-primary/20'}`}>
                            {editMode ? <LuPencil size={22} /> : <LuPlus size={22} />}
                        </div>
                        <div className="flex flex-col">
                            <span>{editMode ? 'Edit Account' : 'New Account'}</span>
                            <span className="text-xs font-normal text-[var(--color-text-muted)]">Enter account details below</span>
                        </div>
                    </h3>
                    <button 
                        onClick={handleCloseModal} 
                        className="text-[var(--color-text-muted)] hover:text-danger hover:bg-danger/10 transition-colors p-2 rounded-lg group"
                        title="Close"
                    >
                        <LuX size={20} className="group-hover:scale-110 transition-transform" />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {error && (
                        <div className="p-4 bg-danger/5 text-danger text-sm rounded-xl border border-danger/10 flex items-start gap-3 animate-shake shadow-sm">
                            <LuAlertCircle className="shrink-0 mt-0.5" size={20} />
                            <div>
                                <span className="font-bold block text-danger-dark mb-0.5">Validation Error</span>
                                {error}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider pl-0.5">Account Code <span className="text-danger">*</span></label>
                            <div className="relative group">
                                <input 
                                    type="text" 
                                    name="code"
                                    required
                                    disabled={editMode} 
                                    className={`input-base font-mono w-full pl-3 py-3 text-sm transition-all shadow-sm bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-[var(--color-text)] ${editMode ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] cursor-not-allowed border-dashed' : 'focus:ring-4 focus:ring-primary/10 focus:border-primary'}`}
                                    placeholder="e.g. 1001"
                                    value={formData.code}
                                    onChange={handleChange}
                                />
                                {!editMode && <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] text-[10px] font-medium px-1.5 py-0.5 bg-[var(--color-surface-hover)] rounded border border-[var(--color-border)] pointer-events-none opacity-60 group-focus-within:opacity-100 transition-opacity">UNIQUE</div>}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider pl-0.5">Type <span className="text-danger">*</span></label>
                            <div className="relative">
                                <select 
                                    name="type"
                                    required
                                    className="input-base w-full appearance-none py-3 px-3 text-sm focus:ring-4 focus:ring-primary/10 focus:border-primary cursor-pointer hover:border-[var(--color-text-muted)] transition-colors shadow-sm bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-[var(--color-text)]"
                                    value={formData.type}
                                    onChange={handleChange}
                                >
                                    {accountTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <LuChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" size={16} />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider pl-0.5">Account Name <span className="text-danger">*</span></label>
                        <input 
                            type="text" 
                            name="name"
                            required
                            className="input-base w-full py-3 px-3 text-sm focus:ring-4 focus:ring-primary/10 focus:border-primary shadow-sm bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-[var(--color-text)]"
                            placeholder="e.g. Cash on Hand"
                            value={formData.name}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider pl-0.5">Category</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                name="category"
                                className="input-base w-full pr-10 py-3 px-3 text-sm focus:ring-4 focus:ring-primary/10 focus:border-primary shadow-sm bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-[var(--color-text)]"
                                placeholder="Select or type a category"
                                value={formData.category}
                                onChange={handleChange}
                                list="category-suggestions"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 bg-[var(--color-surface-hover)] rounded-md text-[var(--color-text-muted)] pointer-events-none border border-[var(--color-border)]">
                                 <LuFolderOpen size={14} />
                            </div>
                        </div>
                        <datalist id="category-suggestions">
                            {categoriesByType[formData.type]?.map(c => <option key={c} value={c} />)}
                        </datalist>
                        <p className="text-[11px] text-[var(--color-text-muted)] ml-1 flex items-center gap-1">
                            <LuFolder size={10} /> Used for grouping accounts in financial reports.
                        </p>
                    </div>

                    <div className="pt-6 flex justify-end gap-3 border-t border-[var(--color-border)] mt-2">
                        <button 
                            type="button" 
                            onClick={handleCloseModal}
                            className="btn-secondary text-sm font-bold px-5 py-2.5 hover:bg-danger/5 hover:text-danger hover:border-danger/20 transition-all rounded-xl border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="btn-primary flex items-center gap-2 shadow-lg shadow-primary/25 px-6 py-2.5 text-sm font-bold tracking-wide transform active:scale-95 transition-all rounded-xl"
                        >
                            {editMode ? (
                                <>
                                    <LuCheckCircle2 size={18} /> Update Account
                                </>
                            ) : (
                                <>
                                    <LuPlus size={18} /> Create Account
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Ledger Modal */}
      {showLedgerModal && ledgerAccount && (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
            onClick={handleCloseLedger}
        >
            <div 
                className="bg-[var(--color-surface)] rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-[var(--color-border)] animate-scale-up"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-surface-hover)]">
                    <div>
                        <h3 className="font-bold text-lg text-[var(--color-text-heading)] flex items-center gap-2">
                            <LuBookOpen className="text-primary" size={20} />
                            General Ledger: <span className="font-mono text-primary">{ledgerAccount.code}</span>
                        </h3>
                        <p className="text-sm text-[var(--color-text-muted)]">{ledgerAccount.name}</p>
                    </div>
                    <button 
                        onClick={handleCloseLedger} 
                        className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors p-1 rounded-md hover:bg-[var(--color-surface-hover)]"
                    >
                        <LuX size={20} />
                    </button>
                </div>

                {/* Filters */}
                <div className="p-4 border-b border-[var(--color-border)] flex flex-wrap gap-4 items-end bg-[var(--color-surface)]">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase">Start Date</label>
                        <input 
                            type="date" 
                            className="input-base text-sm py-1.5 bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-[var(--color-text)]"
                            value={ledgerDateRange.startDate}
                            onChange={(e) => {
                                const newStart = e.target.value;
                                setLedgerDateRange(prev => ({ ...prev, startDate: newStart }));
                                fetchLedger(ledgerAccount.code, newStart, ledgerDateRange.endDate);
                            }}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase">End Date</label>
                        <input 
                            type="date" 
                            className="input-base text-sm py-1.5 bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-[var(--color-text)]"
                            value={ledgerDateRange.endDate}
                            onChange={(e) => {
                                const newEnd = e.target.value;
                                setLedgerDateRange(prev => ({ ...prev, endDate: newEnd }));
                                fetchLedger(ledgerAccount.code, ledgerDateRange.startDate, newEnd);
                            }}
                        />
                    </div>
                    <button 
                        onClick={() => fetchLedger(ledgerAccount.code, ledgerDateRange.startDate, ledgerDateRange.endDate)}
                        className="btn-secondary text-sm py-1.5 px-3 flex items-center gap-2 border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
                    >
                        <LuRefreshCw size={14} className={ledgerLoading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto p-0 bg-[var(--color-surface)]">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-[var(--color-surface-hover)] sticky top-0 z-10 shadow-sm border-b border-[var(--color-border)]">
                            <tr>
                                <th className="px-4 py-3 font-semibold text-[var(--color-text-muted)]">Date</th>
                                <th className="px-4 py-3 font-semibold text-[var(--color-text-muted)]">Description</th>
                                <th className="px-4 py-3 font-semibold text-[var(--color-text-muted)] text-right">Debit</th>
                                <th className="px-4 py-3 font-semibold text-[var(--color-text-muted)] text-right">Credit</th>
                                <th className="px-4 py-3 font-semibold text-[var(--color-text-muted)] text-right">Balance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)]">
                                {/* Opening Balance Row */}
                                {ledgerOpeningBalance !== 0 && (
                                <tr className="bg-[var(--color-surface-hover)] font-medium">
                                    <td className="px-4 py-2 italic text-[var(--color-text-muted)]" colSpan={4}>Opening Balance</td>
                                    <td className="px-4 py-2 text-right font-mono text-[var(--color-text-heading)]">
                                        {formatLedgerBalance(ledgerOpeningBalance)}
                                    </td>
                                </tr>
                                )}
                                
                            {ledgerLoading ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-[var(--color-text-muted)]">Loading ledger data...</td>
                                </tr>
                            ) : ledgerEntries.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-[var(--color-text-muted)]">No transactions found for this period.</td>
                                </tr>
                            ) : (
                                ledgerEntries.map((entry, idx) => (
                                    <tr key={idx} className="hover:bg-[var(--color-surface-hover)] transition-colors border-b border-[var(--color-border)] last:border-0">
                                        <td className="px-4 py-2 text-[var(--color-text)] whitespace-nowrap">
                                            {new Date(entry.date).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-2 text-[var(--color-text)]">{entry.description}</td>
                                        <td className="px-4 py-2 text-right font-mono text-[var(--color-text)]">
                                            {entry.debit ? formatCurrency(entry.debit) : '-'}
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono text-[var(--color-text)]">
                                            {entry.credit ? formatCurrency(entry.credit) : '-'}
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono font-medium text-[var(--color-text-heading)]">
                                            {formatLedgerBalance(entry.balance)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default ChartOfAccounts;
