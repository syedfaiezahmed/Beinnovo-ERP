const mongoose = require('mongoose');

const AITransactionLogSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userRole: { type: String },
    userBusinessRole: { type: String },
    userPrompt: { type: String, required: true },
    aiResponse: { type: mongoose.Schema.Types.Mixed }, // JSON response from AI
    parsedEntries: { type: mongoose.Schema.Types.Mixed }, // The resulting journal entries
    status: { type: String, enum: ['Success', 'Failed', 'Ambiguous'], required: true },
    error: { type: String },
    confidenceScore: { type: Number },
    intent: { type: String },
    module: { type: String },
    action: { type: String },
    permissionKey: { type: String },
    permissionGranted: { type: Boolean },
    approvalStatus: { type: String, enum: ['Approved', 'Denied', 'Pending'], default: 'Approved' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AITransactionLog', AITransactionLogSchema);
