const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner' },
    startDate: Date,
    endDate: Date,
    status: { type: String, enum: ['Not Started', 'In Progress', 'Completed', 'On Hold'], default: 'Not Started' },
    budget: { type: Number, default: 0 }, // Total Budget
    budgetBreakdown: {
        labor: { type: Number, default: 0 },
        material: { type: Number, default: 0 },
        overhead: { type: Number, default: 0 }
    },
    description: String,
    createdAt: { type: Date, default: Date.now }
});

// Compound unique index
ProjectSchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Project', ProjectSchema);
