import React, { useEffect, useState } from 'react';
import { Printer as BiPrinter, Download as BiDownload, FileText as BiFile } from 'lucide-react';
import DateFilter from '../components/DateFilter';
import { handlePrint, exportToPDF, exportToExcel, formatCurrency, formatNumber } from '../utils/exportUtils';
import { getTrialBalance } from '../services/api';

const TrialBalance = () => {
  const [filter, setFilter] = useState({ period: 'thisMonth' });
  const [tbData, setTbData] = useState([]);
  const [totals, setTotals] = useState({ totalDebit: 0, totalCredit: 0, balanced: true });
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
    const loadTB = async () => {
      try {
        const res = await getTrialBalance(computeRange(filter));
        const { rows, totalDebit, totalCredit, balanced } = res.data || {};
        setTbData(Array.isArray(rows) ? rows : []);
        setTotals({ totalDebit: totalDebit || 0, totalCredit: totalCredit || 0, balanced: !!balanced });
      } catch (e) {
        console.error('Failed to load trial balance', e);
        setTbData([]);
        setTotals({ totalDebit: 0, totalCredit: 0, balanced: true });
      }
    };
    loadTB();
  }, [filter]);

  const totalDebit = totals.totalDebit;
  const totalCredit = totals.totalCredit;
  const isBalanced = totals.balanced;

  const handleExportPDF = () => {
    const columns = [
      { header: 'Code', dataKey: 'code' },
      { header: 'Account Name', dataKey: 'name' },
      { header: 'Debit', dataKey: 'debit' },
      { header: 'Credit', dataKey: 'credit' }
    ];
    
    const data = tbData.map(item => ({
        code: item.code,
        name: item.name,
        debit: Number(item.debit) > 0 ? formatCurrency(Number(item.debit)) : '-',
        credit: Number(item.credit) > 0 ? formatCurrency(Number(item.credit)) : '-'
    }));

    exportToPDF(columns, data, 'Trial Balance', 'trial_balance.pdf');
  };

  const handleExportExcel = () => {
    const data = tbData.map(item => ({
      Code: item.code,
      'Account Name': item.name,
      Debit: item.debit,
      Credit: item.credit
    }));
    exportToExcel(data, 'Trial Balance', 'trial_balance.xlsx');
  };

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-3 gap-3">
        <div>
          <h2 className="text-xl font-black text-[var(--color-text-heading)] tracking-tight">{companyName} - Trial Balance</h2>
          <p className="text-sm text-[var(--color-text-muted)] font-medium">As of {new Date().toLocaleDateString()}</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
          <DateFilter onFilterChange={setFilter} />
          <div className="flex gap-2">
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors shadow-sm text-sm font-medium font-medium">
              <BiPrinter size={16} /> Print
            </button>
            <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors shadow-sm text-sm font-medium font-medium">
              <BiDownload size={16} /> PDF
            </button>
            <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors shadow-sm text-sm font-medium font-medium">
              <BiFile size={16} /> Excel
            </button>
          </div>
        </div>
      </div>

      <div className="table-container">
        {/* Report Header */}
        <div className="text-center mt-4 mb-4 border-b border-[var(--color-border)] pb-4 mx-4">
            <h1 className="text-2xl font-black uppercase tracking-wide text-[var(--color-text-heading)]">{companyName}</h1>
            <h3 className="text-lg text-[var(--color-text-muted)] mt-1 font-medium">Trial Balance</h3>
        </div>
        <table className="table-professional w-full text-left border-collapse">
            <thead className="bg-[var(--color-surface-hover)] sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] w-24">Code</th>
                <th className="px-4 py-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Account Name</th>
                <th className="px-4 py-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] text-right w-32">Debit</th>
                <th className="px-4 py-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] text-right w-32">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {tbData.map((row, index) => (
                <tr key={index} className="group hover:bg-[var(--color-surface-hover)] transition-colors">
                  <td className="px-4 py-2.5 font-mono font-medium text-[var(--color-text-heading)] text-sm">{row.code}</td>
                  <td className="px-4 py-2.5 font-medium text-[var(--color-text)] text-sm">{row.name}</td>
                  <td className="px-4 py-2.5 text-right text-[var(--color-text)] font-mono text-sm">
                    {Number(row.debit) > 0 ? formatCurrency(Number(row.debit)) : '-'}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[var(--color-text)] font-mono text-sm">
                    {Number(row.credit) > 0 ? formatCurrency(Number(row.credit)) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-[var(--color-surface-hover)] font-bold border-t-2 border-[var(--color-border)]">
              <tr>
                <td className="px-4 py-3 text-right uppercase tracking-wider text-xs" colSpan="2">Totals</td>
                <td className="px-4 py-3 text-right text-[var(--color-text-heading)] font-mono text-sm">
                  {formatCurrency(Number(totalDebit) || 0)}
                </td>
                <td className="px-4 py-3 text-right text-[var(--color-text-heading)] font-mono text-sm">
                  {formatCurrency(Number(totalCredit) || 0)}
                </td>
              </tr>
            </tfoot>
          </table>
      </div>

      <div className={`mt-2.5 p-2.5 rounded-lg flex items-center justify-between ${isBalanced ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
        <span className="font-bold flex items-center gap-2 text-sm">
          {isBalanced ? (
            <>✅ Trial Balance is Balanced</>
          ) : (
            <>⚠️ Trial Balance is NOT Balanced</>
          )}
        </span>
        {!isBalanced && (
          <span className="text-sm font-medium">Difference: {formatCurrency(Math.abs(totalDebit - totalCredit))}</span>
        )}
      </div>
    </div>
  );
};

export default TrialBalance;
