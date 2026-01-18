import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Download as LuDownload, Search as LuSearch, Wallet as LuWallet, CheckCircle as LuCheckCircle, CreditCard as LuCreditCard } from 'lucide-react';
import { exportToExcel, formatCurrency, formatNumber } from '../utils/exportUtils';

const AccountsPayable = () => {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [accounts, setAccounts] = useState([]); // For selecting bank/cash account
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
  
  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [paymentData, setPaymentData] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    method: 'Bank Transfer',
    reference: '',
    accountCode: '102' // Default Bank
  });

  const fetchBills = async () => {
    try {
      const response = await api.get('/bills');
      const billsData = Array.isArray(response.data) ? response.data : [];
      // Filter for unpaid or partially paid
      const unpaid = billsData.filter(bill => bill.status !== 'Paid');
      
      // Calculate balance due for legacy data
      const processed = unpaid.map(bill => ({
        ...bill,
        balanceDue: (bill.balanceDue !== undefined && bill.balanceDue !== null) ? Number(bill.balanceDue) : (Number(bill.grandTotal || 0) - Number(bill.amountPaid || 0))
      }));
      
      setBills(processed);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching bills:", error);
      setLoading(false);
      setBills([]);
    }
  };

  const fetchAccounts = async () => {
    try {
      const response = await api.get('/accounts');
      const accountsData = Array.isArray(response.data) ? response.data : [];
      // Filter for Asset accounts (Cash/Bank) to pay FROM
      const assetAccounts = accountsData.filter(acc => acc.type === 'Asset' && (acc.name.includes('Cash') || acc.name.includes('Bank')));
      setAccounts(assetAccounts);
    } catch (error) {
      console.error("Error fetching accounts:", error);
      setAccounts([]);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await fetchBills();
      await fetchAccounts();
    };
    loadData();
  }, []);

  const handlePaymentClick = (bill) => {
    setSelectedBill(bill);
    setPaymentData({
      amount: bill.balanceDue,
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
      await api.post(`/bills/${selectedBill._id}/pay`, paymentData);
      setShowPaymentModal(false);
      fetchBills(); // Refresh list
      alert('Payment recorded successfully!');
    } catch (error) {
      console.error("Payment failed:", error);
      alert(error.response?.data?.message || "Payment failed");
    }
  };

  const filteredBills = bills.filter(bill => 
    bill.billNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (bill.vendor && bill.vendor.name && bill.vendor.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalPayable = filteredBills.reduce((sum, bill) => sum + bill.balanceDue, 0);

  if (loading) return (
    <div className="p-4 text-center flex flex-col items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">Loading Payables...</p>
    </div>
  );

  return (
    <div className="p-2 max-w-7xl mx-auto space-y-3 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-heading)] flex items-center gap-2">
            <LuWallet className="text-primary" size={16} /> {companyName} - Accounts Payable
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Manage bills and payments to vendors</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => exportToExcel(filteredBills, 'Payables', 'Payables.xlsx')}
            className="btn-outline flex items-center gap-1 bg-[var(--color-surface)] text-sm px-4 py-2.5"
          >
            <LuDownload size={16} /> Export
          </button>
        </div>
      </div>

      {/* Summary Card */}
      <div className="card-base p-4 flex flex-col items-center justify-center gap-2">
        <h2 className="text-xl font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Total Payable</h2>
        <p className="text-sm font-bold text-[var(--color-text-heading)]">{formatCurrency(totalPayable)}</p>
      </div>

      {/* Search & Filter */}
      <div className="card-base flex gap-2 items-center p-2">
        <div className="relative flex-1">
          <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" size={16} />
          <input 
            type="text" 
            placeholder="Search by Bill # or Vendor..." 
            className="input-base pl-12 w-full text-sm py-2.5"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Bills Table */}
      <div className="table-container">
        <table className="table-professional">
          <thead>
            <tr>
              <th>Bill #</th>
              <th>Date</th>
              <th>Vendor</th>
              <th>Status</th>
              <th className="text-right">Total</th>
              <th className="text-right">Balance Due</th>
              <th className="text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {filteredBills.length > 0 ? (
              filteredBills.map((bill, index) => (
                <tr key={bill._id || index} className="group">
                  <td className="font-medium text-[var(--color-text-heading)]">{bill.billNumber}</td>
                  <td className="text-[var(--color-text)]">
                    {bill.date ? new Date(bill.date).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="text-[var(--color-text)]">{bill.vendor?.name || 'Unknown'}</td>
                  <td>
                    <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${
                      bill.status === 'Paid' ? 'bg-success/10 text-success border-success/20' :
                      bill.status === 'Overdue' ? 'bg-danger/10 text-danger border-danger/20' :
                      'bg-warning/10 text-warning border-warning/20'
                    }`}>
                      {bill.status || 'Pending'}
                    </span>
                  </td>
                  <td className="text-right font-medium text-[var(--color-text)]">{formatNumber(Number(bill.grandTotal || 0))}</td>
                  <td className="text-right font-bold text-danger">{formatNumber(Number(bill.balanceDue || 0))}</td>
                  <td className="text-center">
                    <button 
                      onClick={() => handlePaymentClick(bill)}
                      className="btn-primary py-1.5 px-3 text-xs flex items-center justify-center mx-auto gap-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <LuCreditCard size={14} /> Pay
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
                      <p className="text-base font-medium">No outstanding payables found.</p>
                    </div>
                  </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedBill && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-[var(--color-surface)] rounded-lg shadow-2xl w-full max-w-xs overflow-hidden transform transition-all scale-100 animate-slide-up border border-[var(--color-border)]">
            <div className="bg-[var(--color-surface)] px-3 py-2.5 border-b border-[var(--color-border)] flex justify-between items-center">
              <h3 className="font-bold text-lg text-[var(--color-text-heading)]">Record Payment</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-heading)] transition-colors">&times;</button>
            </div>
            
            <form onSubmit={handlePaymentSubmit} className="p-2.5 space-y-2.5">
              <div className="bg-danger/10 p-2.5 rounded-lg mb-2 border border-danger/20">
                <p className="text-sm text-danger mb-0.5">Bill: <strong>{selectedBill.billNumber}</strong></p>
                <p className="text-sm text-danger">Balance Due: <strong className="text-sm">{formatCurrency(Number(selectedBill.balanceDue || 0))}</strong></p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-0.5">Amount Paying</label>
                <input 
                  type="number" 
                  step="0.01"
                  required
                  max={selectedBill.balanceDue}
                  className="input-base w-full text-sm py-2.5"
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({...paymentData, amount: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-0.5">Payment Date</label>
                <input 
                  type="date" 
                  required
                  className="input-base w-full text-sm py-2.5"
                  value={paymentData.date}
                  onChange={(e) => setPaymentData({...paymentData, date: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-0.5">Payment Method</label>
                <select 
                  className="input-base w-full text-sm py-2.5"
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
                <label className="block text-sm font-medium text-[var(--color-text)] mb-0.5">Pay From Account</label>
                <select 
                  className="input-base w-full text-sm py-2.5"
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
                  className="input-base w-full text-sm py-2.5"
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
                  className="btn-primary flex-1 flex items-center justify-center gap-1 text-sm font-medium py-2.5"
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

export default AccountsPayable;
