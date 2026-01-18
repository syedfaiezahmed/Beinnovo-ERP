const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['super_admin', 'admin', 'user'], default: 'user' },
    businessRole: { 
        type: String, 
        enum: [
            'Organization Admin',
            'Accountant',
            'HR',
            'Inventory Manager',
            'Auditor',
            'Cashier',
            'Custom Role'
        ],
        default: 'Custom Role'
    },
    approvalLimit: { type: Number, default: 0 },
    permissions: { type: [String], default: [] },
    dashboardLayout: { type: Array, default: [] },
    lastLoginAt: { type: Date },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    createdAt: { type: Date, default: Date.now }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Compare password method
userSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
