import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Download as LuDownload, Search as LuSearch, DollarSign as LuDollarSign, CheckCircle as LuCheckCircle, Wallet as LuWallet } from 'lucide-react';
import { exportToExcel, formatCurrency, formatNumber } from '../utils/exportUtils';

const AccountsReceivable = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [accounts, setAccounts] = useState([]); // For selecting bank/cash account
  
  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentData, setPaymentData] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    method: 'Bank Transfer',
    reference: '',
    accountCode: '102' // Default Bank
  });
  
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

  const fetchInvoices = async () => {
    try {
      const response = await api.get('/invoices');
      const invoicesData = Array.isArray(response.data) ? response.data : [];
      // Filter for unpaid or partially paid
      const unpaid = invoicesData.filter(inv => inv.status !== 'Paid' && inv.status !== 'Cancelled');
      
      // Calculate balance due for legacy data if missing
      const processed = unpaid.map(inv => ({
        ...inv,
        balanceDue: (inv.balanceDue !== undefined && inv.balanceDue !== null) ? Number(inv.balanceDue) : (Number(inv.grandTotal || 0) - Number(inv.amountPaid || 0))
      }));
      
      setInvoices(processed);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      setLoading(false);
      setInvoices([]);
    }
  };

  const fetchAccounts = async () => {
    try {
      const response = await api.get('/accounts');
      const accountsData = response.data || [];
      // Filter for Asset accounts (Cash/Bank)
      const assetAccounts = accountsData.filter(acc => acc.type === 'Asset' && (acc.name.includes('Cash') || acc.name.includes('Bank')));
      setAccounts(assetAccounts);
    } catch (error) {
      console.error("Error fetching accounts:", error);
      setAccounts([]);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await fetchInvoices();
      await fetchAccounts();
    };
    loadData();
  }, []);

  const handlePaymentClick = (invoice) => {
    setSelectedInvoice(invoice);
    setPaymentData({
      amount: invoice.balanceDue,
      date: new Date().toISOString().split('T')[0],
      method: 'Bank Transfer',
      reference: '',
      accountCode: '102'
    });
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/invoices/${selectedInvoice._id}/pay`, paymentData);
      setShowPaymentModal(false);
      fetchInvoices(); // Refresh list
      alert('Payment recorded successfully!');
    } catch (error) {
      console.error("Payment failed:", error);
      alert(error.response?.data?.message || "Payment failed");
    }
  };

  const filteredInvoices = invoices.filter(inv => 
    inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (inv.customer && inv.customer.name && inv.customer.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalReceivable = filteredInvoices.reduce((sum, inv) => sum + inv.balanceDue, 0);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm text-[var(--color-text-muted)]">Loading Receivables...</p>
    </div>
  );

  return (
    <div className="p-2 max-w-7xl mx-auto space-y-3 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-heading)] flex items-center gap-2">
                    <LuDollarSign className="text-primary" size={16} /> {companyName} - Accounts Receivable
                </h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-0.5">Track and collect payments from customers</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => exportToExcel(filteredInvoices, 'Receivables', 'Receivables.xlsx')}
            className="btn-outline flex items-center gap-1 bg-[var(--color-surface)] py-2.5 px-4 text-sm"
          >
            <LuDownload size={16} /> Export
          </button>
        </div>
      </div>

      {/* Summary Card */}
      <div className="card-base bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-surface-hover)] p-2.5">
        <h3 className="text-[var(--color-text-muted)] font-medium uppercase text-lg tracking-wider mb-1">Total Outstanding Receivables</h3>
        <p className="text-sm font-bold text-[var(--color-text-heading)]">{formatCurrency(totalReceivable)}</p>
      </div>

      {/* Search & Filter */}
      <div className="card-base flex gap-2.5 items-center p-2.5">
        <div className="relative flex-1">
          <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" size={16} />
          <input 
            type="text" 
            placeholder="Search by Invoice # or Customer..." 
            className="input-base pl-12 w-full py-2.5 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Invoices Table */}
      <div className="table-container">
        <table className="table-professional">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Status</th>
              <th className="text-right">Total</th>
              <th className="text-right">Balance Due</th>
              <th className="text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {filteredInvoices.length > 0 ? (
              filteredInvoices.map((inv, index) => (
                <tr key={inv._id || index} className="group">
                  <td className="font-medium text-[var(--color-text-heading)]">{inv.invoiceNumber}</td>
                  <td className="text-[var(--color-text)]">
                    {inv.date ? new Date(inv.date).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="text-[var(--color-text)]">{inv.customer?.name || 'Unknown'}</td>
                  <td>
                    <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${
                      inv.status === 'Paid' ? 'bg-success/10 text-success border-success/20' :
                      inv.status === 'Overdue' ? 'bg-danger/10 text-danger border-danger/20' :
                      'bg-warning/10 text-warning border-warning/20'
                    }`}>
                      {inv.status || 'Pending'}
                    </span>
                  </td>
                  <td className="text-right font-medium text-[var(--color-text)]">{formatNumber(Number(inv.grandTotal || 0))}</td>
                  <td className="text-right font-bold text-danger">{formatNumber(Number(inv.balanceDue || 0))}</td>
                  <td className="text-center">
                    <button 
                      onClick={() => handlePaymentClick(inv)}
                      className="btn-primary py-1.5 px-3 text-xs flex items-center justify-center mx-auto gap-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <LuWallet size={14} /> Pay
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="p-12 text-center text-[var(--color-text-muted)]">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-12 h-12 bg-[var(--color-surface-hover)] rounded-full flex items-center justify-center text-[var(--color-text-muted)]">
                        <LuCheckCircle size={24} />
                      </div>
                      <p className="text-base font-medium">No outstanding receivables found.</p>
                    </div>
                  </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-[var(--color-surface)] rounded-lg shadow-2xl w-full max-w-xs overflow-hidden transform transition-all scale-100 animate-slide-up border border-[var(--color-border)]">
            <div className="bg-[var(--color-surface)] px-3 py-2.5 border-b border-[var(--color-border)] flex justify-between items-center">
              <h3 className="font-bold text-lg text-[var(--color-text-heading)]">Record Payment</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-heading)] transition-colors">&times;</button>
            </div>
            
            <form onSubmit={handlePaymentSubmit} className="p-2.5 space-y-2.5">
              <div className="bg-primary/10 p-2.5 rounded-lg mb-2 border border-primary/20">
                <p className="text-sm text-primary mb-0.5">Invoice: <strong>{selectedInvoice.invoiceNumber}</strong></p>
                <p className="text-sm text-primary">Balance Due: <strong className="text-sm">{formatCurrency(Number(selectedInvoice.balanceDue || 0))}</strong></p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-0.5">Amount Received</label>
                <input 
                  type="number" 
                  step="0.01"
                  required
                  max={selectedInvoice.balanceDue}
                  className="input-base w-full py-2.5 text-sm"
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({...paymentData, amount: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-0.5">Payment Date</label>
                <input 
                  type="date" 
                  required
                  className="input-base w-full py-2.5 text-sm"
                  value={paymentData.date}
                  onChange={(e) => setPaymentData({...paymentData, date: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-0.5">Payment Method</label>
                <select 
                  className="input-base w-full py-2.5 text-sm"
                  value={paymentData.method}
                  onChange={(e) => setPaymentData({...paymentData, method: e.target.value})}
                >
                  <option>Bank Transfer</option>
                  <option>Cash</option>
                  <option>Check</option>
                  <option>Credit Card</option>
                  <option>Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-0.5">Deposit To Account</label>
                <select 
                  className="input-base w-full py-2.5 text-sm"
                  value={paymentData.accountCode}
                  onChange={(e) => setPaymentData({...paymentData, accountCode: e.target.value})}
                >
                  {accounts.map(acc => (
                    <option key={acc.code} value={acc.code}>{acc.code} - {acc.name}</option>
                  ))}
                  <option value="102">102 - Bank (Default)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-0.5">Reference / Note</label>
                <input 
                  type="text" 
                  className="input-base w-full py-2.5 text-sm"
                  placeholder="e.g. Check #123"
                  value={paymentData.reference}
                  onChange={(e) => setPaymentData({...paymentData, reference: e.target.value})}
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button 
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="btn-ghost flex-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-heading)] py-2.5"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn-primary flex-1 flex items-center justify-center gap-1 py-2.5 text-sm font-medium"
                >
                  <LuCheckCircle size={16} /> Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountsReceivable;
