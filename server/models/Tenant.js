const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
    name: { type: String, required: true },
    address: String,
    phone: String,
    email: String,
    status: { type: String, enum: ['Active', 'Inactive', 'Suspended'], default: 'Active' },
    subscriptionPlan: { type: String, enum: ['Free', 'Basic', 'Pro', 'Enterprise'], default: 'Free' },
    subscriptionStatus: { type: String, enum: ['Trial', 'Active', 'Past_Due', 'Cancelled', 'Expired'], default: 'Trial' },
    trialEndDate: { type: Date },
    nextBillingDate: { type: Date },
    subscriptionAmount: { type: Number, default: 0 },
    lastLogin: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Tenant', tenantSchema);
