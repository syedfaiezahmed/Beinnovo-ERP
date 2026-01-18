import React from 'react';
import { X as LuX, Printer as LuPrinter, Receipt as LuReceipt, Building as LuBuilding, Calendar as LuCalendar, CreditCard as LuCreditCard } from 'lucide-react';
import { formatCurrency, formatNumber } from '../utils/exportUtils';

const BillPreviewModal = ({ bill, onClose }) => {
  if (!bill) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-all duration-300 animate-in fade-in">
      <div 
        className="card-base w-full max-w-4xl max-h-[90vh] flex flex-col relative overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 bg-gradient-to-r from-primary/5 to-transparent border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] shadow-sm">
              <LuReceipt className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--color-text-heading)]">Bill Preview</h3>
              <p className="text-xs text-[var(--color-text-muted)] font-mono">{bill.id}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-[var(--color-surface-hover)] rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text-heading)] transition-colors"
          >
            <LuX size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-[var(--color-background)] p-8 relative custom-scrollbar">
           {/* Watermark */}
           <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] overflow-hidden">
            <LuReceipt size={400} />
          </div>

          <div className="bg-[var(--color-surface)] shadow-xl shadow-[var(--color-shadow)]/40 border border-[var(--color-border)] p-8 max-w-3xl mx-auto min-h-[800px] rounded-xl relative z-10 print-content text-[var(--color-text)]">
            
            {/* Bill Header */}
            <div className="flex justify-between items-start mb-12">
              <div>
                <div className="flex items-center gap-2 mb-2">
                    <LuReceipt className="w-8 h-8 text-primary" />
                    <h1 className="text-4xl font-black text-[var(--color-text-heading)] tracking-tight">BILL</h1>
                </div>
                <p className="text-[var(--color-text-muted)] font-medium flex items-center gap-2">
                    <span className="font-mono text-primary bg-primary/10 px-2 py-0.5 rounded text-sm">#{bill.id}</span>
                </p>
              </div>
              <div className="text-right">
                <h2 className="text-xl font-bold text-[var(--color-text-heading)] mb-1">
                  {bill.vendor?.name || bill.vendorName || 'Unknown Vendor'}
                </h2>
                <div className="text-sm text-[var(--color-text-muted)] space-y-0.5">
                    <p>Vendor Address Line 1</p>
                    <p>City, State, Zip</p>
                </div>
              </div>
            </div>

            <div className="w-full h-px bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent mb-8" />

            {/* Bill To & Details */}
            <div className="grid grid-cols-2 gap-12 mb-12">
              <div>
                <div className="flex items-center gap-2 mb-3 text-primary">
                    <LuBuilding className="w-4 h-4" />
                    <h3 className="text-xs font-bold uppercase tracking-widest">Bill To</h3>
                </div>
                <div className="space-y-1">
                    <p className="font-bold text-[var(--color-text-heading)] text-lg">Your Company Name</p>
                    <p className="text-sm text-[var(--color-text-muted)]">123 Business Street</p>
                    <p className="text-sm text-[var(--color-text-muted)]">City, State, Zip</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                    <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                        <LuCalendar className="w-4 h-4" />
                        <span className="text-sm font-medium">Bill Date</span>
                    </div>
                    <span className="font-bold text-[var(--color-text-heading)]">{bill.date}</span>
                </div>
                
                {bill.dueDate && (
                    <div className="flex justify-between items-center p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                        <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                            <LuCalendar className="w-4 h-4" />
                            <span className="text-sm font-medium">Due Date</span>
                        </div>
                        <span className="font-bold text-[var(--color-text-heading)]">{bill.dueDate}</span>
                    </div>
                )}

                <div className="flex justify-between items-center p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                    <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                        <LuCreditCard className="w-4 h-4" />
                        <span className="text-sm font-medium">Status</span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                      bill.status === 'Paid' 
                        ? 'bg-success/10 text-success border-success/20' 
                        : 'bg-warning/10 text-warning border-warning/20'
                    }`}>
                      {bill.status}
                    </span>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="rounded-xl border border-[var(--color-border)] overflow-hidden mb-8">
                <table className="w-full">
                <thead className="bg-[var(--color-bg-secondary)]">
                    <tr>
                    <th className="text-left py-4 px-6 text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Item / Account</th>
                    <th className="text-right py-4 px-6 text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-24">Qty</th>
                    <th className="text-right py-4 px-6 text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-32">Price</th>
                    <th className="text-right py-4 px-6 text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-32">Amount</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                    {bill.items && bill.items.map((item, index) => (
                    <tr key={index} className="hover:bg-[var(--color-surface-hover)] transition-colors">
                        <td className="py-4 px-6 text-sm text-[var(--color-text)]">
                        <p className="font-bold text-[var(--color-text-heading)]">{item.expense || item.description}</p>
                        {item.description && item.expense && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{item.description}</p>}
                        </td>
                        <td className="py-4 px-6 text-right text-sm text-[var(--color-text)] font-mono">{item.quantity}</td>
                        <td className="py-4 px-6 text-right text-sm text-[var(--color-text)] font-mono">{formatNumber(parseFloat(item.price))}</td>
                        <td className="py-4 px-6 text-right text-sm font-bold text-[var(--color-text-heading)] font-mono">
                        {formatNumber(item.quantity * item.price)}
                        </td>
                    </tr>
                    ))}
                    {(!bill.items || bill.items.length === 0) && (
                        <tr>
                            <td colSpan="4" className="py-12 text-center text-[var(--color-text-muted)] italic bg-[var(--color-bg-secondary)]/30">
                                No items details available for this bill preview.
                            </td>
                        </tr>
                    )}
                </tbody>
                </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-72 bg-primary/5 rounded-xl p-6 border border-primary/10">
                <div className="flex justify-between items-center">
                  <span className="text-primary font-bold uppercase tracking-widest text-xs">Total Amount</span>
                  <span className="text-3xl font-black text-primary tracking-tight">
                    {formatCurrency(bill.total || bill.grandTotal || bill.subtotal || 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer Note */}
            <div className="mt-12 pt-8 border-t border-[var(--color-border)] text-center">
                <p className="text-[var(--color-text-muted)] text-xs">
                    This is a computer generated bill and requires no signature.
                </p>
            </div>

          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex justify-end gap-3 z-20">
          <button 
            onClick={onClose}
            className="btn-ghost"
          >
            Close
          </button>
          <button 
            onClick={() => window.print()}
            className="btn-primary flex items-center gap-2 shadow-lg shadow-primary/20"
          >
            <LuPrinter size={18} /> Print Bill
          </button>
        </div>

      </div>
    </div>
  );
};

export default BillPreviewModal;
