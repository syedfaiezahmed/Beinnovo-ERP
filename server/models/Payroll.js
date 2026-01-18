const mongoose = require('mongoose');

const PayrollSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    month: { type: String, required: true }, // e.g., "October 2023"
    baseSalary: { type: Number, required: true },
    bonus: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    netSalary: { type: Number, required: true },
    salaryType: { type: String, enum: ['Monthly', 'Advance'], default: 'Monthly' },
    status: { type: String, enum: ['Pending', 'Paid'], default: 'Pending' },
    paymentDate: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Payroll', PayrollSchema);
