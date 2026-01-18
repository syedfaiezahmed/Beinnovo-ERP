const mongoose = require('mongoose');

const LeaveSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    type: { type: String, enum: ['Sick Leave', 'Vacation', 'Personal', 'Maternity/Paternity', 'Unpaid'], required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    days: { type: Number, required: true },
    reason: { type: String },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional: link to admin user
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Leave', LeaveSchema);
