import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Plus as LuPlus, 
  User as LuUser, 
  Printer as LuPrinter, 
  Download as LuDownload, 
  FileText as LuFileText, 
  Eye as LuEye, 
  Bot as LuBot, 
  Send as LuSend, 
  Trash2 as LuTrash2, 
  Sparkles as LuSparkles,
  Search as LuSearch,
  Filter as LuFilter,
  Calendar as LuCalendar
} from 'lucide-react';
import DateFilter from '../components/DateFilter';
import { handlePrint, exportToPDF, exportToExcel, generateInvoicePDF, formatCurrency, formatNumber } from '../utils/exportUtils';
import InvoicePreviewModal from '../components/InvoicePreviewModal';
import api, { aiAssist } from '../services/api';

const Invoicing = () => {
  const [showForm, setShowForm] = useState(false);
  const location = useLocation();
  const [, setFilter] = useState({ period: 'This Month', customRange: { start: '', end: '' } });
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  
  // Data State
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  // AI State
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  // Settings State
  const [settings, setSettings] = useState({
    currencySymbol: '$',
    invoicePrefix: 'INV-',
    invoiceNextNumber: 1001,
    defaultTaxRate: 0
  });

  // Load Settings
  useEffect(() => {
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error("Failed to load settings", e);
      }
    }
  }, []);

  // Fetch Data from API
  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodRes, custRes, invRes] = await Promise.all([
        api.get('/products'),
        api.get('/partners'),
        api.get('/invoices')
      ]);
      
      setProducts(Array.isArray(prodRes.data) ? prodRes.data : []);
      // Filter partners for Customers or Both
      const partnersData = Array.isArray(custRes.data) ? custRes.data : [];
      setCustomers(partnersData.filter(p => p.type === 'Customer' || p.type === 'Both'));
      setInvoices(Array.isArray(invRes.data) ? invRes.data : []);
    } catch (error) {
      console.error("Error fetching data:", error);
      setProducts([]);
      setCustomers([]);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle AI Draft
  useEffect(() => {
    if (location.state?.draftInvoice && !loading) {
      const draft = location.state.draftInvoice;
      setShowForm(true);
      
      if (draft.partnerName && customers.length > 0) {
        const match = customers.find(c => c.name.toLowerCase().includes(draft.partnerName.toLowerCase()));
        if (match) setSelectedCustomer(match._id);
      }
      
      if (draft.date) setInvoiceDate(draft.date);
      
      if (Array.isArray(draft.items)) {
        setInvoiceItems(draft.items.map((item, idx) => ({
            id: Date.now() + idx,
            product: '', 
            description: item.description || '',
            quantity: Number(item.quantity) || 1,
            price: Number(item.rate) || 0
        })));
      }
      
      // Clear state
      window.history.replaceState({}, document.title);
    }
  }, [location.state, loading, customers]);

  // State for new invoice form
  const [invoiceItems, setInvoiceItems] = useState([
    { id: 1, product: '', description: '', quantity: 1, price: 0 }
  ]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentInvoiceId, setCurrentInvoiceId] = useState('');
  const [newInvoice, setNewInvoice] = useState({ notes: '', terms: '' });

  // Update Invoice ID when form opens or settings change
  useEffect(() => {
    // Ideally fetch the next ID from backend to be safe, but using settings for now
    setCurrentInvoiceId(`${settings.invoicePrefix}${settings.invoiceNextNumber}`);
  }, [settings.invoicePrefix, settings.invoiceNextNumber]);

  // AI Handler
  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiProcessing(true);
    try {
      const res = await aiAssist(aiPrompt, 'invoice');
      if (res.data) {
        const draft = res.data;
        if (draft.partnerName && customers.length > 0) {
          const match = customers.find(c => c.name.toLowerCase().includes(draft.partnerName.toLowerCase()));
          if (match) setSelectedCustomer(match._id);
        }
        if (draft.date) setInvoiceDate(draft.date);
        if (Array.isArray(draft.items)) {
          setInvoiceItems(draft.items.map((item, idx) => ({
              id: Date.now() + idx,
              product: '', 
              description: item.description || '',
              quantity: Number(item.quantity) || 1,
              price: Number(item.rate) || 0
          })));
        }
        setShowForm(true);
        setAiPrompt('');
      }
    } catch (error) {
      console.error("AI Generation failed:", error);
      alert("AI Assistant could not generate the invoice. Please try a different prompt.");
    } finally {
      setIsAiProcessing(false);
    }
  };

  // Form Handlers
  const handleAddItem = () => {
    setInvoiceItems([...invoiceItems, { id: Date.now(), product: '', description: '', quantity: 1, price: 0 }]);
  };

  const handleRemoveItem = (id) => {
    if (invoiceItems.length > 1) {
      setInvoiceItems(invoiceItems.filter(item => item.id !== id));
    }
  };

  const handleItemChange = (id, field, value) => {
    const newItems = invoiceItems.map(item => {
      if (item.id === id) {
        let updates = { [field]: value };
        
        if (field === 'product') {
           // Find product by ID
           const product = products.find(p => p._id === value);
           if (product) {
             updates.price = product.salesPrice || 0;
             updates.description = product.name; 
             updates.product = product._id;
           }
        }
        return { ...item, ...updates };
      }
      return item;
    });
    setInvoiceItems(newItems);
  };

  // Calculations
  const subtotal = invoiceItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  const taxRate = parseFloat(settings.defaultTaxRate) || 0;
  const tax = (subtotal * taxRate) / 100;
  const total = subtotal + tax;

  const handleSaveInvoice = async () => {
    if (!selectedCustomer) {
        alert("Please select a customer");
        return;
    }

    const payload = {
      invoiceNumber: currentInvoiceId,
      customer: selectedCustomer, // ObjectId
      date: invoiceDate,
      dueDate: dueDate,
      items: invoiceItems.map(item => ({
        product: item.product || null, // ObjectId or null
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.price,
        amount: item.quantity * item.price
      })),
      subtotal: subtotal,
      taxTotal: tax,
      grandTotal: total,
      status: 'Sent' // Auto-finalize for now to trigger accounting
    };

    try {
        await api.post('/invoices', payload);
        
        // Update local settings for next number
        const newNextNumber = parseInt(settings.invoiceNextNumber) + 1;
        const newSettings = { ...settings, invoiceNextNumber: newNextNumber };
        setSettings(newSettings);
        localStorage.setItem('appSettings', JSON.stringify(newSettings));

        // Refresh Data
        fetchData();
        setShowForm(false);

        // Reset form
        setInvoiceItems([{ id: Date.now(), product: '', description: '', quantity: 1, price: 0 }]);
        setSelectedCustomer('');
        
    } catch (error) {
        console.error("Error saving invoice", error);
        alert(`Error saving invoice: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleViewInvoice = (invoice) => {
    const mappedInvoice = {
        ...invoice,
        id: invoice.invoiceNumber,
        customer: invoice.customer?.name || 'Unknown',
        total: invoice.grandTotal,
        items: (invoice.items || []).map(i => ({
            description: i.description,
            quantity: i.quantity,
            price: i.unitPrice,
            amount: i.amount
        }))
    };
    
    setPreviewInvoice(mappedInvoice);
    setShowPreview(true);
  };

  const handleExportPDF = () => {
    const columns = [
      { header: 'ID', dataKey: 'invoiceNumber' },
      { header: 'Customer', dataKey: 'customerName' },
      { header: 'Date', dataKey: 'date' },
      { header: 'Total', dataKey: 'grandTotal' },
      { header: 'Status', dataKey: 'status' }
    ];
    // Format total with currency
    const data = invoices.map(inv => ({
        ...inv,
        customerName: inv.customer?.name || 'Unknown',
        date: inv.date ? new Date(inv.date).toLocaleDateString() : 'N/A',
        grandTotal: formatCurrency(inv.grandTotal)
    }));
    exportToPDF(columns, data, 'Invoices List', 'invoices.pdf');
  };

  const handleExportExcel = () => {
    const data = invoices.map(inv => ({
        'Invoice #': inv.invoiceNumber,
        'Customer': inv.customer?.name || 'Unknown',
        'Date': new Date(inv.date).toLocaleDateString(),
        'Total': inv.grandTotal,
        'Status': inv.status
    }));
    exportToExcel(data, 'Invoices', 'invoices.xlsx');
  };

  return (
    <div className="animate-fade-in space-y-1">
      {showPreview && previewInvoice && (
        <InvoicePreviewModal 
          invoice={previewInvoice} 
          onClose={() => setShowPreview(false)} 
        />
      )}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-3">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-heading)] tracking-tight">{settings.companyName ? `${settings.companyName} - ` : ''}Invoicing</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Manage customer invoices and sales</p>
        </div>
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto items-center">
            <DateFilter onFilterChange={setFilter} />
            <div className="flex gap-2">
                 <button onClick={handlePrint} className="btn-secondary p-2.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)]" title="Print List">
                  <LuPrinter size={16} />
                </button>
                <button onClick={handleExportPDF} className="btn-secondary p-2.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)]" title="Export PDF">
                  <LuDownload size={16} />
                </button>
                 <button onClick={handleExportExcel} className="btn-secondary p-2.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)]" title="Export Excel">
                  <LuFileText size={16} />
                </button>
                <button 
                    onClick={() => setShowAiPanel(!showAiPanel)}
                    className={`btn-secondary py-2.5 px-4 flex items-center gap-2 text-sm font-medium ${
                        showAiPanel 
                        ? 'bg-secondary/10 border-secondary/30 text-secondary' 
                        : 'text-secondary hover:bg-secondary/10 hover:border-secondary/30'
                    }`}
                >
                    <LuSparkles size={16} /> AI Agent
                </button>
                <button 
                  onClick={() => setShowForm(!showForm)}
                  className="btn-primary py-2.5 px-4 flex items-center gap-2 text-sm font-medium"
                >
                  <LuPlus size={16} /> New Invoice
                </button>
            </div>
        </div>
      </div>

      {showAiPanel && (
        <div className="card-base p-6 border-l-4 border-l-secondary animate-slide-down bg-gradient-to-r from-secondary/5 to-transparent mb-6">
            <div className="flex items-center gap-2 mb-3 text-secondary font-bold text-sm">
                <LuBot size={16} />
                <span>AI Invoice Assistant</span>
            </div>
            <div className="flex gap-3">
                <input 
                    type="text" 
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="e.g. Create invoice for John Doe for Web Development $500"
                    className="input-base flex-1 text-sm py-2.5 px-3"
                    onKeyDown={(e) => e.key === 'Enter' && handleAiGenerate()}
                />
                <button 
                    onClick={handleAiGenerate}
                    disabled={isAiProcessing}
                    className="btn-primary bg-secondary hover:bg-secondary/90 border-secondary hover:border-secondary flex items-center gap-2 text-sm font-medium px-4 py-2.5"
                >
                    {isAiProcessing ? 'Thinking...' : <><LuSend size={16} /> Generate</>}
                </button>
            </div>
            <p className="text-sm text-purple-600 dark:text-purple-400 mt-2 flex items-center gap-1">
                <LuSparkles size={16} />
                AI will automatically detect customers and items. If an item is not in the Chart of Accounts, it will be added.
            </p>
        </div>
      )}

      {showForm ? (
        <div className="card-base p-6 animate-fade-in border-l-4 border-l-primary">
            <div className="flex justify-between items-center mb-6 pb-2 border-b border-[var(--color-border)]">
                <h3 className="text-lg font-bold text-[var(--color-text-heading)]">Create New Invoice</h3>
                <span className="text-sm font-mono bg-[var(--color-surface-hover)] text-[var(--color-text)] px-3 py-1 rounded-md border border-[var(--color-border)]">
                    ID: {currentInvoiceId}
                </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div>
                    <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-2">Customer</label>
                    <div className="relative">
                      <LuUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" size={16} />
                      <select 
                        value={selectedCustomer}
                        onChange={(e) => setSelectedCustomer(e.target.value)}
                        className="input-base w-full appearance-none text-sm py-2.5 pl-10 pr-3"
                      >
                          <option value="">Select Customer...</option>
                          {customers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                      </select>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-2">Invoice Date</label>
                    <div className="relative">
                      <LuCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" size={16} />
                      <input 
                        type="date" 
                        value={invoiceDate}
                        onChange={(e) => setInvoiceDate(e.target.value)}
                        className="input-base w-full text-sm py-2.5 pl-10 pr-3" 
                      />
                    </div>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-2">Due Date</label>
                    <div className="relative">
                      <LuCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" size={16} />
                      <input 
                        type="date" 
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="input-base w-full text-sm py-2.5 pl-10 pr-3" 
                      />
                    </div>
                </div>
            </div>

            {/* Line Items Section */}
            <div className="bg-[var(--color-surface-hover)]/30 rounded-xl p-6 border border-[var(--color-border)]/50">
                <h4 className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wider mb-3">Invoice Items</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left mb-2">
                    <thead className="text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                      <tr>
                        <th className="px-4 py-2.5 w-1/3 font-semibold text-sm">Product/Service</th>
                        <th className="px-4 py-2.5 w-1/3 font-semibold text-sm">Description</th>
                        <th className="px-4 py-2.5 w-16 font-semibold text-sm">Qty</th>
                        <th className="px-4 py-2.5 w-20 font-semibold text-sm">Price</th>
                        <th className="px-4 py-2.5 w-20 font-semibold text-sm">Amount</th>
                        <th className="px-4 py-2.5 w-6"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]/50">
                      {invoiceItems.map((item) => (
                        <tr key={item.id} className="group">
                          <td className="px-4 py-2.5">
                            <select 
                              value={item.product}
                              onChange={(e) => handleItemChange(item.id, 'product', e.target.value)}
                              className="input-base w-full py-2.5 text-sm"
                            >
                              <option value="">Select Product...</option>
                              {products.map(p => (
                                <option key={p._id} value={p._id}>{p.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2.5">
                            <input 
                              type="text" 
                              value={item.description}
                              onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                              className="input-base w-full py-2.5 px-3 text-sm"
                              placeholder="Description"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <input 
                              type="number" 
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                              className="input-base w-full py-2.5 text-sm text-right"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <input 
                              type="number" 
                              min="0"
                              step="0.01"
                              value={item.price}
                              onChange={(e) => handleItemChange(item.id, 'price', parseFloat(e.target.value) || 0)}
                              className="input-base w-full py-2.5 px-3 text-sm text-right"
                            />
                          </td>
                          <td className="px-3 py-2.5 font-medium text-right text-[var(--color-text)]">
                            {formatNumber(item.quantity * item.price)}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button 
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-danger hover:text-red-700 dark:hover:text-red-400 p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
                              title="Remove Item"
                            >
                              <LuTrash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                <button 
                  onClick={handleAddItem}
                  className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-dark font-medium mt-2 px-4 py-2.5 rounded-md hover:bg-primary/5 transition-colors"
                >
                  <LuPlus size={16} /> Add Line Item
                </button>

                <div className="flex justify-end border-t border-[var(--color-border)] pt-4 mt-4">
                  <div className="w-48 space-y-2">
                    <div className="flex justify-between text-sm text-[var(--color-text-muted)]">
                      <span>Subtotal:</span>
                      <span className="text-[var(--color-text-heading)] font-medium">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-[var(--color-text-muted)]">
                      <span>Tax ({taxRate}%):</span>
                      <span className="text-[var(--color-text-heading)] font-medium">{formatCurrency(tax)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-[var(--color-text-heading)] border-t border-[var(--color-border)] pt-2">
                      <span>Total:</span>
                      <span className="text-primary">{formatCurrency(total)}</span>
                    </div>
                  </div>
                </div>

                {/* Notes & Terms */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-2">Notes</label>
                    <textarea
                      value={newInvoice.notes}
                      onChange={(e) => setNewInvoice({ ...newInvoice, notes: e.target.value })}
                      className="input-base w-full h-12 text-sm resize-none py-2.5 px-3"
                      placeholder="Notes for the customer..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-2">Terms & Conditions</label>
                    <textarea
                      value={newInvoice.terms}
                      onChange={(e) => setNewInvoice({ ...newInvoice, terms: e.target.value })}
                      className="input-base w-full h-12 text-sm resize-none py-2.5 px-3"
                      placeholder="Payment terms, warranty, etc..."
                    />
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border)] mt-4">
                    <button onClick={() => setShowForm(false)} className="btn-secondary px-4 py-2.5 text-sm">Cancel</button>
                    <button 
                      onClick={handleSaveInvoice} 
                      className="btn-primary shadow-lg shadow-primary/20 px-4 py-2.5 text-sm font-medium"
                    >
                      Save Invoice
                    </button>
                </div>
            </div>
        </div>
      ) : (
        <div className="card-base overflow-hidden">
          {loading ? (
             <div className="p-4 text-center text-[var(--color-text-muted)] flex flex-col items-center gap-2">
               <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
               <p className="text-sm">Loading invoices...</p>
             </div>
          ) : (
          <div className="table-container">
            <table className="table-professional">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th className="text-right">Total</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {invoices.length > 0 ? invoices.map((inv) => (
                  <tr key={inv._id} className="group">
                    <td className="font-medium text-primary">{inv.invoiceNumber}</td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <LuUser size={16} />
                        </div>
                        <span className="font-medium text-[var(--color-text)]">{inv.customer?.name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="text-[var(--color-text-muted)]">{inv.date ? new Date(inv.date).toLocaleDateString() : 'N/A'}</td>
                    <td className="text-right font-bold text-[var(--color-text)]">{formatCurrency(inv.grandTotal)}</td>
                    <td className="text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                        inv.status === 'Paid' ? 'bg-success/10 text-success border-success/20' :
                        inv.status === 'Sent' ? 'bg-info/10 text-info border-info/20' :
                        'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] border-[var(--color-border)]'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="text-center">
                      <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button onClick={() => handleViewInvoice(inv)} className="p-2 text-[var(--color-text-muted)] hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="View"><LuEye size={18} /></button>
                       <button onClick={() => generateInvoicePDF(inv)} className="p-2 text-[var(--color-text-muted)] hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Download PDF"><LuDownload size={18} /></button>
                      </div>
                    </td>
                  </tr>
                )) : (
                   <tr>
                      <td colSpan="6" className="p-12 text-center text-[var(--color-text-muted)]">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 bg-[var(--color-surface-hover)] rounded-full flex items-center justify-center text-[var(--color-text-muted)]">
                            <LuFileText size={24} />
                          </div>
                          <p className="text-base font-medium">No invoices found</p>
                          <button onClick={() => setShowForm(true)} className="text-primary hover:underline text-sm font-medium">Create your first invoice</button>
                        </div>
                      </td>
                   </tr>
                )}
              </tbody>
             </table>
           </div>
           )}
        </div>
      )}
    </div>
  );
};

export default Invoicing;
