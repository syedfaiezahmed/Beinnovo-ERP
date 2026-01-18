import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useTheme } from '../context/ThemeContext';
import api, { aiForecast, getDashboardLayout, saveDashboardLayout, getAnalyticsSum, getAnalyticsMonthly, aiDesignDashboard, getTransactions } from '../services/api';
import { 
  Wallet as LuWallet, 
  TrendingUp as LuTrendingUp, 
  TrendingDown as LuTrendingDown,
  DollarSign as LuDollarSign, 
  PieChart as LuPieChart, 
  BarChart3 as LuBarChart3,
  Activity as LuActivity,
  ArrowUpRight as LuArrowUpRight,
  ArrowDownRight as LuArrowDownRight,
  Calendar as LuCalendar,
  Plus as LuPlus,
  Settings as LuSettings,
  Trash2 as LuTrash2,
  Sparkles as LuSparkles,
  LayoutDashboard as LuLayoutDashboard,
  ShoppingBag as LuShoppingBag,
  Filter as LuFilter
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import { formatCurrency } from '../utils/exportUtils';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

// --- Power BI Style Components ---

const DATA_FIELDS = [
  { label: 'Revenue', value: 'revenue' },
  { label: 'Expense', value: 'expense' },
  { label: 'Net Profit', value: 'netProfit' },
  { label: 'Cash Flow', value: 'cashBalance' }
];

const DATA_DIMENSIONS = [
  { label: 'Monthly Trend', value: 'month' },
  { label: 'Category Breakdown', value: 'category' }
];

const CHART_TYPES = [
  { label: 'Line Chart', value: 'line_chart', icon: <LuTrendingUp size={16}/> },
  { label: 'Bar Chart', value: 'bar_chart', icon: <LuBarChart3 size={16}/> },
  { label: 'Doughnut', value: 'doughnut_chart', icon: <LuPieChart size={16}/> },
  { label: 'KPI Card', value: 'stat_card', icon: <LuWallet size={16}/> }
];

const EditorPanel = ({ widget, onUpdate, onClose, onDelete }) => {
  if (!widget) return null;

  const [activeTab, setActiveTab] = useState('data'); // data, visual, general

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-[var(--color-surface)] shadow-2xl z-[100] border-l border-[var(--color-border)] flex flex-col animate-slide-in-right">
      <div className="p-4 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-surface-hover)]">
        <h3 className="font-bold text-[var(--color-text-heading)] flex items-center gap-2">
          <LuSettings size={18} /> Edit Widget
        </h3>
        <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-heading)]">
          <LuPlus size={24} className="rotate-45" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-border)]">
        {['data', 'visual', 'general'].map(tab => (
           <button
             key={tab}
             onClick={() => setActiveTab(tab)}
             className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === tab ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-heading)]'}`}
           >
             {tab}
           </button>
        ))}
      </div>
      
      <div className="flex-1 overflow-y-auto p-5 space-y-8 custom-scrollbar">
        
        {/* DATA TAB */}
        {activeTab === 'data' && (
           <div className="space-y-6">
              {(widget.type === 'stat_card' || widget.type === 'line_chart' || widget.type === 'bar_chart' || widget.type === 'doughnut_chart') && (
                 <>
                   <div className="space-y-3">
                     <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase flex items-center gap-2">
                       <LuActivity size={14}/> Metric / Field
                     </label>
                     <div className="grid grid-cols-1 gap-2">
                        {DATA_FIELDS.map(field => (
                          <button
                            key={field.value}
                            onClick={() => onUpdate({ ...widget, props: { ...widget.props, dataKey: field.value } })}
                            className={`flex items-center justify-between p-3 rounded-lg border text-sm font-medium transition-all ${widget.props?.dataKey === field.value ? 'bg-primary/10 border-primary text-primary shadow-sm' : 'bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'}`}
                          >
                            {field.label}
                            {widget.props?.dataKey === field.value && <div className="w-2 h-2 rounded-full bg-primary"></div>}
                          </button>
                        ))}
                     </div>
                   </div>

                   {(widget.type !== 'stat_card') && (
                     <div className="space-y-3">
                       <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase flex items-center gap-2">
                         <LuCalendar size={14}/> Dimension
                       </label>
                        <select 
                           value={widget.props?.dimension || 'month'} 
                           onChange={(e) => onUpdate({ ...widget, props: { ...widget.props, dimension: e.target.value } })}
                           className="w-full px-3 py-2.5 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-heading)] text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                         >
                           {DATA_DIMENSIONS.map(dim => (
                             <option key={dim.value} value={dim.value}>{dim.label}</option>
                           ))}
                         </select>
                     </div>
                   )}
                 </>
              )}
              
              {(widget.type === 'transaction_list' || widget.type === 'budget_planner') && (
                 <div className="space-y-3">
                    <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase">Items to Show</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="20"
                      value={widget.props?.limit || 5} 
                      onChange={(e) => onUpdate({ ...widget, props: { ...widget.props, limit: parseInt(e.target.value) } })}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-heading)] text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                    />
                 </div>
              )}
           </div>
        )}

        {/* VISUAL TAB */}
        {activeTab === 'visual' && (
          <div className="space-y-6">
            <div className="space-y-3">
               <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase">Chart Type</label>
               <div className="grid grid-cols-2 gap-2">
                 {CHART_TYPES.map(type => (
                   <button
                     key={type.value}
                     onClick={() => onUpdate({ ...widget, type: type.value })}
                     className={`flex items-center gap-2 p-3 rounded-lg border text-xs font-medium transition-all ${widget.type === type.value ? 'bg-primary/10 border-primary text-primary' : 'bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]'}`}
                   >
                     {type.icon} {type.label}
                   </button>
                 ))}
               </div>
            </div>

            <div className="space-y-3">
               <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase">Accent Color</label>
               <div className="flex gap-3 flex-wrap">
                 {['primary', 'success', 'danger', 'warning', 'info'].map(color => (
                   <button
                     key={color}
                     onClick={() => onUpdate({ ...widget, props: { ...widget.props, color } })}
                     className={`w-10 h-10 rounded-full border-4 transition-transform hover:scale-110 ${widget.props?.color === color ? 'border-[var(--color-text-heading)] scale-110 shadow-lg' : 'border-transparent shadow-sm'}`}
                     style={{ backgroundColor: `var(--color-${color})` }}
                   />
                 ))}
               </div>
            </div>

            {(widget.type.includes('chart')) && (
                <div className="p-4 bg-[var(--color-bg)] rounded-xl border border-[var(--color-border)] space-y-3">
                    <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase">Display Options</label>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-[var(--color-text)]">Show Legend</span>
                        <input 
                            type="checkbox" 
                            checked={widget.props?.showLegend !== false}
                            onChange={(e) => onUpdate({ ...widget, props: { ...widget.props, showLegend: e.target.checked } })}
                            className="toggle-checkbox accent-primary h-5 w-5"
                        />
                    </div>
                </div>
            )}
            
            {widget.type === 'stat_card' && (
                 <div className="p-4 bg-[var(--color-bg)] rounded-xl border border-[var(--color-border)] space-y-3">
                    <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase">Display Options</label>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-[var(--color-text)]">Show Trend Indicator</span>
                        <input 
                            type="checkbox" 
                            checked={widget.props?.showTrend !== false}
                            onChange={(e) => onUpdate({ ...widget, props: { ...widget.props, showTrend: e.target.checked } })}
                            className="toggle-checkbox accent-primary h-5 w-5"
                        />
                    </div>
                </div>
            )}
          </div>
        )}

        {/* GENERAL TAB */}
        {activeTab === 'general' && (
           <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase">Widget Title</label>
                <input 
                  type="text" 
                  value={widget.title} 
                  onChange={(e) => onUpdate({ ...widget, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-heading)] text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase">Width (Grid Columns)</label>
                <div className="flex items-center gap-4 bg-[var(--color-bg)] p-3 rounded-lg border border-[var(--color-border)]">
                   <input 
                     type="range" 
                     min="3" 
                     max="12" 
                     value={widget.w} 
                     onChange={(e) => onUpdate({ ...widget, w: parseInt(e.target.value) })}
                     className="flex-1 accent-primary h-2 bg-[var(--color-border)] rounded-lg appearance-none cursor-pointer"
                   />
                   <span className="font-mono text-sm font-bold text-white bg-primary px-2 py-1 rounded w-10 text-center">{widget.w}</span>
                </div>
                <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] uppercase font-bold tracking-wider">
                   <span>Quarter</span>
                   <span>Half</span>
                   <span>Full Width</span>
                </div>
              </div>
           </div>
        )}
      </div>

      <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-surface-hover)]">
         <button 
           onClick={onDelete}
           className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-danger text-white hover:bg-danger-dark font-bold text-sm transition-all shadow-md hover:shadow-lg"
         >
           <LuTrash2 size={16} /> Delete Widget
         </button>
      </div>
    </div>
  );
};

const WidgetWrapper = ({ widget, editMode, onEdit, children }) => (
  <div className={`card-base flex flex-col relative transition-all duration-300 h-full ${editMode ? 'border-2 border-dashed border-primary/50 hover:border-primary cursor-move transform hover:scale-[0.99] z-10' : 'border border-[var(--color-border)] shadow-sm'}`} 
       style={{ gridColumn: `span ${widget.w} / span ${widget.w}` }}
       onClick={() => editMode && onEdit(widget)}
  >
    {editMode && (
      <div className="absolute top-2 right-2 z-50 flex gap-1 animate-fade-in">
          <div className="bg-primary text-white p-1.5 rounded-full shadow-sm">
              <LuSettings size={12} />
          </div>
      </div>
    )}
    {children}
  </div>
);

const Dashboard = () => {
  const { theme } = useTheme();
  const [period, setPeriod] = useState('thisYear');
  const [loading, setLoading] = useState(true);
  
  // State for data
  const [kpiData, setKpiData] = useState({
    revenue: 0,
    expense: 0,
    netProfit: 0,
    cashBalance: 0
  });
  const [trendData, setTrendData] = useState([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [aiInsights, setAiInsights] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [layout, setLayout] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showAIDesigner, setShowAIDesigner] = useState(false);
  const [aiDesignPrompt, setAiDesignPrompt] = useState('Executive overview: Revenue, Expense, Net Profit, Cash, monthly trends.');
  const [aiDesignLoading, setAiDesignLoading] = useState(false);
  const [customKpiValues, setCustomKpiValues] = useState({});
  const [customChartData, setCustomChartData] = useState({});
  const [activeWidgetId, setActiveWidgetId] = useState(null);
  const [widgetForm, setWidgetForm] = useState({
    title: 'Custom KPI',
    source: 'type',
    type: 'Revenue',
    codes: '',
    period: 'thisYear',
    colorClass: 'primary',
    bgClass: 'bg-primary',
    w: 3
  });

  // Fetch Data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [kpiRes, trendRes, expenseRes, txRes] = await Promise.all([
        api.get('/dashboard/kpi-summary', { params: { period } }),
        api.get('/dashboard/financial-trends', { params: { period } }),
        api.get('/dashboard/expense-breakdown', { params: { period } }),
        getTransactions({ limit: 10 })
      ]);

      setKpiData(kpiRes.data || { revenue: 0, expense: 0, netProfit: 0, cashBalance: 0 });
      setTrendData(Array.isArray(trendRes.data) ? trendRes.data : []);
      setExpenseBreakdown(Array.isArray(expenseRes.data) ? expenseRes.data : []);
      setRecentTransactions(Array.isArray(txRes.data) ? txRes.data : []);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      setKpiData({ revenue: 0, expense: 0, netProfit: 0, cashBalance: 0 });
      setTrendData([]);
      setExpenseBreakdown([]);
      setRecentTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchAiForecast();
  }, [period]);

  const defaultLayout = useMemo(() => ([
    { id: 'kpi-net', type: 'stat_card', title: 'Total Balance', w: 3, props: { dataKey: 'netProfit', color: 'primary', trend: 'up', trendValue: '4.1' } },
    { id: 'kpi-revenue', type: 'stat_card', title: 'Income', w: 3, props: { dataKey: 'revenue', color: 'success', trend: 'up', trendValue: '8.2' } },
    { id: 'kpi-expense', type: 'stat_card', title: 'Expenses', w: 3, props: { dataKey: 'expense', color: 'danger', trend: 'down', trendValue: '2.8' } },
    { id: 'kpi-cash', type: 'stat_card', title: 'Cash Balance', w: 3, props: { dataKey: 'cashBalance', color: 'warning', trend: 'up', trendValue: '1.2' } },
    { id: 'line-trends', type: 'line_chart', title: 'Cash Flow', w: 8, props: { } },
    { id: 'expense-donut', type: 'doughnut_chart', title: 'Expense Breakdown', w: 4, props: { } },
    { id: 'bar-netprofit', type: 'bar_chart', title: 'Net Profit Trend', w: 6, props: { } },
    { id: 'budget-planner', type: 'budget_planner', title: 'Budget Planning', w: 6, props: { } },
    { id: 'transaction-list', type: 'transaction_list', title: 'Recent Transactions', w: 4, props: { } },
    { id: 'credit-limits', type: 'credit_limits', title: 'Credit Limits', w: 4, props: { } },
    { id: 'ai-forecast', type: 'ai_insights', title: 'AI Forecast', w: 4, props: { } }
  ]), []);

  const loadLayout = useCallback(async () => {
    try {
      const res = await getDashboardLayout();
      let serverLayout = Array.isArray(res.data) ? res.data : [];
      
      // Normalize layout types from backend/AI to frontend component types
      serverLayout = serverLayout.map(w => {
        let type = w.type;
        let props = w.props || w.config || {};
        let title = w.title || (w.config && w.config.title) || 'Widget';

        // Map backend/AI types to frontend types
        const typeMap = {
          'kpi-custom': 'stat_card',
          'line': 'line_chart',
          'bar': 'bar_chart',
          'doughnut': 'doughnut_chart',
          'pie': 'doughnut_chart',
          'pie_chart': 'doughnut_chart',
          'ai': 'ai_insights',
          'kpi': 'stat_card',
          'chart': 'line_chart',
          'transaction-list': 'transaction_list',
          'transactions': 'transaction_list',
          'list': 'transaction_list',
          'budget': 'budget_planner',
          'budget-planner': 'budget_planner',
          'credit': 'credit_limits',
          'credit-limits': 'credit_limits'
        };

        if (typeMap[type]) {
          type = typeMap[type];
        }

        // Fallback for completely unknown types
        const validTypes = ['stat_card', 'line_chart', 'bar_chart', 'doughnut_chart', 'ai_insights', 'transaction_list', 'budget_planner', 'credit_limits'];
        if (!validTypes.includes(type)) {
             // Try to guess based on props or title
             if (title.toLowerCase().includes('transaction') || title.toLowerCase().includes('recent')) type = 'transaction_list';
             else if (title.toLowerCase().includes('budget')) type = 'budget_planner';
             else if (title.toLowerCase().includes('forecast') || title.toLowerCase().includes('ai')) type = 'ai_insights';
             else type = 'stat_card'; // Default to stat card
        }

        // Ensure props has necessary defaults if coming from config
        if (!props.dataKey && w.config?.type) {
             // Map AI config type to dataKey
             const keyMap = { 'Revenue': 'revenue', 'Expense': 'expense', 'Net Profit': 'netProfit', 'Cash': 'cashBalance' };
             if (keyMap[w.config.type]) props.dataKey = keyMap[w.config.type];
        }

        return { ...w, type, title, props };
      });

      setLayout(serverLayout.length ? serverLayout : defaultLayout);
    } catch {
      setLayout(defaultLayout);
    }
  }, [defaultLayout]);

  useEffect(() => {
    loadLayout();
  }, [loadLayout]);

  const handleUpdateWidget = (updatedWidget) => {
    setLayout(prev => prev.map(w => w.id === updatedWidget.id ? updatedWidget : w));
  };

  const handleDeleteWidget = (widgetId) => {
    setLayout(prev => prev.filter(w => w.id !== widgetId));
    setActiveWidgetId(null);
  };

  const handleSaveLayout = async () => {
    try {
      setLoading(true);
      // In a real app, this would save to backend
      await saveDashboardLayout(layout);
      setEditMode(false);
    } catch (error) {
      console.error("Failed to save layout", error);
      // Fallback if API fails or not implemented fully
      localStorage.setItem('dashboard_layout', JSON.stringify(layout));
      setEditMode(false);
    } finally {
      setLoading(false);
    }
  };

  const handleAddWidget = (type) => {
    const newWidget = {
      id: `widget-${Date.now()}`,
      type: type,
      title: 'New Widget',
      w: 6,
      props: { color: 'primary' }
    };
    setLayout(prev => [...prev, newWidget]);
    setActiveWidgetId(newWidget.id);
  };

  // Helper Functions for Chart Data & Options - Consolidated below
  // Removing duplicate definitions from here to avoid conflicts


  const renderWidgetContent = (widget) => {
    switch (widget.type) {
      case 'stat_card':
        const amount = kpiData[widget.props?.dataKey || 'revenue'] || 0;
        return (
          <StatCard 
            title={widget.title} 
            amount={amount} 
            trend={widget.props?.trend || 'up'} 
            trendValue={widget.props?.trendValue || '0.0'} 
            colorClass={widget.props?.color || 'primary'} 
            data={[10, 15, 12, 20, 18, 25]} 
          />
        );
      case 'line_chart':
        return (
            <div className="h-full flex flex-col p-5">
                <div className="flex justify-between items-center mb-4">
                   <h3 className="font-bold text-base text-[var(--color-text-heading)] uppercase tracking-wider">{widget.title}</h3>
                </div>
                <div className="flex-1">
                   <Line data={getWidgetData(widget)} options={getChartOptions(widget)} />
                </div>
            </div>
        );
      case 'doughnut_chart':
        return (
            <div className="h-full flex flex-col p-5">
                 <div className="flex justify-between items-center mb-4">
                   <h3 className="font-bold text-base text-[var(--color-text-heading)] uppercase tracking-wider">{widget.title}</h3>
                 </div>
                 <div className="flex-1 flex items-center justify-center">
                    <div className="relative w-full max-w-[220px] aspect-square mx-auto">
                        <Doughnut data={getWidgetData(widget)} options={getDoughnutOptions(widget)} />
                        <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                           <span className="text-2xl font-black text-[var(--color-text-heading)] tracking-tight">
                               {formatCurrency(expenseBreakdown.reduce((acc, curr) => acc + curr.amount, 0))}
                           </span>
                           <span className="text-[10px] text-[var(--color-text-muted)] uppercase font-bold tracking-widest mt-0.5">Total</span>
                        </div>
                    </div>
                 </div>
            </div>
        );
      case 'bar_chart':
        return (
            <div className="h-full flex flex-col p-5">
                 <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-base text-[var(--color-text-heading)] uppercase tracking-wider">{widget.title}</h3>
                 </div>
                 <div className="flex-1">
                    <Bar data={getWidgetData(widget)} options={getChartOptions(widget)} />
                 </div>
            </div>
        );
      case 'transaction_list':
        return <TransactionList limit={widget.props?.limit || 5} transactions={recentTransactions} />;
      case 'budget_planner':
        return (
              <div className="h-full flex flex-col p-5 overflow-y-auto custom-scrollbar">
                 <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-base text-[var(--color-text-heading)] uppercase tracking-wider">{widget.title}</h3>
                 </div>
                 <div className="space-y-5">
                    {[
                      { label: 'New Office Setup', current: 3100, target: 4000, color: 'bg-primary' },
                      { label: 'Marketing Campaign', current: 2000, target: 10000, color: 'bg-secondary' },
                      { label: 'Software Licenses', current: 2100, target: 3200, color: 'bg-info' },
                      { label: 'Employee Bonus', current: 1680, target: 1800, color: 'bg-warning' },
                      { label: 'Travel Expenses', current: 1200, target: 5000, color: 'bg-danger' },
                      { label: 'Training', current: 500, target: 2000, color: 'bg-success' },
                    ].slice(0, widget.props?.limit || 4).map((item, idx) => (
                      <div key={idx}>
                         <div className="flex justify-between text-sm mb-2 font-bold">
                            <span className="text-[var(--color-text-heading)]">{item.label}</span>
                            <span className="text-[var(--color-text-muted)] font-mono">{formatCurrency(item.current)} / {formatCurrency(item.target)}</span>
                         </div>
                         <div className="h-2.5 w-full bg-[var(--color-surface-hover)] rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${item.color} shadow-sm`} style={{ width: `${(item.current / item.target) * 100}%` }}></div>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
        );
      case 'credit_limits':
        return (
           <div className="h-full flex flex-col p-5">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-base text-[var(--color-text-heading)] uppercase tracking-wider">{widget.title}</h3>
              </div>
              
              <div className="relative h-48 mb-6">
                 <Doughnut 
                    data={{
                        labels: ['Used', 'Available'],
                        datasets: [{
                            data: [3045, 955],
                            backgroundColor: [chartColors.primary, chartColors.info],
                            borderWidth: 0,
                            cutout: '65%',
                        }]
                    }}
                    options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false }, tooltip: { enabled: true } }
                    }}
                 />
                 <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                    <span className="text-3xl font-black text-[var(--color-text-heading)] tracking-tight">$3,045</span>
                    <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Used</span>
                 </div>
              </div>
           </div>
        );
      case 'ai_insights':
        return (
            <div className="h-full flex flex-col">
                <div className="p-4 border-b border-[var(--color-border)] flex justify-between items-center bg-primary/5">
                  <div className="flex items-center gap-3">
                     <div className="p-2 bg-primary rounded-lg text-white shadow-sm">
                        <LuSparkles size={16} />
                     </div>
                     <div>
                        <h3 className="text-sm font-bold text-[var(--color-text-heading)] uppercase tracking-wider">{widget.title}</h3>
                     </div>
                  </div>
                </div>
                <div className="p-5 bg-[var(--color-surface)] relative min-h-[120px] flex-1 overflow-y-auto">
                  {aiInsights ? (
                    <div className="prose prose-sm prose-invert max-w-none text-[var(--color-text)] relative z-10">
                      <p className="whitespace-pre-line leading-relaxed font-medium text-sm text-justify">{aiInsights}</p>
                    </div>
                  ) : (
                    <div className="text-center py-6 flex flex-col items-center gap-3">
                      <div className="p-3 bg-[var(--color-surface-hover)] rounded-full text-[var(--color-text-muted)]">
                         <LuSparkles size={24} />
                      </div>
                      <p className="text-sm font-medium text-[var(--color-text-muted)]">Generate forecast to see AI predictions.</p>
                    </div>
                  )}
                </div>
            </div>
        );
      default:
        return <div>Unknown Widget</div>;
    }
  };
  
  const fetchAiForecast = async () => {
    try {
      setAiLoading(true);
      const res = await aiForecast();
      setAiInsights(res.data?.insights || '');
    } catch (error) {
      console.error("Error fetching AI insights:", error);
      setAiInsights('');
    } finally {
      setAiLoading(false);
    }
  };

  const getThemeColor = (variable) => {
    return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  };

  const [chartColors, setChartColors] = useState({
    primary: '#4361ee',
    danger: '#f72585',
    success: '#4cc9f0',
    warning: '#f8961e',
    info: '#3f37c9'
  });

  useEffect(() => {
    // Small delay to ensure DOM is updated
    const timer = setTimeout(() => {
      setChartColors({
        primary: getThemeColor('--color-primary') || '#4361ee',
        danger: getThemeColor('--color-danger') || '#f72585',
        success: getThemeColor('--color-success') || '#4cc9f0',
        warning: getThemeColor('--color-warning') || '#f8961e',
        info: getThemeColor('--color-secondary') || '#3f37c9'
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [theme]);

  // --- Chart Configurations ---
  
  const chartTextColor = getThemeColor('--color-text-muted') || '#64748b';
  const chartGridColor = getThemeColor('--color-border') || '#e2e8f0';
  const chartTooltipBg = getThemeColor('--color-surface') || '#ffffff';
  const chartTooltipText = getThemeColor('--color-text-heading') || '#0f172a';
  const chartTooltipBorder = getThemeColor('--color-border') || '#cbd5e1';

  const getChartOptions = (widget) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        display: widget?.props?.showLegend !== false,
        position: 'top',
        align: 'end',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 6,
          font: { family: 'Inter', size: 12, weight: 500 },
          color: chartTextColor,
          padding: 10
        }
      },
      title: { 
        display: false 
      },
      tooltip: {
        backgroundColor: chartTooltipBg,
        padding: 8,
        titleColor: chartTooltipText,
        bodyColor: chartTooltipText,
        titleFont: { family: 'Inter', size: 12, weight: 600 },
        bodyFont: { family: 'Inter', size: 12 },
        cornerRadius: 8,
        displayColors: true,
        boxPadding: 4,
        borderColor: chartTooltipBorder,
        borderWidth: 1,
        shadowOffsetX: 0,
        shadowOffsetY: 4,
        shadowBlur: 10,
        shadowColor: 'rgba(0,0,0,0.1)'
      }
    },
    scales: {
      y: { 
        beginAtZero: true, 
        grid: { color: chartGridColor, drawBorder: false, borderDash: [4, 4] },
        ticks: { font: { family: 'Inter', size: 11 }, color: chartTextColor, padding: 6 },
        border: { display: false }
      },
      x: { 
        grid: { display: false },
        ticks: { font: { family: 'Inter', size: 11 }, color: chartTextColor, padding: 6 },
        border: { display: false }
      },
    },
    elements: {
      point: { radius: 0, hitRadius: 20, hoverRadius: 4, hoverBorderWidth: 2 },
      line: { borderWidth: 1.5 }
    }
  });

  // --- Dynamic Data Binding ---
  const getWidgetData = (widget) => {
    const labels = trendData.map(d => {
        const date = new Date(0, d.month - 1);
        return date.toLocaleString('default', { month: 'short' });
    });

    const primaryColor = chartColors[widget.props?.color] || chartColors.primary;

    // Common Dataset Factory
    const createDataset = (label, data, color, type = 'line') => {
        const isLine = type === 'line';
        return {
            label,
            data,
            borderColor: color,
            backgroundColor: isLine ? (context) => {
                const ctx = context.chart.ctx;
                const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                gradient.addColorStop(0, `${color}33`);
                gradient.addColorStop(1, `${color}00`);
                return gradient;
            } : color,
            fill: isLine,
            tension: 0.4,
            borderRadius: isLine ? 0 : 4,
        };
    };

    // 1. Line & Bar Charts
    if (widget.type === 'line_chart' || widget.type === 'bar_chart') {
        const chartType = widget.type === 'line_chart' ? 'line' : 'bar';
        
        // Single Metric
        if (widget.props?.dataKey && widget.props.dataKey !== 'all') {
             const keyMap = {
                 'revenue': { label: 'Revenue', data: trendData.map(d => d.revenue) },
                 'expense': { label: 'Expense', data: trendData.map(d => d.expense) },
                 'netProfit': { label: 'Net Profit', data: trendData.map(d => d.revenue - d.expense) },
                 'cashBalance': { label: 'Cash Flow', data: trendData.map(d => (d.revenue - d.expense) * 0.8) } // Mock cash flow logic
             };
             
             const metric = keyMap[widget.props.dataKey] || keyMap['revenue'];
             
             return {
                 labels,
                 datasets: [createDataset(metric.label, metric.data, primaryColor, chartType)]
             };
        }
        
        // Default / Comparative (Revenue vs Expense)
        return {
            labels,
            datasets: [
                createDataset('Revenue', trendData.map(d => d.revenue), chartColors.primary, chartType),
                createDataset('Expenses', trendData.map(d => d.expense), chartColors.danger, chartType)
            ]
        };
    }

    // 2. Doughnut Chart
    if (widget.type === 'doughnut_chart') {
        if (widget.props?.dimension === 'category' || !widget.props?.dimension) {
            return {
                labels: expenseBreakdown.map(e => e._id),
                datasets: [{
                    label: 'Amount',
                    data: expenseBreakdown.map(e => e.amount),
                    backgroundColor: [chartColors.primary, chartColors.info, chartColors.success, chartColors.danger, chartColors.warning],
                    borderWidth: 0,
                    borderRadius: 0,
                    spacing: 0,
                    hoverOffset: 4
                }]
            };
        }
        // Fallback or other dimensions can be added here
    }

    return { labels: [], datasets: [] };
  };

  const getDoughnutOptions = (widget) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: widget?.props?.showLegend !== false,
        position: 'bottom',
        labels: {
          boxWidth: 10,
          usePointStyle: true,
          font: { family: 'Inter', size: 12 },
          color: chartTextColor,
          padding: 12
        },
        onClick: () => {}
      }
    },
    cutout: '70%'
  });



  

  const StatCard = ({ title, amount, trend, trendValue, colorClass, data }) => {
    // Mini Chart Data
    const miniChartData = {
      labels: ['1', '2', '3', '4', '5', '6'],
      datasets: [{
        data: data || [10, 25, 20, 40, 35, 50],
        borderColor: chartColors[colorClass],
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 100);
          gradient.addColorStop(0, `${chartColors[colorClass]}20`); // 10% opacity
          gradient.addColorStop(1, `${chartColors[colorClass]}00`); // 0% opacity
          return gradient;
        },
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0
      }]
    };

    const miniChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { x: { display: false }, y: { display: false } },
      layout: { padding: 0 }
    };

    return (
      <div className={`card-base p-4 flex flex-col justify-between h-32 relative overflow-hidden group hover:shadow-md transition-all ${editMode ? 'border-2 border-dashed border-primary cursor-move transform scale-[0.98]' : ''}`}>
        {editMode && (
           <div className="absolute top-2 right-2 z-50 flex gap-1 animate-fade-in">
               <button className="bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-primary p-1.5 rounded-full shadow-sm border border-[var(--color-border)]">
                   <LuSettings size={12} />
               </button>
               <button className="bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-danger p-1.5 rounded-full shadow-sm border border-[var(--color-border)]">
                   <LuTrash2 size={12} />
               </button>
           </div>
        )}
        <div className="flex justify-between items-start z-10">
           <div>
             <p className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">{title}</p>
             <h3 className="text-2xl font-black mt-1 text-[var(--color-text-heading)] tracking-tight">{formatCurrency(amount)}</h3>
           </div>
           <div className={`p-2 rounded-lg bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] group-hover:bg-${colorClass}/10 group-hover:text-${colorClass} transition-colors`}>
              {colorClass === 'primary' && <LuWallet size={20} />}
              {colorClass === 'success' && <LuTrendingUp size={20} />}
              {colorClass === 'danger' && <LuTrendingDown size={20} />}
           </div>
        </div>
        
        <div className="flex items-end justify-between z-10 mt-2">
            {trend && (
             <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${trend === 'up' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
              {trend === 'up' ? <LuArrowUpRight size={14} /> : <LuArrowDownRight size={14} />}
              {trendValue}% <span className="font-medium opacity-70 ml-1">vs last month</span>
            </div>
           )}
        </div>

        <div className="h-16 absolute -bottom-4 -left-4 -right-4 z-0 opacity-30 group-hover:opacity-50 transition-opacity">
           <Line data={miniChartData} options={miniChartOptions} />
        </div>
      </div>
    );
  };

  // Removed CreditCardWidget to match professional financial look

  const TransactionList = ({ transactions = [], limit = 5, onViewAll }) => {
    // Transform backend transactions to display format
    const displayTransactions = (transactions || []).slice(0, limit).map(tx => {
      // Determine type based on entries
      let type = 'journal';
      let amount = 0;
      
      // Calculate total amount (sum of debits)
      const totalAmount = tx.entries.reduce((sum, e) => sum + (e.debit || 0), 0);
      amount = totalAmount; // In a balanced transaction, sum(debit) == sum(credit), so this is the transaction volume

      // Check for Revenue (Credit to 4xx)
      const isRevenue = tx.entries.some(e => e.accountCode && e.accountCode.toString().startsWith('4') && e.credit > 0);
      // Check for Expense (Debit to 5xx)
      const isExpense = tx.entries.some(e => e.accountCode && e.accountCode.toString().startsWith('5') && e.debit > 0);
      // Check for Transfer (Asset to Asset, e.g., Cash to Bank)
      const isAssetOnly = tx.entries.every(e => e.accountCode && e.accountCode.toString().startsWith('1'));

      if (isRevenue) {
        type = 'income';
      } else if (isExpense) {
        type = 'expense';
      } else if (isAssetOnly) {
        type = 'transfer';
      }

      // Override based on explicit transaction type if available
      if (tx.type === 'Invoice') type = 'income';
      if (tx.type === 'Bill') type = 'expense';
      if (tx.type === 'Payment') type = 'expense'; // Paying a bill
      if (tx.type === 'Receipt') type = 'income'; // Receiving payment

      return {
        id: tx._id,
        name: tx.description || 'Transaction',
        date: new Date(tx.date).toLocaleDateString(),
        amount: amount,
        icon: type === 'income' ? <LuTrendingUp size={16} /> : (type === 'expense' ? <LuTrendingDown size={16} /> : (type === 'transfer' ? <LuArrowUpRight size={16} /> : <LuActivity size={16} />)),
        type: type,
        category: tx.type || 'Journal',
        colorClass: type === 'income' ? 'text-success' : (type === 'expense' ? 'text-danger' : (type === 'transfer' ? 'text-info' : 'text-[var(--color-text-heading)]'))
      };
    });

    return (
    <div className={`card-base p-0 overflow-hidden h-full flex flex-col relative transition-all ${editMode ? 'border-2 border-dashed border-primary cursor-move transform scale-[0.98]' : ''}`}>
      {editMode && (
        <div className="absolute top-2 right-2 z-50 flex gap-1">
            <LuSettings size={14} className="text-[var(--color-text-muted)] hover:text-primary cursor-pointer" />
        </div>
      )}
      <div className="p-4 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-surface-hover)]">
        <h3 className="font-bold text-base text-[var(--color-text-heading)] uppercase tracking-wider">Recent Transactions</h3>
        <button onClick={onViewAll} className="text-xs font-bold text-primary hover:underline">View All</button>
      </div>
      <div className="overflow-y-auto flex-1 p-0">
         {displayTransactions.length > 0 ? displayTransactions.map((item, idx) => (
           <div key={idx} className="flex items-center justify-between px-4 py-3 hover:bg-[var(--color-surface-hover)] transition-colors border-b border-[var(--color-border)] last:border-0 group">
             <div className="flex items-center gap-3">
               <div className={`p-2 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] group-hover:scale-110 transition-transform ${item.type === 'income' ? 'text-success' : (item.type === 'expense' ? 'text-danger' : (item.type === 'transfer' ? 'text-info' : 'text-primary'))}`}>
                 {item.icon}
               </div>
               <div>
                 <p className="text-sm font-bold text-[var(--color-text-heading)] truncate max-w-[150px]">{item.name}</p>
                 <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--color-text-muted)]">{item.date}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] border border-[var(--color-border)]">{item.category}</span>
                 </div>
               </div>
             </div>
             <span className={`text-sm font-bold font-mono ${item.colorClass}`}>
               {item.type === 'expense' ? '-' : (item.type === 'income' ? '+' : '')}{formatCurrency(item.amount)}
             </span>
           </div>
         )) : (
           <div className="p-4 text-center text-sm text-[var(--color-text-muted)]">No recent transactions</div>
         )}
      </div>
    </div>
  );
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[var(--color-surface)] p-6 rounded-2xl border border-[var(--color-border)] shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
            <LuActivity size={120} className="text-primary" />
        </div>
        <div className="relative z-10">
          <h1 className="text-2xl font-black text-[var(--color-text-heading)] tracking-tight">Financial Dashboard</h1>
          <p className="text-sm text-[var(--color-text-muted)] font-medium mt-1">Overview of your business performance and financial health.</p>
        </div>
        <div className="flex items-center gap-3 relative z-10 flex-wrap">
           <div className="flex bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-lg p-1 shadow-inner">
              <button 
                onClick={() => setPeriod('thisYear')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${period === 'thisYear' ? 'bg-primary text-white shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-heading)] hover:bg-[var(--color-surface)]'}`}
              >
                Year
              </button>
              <button 
                onClick={() => setPeriod('thisQuarter')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${period === 'thisQuarter' ? 'bg-primary text-white shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-heading)] hover:bg-[var(--color-surface)]'}`}
              >
                Quarter
              </button>
              <button 
                onClick={() => setPeriod('thisMonth')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${period === 'thisMonth' ? 'bg-primary text-white shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-heading)] hover:bg-[var(--color-surface)]'}`}
              >
                Month
              </button>
           </div>
           
           <div className="h-6 w-px bg-[var(--color-border)] mx-1 hidden sm:block"></div>

           {editMode ? (
              <button 
                onClick={handleSaveLayout}
                className="flex items-center gap-2 text-xs font-bold py-2 px-3 rounded-lg transition-all bg-primary text-white border border-primary hover:bg-primary-dark shadow-md animate-fade-in"
              >
                <LuLayoutDashboard size={14} />
                Save Layout
              </button>
           ) : (
             <button 
               onClick={() => setEditMode(true)}
               className="flex items-center gap-2 text-xs font-bold py-2 px-3 rounded-lg transition-all bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-heading)]"
             >
               <LuLayoutDashboard size={14} />
               Customize
             </button>
           )}

           <button onClick={fetchAiForecast} className="btn-primary flex items-center gap-2 text-xs font-bold py-2 px-4 shadow-lg shadow-primary/20">
             <LuSparkles size={14} /> AI Insights
           </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 relative">
        {layout.map((widget, index) => (
          <WidgetWrapper 
            key={widget.id} 
            widget={widget} 
            editMode={editMode} 
            onEdit={(w) => setActiveWidgetId(w.id)}
          >
            {renderWidgetContent(widget)}
          </WidgetWrapper>
        ))}

        {editMode && (
          <div className="col-span-12 md:col-span-3 min-h-[150px] border-2 border-dashed border-[var(--color-border)] rounded-2xl flex flex-col items-center justify-center text-[var(--color-text-muted)] hover:border-primary hover:text-primary transition-all cursor-pointer group bg-[var(--color-surface)]"
               onClick={() => handleAddWidget('stat_card')}
          >
             <div className="p-3 bg-[var(--color-surface-hover)] rounded-full mb-3 group-hover:bg-primary/10 transition-colors">
                <LuPlus size={24} />
             </div>
             <p className="font-bold text-sm">Add New Widget</p>
          </div>
        )}
      </div>

      {activeWidgetId && (
        <EditorPanel 
          widget={layout.find(w => w.id === activeWidgetId)} 
          onUpdate={handleUpdateWidget} 
          onClose={() => setActiveWidgetId(null)}
          onDelete={() => handleDeleteWidget(activeWidgetId)}
        />
      )}
    </div>
  );
};

export default Dashboard;
// End of Dashboard Component
