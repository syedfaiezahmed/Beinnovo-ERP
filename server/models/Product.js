const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    image: { type: String }, // Base64 or URL
    barcode: { type: String },
    brand: { type: String },
    category: { type: String, default: 'General' },
    type: { type: String, enum: ['Goods', 'Service'], default: 'Goods' },
    description: { type: String },
    
    // Pricing
    salesPrice: { type: Number, required: true, default: 0 },
    costPrice: { type: Number, required: true, default: 0 }, // For standard cost or weighted average
    taxRate: { type: Number, default: 0 },
    
    // Advanced Inventory Valuation
    valuationMethod: { 
        type: String, 
        enum: ['FIFO', 'LIFO', 'Weighted Average'], 
        default: 'FIFO' 
    },
    
    // Multi-Warehouse Stock
    stockLocations: [{
        warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
        quantity: { type: Number, default: 0 },
        rack: String,
        bin: String
    }],

    batches: [{
        batchId: { type: String },
        warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
        date: { type: Date, default: Date.now },
        quantity: { type: Number, required: true },
        unitCost: { type: Number, required: true },
        remainingQuantity: { type: Number, required: true }, // Decreases as items are sold
        expiryDate: { type: Date }
    }],

    // Inventory
    quantityOnHand: { type: Number, default: 0 },
    reorderLevel: { type: Number, default: 10 },
    unit: { type: String, default: 'pcs' }, // pcs, kg, hours
    
    // Accounting Links (optional but good for ERP)
    salesAccount: { type: String }, // Account Code
    cogsAccount: { type: String }, // Cost of Goods Sold Account Code
    inventoryAccount: { type: String }, // Inventory Asset Account Code

    createdAt: { type: Date, default: Date.now }
});

// Compound unique index per tenant
ProductSchema.index({ tenantId: 1, sku: 1 }, { unique: true });

module.exports = mongoose.model('Product', ProductSchema);
