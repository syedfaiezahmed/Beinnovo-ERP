const mongoose = require('mongoose');

const BillSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    billNumber: { type: String, required: true }, // Vendor's Invoice #
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true },
    date: { type: Date, required: true, default: Date.now },
    dueDate: { type: Date, required: true },

    items: [{
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, // For inventory items
        accountCode: { type: String }, // For direct expenses (e.g. '501')
        description: String,
        quantity: { type: Number, required: true },
        unitPrice: { type: Number, required: true },
        amount: { type: Number, required: true }
    }],

    subtotal: { type: Number, required: true },
    taxTotal: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },

    status: { type: String, enum: ['Draft', 'Received', 'Paid', 'Overdue', 'Posted'], default: 'Draft' },

    // Link to Journal Transaction
    transactionRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },

    // Cost Accounting
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    costCenter: { type: mongoose.Schema.Types.ObjectId, ref: 'CostCenter' },

    // Payment Tracking
    amountPaid: { type: Number, default: 0 },
    balanceDue: { type: Number },
    payments: [{
        date: { type: Date, default: Date.now },
        amount: Number,
        method: String,
        reference: String,
        note: String
    }],

    notes: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Bill', BillSchema);
