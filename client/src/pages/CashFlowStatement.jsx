import React, { useEffect, useState } from 'react';
import { Printer as BiPrinter, Download as BiDownload, TrendingUp as BiTrendingUp, FileText as BiFile, LineChart as BiLineChart } from 'lucide-react';
import DateFilter from '../components/DateFilter';
import { handlePrint, exportToPDF, exportToExcel, formatCurrency, formatNumber } from '../utils/exportUtils';
import { getCashFlow } from '../services/api';

const CashFlowStatement = () => {
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

  const [data, setData] = useState({
    netIncome: 0,
    operatingActivities: [],
    investingActivities: [],
    financingActivities: []
  });
  const [loading, setLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState('');

  const generateAnalysis = () => {
    setIsAnalyzing(true);
    setAiAnalysis('');
    
    setTimeout(() => {
        const { netIncome, operatingActivities, investingActivities, financingActivities } = data;
        const totalOperating = operatingActivities.reduce((sum, item) => sum + item.amount, 0) + netIncome;
        const totalInvesting = investingActivities.reduce((sum, item) => sum + item.amount, 0);
        const totalFinancing = financingActivities.reduce((sum, item) => sum + item.amount, 0);
        const netCashChange = totalOperating + totalInvesting + totalFinancing;
        
        const analysis = `
  **Cash Flow Analysis**

  **1. Operating Cash Flow:**
  Net cash from operating activities is **${formatCurrency(totalOperating)}**. ${totalOperating > 0 ? "The company is generating cash from its core operations, which is a positive sign of financial health." : "Operating cash flow is negative, indicating the company is using more cash in operations than it is generating."}

  **2. Investing & Financing:**
  - Investing Activities: **${formatCurrency(totalInvesting)}** (${totalInvesting < 0 ? "Indicates investment in assets for future growth." : "Cash generated from asset sales."})
  - Financing Activities: **${formatCurrency(totalFinancing)}**

  **3. Net Cash Position:**
  The net change in cash for the period is **${formatCurrency(netCashChange)}**.

  **CA Comments & Recommendations:**
  ${totalOperating > 0 
      ? "• Strong operating cash flow allows for reinvestment and debt repayment.\n• Consider allocating excess cash to interest-bearing accounts or expansion.\n• Monitor investing activities to ensure efficient capital allocation." 
      : "• Critical: Improve working capital management (receivables/payables).\n• Review pricing and cost structures to boost operating margins.\n• Secure short-term financing if cash reserves are low."}
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
    const loadData = async () => {
      setLoading(true);
      try {
        const res = await getCashFlow(computeRange(filter));
        setData(res.data || { netIncome: 0, operatingActivities: [], investingActivities: [], financingActivities: [] });
      } catch (e) {
        console.error('Failed to load cash flow statement', e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [filter]);

  const { netIncome, operatingActivities, investingActivities, financingActivities } = data;

  const totalOperating = operatingActivities.reduce((sum, item) => sum + item.amount, 0) + netIncome;
  const totalInvesting = investingActivities.reduce((sum, item) => sum + item.amount, 0);
  const totalFinancing = financingActivities.reduce((sum, item) => sum + item.amount, 0);
  const netCashChange = totalOperating + totalInvesting + totalFinancing;

  const handleExportPDF = () => {
    const columns = [
      { header: 'Description', dataKey: 'name' },
      { header: 'Amount', dataKey: 'amount' }
    ];
    
    // Combine data for report
    const pdfData = [
      { name: 'Operating Activities', amount: '' }, // Section Header
      { name: 'Net Income', amount: formatCurrency(netIncome) },
      ...operatingActivities.map(i => ({ name: i.name, amount: formatCurrency(i.amount) })),
      { name: 'Net Cash from Operating', amount: formatCurrency(totalOperating) },
      
      { name: '', amount: '' }, // Spacer
      
      { name: 'Investing Activities', amount: '' }, // Section Header
      ...investingActivities.map(i => ({ name: i.name, amount: formatCurrency(i.amount) })),
      { name: 'Net Cash from Investing', amount: formatCurrency(totalInvesting) },
      
      { name: '', amount: '' }, // Spacer

      { name: 'Financing Activities', amount: '' }, // Section Header
      ...financingActivities.map(i => ({ name: i.name, amount: formatCurrency(i.amount) })),
      { name: 'Net Cash from Financing', amount: formatCurrency(totalFinancing) },

      { name: '', amount: '' }, // Spacer
      { name: 'NET INCREASE (DECREASE) IN CASH', amount: formatCurrency(netCashChange) }
    ];

    exportToPDF(columns, pdfData, `Cash Flow Statement - ${companyName}`, companyName);
  };

  const handleExportExcel = () => {
    const excelData = [
      { Description: 'Operating Activities', Amount: '' },
      { Description: 'Net Income', Amount: netIncome },
      ...operatingActivities.map(i => ({ Description: i.name, Amount: i.amount })),
      { Description: 'Net Cash from Operating', Amount: totalOperating },
      { Description: '', Amount: '' },
      { Description: 'Investing Activities', Amount: '' },
      ...investingActivities.map(i => ({ Description: i.name, Amount: i.amount })),
      { Description: 'Net Cash from Investing', Amount: totalInvesting },
      { Description: '', Amount: '' },
      { Description: 'Financing Activities', Amount: '' },
      ...financingActivities.map(i => ({ Description: i.name, Amount: i.amount })),
      { Description: 'Net Cash from Financing', Amount: totalFinancing },
      { Description: '', Amount: '' },
      { Description: 'NET INCREASE (DECREASE) IN CASH', Amount: netCashChange }
    ];
    exportToExcel(excelData, 'CashFlowStatement');
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-heading)] flex items-center gap-1 transition-colors duration-300">
            <BiLineChart className="text-primary" size={16} /> Cash Flow Statement
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] transition-colors duration-300">Analyze cash inflows and outflows</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="btn-secondary flex items-center gap-2 px-4 py-2.5 text-sm font-medium">
            <BiPrinter size={16} /> Print
          </button>
          <button onClick={handleExportPDF} className="btn-secondary flex items-center gap-2 px-4 py-2.5 text-sm font-medium">
            <BiFile size={16} /> PDF
          </button>
          <button onClick={handleExportExcel} className="btn-secondary flex items-center gap-2 px-4 py-2.5 text-sm font-medium">
            <BiDownload size={16} /> Excel
          </button>
          <button 
                onClick={generateAnalysis}
                disabled={isAnalyzing}
                className={`flex items-center gap-2 px-4 py-2.5 rounded text-sm text-white transition-colors shadow-sm ${isAnalyzing ? 'bg-secondary/70 cursor-not-allowed' : 'btn-primary'}`}
            >
                {isAnalyzing ? 'Analyzing...' : 'AI Analysis'}
          </button>
        </div>
      </div>

      <div className="card-base p-8 print-content min-h-screen">
        {aiAnalysis && (
            <div className="mb-6 p-5 bg-primary/5 rounded-xl border border-primary/10 animate-fade-in">
                <div className="flex items-center gap-2 mb-3 text-primary font-bold border-b border-primary/10 pb-2 text-sm uppercase tracking-wider">
                    <BiTrendingUp size={18} />
                    <h3>AI Financial Analysis</h3>
                </div>
                <div className="prose max-w-none text-[var(--color-text)] whitespace-pre-line leading-relaxed text-sm font-medium text-justify">
                    {aiAnalysis.split('**').map((part, index) => index % 2 === 1 ? <strong key={index}>{part}</strong> : part)}
                </div>
            </div>
        )}

        <div className="flex justify-between items-end mb-8 border-b-2 border-[var(--color-border)] pb-4">
          <div>
            <h2 className="text-2xl font-black text-[var(--color-text-heading)] uppercase tracking-tight">{companyName}</h2>
            <p className="text-sm font-bold text-[var(--color-text-muted)] mt-1 uppercase tracking-wider">Statement of Cash Flows</p>
          </div>
          <div className="text-right">
             <DateFilter filter={filter} onChange={setFilter} />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-8 max-w-5xl mx-auto">
            
            {/* Operating Activities */}
            <div>
              <h3 className="text-sm font-black text-[var(--color-text-heading)] uppercase tracking-wider mb-4 border-b border-[var(--color-border)] pb-2">Operating Activities</h3>
              <div className="space-y-1">
                <div className="flex justify-between py-2 px-2 hover:bg-[var(--color-surface-hover)] rounded transition-colors">
                  <span className="text-[var(--color-text-heading)] font-bold text-sm">Net Income</span>
                  <span className="font-mono font-bold text-[var(--color-text-heading)] text-sm">{formatNumber(netIncome)}</span>
                </div>
                <div className="pl-4 space-y-1 border-l-2 border-[var(--color-border)] ml-2 my-2">
                    <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider px-2 py-1">Adjustments to reconcile Net Income to Net Cash:</p>
                    {operatingActivities.length > 0 ? (
                        operatingActivities.map((item, index) => (
                        <div key={index} className="flex justify-between py-1.5 px-2 hover:bg-[var(--color-surface-hover)] rounded transition-colors text-sm">
                            <span className="text-[var(--color-text)]">{item.name}</span>
                            <span className="font-mono text-[var(--color-text)]">{formatNumber(item.amount)}</span>
                        </div>
                        ))
                    ) : (
                        <div className="text-[var(--color-text-muted)] italic text-xs px-2 py-1">No adjustments found</div>
                    )}
                </div>
                <div className="flex justify-between py-3 px-2 mt-2 bg-[var(--color-surface-hover)] rounded font-bold border-t border-[var(--color-border)]">
                  <span className="text-sm text-[var(--color-text-heading)] uppercase tracking-wide">Net Cash from Operating</span>
                  <span className={`font-mono text-sm ${totalOperating >= 0 ? 'text-success' : 'text-danger'}`}>
                    {formatCurrency(totalOperating)}
                  </span>
                </div>
              </div>
            </div>

            {/* Investing Activities */}
            <div>
              <h3 className="text-sm font-black text-[var(--color-text-heading)] uppercase tracking-wider mb-4 border-b border-[var(--color-border)] pb-2">Investing Activities</h3>
              <div className="space-y-1">
                {investingActivities.length > 0 ? (
                    investingActivities.map((item, index) => (
                    <div key={index} className="flex justify-between py-2 px-2 hover:bg-[var(--color-surface-hover)] rounded transition-colors text-sm group">
                        <span className="text-[var(--color-text)] group-hover:text-[var(--color-text-heading)] transition-colors">{item.name}</span>
                        <span className="font-mono text-[var(--color-text)] group-hover:text-[var(--color-text-heading)] transition-colors">{formatNumber(item.amount)}</span>
                    </div>
                    ))
                ) : (
                    <div className="text-[var(--color-text-muted)] italic text-sm py-2 px-2">No investing activities found</div>
                )}
                <div className="flex justify-between py-3 px-2 mt-2 bg-[var(--color-surface-hover)] rounded font-bold border-t border-[var(--color-border)]">
                  <span className="text-sm text-[var(--color-text-heading)] uppercase tracking-wide">Net Cash from Investing</span>
                  <span className={`font-mono text-sm ${totalInvesting >= 0 ? 'text-success' : 'text-danger'}`}>
                    {formatCurrency(totalInvesting)}
                  </span>
                </div>
              </div>
            </div>

            {/* Financing Activities */}
            <div>
              <h3 className="text-sm font-black text-[var(--color-text-heading)] uppercase tracking-wider mb-4 border-b border-[var(--color-border)] pb-2">Financing Activities</h3>
              <div className="space-y-1">
                {financingActivities.length > 0 ? (
                    financingActivities.map((item, index) => (
                    <div key={index} className="flex justify-between py-2 px-2 hover:bg-[var(--color-surface-hover)] rounded transition-colors text-sm group">
                        <span className="text-[var(--color-text)] group-hover:text-[var(--color-text-heading)] transition-colors">{item.name}</span>
                        <span className="font-mono text-[var(--color-text)] group-hover:text-[var(--color-text-heading)] transition-colors">{formatNumber(item.amount)}</span>
                    </div>
                    ))
                ) : (
                    <div className="text-[var(--color-text-muted)] italic text-sm py-2 px-2">No financing activities found</div>
                )}
                <div className="flex justify-between py-3 px-2 mt-2 bg-[var(--color-surface-hover)] rounded font-bold border-t border-[var(--color-border)]">
                  <span className="text-sm text-[var(--color-text-heading)] uppercase tracking-wide">Net Cash from Financing</span>
                  <span className={`font-mono text-sm ${totalFinancing >= 0 ? 'text-success' : 'text-danger'}`}>
                    {formatCurrency(totalFinancing)}
                  </span>
                </div>
              </div>
            </div>

            {/* Grand Total */}
            <div className="mt-8 pt-6 border-t-2 border-[var(--color-border)]">
                <div className="flex justify-between items-center py-4 px-4 bg-[var(--color-text-heading)] text-[var(--color-surface)] rounded-lg shadow-lg">
                  <span className="text-base font-black uppercase tracking-widest">Net Change in Cash</span>
                  <span className="text-xl font-mono font-bold">{formatCurrency(netCashChange)}</span>
                </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default CashFlowStatement;
