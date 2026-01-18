import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Plus as LuPlus, 
  ShoppingBag as LuShoppingBag, 
  Store as LuStore, 
  Printer as LuPrinter, 
  Download as LuDownload, 
  FileSpreadsheet as LuFileSpreadsheet, 
  Eye as LuEye, 
  Trash2 as LuTrash2,
  Calendar as LuCalendar,
  Search as LuSearch,
  Filter as LuFilter,
  Loader2 as LuLoader2
} from 'lucide-react';
import DateFilter from '../components/DateFilter';
import { handlePrint, exportToPDF, exportToExcel, formatCurrency, formatNumber } from '../utils/exportUtils';
import BillPreviewModal from '../components/BillPreviewModal';
import api from '../services/api';

const Purchasing = () => {
  const [showForm, setShowForm] = useState(false);
  const location = useLocation();
  const [filter, setFilter] = useState({ period: 'This Month', customRange: { start: '', end: '' } });
  const [previewBill, setPreviewBill] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Data from backend
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [expenseAccounts, setExpenseAccounts] = useState([]);
  const [bills, setBills] = useState([]);

  // State for new bill form
  const [billItems, setBillItems] = useState([
    { id: 1, type: 'product', itemId: '', description: '', quantity: 1, price: 0 }
  ]);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchData();
  }, []);

  // Handle AI Draft
  useEffect(() => {
    if (location.state?.draftBill && !loading) {
      const draft = location.state.draftBill;
      setShowForm(true);
      
      if (draft.partnerName && vendors.length > 0) {
        const match = vendors.find(v => v.name.toLowerCase().includes(draft.partnerName.toLowerCase()));
        if (match) setSelectedVendor(match._id);
      }
      
      if (draft.date) setBillDate(draft.date);
      
      if (Array.isArray(draft.items)) {
        setBillItems(draft.items.map((item, idx) => ({
            id: Date.now() + idx,
            type: 'product', // Default to product, user can change
            itemId: '', 
            description: item.description || '',
            quantity: Number(item.quantity) || 1,
            price: Number(item.rate) || 0
        })));
      }
      
      window.history.replaceState({}, document.title);
    }
  }, [location.state, loading, vendors]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [vendorsRes, productsRes, accountsRes, billsRes] = await Promise.all([
        api.get('/partners'),
        api.get('/products'),
        api.get('/accounts'),
        api.get('/bills')
      ]);

      const vendorsData = Array.isArray(vendorsRes.data) ? vendorsRes.data : [];
      setVendors(vendorsData.filter(p => p.type === 'Vendor'));
      setProducts(Array.isArray(productsRes.data) ? productsRes.data : []);
      const accountsData = Array.isArray(accountsRes.data) ? accountsRes.data : [];
      setExpenseAccounts(accountsData.filter(a => a.type === 'Expense' || a.code.startsWith('5') || a.code.startsWith('6')));
      setBills(Array.isArray(billsRes.data) ? billsRes.data : []);
    } catch (error) {
      console.error("Error fetching data:", error);
      setVendors([]);
      setProducts([]);
      setExpenseAccounts([]);
      setBills([]);
    } finally {
      setLoading(false);
    }
  };

  // Form Handlers
  const handleAddItem = () => {
    setBillItems([...billItems, { id: Date.now(), type: 'product', itemId: '', description: '', quantity: 1, price: 0 }]);
  };

  const handleRemoveItem = (id) => {
    if (billItems.length > 1) {
      setBillItems(billItems.filter(item => item.id !== id));
    }
  };

  const handleItemChange = (id, field, value) => {
    const newItems = billItems.map(item => {
      if (item.id === id) {
        let updates = { [field]: value };
        
        if (field === 'itemId') {
            // Find selected item (either product or expense account)
            if (item.type === 'product') {
                const product = products.find(p => p._id === value);
                if (product) {
                    updates.price = product.costPrice || 0;
                    updates.description = product.name;
                }
            } else {
                const account = expenseAccounts.find(a => a.code === value);
                if (account) {
                    updates.description = account.name;
                    updates.price = 0; // Expenses usually entered manually
                }
            }
        }
        
        // Reset itemId if type changes
        if (field === 'type') {
            updates.itemId = '';
            updates.description = '';
            updates.price = 0;
        }

        return { ...item, ...updates };
      }
      return item;
    });
    setBillItems(newItems);
  };

  const calculateTotals = () => {
    const subtotal = billItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const tax = subtotal * 0.05; // Assuming 5% tax on purchases, ideally configurable
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  const { subtotal, tax, total } = calculateTotals();

  // Filter Logic
  const filteredBills = bills.filter(bill => {
    if (filter.period === 'All Time') return true;
    
    const billDate = new Date(bill.date);
    const today = new Date();
    
    if (filter.period === 'This Month') {
      return billDate.getMonth() === today.getMonth() && billDate.getFullYear() === today.getFullYear();
    }
    
    if (filter.period === 'Last Month') {
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return billDate.getMonth() === lastMonth.getMonth() && billDate.getFullYear() === lastMonth.getFullYear();
    }
    
    if (filter.period === 'Custom') {
      const start = filter.customRange.start ? new Date(filter.customRange.start) : new Date(0);
      const end = filter.customRange.end ? new Date(filter.customRange.end) : new Date(9999, 11, 31);
      return billDate >= start && billDate <= end;
    }
    
    return true;
  });

  const handleSaveBill = async () => {
      if (!selectedVendor) {
        alert("Please select a vendor");
        return;
      }
      if (billItems.length === 0 || billItems.every(item => !item.itemId)) {
        alert("Please add at least one valid item");
        return;
      }
      if (!billNumber) {
          alert("Please enter a bill number");
          return;
      }

      // Map frontend items to backend schema
      const itemsPayload = billItems.map(item => ({
          product: item.type === 'product' ? item.itemId : null,
          accountCode: item.type === 'expense' ? item.itemId : null,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.price,
          amount: item.quantity * item.price
      }));

      const newBill = {
          billNumber: billNumber,
          vendor: selectedVendor,
          date: billDate,
          dueDate: dueDate,
          items: itemsPayload,
          subTotal: subtotal,
          taxTotal: tax,
          grandTotal: total,
          status: 'Unpaid' // Initial status
      };

      try {
          const res = await api.post('/bills', newBill);
          setBills([res.data, ...bills]);
          setShowForm(false);
          
          // Reset Form
          setBillItems([{ id: Date.now(), type: 'product', itemId: '', description: '', quantity: 1, price: 0 }]);
          setSelectedVendor('');
          setBillNumber('');
          setBillDate(new Date().toISOString().split('T')[0]);
          setDueDate(new Date().toISOString().split('T')[0]);
          
          // Refresh data to update inventory counts if needed
          fetchData();
      } catch (error) {
          console.error("Error saving bill:", error);
          alert("Failed to save bill: " + (error.response?.data?.message || error.message));
      }
  };

  const handleExportPDF = () => {
    const columns = [
      { header: 'Bill #', dataKey: 'billNumber' },
      { header: 'Vendor', dataKey: 'vendorName' },
      { header: 'Date', dataKey: 'date' },
      { header: 'Total', dataKey: 'grandTotal' },
      { header: 'Status', dataKey: 'status' }
    ];
    
    const data = bills.map(bill => ({
      ...bill,
      vendorName: bill.vendor?.name || 'Unknown',
      date: bill.date ? new Date(bill.date).toLocaleDateString() : 'N/A',
      grandTotal: formatCurrency(Number(bill.grandTotal) || 0)
    }));

    exportToPDF(columns, data, 'Purchasing Bills Report', 'bills.pdf');
  };

  const handleExportExcel = () => {
    const data = bills.map(bill => ({
      'Bill #': bill.billNumber,
      Vendor: bill.vendor?.name || 'Unknown',
      Date: new Date(bill.date).toLocaleDateString(),
      Total: bill.grandTotal,
      Status: bill.status
    }));
    exportToExcel(data, 'Bills', 'bills.xlsx');
  };

  const handlePreviewBill = (bill) => {
    setPreviewBill(bill);
    setShowPreview(true);
  };

  return (
    <div className="animate-fade-in p-2">
      {showPreview && previewBill && (
        <BillPreviewModal 
          bill={previewBill}  
          onClose={() => setShowPreview(false)} 
        />
      )}
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2.5 gap-2.5">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-heading)] tracking-tight flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-lg">
              <LuShoppingBag className="text-primary" size={16} />
            </div>
            Purchasing
          </h2>
          <p className="text-[var(--color-text-muted)] text-sm mt-0.5 ml-8">Manage vendor bills and track expenses</p>
        </div>
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
            <DateFilter onFilterChange={setFilter} />
            <div className="flex gap-2">
                <button onClick={handlePrint} className="btn-outline flex items-center gap-1 py-2.5 px-4 text-sm font-medium" title="Print">
                  <LuPrinter size={16} />
              </button>
              <button onClick={handleExportPDF} className="btn-outline flex items-center gap-1 py-2.5 px-4 text-sm font-medium" title="Export PDF">
                  <LuDownload size={16} />
              </button>
              <button onClick={handleExportExcel} className="btn-outline flex items-center gap-1 py-2.5 px-4 text-sm font-medium" title="Export Excel">
                  <LuFileSpreadsheet size={16} />
              </button>
              <button 
                onClick={() => setShowForm(!showForm)}
                className="btn-primary flex items-center gap-1 py-2.5 px-4 text-sm"
              >
                <LuPlus size={16} /> New Bill
              </button>
            </div>
        </div>
      </div>

      {showForm ? (
        <div className="card-base p-2.5 mb-2.5 animate-slide-up border-l-4 border-l-primary relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2.5 opacity-5 pointer-events-none">
              <LuShoppingBag size={100} />
            </div>
            
            <div className="flex justify-between items-center mb-2.5 border-b border-[var(--color-border)] pb-2.5">
              <h3 className="text-lg font-bold text-[var(--color-text-heading)] flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-sm">1</span>
                Record New Bill
              </h3>
              <button onClick={() => setShowForm(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
                <LuTrash2 size={16} className="opacity-0" /> {/* Spacer */}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 mb-4">
                <div className="md:col-span-1">
                    <label className="block text-sm font-semibold text-[var(--color-text-heading)] mb-1">Bill #</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={billNumber}
                        onChange={(e) => setBillNumber(e.target.value)}
                        placeholder="e.g. BILL-2024-001"
                        className="input-base w-full pl-10 py-2.5 text-sm" 
                      />
                      <LuFileSpreadsheet className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" size={16} />
                    </div>
                </div>
                <div className="md:col-span-1">
                    <label className="block text-sm font-semibold text-[var(--color-text-heading)] mb-1">Vendor</label>
                    <div className="relative">
                      <select 
                        value={selectedVendor}
                        onChange={(e) => setSelectedVendor(e.target.value)}
                        className="input-base w-full pl-10 py-2.5 text-sm appearance-none"
                      >
                          <option value="">Select Vendor...</option>
                          {vendors.map(v => <option key={v._id} value={v._id}>{v.name}</option>)}
                      </select>
                      <LuStore className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" size={16} />
                    </div>
                </div>
                <div className="md:col-span-1">
                    <label className="block text-sm font-semibold text-[var(--color-text-heading)] mb-1">Bill Date</label>
                    <div className="relative">
                      <input 
                        type="date" 
                        value={billDate}
                        onChange={(e) => setBillDate(e.target.value)}
                        className="input-base w-full pl-10 py-2.5 text-sm" 
                      />
                      <LuCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" size={16} />
                    </div>
                </div>
                <div className="md:col-span-1">
                    <label className="block text-sm font-semibold text-[var(--color-text-heading)] mb-1">Due Date</label>
                    <div className="relative">
                      <input 
                        type="date" 
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="input-base w-full pl-10 py-2.5 text-sm" 
                      />
                      <LuCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" size={16} />
                    </div>
                </div>
            </div>

            {/* Expense Items Section */}
             <div className="bg-[var(--color-surface-hover)]/30 rounded-xl p-6 border border-[var(--color-border)]/50">
                <h4 className="text-sm font-bold text-[var(--color-text-heading)] uppercase tracking-wider mb-3 flex items-center gap-2">
                  Bill Items
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left mb-2">
                    <thead className="text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                      <tr>
                        <th className="px-4 py-2.5 w-24 font-semibold text-sm">Type</th>
                        <th className="px-4 py-2.5 w-1/3 font-semibold text-sm">Item / Account</th>
                        <th className="px-4 py-2.5 w-1/3 font-semibold text-sm">Description</th>
                        <th className="px-4 py-2.5 w-20 font-semibold text-sm">Qty</th>
                        <th className="px-4 py-2.5 w-24 font-semibold text-sm">Price</th>
                        <th className="px-4 py-2.5 w-24 text-right font-semibold text-sm">Amount</th>
                        <th className="px-4 py-2.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]/50">
                      {billItems.map((item) => (
                        <tr key={item.id} className="group hover:bg-transparent">
                          <td className="px-4 py-2.5 align-top">
                              <select
                                value={item.type}
                                onChange={(e) => handleItemChange(item.id, 'type', e.target.value)}
                                className="input-base w-full text-sm py-2.5"
                              >
                                  <option value="product">Product</option>
                                  <option value="expense">Expense</option>
                              </select>
                          </td>
                          <td className="px-4 py-2.5 align-top">
                            <select 
                              value={item.itemId}
                              onChange={(e) => handleItemChange(item.id, 'itemId', e.target.value)}
                              className="input-base w-full text-sm py-2.5"
                            >
                              <option value="">Select...</option>
                              {item.type === 'product' ? (
                                  products.map(p => (
                                    <option key={p._id} value={p._id}>{p.name}</option>
                                  ))
                              ) : (
                                  expenseAccounts.map(a => (
                                    <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                                  ))
                              )}
                            </select>
                          </td>
                          <td className="px-4 py-2.5 align-top">
                            <input 
                              type="text" 
                              value={item.description}
                              onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                              className="input-base w-full text-sm py-2.5"
                              placeholder="Description"
                            />
                          </td>
                          <td className="px-4 py-2.5 align-top">
                            <input 
                              type="number" 
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                              className="input-base w-full text-sm py-2.5 text-center"
                            />
                          </td>
                          <td className="px-4 py-2.5 align-top">
                            <input 
                              type="number" 
                              min="0"
                              step="0.01"
                              value={item.price}
                              onChange={(e) => handleItemChange(item.id, 'price', parseFloat(e.target.value) || 0)}
                              className="input-base w-full text-sm py-2.5 text-right"
                            />
                          </td>
                          <td className="px-4 py-2.5 align-top font-medium text-right text-[var(--color-text-heading)] pt-4">
                            {formatNumber(item.quantity * item.price)}
                          </td>
                          <td className="px-4 py-2.5 align-top text-center pt-3">
                            <button 
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-danger hover:text-danger-dark p-2 rounded-lg hover:bg-danger/10 transition-colors opacity-0 group-hover:opacity-100"
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
                  className="text-primary text-sm font-medium font-semibold hover:text-primary-dark mb-1 flex items-center gap-1 transition-colors"
                >
                  <LuPlus size={16} /> Add Another Item
                </button>

                <div className="flex justify-end border-t border-[var(--color-border)] pt-2">
                  <div className="w-48 space-y-1 bg-[var(--color-surface)] p-2 rounded-lg shadow-sm border border-[var(--color-border)]">
                    <div className="flex justify-between text-sm text-[var(--color-text-muted)]">
                      <span>Subtotal</span>
                      <span className="font-medium text-[var(--color-text-heading)]">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-[var(--color-text-muted)]">
                      <span>Tax (5%)</span>
                      <span className="font-medium text-[var(--color-text-heading)]">{formatCurrency(tax)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-primary border-t border-dashed border-[var(--color-border)] pt-1 mt-1">
                      <span>Total Amount</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-3">
                    <button 
                      onClick={() => setShowForm(false)} 
                      className="px-3 py-2 text-sm text-[var(--color-text)] bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] rounded transition-all font-medium"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSaveBill} 
                      className="px-3 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-all shadow-md shadow-primary/20 font-medium flex items-center gap-2 text-sm font-medium"
                    >
                      <LuStore size={16} />
                      Save Bill
                    </button>
                </div>
            </div>
        </div>
      ) : (
        <div className="card-base overflow-hidden min-h-[100px]">
          {loading ? (
              <div className="flex flex-col items-center justify-center h-40 text-[var(--color-text-muted)] gap-2">
                <LuLoader2 className="animate-spin text-primary" size={20} />
                <p className="animate-pulse text-sm">Loading bills...</p>
              </div>
          ) : (
          <div className="table-container">
            <table className="table-professional">
              <thead>
                <tr>
                  <th>Bill #</th>
                  <th>Vendor</th>
                  <th>Date</th>
                  <th>Due Date</th>
                  <th className="text-right">Total</th>
                  <th className="text-center">Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filteredBills.length > 0 ? (
                  filteredBills.map((bill) => (
                    <tr key={bill._id} className="group">
                      <td className="font-medium text-primary">
                        {bill.billNumber}
                      </td>
                      <td className="font-medium text-[var(--color-text-heading)]">
                        {bill.vendor?.name || 'Unknown'}
                      </td>
                      <td className="text-[var(--color-text-muted)]">
                        {new Date(bill.date).toLocaleDateString()}
                      </td>
                      <td className="text-[var(--color-text-muted)]">
                        {new Date(bill.dueDate).toLocaleDateString()}
                      </td>
                      <td className="text-right font-medium text-[var(--color-text-heading)]">
                        {formatCurrency(bill.grandTotal)}
                      </td>
                      <td className="text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          bill.status === 'Paid' ? 'bg-success/10 text-success border-success/20' : 
                          bill.status === 'Overdue' ? 'bg-danger/10 text-danger border-danger/20' :
                          'bg-warning/10 text-warning border-warning/20'
                        }`}>
                          {bill.status}
                        </span>
                      </td>
                      <td className="text-right">
                        <button 
                          onClick={() => handlePreviewBill(bill)}
                          className="text-[var(--color-text-muted)] hover:text-primary transition-colors p-2 hover:bg-primary/5 rounded-lg opacity-0 group-hover:opacity-100"
                          title="View Details"
                        >
                          <LuEye size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="p-12 text-center text-[var(--color-text-muted)]">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-12 h-12 bg-[var(--color-surface-hover)] rounded-full flex items-center justify-center text-[var(--color-text-muted)]">
                          <LuShoppingBag size={24} />
                        </div>
                        <p className="text-base font-medium">No bills found for the selected period.</p>
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

export default Purchasing;
