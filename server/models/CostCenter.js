const mongoose = require('mongoose');

const CostCenterSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    description: String,
    manager: String,
    budget: { type: Number, default: 0 },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    createdAt: { type: Date, default: Date.now }
});

// Compound unique index
CostCenterSchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('CostCenter', CostCenterSchema);
