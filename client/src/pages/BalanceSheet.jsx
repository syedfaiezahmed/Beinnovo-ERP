import React, { useEffect, useState } from 'react';
import { Printer as BiPrinter, Download as BiDownload, Building as BiBuilding, FileText as BiFile } from 'lucide-react';
import DateFilter from '../components/DateFilter';
import { handlePrint, exportToPDF, exportToExcel, formatCurrency, formatNumber } from '../utils/exportUtils';
import { getBalanceSheet } from '../services/api';

const BalanceSheet = () => {
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

  const [assets, setAssets] = useState([]);
  const [liabilities, setLiabilities] = useState([]);
  const [equity, setEquity] = useState([]);
  const [totals, setTotals] = useState({ totalAssets: 0, totalLiabilities: 0, totalEquity: 0 });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState('');

  const generateAnalysis = () => {
    setIsAnalyzing(true);
    setAiAnalysis('');
    
    setTimeout(() => {
        const { totalAssets, totalLiabilities, totalEquity } = totals;
        const debtRatio = totalAssets > 0 ? ((totalLiabilities / totalAssets) * 100).toFixed(1) : 0;
        
        const analysis = `
  **Balance Sheet Analysis**

  **1. Financial Position:**
  The company possesses Total Assets of **${formatCurrency(totalAssets)}**, funded by **${formatCurrency(totalLiabilities)}** in Liabilities and **${formatCurrency(totalEquity)}** in Equity.

  **2. Solvency & Risk:**
  The Debt-to-Asset ratio is **${debtRatio}%**. ${debtRatio < 50 ? "This indicates a healthy balance sheet with low leverage." : "Leverage is high; monitor debt obligations carefully."}
  The company is **${totalAssets > totalLiabilities ? "Solvent" : "Technically Insolvent"}** with a net asset coverage of **${formatCurrency(totalAssets - totalLiabilities)}**.

  **CA Comments & Recommendations:**
  ${totalEquity > 0 
      ? "• Strong equity position indicates business stability.\n• Consider leveraging assets for expansion if debt is low.\n• Maintain current asset mix." 
      : "• Warning: Negative equity detected. Capital injection required.\n• Prioritize debt reduction immediately."}
        `;
        setAiAnalysis(analysis.trim());
        setIsAnalyzing(false);
    }, 2000);
  };

  const computeAsOf = (f) => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const period = f?.period || 'thisMonth';
    
    switch (period) {
      case 'thisMonth':
        return { asOfDate: new Date(y, m + 1, 0).toISOString() };
      case 'lastMonth':
        return { asOfDate: new Date(y, m, 0).toISOString() };
      case 'thisYear':
        return { asOfDate: new Date(y, 11, 31).toISOString() };
      case 'custom':
        return { asOfDate: f.endDate };
      default:
        return {};
    }
  };

  useEffect(() => {
    const loadBS = async () => {
      try {
        const res = await getBalanceSheet(computeAsOf(filter));
        const { assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity } = res.data || {};
        setAssets(Array.isArray(assets) ? assets : []);
        setLiabilities(Array.isArray(liabilities) ? liabilities : []);
        setEquity(Array.isArray(equity) ? equity : []);
        setTotals({
          totalAssets: totalAssets || 0,
          totalLiabilities: totalLiabilities || 0,
          totalEquity: totalEquity || 0
        });
      } catch (e) {
        console.error('Failed to load balance sheet', e);
      }
    };
    loadBS();
  }, [filter]);

  const totalAssets = totals.totalAssets;
  const totalLiabilities = totals.totalLiabilities;
  const totalEquity = totals.totalEquity;

  const handleExportPDF = () => {
    const columns = [
      { header: 'Description', dataKey: 'name' },
      { header: 'Amount', dataKey: 'amount' }
    ];
    
    // Combine data for report
    const data = [
      { name: 'ASSETS', amount: '' },
      ...assets.map(item => ({ name: item.name, amount: formatCurrency(Number(item.amount) || 0) })),
      { name: 'Total Assets', amount: formatCurrency(Number(totalAssets) || 0) },
      { name: 'LIABILITIES', amount: '' },
      ...liabilities.map(item => ({ name: item.name, amount: formatCurrency(Number(item.amount) || 0) })),
      { name: 'Total Liabilities', amount: formatCurrency(Number(totalLiabilities) || 0) },
      { name: 'EQUITY', amount: '' },
      ...equity.map(item => ({ name: item.name, amount: formatCurrency(Number(item.amount) || 0) })),
      { name: 'Total Equity', amount: formatCurrency(Number(totalEquity) || 0) },
      { name: 'Total Liabilities & Equity', amount: formatCurrency(Number(totalLiabilities + totalEquity) || 0) }
    ];

    exportToPDF(columns, data, 'Balance Sheet', 'balance_sheet.pdf');
  };

  const handleExportExcel = () => {
    const data = [
      { Category: 'ASSETS', Name: '', Amount: '' },
      ...assets.map(item => ({ Category: 'Asset', Name: item.name, Amount: item.amount })),
      { Category: '', Name: 'Total Assets', Amount: totalAssets },
      { Category: 'LIABILITIES', Name: '', Amount: '' },
      ...liabilities.map(item => ({ Category: 'Liability', Name: item.name, Amount: item.amount })),
      { Category: '', Name: 'Total Liabilities', Amount: totalLiabilities },
      { Category: 'EQUITY', Name: '', Amount: '' },
      ...equity.map(item => ({ Category: 'Equity', Name: item.name, Amount: item.amount })),
      { Category: '', Name: 'Total Equity', Amount: totalEquity }
    ];
    exportToExcel(data, 'Balance Sheet', 'balance_sheet.xlsx');
  };

  return (
    <div className="animate-fade-in p-2 bg-[var(--color-background)] min-h-screen text-[var(--color-text)]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-heading)]">{companyName} - Balance Sheet</h2>
          <p className="text-sm text-[var(--color-text-muted)]">As of {new Date().toLocaleDateString()}</p>
        </div>
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          <DateFilter onFilterChange={setFilter} />
          <div className="flex gap-3">
            <button 
                onClick={generateAnalysis}
                disabled={isAnalyzing}
                className={`flex items-center gap-2 px-4 py-2.5 rounded text-sm text-white transition-colors shadow-sm ${isAnalyzing ? 'bg-secondary/70 cursor-not-allowed' : 'btn-primary'}`}
            >
                {isAnalyzing ? 'Analyzing...' : 'AI Analysis'}
            </button>
            <button onClick={handlePrint} className="btn-secondary flex items-center gap-2 px-4 py-2.5 text-sm font-medium">
              <BiPrinter size={16} /> Print
            </button>
            <button onClick={handleExportPDF} className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm font-medium">
              <BiDownload size={16} /> PDF
            </button>
            <button onClick={handleExportExcel} className="btn-secondary flex items-center gap-2 px-4 py-2.5 text-sm font-medium">
              <BiFile size={16} /> Excel
            </button>
          </div>
        </div>
      </div>

      <div className="card-base p-6 max-w-5xl mx-auto">
        
        {aiAnalysis && (
            <div className="mb-6 p-5 bg-secondary/5 rounded-xl border border-secondary/10 animate-fade-in">
                <div className="flex items-center gap-2 mb-3 text-secondary font-bold border-b border-secondary/10 pb-2 text-sm uppercase tracking-wider">
                    <h3>AI Financial Analysis</h3>
                </div>
                <div className="prose max-w-none text-[var(--color-text)] whitespace-pre-line leading-relaxed text-sm font-medium text-justify">
                    {aiAnalysis}
                </div>
            </div>
        )}

        {/* Report Header */}
        <div className="text-center mb-8 border-b-2 border-[var(--color-border)] pb-6">
            <h1 className="text-3xl font-black uppercase tracking-tight text-[var(--color-text-heading)] mb-1">{companyName}</h1>
            <h3 className="text-lg font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Balance Sheet</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Column: Assets */}
            <div className="space-y-6">
                <h4 className="text-base font-black text-primary border-b-2 border-primary pb-2 flex items-center gap-2 uppercase tracking-wide">
                    <BiBuilding size={18} /> Assets
                </h4>
                
                <div className="space-y-6">
                    <div>
                        <h5 className="font-bold text-[var(--color-text-heading)] text-xs uppercase tracking-wider mb-3 bg-[var(--color-surface-hover)] p-2 rounded">Current Assets</h5>
                        {assets.filter(a => a.name !== 'Equipment').map((item, index) => (
                            <div key={index} className="flex justify-between items-center text-[var(--color-text)] py-2 px-2 border-b border-dashed border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-hover)] transition-colors rounded text-sm group">
                                <span className="font-medium group-hover:text-[var(--color-text-heading)] transition-colors">{item.name}</span>
                                <span className="font-mono group-hover:text-[var(--color-text-heading)] transition-colors">{formatNumber(Number(item.amount) || 0)}</span>
                            </div>
                        ))}
                    </div>

                    <div>
                        <h5 className="font-bold text-[var(--color-text-heading)] text-xs uppercase tracking-wider mb-3 bg-[var(--color-surface-hover)] p-2 rounded">Non-Current Assets</h5>
                         {assets.filter(a => a.name === 'Equipment').map((item, index) => (
                            <div key={index} className="flex justify-between items-center text-[var(--color-text)] py-2 px-2 border-b border-dashed border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-hover)] transition-colors rounded text-sm group">
                                <span className="font-medium group-hover:text-[var(--color-text-heading)] transition-colors">{item.name}</span>
                                <span className="font-mono group-hover:text-[var(--color-text-heading)] transition-colors">{formatNumber(Number(item.amount) || 0)}</span>
                            </div>
                        ))}
                    </div>


                    <div className="flex justify-between items-center font-bold text-[var(--color-text-heading)] text-sm pt-3 border-t-2 border-[var(--color-border)] mt-2 bg-[var(--color-surface-hover)] p-3 rounded">
                        <span className="uppercase tracking-wide">Total Assets</span>
                        <span className="font-mono text-base">{formatCurrency(Number(totalAssets) || 0)}</span>
                    </div>
                </div>
            </div>

            {/* Right Column: Liabilities & Equity */}
            <div className="space-y-8">
                {/* Liabilities */}
                <div>
                    <h4 className="text-base font-black text-danger border-b-2 border-danger pb-2 mb-4 uppercase tracking-wide">Liabilities</h4>
                    <div className="space-y-6">
                        <div>
                            <h5 className="font-bold text-[var(--color-text-heading)] text-xs uppercase tracking-wider mb-3 bg-[var(--color-surface-hover)] p-2 rounded">Current Liabilities</h5>
                            {liabilities.filter(l => l.category === 'Current Liability' || (!l.category && l.code.startsWith('2'))).map((item, index) => (
                                <div key={index} className="flex justify-between items-center text-[var(--color-text)] py-2 px-2 border-b border-dashed border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-hover)] transition-colors rounded text-sm group">
                                    <span className="font-medium group-hover:text-[var(--color-text-heading)] transition-colors">{item.code} - {item.name}</span>
                                    <span className="font-mono group-hover:text-[var(--color-text-heading)] transition-colors">{formatNumber(Number(item.amount) || 0)}</span>
                                </div>
                            ))}
                        </div>
                        <div>
                             <h5 className="font-bold text-[var(--color-text-heading)] text-xs uppercase tracking-wider mb-3 bg-[var(--color-surface-hover)] p-2 rounded">Non-Current Liabilities</h5>
                            {liabilities.filter(l => l.category !== 'Current Liability' && (l.category || !l.code.startsWith('2'))).map((item, index) => (
                                <div key={index} className="flex justify-between items-center text-[var(--color-text)] py-2 px-2 border-b border-dashed border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-hover)] transition-colors rounded text-sm group">
                                    <span className="font-medium group-hover:text-[var(--color-text-heading)] transition-colors">{item.code} - {item.name}</span>
                                    <span className="font-mono group-hover:text-[var(--color-text-heading)] transition-colors">{formatNumber(Number(item.amount) || 0)}</span>
                                </div>
                            ))}
                        </div>
                        
                        <div className="flex justify-between items-center font-bold text-[var(--color-text-heading)] pt-3 mt-4 text-sm bg-[var(--color-surface-hover)] p-3 rounded">
                            <span className="uppercase tracking-wide">Total Liabilities</span>
                            <span className="font-mono text-base">{formatCurrency(Number(totalLiabilities) || 0)}</span>
                        </div>
                    </div>
                </div>

                {/* Equity */}
                <div>
                    <h4 className="text-base font-black text-success border-b-2 border-success pb-2 mb-4 uppercase tracking-wide">Equity</h4>
                    <div className="space-y-1">
                        {equity.map((item, index) => (
                            <div key={index} className="flex justify-between items-center text-[var(--color-text)] py-2 px-2 border-b border-dashed border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-hover)] transition-colors rounded text-sm group">
                                <span className="font-medium group-hover:text-[var(--color-text-heading)] transition-colors">{item.name}</span>
                                <span className="font-mono group-hover:text-[var(--color-text-heading)] transition-colors">{formatNumber(Number(item.amount) || 0)}</span>
                            </div>
                        ))}
                        <div className="flex justify-between items-center font-bold text-[var(--color-text-heading)] pt-3 mt-4 text-sm bg-[var(--color-surface-hover)] p-3 rounded">
                            <span className="uppercase tracking-wide">Total Equity</span>
                            <span className="font-mono text-base">{formatCurrency(Number(totalEquity) || 0)}</span>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center font-black text-[var(--color-surface)] bg-[var(--color-text-heading)] text-sm pt-4 pb-4 px-4 rounded-lg shadow-lg mt-6">
                    <span className="uppercase tracking-widest">Total Liabilities & Equity</span>
                    <span className="font-mono text-lg">{formatCurrency(Number(totalLiabilities + totalEquity) || 0)}</span>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default BalanceSheet;
