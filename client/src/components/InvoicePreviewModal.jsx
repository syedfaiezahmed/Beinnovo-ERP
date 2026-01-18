import React, { useState } from 'react';
import { X as LuX, Printer as LuPrinter, Download as LuDownload } from 'lucide-react';
import { generateInvoicePDF, formatCurrency, formatNumber } from '../utils/exportUtils';

const InvoicePreviewModal = ({ invoice, onClose }) => {
  const [companyInfo] = useState(() => {
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        return {
          name: parsed.companyName || 'My Company',
          address: parsed.companyAddress || '',
          phone: parsed.companyPhone || '',
          email: parsed.companyEmail || '',
        };
      } catch {
        return {
          name: 'My Company',
          address: '',
          phone: '',
          email: '',
        };
      }
    }
    return {
      name: 'My Company',
      address: '',
      phone: '',
      email: '',
    };
  });

  if (!invoice) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-[var(--color-surface)] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-slide-up border border-[var(--color-border)] overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center p-3 border-b border-[var(--color-border)] bg-[var(--color-surface-hover)]/50">
          <h3 className="text-sm font-bold text-[var(--color-text-heading)]">Invoice Preview</h3>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-heading)] transition-colors p-1.5 hover:bg-[var(--color-surface-hover)] rounded-full">
            <LuX size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-2 bg-[var(--color-background)] custom-scrollbar">
          <div className="bg-[var(--color-surface)] shadow-xl rounded-xl border border-[var(--color-border)] p-4 max-w-2xl mx-auto min-h-[400px] relative overflow-hidden">
            
            {/* Watermark */}
            <div className="absolute top-0 right-0 p-2 opacity-[0.03] pointer-events-none">
                <div className="text-4xl font-black text-primary tracking-tighter">INVOICE</div>
            </div>

            {/* Invoice Header */}
            <div className="flex justify-between items-start mb-3 relative z-10">
              <div>
                <h1 className="text-xl font-black text-primary mb-0.5 tracking-tight">INVOICE</h1>
                <p className="text-[var(--color-text-muted)] font-medium text-xs">#{invoice.id}</p>
              </div>
              <div className="text-right">
                <h2 className="text-xs font-bold text-[var(--color-text-heading)]">{companyInfo.name}</h2>
                {companyInfo.address && <p className="text-xs text-[var(--color-text-muted)] whitespace-pre-line mt-0.5">{companyInfo.address}</p>}
                {companyInfo.phone && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{companyInfo.phone}</p>}
                {companyInfo.email && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{companyInfo.email}</p>}
              </div>
            </div>

            {/* Bill To & Details */}
            <div className="flex justify-between mb-3 relative z-10">
              <div className="bg-[var(--color-surface-hover)] p-2 rounded-lg border border-[var(--color-border)] min-w-[150px]">
                <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-1">Bill To</h3>
                <p className="font-bold text-[var(--color-text-heading)] text-xs">
                  {invoice.customer?.name || invoice.customerName || invoice.customer || 'Unknown Customer'}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Client Address Line 1</p>
                <p className="text-xs text-[var(--color-text-muted)]">City, State, Zip</p>
              </div>
              <div className="text-right space-y-1">
                <div className="flex justify-end items-center gap-2">
                  <span className="text-[var(--color-text-muted)] text-xs font-medium uppercase tracking-wider">Date</span>
                  <span className="font-bold text-[var(--color-text-heading)] text-xs">{invoice.date}</span>
                </div>
                <div className="flex justify-end items-center gap-2">
                  <span className="text-[var(--color-text-muted)] text-xs font-medium uppercase tracking-wider">Status</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
                      invoice.status === 'Paid' ? 'bg-success/10 text-success border-success/20' :
                      invoice.status === 'Sent' ? 'bg-primary/10 text-primary border-primary/20' :
                      'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] border-[var(--color-border)]'
                  }`}>
                      {invoice.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <table className="w-full mb-3 relative z-10">
              <thead>
                <tr className="border-b border-primary/10">
                  <th className="text-left py-1 text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider pl-1">Description</th>
                  <th className="text-right py-1 text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-12">Qty</th>
                  <th className="text-right py-1 text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-16">Price</th>
                  <th className="text-right py-1 text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-16 pr-1">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {invoice.items && invoice.items.map((item, index) => (
                  <tr key={index} className="group hover:bg-[var(--color-surface-hover)] transition-colors">
                    <td className="py-1 pl-1 text-xs text-[var(--color-text)]">
                      <p className="font-semibold text-[var(--color-text-heading)]">{item.description}</p>
                      {item.product && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{item.product}</p>}
                    </td>
                    <td className="py-1 text-right text-xs text-[var(--color-text)] font-medium">{item.quantity}</td>
                    <td className="py-1 text-right text-xs text-[var(--color-text)] font-medium">{formatNumber(parseFloat(item.price))}</td>
                    <td className="py-1 pr-1 text-right text-xs font-bold text-[var(--color-text-heading)]">
                      {formatNumber(item.quantity * item.price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end relative z-10">
              <div className="w-48 bg-[var(--color-surface-hover)] p-2 rounded-xl border border-[var(--color-border)] backdrop-blur-sm">
                <div className="flex justify-between py-0.5 border-b border-[var(--color-border)]">
                  <span className="text-[var(--color-text-muted)] text-xs font-medium">Subtotal</span>
                  <span className="text-[var(--color-text-heading)] font-bold text-xs">{formatCurrency(invoice.subtotal || invoice.total)}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-[var(--color-border)]">
                  <span className="text-[var(--color-text-muted)] text-xs font-medium">Tax</span>
                  <span className="text-[var(--color-text-heading)] font-bold text-xs">{formatCurrency(invoice.tax || 0)}</span>
                </div>
                <div className="flex justify-between pt-1 mt-0.5 items-end">
                  <span className="text-[var(--color-text-heading)] font-bold text-xs">Total</span>
                  <span className="text-primary font-black text-sm tracking-tight">{formatCurrency(invoice.total)}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-4 pt-2 border-t border-[var(--color-border)] text-center text-xs text-[var(--color-text-muted)] relative z-10">
              <p className="font-medium">Thank you for your business!</p>
              <p className="mt-0.5 text-xs opacity-70">Payment is due within 30 days.</p>
            </div>

          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-[var(--color-border)] bg-[var(--color-surface-hover)]/50 flex justify-end gap-2">
          <button 
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-[var(--color-text-muted)] font-medium text-xs hover:bg-[var(--color-surface-hover)] transition-colors border border-transparent hover:border-[var(--color-border)]"
          >
            Close
          </button>
          <button 
            onClick={() => window.print()}
            className="px-4 py-1.5 rounded-lg text-[var(--color-text-heading)] font-bold text-xs bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-border)] transition-all shadow-sm flex items-center gap-1.5"
          >
            <LuPrinter size={14} /> Print
          </button>
          <button 
            onClick={() => generateInvoicePDF(invoice)}
            className="px-4 py-1.5 rounded-lg bg-primary text-white font-bold text-xs hover:bg-primary-dark transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40 flex items-center gap-1.5"
          >
            <LuDownload size={14} /> Download PDF
          </button>
        </div>

      </div>
    </div>
  );
};

export default InvoicePreviewModal;
