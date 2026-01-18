const mongoose = require('mongoose');

const TimesheetSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    costCenter: { type: mongoose.Schema.Types.ObjectId, ref: 'CostCenter' }, // Optional
    
    date: { type: Date, required: true },
    hours: { type: Number, required: true },
    
    // Costing
    hourlyRate: { type: Number, required: true }, // Captured at time of entry to freeze cost
    totalCost: { type: Number, required: true }, // hours * hourlyRate
    
    taskDescription: String,
    status: { type: String, enum: ['Draft', 'Submitted', 'Approved', 'Rejected'], default: 'Submitted' },
    
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Timesheet', TimesheetSchema);
