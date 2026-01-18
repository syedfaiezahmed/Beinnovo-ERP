const mongoose = require('mongoose');

const warehouseSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true },
    location: String,
    contactPerson: String,
    contactNumber: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Warehouse', warehouseSchema);
