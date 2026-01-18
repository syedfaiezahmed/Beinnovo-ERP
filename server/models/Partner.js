const mongoose = require('mongoose');

const PartnerSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true },
    type: { type: String, required: true, enum: ['Customer', 'Vendor', 'Both'] },
    email: { type: String },
    phone: { type: String },
    address: {
        street: String,
        city: String,
        state: String,
        zip: String,
        country: String
    },
    taxId: { type: String },
    paymentTerms: { type: String }, // e.g., "Net 30"
    balance: { type: Number, default: 0 }, // Receivable or Payable
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Partner', PartnerSchema);
