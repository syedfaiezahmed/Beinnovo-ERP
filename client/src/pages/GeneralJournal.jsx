import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus as LuPlus, Trash2 as LuTrash2, Save as LuSave, History as LuHistory, Printer as LuPrinter, Download as LuDownload, FileText as LuFileText, Pencil as LuPencil, Calendar as LuCalendar } from 'lucide-react';
import DateFilter from '../components/DateFilter';
import { handlePrint, exportToPDF, exportToExcel, formatCurrency, formatNumber } from '../utils/exportUtils';
import { getTransactions, createTransaction, updateTransaction, deleteTransaction, getAccounts } from '../services/api';

const GeneralJournal = () => {
  const [showForm, setShowForm] = useState(false);
  const location = useLocation();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
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
  
  const [, setFilter] = useState({ period: 'thisMonth' });
  
  // Form State
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    entries: [
      { accountCode: '', debit: '', credit: '' },
      { accountCode: '', debit: '', credit: '' }
    ]
  });

  const [accounts, setAccounts] = useState([]);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [accRes, txRes] = await Promise.all([
          getAccounts(),
          getTransactions()
        ]);
        setAccounts(Array.isArray(accRes.data) ? accRes.data : []);
        
        // Calculate total amount for each transaction
        const transactionsData = Array.isArray(txRes.data) ? txRes.data : [];
        const transactionsWithTotal = transactionsData.map(tx => {
          const totalAmount = (tx.entries || []).reduce((sum, entry) => sum + (Number(entry.debit) || 0), 0);
          return { ...tx, totalAmount };
        });
        
        setTransactions(transactionsWithTotal);
      } catch (e) {
        console.error('Failed to load accounts/transactions', e);
      }
    };
    fetchAll();
  }, []);

  // Handle AI Draft
  useEffect(() => {
    if (location.state?.draftJournal) {
      const draft = location.state.draftJournal;
      setShowForm(true);
      if (draft.date) setFormData(prev => ({ ...prev, date: draft.date }));
      if (draft.description) setFormData(prev => ({ ...prev, description: draft.description }));
      if (Array.isArray(draft.entries)) {
        setFormData(prev => ({
            ...prev,
            entries: draft.entries.map(e => ({
                accountCode: e.accountCode || '',
                debit: e.debit || '',
                credit: e.credit || ''
            }))
        }));
      }
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleEntryChange = (index, field, value) => {
    const newEntries = [...formData.entries];
    newEntries[index][field] = value;
    // Auto-clear opposite field
    if (field === 'debit' && value) newEntries[index].credit = '';
    if (field === 'credit' && value) newEntries[index].debit = '';
    setFormData({ ...formData, entries: newEntries });
  };

  const addRow = () => {
    setFormData({
      ...formData,
      entries: [...formData.entries, { accountCode: '', debit: '', credit: '' }]
    });
  };

  const removeRow = (index) => {
    if (formData.entries.length > 2) {
      const newEntries = formData.entries.filter((_, i) => i !== index);
      setFormData({ ...formData, entries: newEntries });
    }
  };

  const calculateTotals = () => {
    return formData.entries.reduce(
      (acc, curr) => ({
        debit: acc.debit + (Number(curr.debit) || 0),
        credit: acc.credit + (Number(curr.credit) || 0)
      }),
      { debit: 0, credit: 0 }
    );
  };

  const totals = calculateTotals();
  const isBalanced = Math.abs(totals.debit - totals.credit) < 0.01 && totals.debit > 0;

  const handleExportPDF = () => {
    const columns = [
      { header: 'Date', dataKey: 'date' },
      { header: 'Description', dataKey: 'description' },
      { header: 'Amount', dataKey: 'amount' },
      { header: 'Status', dataKey: 'status' }
    ];
    
    const data = transactions.map(tx => ({
        date: tx.date,
        description: tx.description,
        amount: formatCurrency(tx.totalAmount),
        status: 'Posted'
    }));

    exportToPDF(columns, data, 'General Journal', 'general_journal.pdf');
  };

  const handleExportExcel = () => {
    const data = transactions.map(tx => ({
      Date: new Date(tx.date).toLocaleDateString(),
      Description: tx.description,
      Amount: tx.totalAmount || 0,
      Status: 'Posted'
    }));
    exportToExcel(data, 'Journal', 'general_journal.xlsx');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isBalanced) {
      alert('Journal Entry must be balanced!');
      return;
    }

    const payload = {
      date: formData.date,
      description: formData.description,
      entries: formData.entries.map(e => ({
        accountCode: e.accountCode,
        debit: Number(e.debit) || 0,
        credit: Number(e.credit) || 0
      }))
    };
    try {
      setLoading(true);
      let saved;
      if (editingId) {
        const res = await updateTransaction(editingId, payload);
        saved = res.data;
        const totalAmount = (saved.entries || []).reduce((sum, entry) => sum + (Number(entry.debit) || 0), 0);
        const updated = transactions.map(tx => (tx._id === saved._id ? { ...saved, totalAmount } : tx));
        setTransactions(updated);
      } else {
        const res = await createTransaction(payload);
        saved = res.data;
        const totalAmount = (saved.entries || []).reduce((sum, entry) => sum + (Number(entry.debit) || 0), 0);
        setTransactions([{ ...saved, totalAmount }, ...transactions]);
      }
      setShowForm(false);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        description: '',
        entries: [
          { accountCode: '', debit: '', credit: '' },
          { accountCode: '', debit: '', credit: '' }
        ]
      });
      setEditingId(null);
    } catch {
      console.error('Failed to post transaction');
      alert('Failed to post transaction');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (tx) => {
    setShowForm(true);
    setEditingId(tx._id);
    setFormData({
      date: new Date(tx.date).toISOString().split('T')[0],
      description: tx.description || '',
      entries: (tx.entries || []).map(e => ({
        accountCode: e.accountCode || '',
        debit: e.debit || '',
        credit: e.credit || ''
      }))
    });
  };

  const handleDelete = async (id) => {
    const ok = window.confirm('Delete this journal entry?');
    if (!ok) return;
    try {
      await deleteTransaction(id);
      setTransactions(transactions.filter(tx => (tx._id || tx.id) !== id));
    } catch {
      alert('Failed to delete');
    }
  };

  return (
    <div className="space-y-4 animate-fade-in p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-[var(--color-text-heading)] tracking-tight">{companyName || 'Company'} - General Journal</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1 font-medium">Record and review daily financial transactions</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {!showForm && (
            <>
              <DateFilter onFilterChange={setFilter} />
              <div className="flex gap-3">
                <button onClick={handlePrint} className="btn-secondary p-2.5" title="Print">
                    <LuPrinter size={16} />
                </button>
                <button onClick={handleExportPDF} className="btn-secondary p-2.5" title="Export PDF">
                    <LuDownload size={16} />
                </button>
                <button onClick={handleExportExcel} className="btn-secondary p-2.5" title="Export Excel">
                    <LuFileText size={16} />
                </button>
              </div>
            </>
          )}
          <button 
            onClick={() => setShowForm(!showForm)}
            className="btn-primary flex items-center justify-center gap-2 text-sm py-2.5 px-4 shadow-sm"
          >
            {showForm ? <><LuHistory size={16} /> View History</> : <><LuPlus size={16} /> New Entry</>}
          </button>
        </div>
      </div>

      {showForm ? (
        <div className="card-base p-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-6 border-b border-[var(--color-border)] pb-4">
            <div className={`p-2 rounded-lg ${editingId ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success'}`}>
                {editingId ? <LuPencil size={16} /> : <LuPlus size={16} />}
            </div>
            <h3 className="text-lg font-black uppercase tracking-wider text-[var(--color-text-heading)]">{editingId ? 'Edit Journal Entry' : 'New Journal Entry'}</h3>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div>
                <label className="block text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Date</label>
                <div className="relative">
                  <LuCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" size={16} />
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="input-base pl-12 py-2.5 text-sm w-full"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Payment for Office Supplies"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-base py-2.5 text-sm"
                />
              </div>
            </div>

            <div className="table-container mb-6 border border-[var(--color-border)] rounded-lg overflow-hidden">
              <table className="table-professional w-full text-left border-collapse">
                <thead className="bg-[var(--color-surface-hover)] sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-[var(--color-text-muted)] uppercase text-xs tracking-wider w-[40%]">Account</th>
                    <th className="px-4 py-3 font-semibold text-[var(--color-text-muted)] uppercase text-xs tracking-wider w-[25%] text-right">Debit</th>
                    <th className="px-4 py-3 font-semibold text-[var(--color-text-muted)] uppercase text-xs tracking-wider w-[25%] text-right">Credit</th>
                    <th className="px-4 py-3 w-[10%]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
                  {formData.entries.map((entry, index) => (
                    <tr key={index} className="group hover:bg-[var(--color-surface-hover)] transition-colors">
                      <td className="px-4 py-2.5 align-top">
                        <select
                          value={entry.accountCode}
                          onChange={(e) => handleEntryChange(index, 'accountCode', e.target.value)}
                          className="input-base w-full py-2.5 text-sm"
                          required
                        >
                          <option value="">Select Account</option>
                          {accounts.map(acc => (
                            <option key={acc.code} value={acc.code}>
                              {acc.code} - {acc.name} ({acc.type})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={entry.debit}
                          onChange={(e) => handleEntryChange(index, 'debit', e.target.value)}
                          className="input-base w-full py-2.5 text-right font-mono text-sm"
                          disabled={!!entry.credit}
                        />
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={entry.credit}
                          onChange={(e) => handleEntryChange(index, 'credit', e.target.value)}
                          className="input-base w-full py-2.5 text-right font-mono text-sm"
                          disabled={!!entry.debit}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-center align-middle">
                        {formData.entries.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeRow(index)}
                            className="p-2 text-[var(--color-text-muted)] hover:text-danger hover:bg-danger/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            title="Remove row"
                          >
                            <LuTrash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-[var(--color-surface-hover)] border-t border-[var(--color-border)]">
                  <tr>
                    <td className="px-4 py-3 text-right font-bold text-[var(--color-text-muted)] text-sm uppercase tracking-wider">Total</td>
                    <td className={`px-4 py-3 text-right font-bold font-mono text-sm border-t-2 border-[var(--color-text-muted)]/20 ${isBalanced ? 'text-success' : 'text-danger'}`}>{formatCurrency(totals.debit)}</td>
                    <td className={`px-4 py-3 text-right font-bold font-mono text-sm border-t-2 border-[var(--color-text-muted)]/20 ${isBalanced ? 'text-success' : 'text-danger'}`}>{formatCurrency(totals.credit)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
              <div className="p-3 bg-[var(--color-surface)] border-t border-[var(--color-border)] flex justify-center">
                <button
                    type="button"
                    onClick={addRow}
                    className="btn-ghost text-primary hover:text-primary-dark text-sm font-medium flex items-center gap-2 py-2 px-4 rounded-full bg-primary/5 hover:bg-primary/10 transition-colors"
                >
                    <LuPlus size={16} /> Add Line Item
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center bg-[var(--color-surface-hover)] p-4 border-t border-[var(--color-border)]">
                <div className="text-sm font-medium text-[var(--color-text-muted)]">
                    {formData.entries.length} lines
                </div>
                <div className="flex gap-8 text-sm">
                    <div className="flex flex-col items-end">
                        <span className="text-[var(--color-text-muted)] text-xs uppercase tracking-wider font-bold">Total Debit</span>
                        <span className="font-mono font-bold text-[var(--color-text-heading)]">{formatCurrency(totals.debit)}</span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[var(--color-text-muted)] text-xs uppercase tracking-wider font-bold">Total Credit</span>
                        <span className="font-mono font-bold text-[var(--color-text-heading)]">{formatCurrency(totals.credit)}</span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[var(--color-text-muted)] text-xs uppercase tracking-wider font-bold">Difference</span>
                        <span className={`font-mono font-bold ${Math.abs(totals.debit - totals.credit) < 0.01 ? 'text-success' : 'text-danger'}`}>
                            {formatCurrency(Math.abs(totals.debit - totals.credit))}
                            {Math.abs(totals.debit - totals.credit) >= 0.01 && (
                                <span className="ml-1 text-[10px] uppercase bg-danger/10 px-1 rounded">
                                    {(totals.debit - totals.credit) > 0 ? 'Dr High' : 'Cr High'}
                                </span>
                            )}
                        </span>
                    </div>
                </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn-secondary px-6 py-2.5 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !isBalanced}
                className={`btn-primary flex items-center gap-2 px-6 py-2.5 text-sm font-bold shadow-lg shadow-primary/25 transition-all transform hover:-translate-y-0.5 ${(!isBalanced || loading) ? 'opacity-50 cursor-not-allowed shadow-none' : 'hover:shadow-primary/40'}`}
              >
                {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <LuSave size={18} />}
                {editingId ? 'Update Entry' : 'Post Entry'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="card-base overflow-hidden">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-[var(--color-text-muted)] flex flex-col items-center">
              <div className="bg-[var(--color-surface-hover)] p-3 rounded-full mb-3">
                  <LuHistory size={24} className="text-[var(--color-text-muted)]" />
              </div>
              <p className="text-sm font-bold text-[var(--color-text-heading)]">No transactions recorded yet</p>
              <p className="text-sm mt-1 max-w-sm mx-auto">Start by creating your first journal entry to track your financial activities.</p>
              <button
                 onClick={() => setShowForm(true)}
                 className="mt-4 btn-primary flex items-center gap-2 py-2.5 px-4 text-sm"
              >
                <LuPlus size={16} />
                Create Entry
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table className="table-professional w-full text-left border-collapse">
                <thead className="bg-[var(--color-surface-hover)] sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-[var(--color-text-muted)] uppercase text-xs tracking-wider w-32">Date</th>
                    <th className="px-4 py-3 font-semibold text-[var(--color-text-muted)] uppercase text-xs tracking-wider">Description</th>
                    <th className="px-4 py-3 font-semibold text-[var(--color-text-muted)] uppercase text-xs tracking-wider w-1/3">Accounts</th>
                    <th className="px-4 py-3 font-semibold text-[var(--color-text-muted)] uppercase text-xs tracking-wider text-right w-32">Amount</th>
                    <th className="px-4 py-3 font-semibold text-[var(--color-text-muted)] uppercase text-xs tracking-wider text-center w-24">Status</th>
                    <th className="px-4 py-3 font-semibold text-[var(--color-text-muted)] uppercase text-xs tracking-wider text-right w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {transactions.map((tx) => (
                    <tr key={tx._id || tx.id} className="group hover:bg-[var(--color-surface-hover)] transition-colors">
                      <td className="px-4 py-2.5 font-medium text-[var(--color-text-heading)] whitespace-nowrap text-sm align-top">{new Date(tx.date).toLocaleDateString()}</td>
                      <td className="px-4 py-2.5 text-[var(--color-text)] max-w-xs truncate text-sm align-top">{tx.description}</td>
                      <td className="px-4 py-2.5 align-top">
                        <div className="flex flex-col gap-1">
                          {(tx.entries || []).map((e, i) => (
                            <div key={i} className="flex justify-between text-sm text-[var(--color-text-muted)] border-b border-dashed border-[var(--color-border)] last:border-0 pb-1 last:pb-0">
                              <span className="truncate mr-2 flex-1" title={accounts.find(a => a.code === e.accountCode)?.name || e.accountCode}>
                                <span className="font-mono text-xs opacity-75 mr-1">{e.accountCode}</span>
                                {accounts.find(a => a.code === e.accountCode)?.name || ''}
                              </span>
                              <span className="font-mono text-[var(--color-text)] whitespace-nowrap">
                                {e.debit ? <span className="text-[var(--color-text)]">{formatNumber(e.debit)} Dr</span> : <span className="text-[var(--color-text-muted)]">{formatNumber(e.credit)} Cr</span>}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-[var(--color-text-heading)] text-sm align-top">
                        {formatCurrency(tx.totalAmount)}
                      </td>
                      <td className="px-4 py-2.5 text-center align-top">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-success/10 text-success border border-success/20 uppercase tracking-wide">
                          Posted
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right align-top">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0">
                          <button 
                            onClick={() => startEdit(tx)}
                            className="p-1.5 text-[var(--color-text-muted)] hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                            title="Edit Entry"
                          >
                            <LuPencil size={15} />
                          </button>
                          <button 
                            onClick={() => handleDelete(tx._id || tx.id)}
                            className="p-1.5 text-[var(--color-text-muted)] hover:text-danger hover:bg-danger/10 rounded-lg transition-all"
                            title="Delete Entry"
                          >
                            <LuTrash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GeneralJournal;
