import React from 'react';
import { X as LuX, Printer as LuPrinter, Download as LuDownload, Wallet as LuWallet, User as LuUser } from 'lucide-react';
import { generatePayslipPDF, handlePrint, formatCurrency, formatNumber } from '../utils/exportUtils';

const PayslipPreviewModal = ({ payslip, onClose }) => {
  if (!payslip) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-[var(--color-surface)] rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-slide-up border border-[var(--color-border)] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-[var(--color-border)] bg-[var(--color-surface-hover)]/30">
          <h3 className="text-xs font-black text-[var(--color-text-heading)] flex items-center gap-2">
            <LuWallet className="text-primary" size={14} /> Payslip Preview
          </h3>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-heading)] transition-colors p-1 hover:bg-[var(--color-surface-hover)] rounded-full">
            <LuX size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[var(--color-background)]">
          <div ref={contentRef} className="bg-white text-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 max-w-3xl mx-auto print-content">
            {/* Payslip Header */}
            <div className="flex justify-between items-start mb-4 border-b border-slate-200 pb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-xs">
                    A
                  </div>
                  <h1 className="text-xs font-bold text-slate-900">ACCOUNTS SYSTEM</h1>
                </div>
                <p className="text-xs text-slate-500">123 Business Avenue, Tech City</p>
                <p className="text-xs text-slate-500">support@accountsystem.com</p>
              </div>
              <div className="text-right">
                <h2 className="text-xs font-black text-slate-200 uppercase tracking-widest mb-0.5">Payslip</h2>
                <p className="font-medium text-slate-900 text-xs">#{payslip.id || 'PAY-001'}</p>
                <p className="text-xs text-slate-500">Date: {new Date().toLocaleDateString()}</p>
              </div>
            </div>

            {/* Employee Details */}
            <div className="flex justify-between items-start mb-3 pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                  <LuUser size={14} />
                </div>
                <div>
                  <h3 className="font-bold text-xs">{payslip.employeeName}</h3>
                  <p className="text-xs text-muted-foreground">{payslip.employeeId} • {payslip.department}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground mb-0.5">Pay Period</div>
                <div className="font-bold text-xs">{payslip.month} {payslip.year}</div>
              </div>
            </div>

            {/* Earnings Section */}
            <div className="mb-4">
                <h4 className="text-xs font-bold text-[var(--color-text-heading)] border-b border-[var(--color-border)] pb-1.5 mb-2 flex justify-between items-center">
                    Earnings
                    <span className="text-xs font-normal text-[var(--color-text-muted)] bg-[var(--color-surface-hover)] px-1.5 py-0.5 rounded">Income</span>
                </h4>
                <div className="space-y-1.5">
                    <div className="flex justify-between text-xs group">
                        <span className="text-[var(--color-text-muted)]">Base Salary</span>
                        <span className="font-bold text-[var(--color-text-heading)]">{formatCurrency(payslip.baseSalary)}</span>
                    </div>
                    <div className="flex justify-between text-xs group">
                        <span className="text-[var(--color-text-muted)]">Bonus</span>
                        <span className="font-bold text-[var(--color-text-heading)]">{formatCurrency(payslip.bonus)}</span>
                    </div>
                    <div className="flex justify-between text-xs pt-2 border-t border-dashed border-[var(--color-border)] mt-1">
                        <span className="font-bold text-[var(--color-text-heading)]">Total Earnings</span>
                        <span className="font-black text-success">{formatCurrency(payslip.baseSalary + payslip.bonus)}</span>
                    </div>
                </div>
            </div>

            {/* Deductions Section */}
            <div className="mb-4">
                <h4 className="text-xs font-bold text-[var(--color-text-heading)] border-b border-[var(--color-border)] pb-1.5 mb-2 flex justify-between items-center">
                    Deductions
                    <span className="text-xs font-normal text-[var(--color-text-muted)] bg-[var(--color-surface-hover)] px-1.5 py-0.5 rounded">Withholdings</span>
                </h4>
                <div className="space-y-1.5">
                    <div className="flex justify-between text-xs group">
                        <span className="text-[var(--color-text-muted)]">Tax & Other Deductions</span>
                        <span className="font-medium text-danger">-{formatNumber(payslip.deductions)}</span>
                    </div>
                    <div className="flex justify-between text-xs pt-2 border-t border-dashed border-[var(--color-border)] mt-1">
                        <span className="font-bold text-[var(--color-text-heading)]">Total Deductions</span>
                        <span className="font-bold text-danger">-{formatCurrency(payslip.deductions)}</span>
                    </div>
                </div>
            </div>

            {/* Net Pay */}
            <div className="bg-primary/5 rounded-xl p-2.5 flex justify-between items-center border border-primary/10">
                  <div className="flex flex-col">
                    <span className="text-primary font-bold uppercase tracking-widest text-xs mb-0.5">Net Pay</span>
                    <span className="text-xs text-muted-foreground">Take home amount</span>
                  </div>
                  <span className="text-xs font-black text-primary tracking-tight">{formatCurrency(payslip.netSalary)}</span>
                </div>

            {/* Footer */}
            <div className="mt-6 text-center">
                <p className="text-xs text-[var(--color-text-muted)] font-medium">This is a system generated payslip.</p>
            </div>

          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-surface-hover)]/30 flex justify-end gap-2.5 rounded-b-2xl">
          <button 
              onClick={handlePrint}
              className="btn-outline flex items-center gap-1.5 text-xs py-2.5 px-4"
          >
              <LuPrinter size={14} /> Print
          </button>
          <button 
              onClick={() => generatePayslipPDF(payslip)}
              className="btn-primary flex items-center gap-1.5 shadow-lg shadow-primary/20 text-xs py-2.5 px-4"
          >
              <LuDownload size={14} /> Download PDF
          </button>
        </div>

      </div>
    </div>
  );
};

export default PayslipPreviewModal;
