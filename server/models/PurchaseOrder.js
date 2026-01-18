const mongoose = require('mongoose');

const PurchaseOrderSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    poNumber: { type: String, required: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true },
    supplierName: { type: String, required: true },
    date: { type: Date, required: true, default: Date.now },
    expectedDeliveryDate: { type: Date },
    items: [{
        productName: { type: String, required: true },
        sku: { type: String, required: true },
        description: { type: String },
        quantity: { type: Number, required: true },
        unitPrice: { type: Number, required: true },
        lineTotal: { type: Number, required: true }
    }],
    totalAmount: { type: Number, required: true },
    currency: { type: String, default: 'PKR' },
    status: { type: String, enum: ['Draft', 'Open', 'Closed', 'Cancelled'], default: 'Open' },
    notes: { type: String },
    createdAt: { type: Date, default: Date.now }
});

PurchaseOrderSchema.index({ tenantId: 1, poNumber: 1 }, { unique: true });

module.exports = mongoose.model('PurchaseOrder', PurchaseOrderSchema);

