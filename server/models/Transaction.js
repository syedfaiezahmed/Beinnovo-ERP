const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    date: { type: Date, required: true, default: Date.now },
    description: { type: String, required: true },
    entries: [{
        accountCode: { type: String, required: true },
        accountName: { type: String }, // Denormalized for easier display
        debit: { type: Number, default: 0 },
        credit: { type: Number, default: 0 }
    }],
    reference: { type: String },
    type: { type: String, default: 'Journal' }, // Journal, Invoice, Bill
    status: { type: String, default: 'Posted' },
    
    // Cost Accounting
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    costCenter: { type: mongoose.Schema.Types.ObjectId, ref: 'CostCenter' },

    // Audit
    created_by: { type: String, enum: ['user', 'ai', 'system'], default: 'user' },
    audit_metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', TransactionSchema);
