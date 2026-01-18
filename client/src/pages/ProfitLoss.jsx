import React, { useEffect, useState } from 'react';
import { Printer as BiPrinter, Download as BiDownload, TrendingUp as BiTrendingUp, TrendingDown as BiTrendingDown, FileText as BiFile } from 'lucide-react';
import DateFilter from '../components/DateFilter';
import { handlePrint, exportToPDF, exportToExcel, formatCurrency, formatNumber } from '../utils/exportUtils';
import { getProfitLoss } from '../services/api';

const ProfitLoss = () => {
  const [filter, setFilter] = useState({ period: 'thisMonth' });
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

  const [incomeData, setIncomeData] = useState([]);
  const [expenseData, setExpenseData] = useState([]);
  const [totals, setTotals] = useState({ totalIncome: 0, totalExpense: 0, netIncome: 0 });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState('');

  const generateAnalysis = () => {
    setIsAnalyzing(true);
    setAiAnalysis('');
    
    setTimeout(() => {
        const { totalIncome, totalExpense, netIncome } = totals;
        const profitMargin = totalIncome > 0 ? ((netIncome / totalIncome) * 100).toFixed(1) : 0;
        
        const analysis = `
  **Profit & Loss Analysis**

  **1. Profitability:**
  The company generated **${formatCurrency(totalIncome)}** in revenue against **${formatCurrency(totalExpense)}** in expenses, resulting in a Net Income of **${formatCurrency(netIncome)}**.
  The Net Profit Margin is **${profitMargin}%**. ${profitMargin > 15 ? "This is a healthy margin." : "Margins are tight; consider cost reduction."}

  **2. Expense Management:**
  Expenses consume **${totalIncome > 0 ? ((totalExpense / totalIncome) * 100).toFixed(1) : 0}%** of total revenue.

  **CA Comments & Recommendations:**
  ${netIncome > 0 
      ? "• Positive cash flow trajectory observed.\n• Reinvest surplus into growth assets.\n• Review recurring expenses for potential savings." 
      : "• Critical: Immediate expense audit required.\n• Focus on high-margin revenue streams.\n• Defer non-essential capital expenditure."}
        `;
        setAiAnalysis(analysis.trim());
        setIsAnalyzing(false);
    }, 2000);
  };

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
    const loadPL = async () => {
      try {
        const res = await getProfitLoss(computeRange(filter));
        const { revenueRows, expenseRows, totalRevenue, totalExpenses, netIncome } = res.data || {};
        setIncomeData(revenueRows || []);
        setExpenseData(expenseRows || []);
        setTotals({ totalIncome: totalRevenue || 0, totalExpense: totalExpenses || 0, netIncome: netIncome || 0 });
      } catch (e) {
        console.error('Failed to load profit & loss', e);
      }
    };
    loadPL();
  }, [filter]);

  const totalIncome = totals.totalIncome;
  const totalExpense = totals.totalExpense;
  const netIncome = totals.netIncome;

  const handleExportPDF = () => {
    const columns = [
      { header: 'Description', dataKey: 'name' },
      { header: 'Amount', dataKey: 'amount' }
    ];
    
    // Combine data for report
    const data = [
      ...incomeData.map(item => ({ name: item.name, amount: formatCurrency(Number(item.amount) || 0) })),
      { name: 'Total Revenue', amount: formatCurrency(Number(totalIncome) || 0) },
      ...expenseData.map(item => ({ name: item.name, amount: formatCurrency(Number(item.amount) || 0) })),
      { name: 'Total Expenses', amount: formatCurrency(Number(totalExpense) || 0) },
      { name: 'Net Income', amount: formatCurrency(Number(netIncome) || 0) }
    ];

    exportToPDF(columns, data, 'Profit & Loss Statement', 'profit_loss.pdf');
  };

  const handleExportExcel = () => {
    const data = [
      { Category: 'REVENUE', Name: '', Amount: '' },
      ...incomeData.map(item => ({ Category: 'Revenue', Name: item.name, Amount: item.amount })),
      { Category: '', Name: 'Total Revenue', Amount: totalIncome },
      { Category: 'EXPENSES', Name: '', Amount: '' },
      ...expenseData.map(item => ({ Category: 'Expense', Name: item.name, Amount: item.amount })),
      { Category: '', Name: 'Total Expenses', Amount: totalExpense },
      { Category: '', Name: 'NET INCOME', Amount: netIncome }
    ];
    exportToExcel(data, 'Profit & Loss', 'profit_loss.xlsx');
  };

  return (
    <div className="animate-fade-in p-2">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
        <div>
          <h2 className="text-xl font-black text-[var(--color-text-heading)] tracking-tight">{companyName} - Profit & Loss Statement</h2>
          <p className="text-sm text-[var(--color-text-muted)] font-medium">For the period ending {new Date().toLocaleDateString()}</p>
        </div>
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          <DateFilter onFilterChange={setFilter} />
          <div className="flex gap-3">
            <button onClick={handlePrint} className="btn-secondary flex items-center gap-2 px-4 py-2.5 text-sm font-medium">
              <BiPrinter size={16} /> Print
            </button>
            <button onClick={handleExportPDF} className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm font-medium">
              <BiDownload size={16} /> PDF
            </button>
            <button onClick={handleExportExcel} className="btn-secondary flex items-center gap-2 px-4 py-2.5 text-sm font-medium">
              <BiFile size={16} /> Excel
            </button>
            <button 
                onClick={generateAnalysis}
                disabled={isAnalyzing}
                className={`flex items-center gap-2 px-4 py-2.5 rounded font-bold text-white text-sm transition-all shadow-sm ${isAnalyzing ? 'bg-secondary/70 cursor-not-allowed' : 'bg-secondary hover:bg-secondary/90 hover:shadow-lg hover:shadow-secondary/30'}`}
            >
                {isAnalyzing ? 'Analyzing...' : 'AI Analysis'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-[var(--color-surface)] rounded-lg shadow-sm border border-[var(--color-border)] overflow-hidden max-w-3xl mx-auto">
        <div className="p-6">
            {aiAnalysis && (
                <div className="mb-4 p-2.5 bg-secondary/10 rounded-lg border border-secondary/20 animate-fade-in">
                    <div className="flex items-center gap-2 mb-2 text-secondary font-bold border-b border-secondary/20 pb-2.5 text-sm">
                        <h3>AI Financial Analysis (CA Comments)</h3>
                    </div>
                    <div className="prose max-w-none text-[var(--color-text)] whitespace-pre-line leading-relaxed text-sm">
                        {aiAnalysis}
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="text-center mb-4 border-b border-[var(--color-border)] pb-2.5">
                <h1 className="text-2xl font-black uppercase tracking-wide text-[var(--color-text-heading)]">{companyName}</h1>
                <h3 className="text-lg text-[var(--color-text-muted)] font-medium">Income Statement</h3>
            </div>

            {/* Revenue Section */}
            <div className="mb-4">
                <h4 className="text-sm font-bold uppercase text-[var(--color-text-muted)] border-b border-[var(--color-border)] pb-2.5 mb-3">Revenue</h4>
                <div className="space-y-2">
                    {incomeData.map((item, index) => (
                        <div key={index} className="flex justify-between text-[var(--color-text)] text-sm py-2.5 border-b border-[var(--color-border)] last:border-0">
                            <span>{item.code ? `${item.code} - ` : ''}{item.name}</span>
                            <span>{formatNumber(Number(item.amount) || 0)}</span>
                        </div>
                    ))}
                </div>
                <div className="flex justify-between font-bold text-[var(--color-text-heading)] mt-2.5 pt-2.5 border-t border-[var(--color-border)] text-sm">
                    <span>Total Revenue</span>
                    <span>{formatCurrency(Number(totalIncome) || 0)}</span>
                </div>
            </div>

            {/* Expenses Section */}
            <div className="mb-4">
                <h4 className="text-sm font-bold uppercase text-[var(--color-text-muted)] border-b border-[var(--color-border)] pb-2.5 mb-3">Operating Expenses</h4>
                <div className="space-y-2">
                    {expenseData.map((item, index) => (
                        <div key={index} className="flex justify-between text-[var(--color-text)] text-sm py-2.5 border-b border-[var(--color-border)] last:border-0">
                            <span>{item.code ? `${item.code} - ` : ''}{item.name}</span>
                            <span>{formatNumber(Number(item.amount) || 0)}</span>
                        </div>
                    ))}
                </div>
                <div className="flex justify-between font-bold text-[var(--color-text-heading)] mt-2.5 pt-2.5 border-t border-[var(--color-border)] text-sm">
                    <span>Total Expenses</span>
                    <span>{formatCurrency(Number(totalExpense) || 0)}</span>
                </div>
            </div>

            {/* Net Income */}
            <div className={`mt-4 p-2.5 rounded flex justify-between items-center text-sm font-black tracking-tight ${netIncome >= 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                <span className="flex items-center gap-2">
                    {netIncome >= 0 ? <BiTrendingUp size={16} /> : <BiTrendingDown size={16} />}
                    Net Income
                </span>
                <span>{formatCurrency(Number(netIncome) || 0)}</span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ProfitLoss;
