const mongoose = require('mongoose');

const EmployeeSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String },
    phone: { type: String },
    
    position: { type: String },
    department: { type: String },
    
    salary: { type: Number, required: true }, // Annual or Monthly
    hourlyRate: { type: Number }, // For Costing
    payFrequency: { type: String, enum: ['Weekly', 'Bi-Weekly', 'Monthly'], default: 'Monthly' },
    
    hireDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['Active', 'On Leave', 'Terminated'], default: 'Active' },
    
    address: {
        street: String,
        city: String,
        state: String,
        zip: String,
        country: String
    },
    
    bankDetails: {
        bankName: String,
        accountNumber: String,
        routingNumber: String
    }
});

// Compound unique index
EmployeeSchema.index({ tenantId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('Employee', EmployeeSchema);
