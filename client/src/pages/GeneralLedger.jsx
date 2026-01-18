import React, { useEffect, useState } from 'react';
import { BookOpen as LuBookOpen, Filter as LuFilter, Printer as LuPrinter, Download as LuDownload, FileText as LuFileText, TrendingUp as LuTrendingUp, TrendingDown as LuTrendingDown, Wallet as LuWallet } from 'lucide-react';
import DateFilter from '../components/DateFilter';
import { handlePrint, exportToPDF, exportToExcel, formatCurrency, formatNumber } from '../utils/exportUtils';
import { getAccounts, getLedger } from '../services/api';

const GeneralLedger = () => {
  const [selectedAccount, setSelectedAccount] = useState('');
  const [filter, setFilter] = useState({ period: 'thisMonth' });
  const [accounts, setAccounts] = useState([]);
  const [ledger, setLedger] = useState({ openingBalance: 0, entries: [], closingBalance: 0 });
  const [companyName] = useState(() => {
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        return parsed.companyName || '';
      } catch {
        return '';
      }
    }
    return '';
  });
  
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const res = await getAccounts();
        setAccounts(res.data || []);
      } catch (e) {
        console.error('Failed to load accounts', e);
      }
    };
    loadAccounts();
  }, []);

  const currentAccount = accounts.find(a => a.code === selectedAccount);

  const computeRange = (f) => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    switch (f.period) {
      case 'thisMonth':
        return { startDate: new Date(y, m, 1).toISOString(), endDate: new Date(y, m + 1, 0).toISOString() };
      case 'lastMonth':
        return { startDate: new Date(y, m - 1, 1).toISOString(), endDate: new Date(y, m, 0).toISOString() };
      case 'thisYear':
        return { startDate: new Date(y, 0, 1).toISOString(), endDate: new Date(y, 11, 31).toISOString() };
      case 'custom':
        return { startDate: f.startDate, endDate: f.endDate };
      default:
        return {};
    }
  };

  useEffect(() => {
    const loadLedger = async () => {
      if (!selectedAccount) return;
      try {
        const params = { accountCode: selectedAccount, ...computeRange(filter) };
        const res = await getLedger(params);
        setLedger(res.data || { openingBalance: 0, entries: [], closingBalance: 0 });
      } catch (e) {
        console.error('Failed to load ledger', e);
      }
    };
    loadLedger();
  }, [selectedAccount, filter]);

  const handleExportPDF = () => {
    if (!selectedAccount) return;
    const columns = [
      { header: 'Date', dataKey: 'date' },
      { header: 'Description', dataKey: 'description' },
      { header: 'Debit', dataKey: 'debit' },
      { header: 'Credit', dataKey: 'credit' },
      { header: 'Balance', dataKey: 'balance' }
    ];
    
    const data = ledger.entries.map(entry => ({
        date: new Date(entry.date).toISOString().substring(0,10),
        description: entry.description,
        debit: Number(entry.debit) > 0 ? formatCurrency(entry.debit) : '-',
        credit: Number(entry.credit) > 0 ? formatCurrency(entry.credit) : '-',
        balance: formatCurrency(entry.balance)
    }));

    exportToPDF(columns, data, `General Ledger - ${currentAccount?.name}`, 'general_ledger.pdf');
  };

  const handleExportExcel = () => {
    if (!selectedAccount) return;
    const data = ledger.entries.map(entry => ({
      Date: new Date(entry.date).toISOString().substring(0,10),
      Description: entry.description,
      Debit: entry.debit,
      Credit: entry.credit,
      Balance: entry.balance
    }));
    exportToExcel(data, 'Ledger', 'general_ledger.xlsx');
  };

  return (
    <div className="space-y-2 animate-in fade-in duration-500 pb-2">
      
      {/* HEADER & FILTERS */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-black text-[var(--color-text-heading)] tracking-tight">General Ledger</h2>
          <p className="text-[var(--color-text-muted)] mt-0.5 text-sm">{companyName ? `${companyName} • ` : ''}View account history and balances</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2.5 w-full md:w-auto items-center">
            <div className="w-full sm:w-auto">
                <DateFilter onFilterChange={setFilter} />
            </div>
            
            <div className="relative w-full sm:w-40">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-muted)]">
                    <LuFilter size={16} />
                </div>
                <select 
                    value={selectedAccount} 
                    onChange={(e) => setSelectedAccount(e.target.value)}
                    className="input-base w-full pl-10 cursor-pointer py-2.5 text-sm h-10"
                >
                    <option value="">Select Account</option>
                    {accounts.map(acc => (
                    <option key={acc.code} value={acc.code}>
                        {acc.code} - {acc.name} ({acc.type})
                    </option>
                    ))}
                </select>
            </div>

            {selectedAccount && (
            <div className="flex gap-1 border-l border-[var(--color-border)] pl-1 ml-0.5">
                <button onClick={handlePrint} className="btn-ghost text-[var(--color-text-muted)] hover:text-[var(--color-text)] p-2.5" title="Print">
                    <LuPrinter size={16} />
                </button>
                <button onClick={handleExportPDF} className="btn-ghost text-[var(--color-text-muted)] hover:text-[var(--color-text)] p-2.5" title="Export PDF">
                    <LuDownload size={16} />
                </button>
                <button onClick={handleExportExcel} className="btn-ghost text-[var(--color-text-muted)] hover:text-[var(--color-text)] p-2.5" title="Export Excel">
                    <LuFileText size={16} />
                </button>
            </div>
            )}
        </div>
      </div>

      {!selectedAccount ? (
        <div className="card-base p-2.5 text-center flex flex-col items-center justify-center min-h-[150px]">
          <div className="w-8 h-8 bg-[var(--color-surface-hover)] rounded-full flex items-center justify-center mb-1.5">
            <LuBookOpen className="text-[var(--color-text-muted)]" size={16} />
          </div>
          <h3 className="text-lg font-bold text-[var(--color-text-heading)] mb-0.5">Select an Account</h3>
          <p className="text-[var(--color-text-muted)] max-w-xs mx-auto text-sm">
            Choose an account from the dropdown menu above to view its general ledger entries, running balance, and history.
          </p>
        </div>
      ) : (
        <div className="space-y-2 animate-in slide-in-from-bottom-4 duration-300">
          
          {/* Account Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
             <div className="card-base p-2.5 border-l-2 border-l-[var(--color-text-muted)]">
                <div className="flex items-center gap-2 mb-1">
                    <div className="p-1 bg-[var(--color-surface-hover)] rounded text-[var(--color-text-muted)]">
                        <LuWallet size={16} />
                    </div>
                    <p className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Opening Balance</p>
                </div>
                <p className="text-sm font-bold text-[var(--color-text-heading)] font-mono tracking-tight">
                    {formatCurrency(Number(ledger.openingBalance || 0))}
                </p>
             </div>

             <div className="card-base p-2.5 border-l-2 border-l-[var(--color-success)]">
                <div className="flex items-center gap-2 mb-1">
                    <div className="p-1 bg-[var(--color-success)]/10 rounded text-[var(--color-success)]">
                        <LuTrendingUp size={16} />
                    </div>
                    <p className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Total Debits</p>
                </div>
                <p className="text-sm font-bold text-[var(--color-success)] font-mono tracking-tight">
                  {formatCurrency(ledger.entries.reduce((sum, item) => sum + (Number(item.debit) || 0), 0))}
                </p>
             </div>

             <div className="card-base p-2.5 border-l-2 border-l-[var(--color-danger)]">
                <div className="flex items-center gap-2 mb-1">
                    <div className="p-1 bg-[var(--color-danger)]/10 rounded text-[var(--color-danger)]">
                        <LuTrendingDown size={16} />
                    </div>
                    <p className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Total Credits</p>
                </div>
                <p className="text-sm font-bold text-[var(--color-danger)] font-mono tracking-tight">
                  {formatCurrency(ledger.entries.reduce((sum, item) => sum + (Number(item.credit) || 0), 0))}
                </p>
             </div>

             <div className="card-base p-2.5 border-l-2 border-l-primary bg-primary/5">
                <div className="flex items-center gap-2 mb-1">
                    <div className="p-1 bg-primary/10 rounded text-primary">
                        <LuWallet size={16} />
                    </div>
                    <p className="text-sm font-bold text-primary uppercase tracking-wider">Closing Balance</p>
                </div>
                <p className="text-sm font-bold text-primary font-mono tracking-tight">
                  {formatCurrency(Number(ledger.closingBalance || 0))}
                </p>
             </div>
          </div>

          {/* Ledger Table */}
          <div className="card-base overflow-hidden">
            <div className="p-2.5 border-b border-[var(--color-border)] bg-[var(--color-surface-hover)] flex justify-between items-center">
               <div className="flex items-center gap-2.5">
                    <div className="w-5 h-5 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-primary shadow-sm">
                        <span className="font-black text-sm">{currentAccount?.code.substring(0, 2)}</span>
                    </div>
                    <div>
                        <h3 className="font-bold text-[var(--color-text-heading)] text-lg">
                            {currentAccount?.name}
                        </h3>
                        <p className="text-sm text-[var(--color-text-muted)] font-mono">Code: {currentAccount?.code}</p>
                    </div>
               </div>
               <span className="px-1 py-0.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full text-sm font-medium text-[var(--color-text-muted)] shadow-sm uppercase tracking-wide">
                 {currentAccount?.type}
               </span>
            </div>

            <div className="table-container">
            <table className="table-professional w-full text-left">
              <thead className="bg-[var(--color-surface-hover)] sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] w-32">Date</th>
                  <th className="px-4 py-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Description</th>
                  <th className="px-4 py-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] text-right w-32">Debit</th>
                  <th className="px-4 py-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] text-right w-32">Credit</th>
                  <th className="px-4 py-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] text-right w-36 bg-[var(--color-surface-hover)]">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {ledger.entries.map((entry, idx) => (
                  <tr key={idx} className="group hover:bg-[var(--color-surface-hover)] transition-colors">
                    <td className="px-4 py-2.5 font-medium text-[var(--color-text)] text-sm whitespace-nowrap">
                      {entry.date ? new Date(entry.date).toISOString().substring(0,10) : 'N/A'}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--color-text-muted)] group-hover:text-[var(--color-text)] transition-colors text-sm">
                      {entry.description || ''}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-[var(--color-text)] font-mono text-sm">
                      {Number(entry.debit) > 0 ? formatNumber(Number(entry.debit)) : <span className="text-[var(--color-text-muted)] opacity-50">-</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-[var(--color-text)] font-mono text-sm">
                      {Number(entry.credit) > 0 ? formatNumber(Number(entry.credit)) : <span className="text-[var(--color-text-muted)] opacity-50">-</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-[var(--color-text-heading)] font-mono text-sm bg-[var(--color-surface-hover)]/30 group-hover:bg-[var(--color-surface-hover)] transition-colors">
                      {formatCurrency(Number(entry.balance || 0))}
                    </td>
                  </tr>
                ))}
                {ledger.entries.length === 0 && (
                    <tr>
                        <td colSpan="5" className="py-8 text-center text-[var(--color-text-muted)] italic">
                            No transactions found for the selected period.
                        </td>
                    </tr>
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

export default GeneralLedger;
