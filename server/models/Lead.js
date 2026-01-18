const mongoose = require('mongoose');

const LeadSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true },
    email: { type: String },
    phone: { type: String },
    status: { type: String, enum: ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'], default: 'New' },
    source: { type: String, default: 'Manual' },
    notes: [{
        text: String,
        date: { type: Date, default: Date.now }
    }],
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Lead', LeadSchema);
