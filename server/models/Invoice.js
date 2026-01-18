const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    invoiceNumber: { type: String, required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true },
    date: { type: Date, required: true, default: Date.now },
    dueDate: { type: Date, required: true },
    
    items: [{
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        description: String,
        quantity: { type: Number, required: true },
        unitPrice: { type: Number, required: true },
        amount: { type: Number, required: true }
    }],

    subtotal: { type: Number, required: true },
    taxTotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },

    status: { type: String, enum: ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'], default: 'Draft' },
    
    // Link to Journal Transaction
    transactionRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },

    // Cost Accounting
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    costCenter: { type: mongoose.Schema.Types.ObjectId, ref: 'CostCenter' },

    // Payment Tracking
    amountPaid: { type: Number, default: 0 },
    balanceDue: { type: Number }, // Calculated as grandTotal - amountPaid
    payments: [{
        date: { type: Date, default: Date.now },
        amount: Number,
        method: String, // Cash, Bank, Check
        reference: String,
        note: String
    }],

    notes: String,
    createdAt: { type: Date, default: Date.now }
});

// Compound unique index per tenant
InvoiceSchema.index({ tenantId: 1, invoiceNumber: 1 }, { unique: true });

module.exports = mongoose.model('Invoice', InvoiceSchema);
