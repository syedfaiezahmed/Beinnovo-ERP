const mongoose = require('mongoose');

const AccountSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, required: true, enum: ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'] },
    category: { type: String }, // e.g., Current Asset, Long Term Liability
    balance: { type: Number, default: 0 }, // Current balance (optional, can be calculated)
    isSystemAccount: { type: Boolean, default: false }, // Cannot be deleted/edited
    created_by: { type: String, enum: ['user', 'ai', 'system'], default: 'user' },
    audit_metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

// Compound unique index per tenant
AccountSchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Account', AccountSchema);
