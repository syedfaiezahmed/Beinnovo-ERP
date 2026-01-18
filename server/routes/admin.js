const express = require('express');
const router = express.Router();
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const Invoice = require('../models/Invoice');
const GlobalSettings = require('../models/GlobalSettings');
const { protect } = require('../middleware/authMiddleware');

// Middleware to ensure user is Super Admin
const superAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'super_admin') {
        next();
    } else {
        res.status(403).json({ message: 'Not authorized as super admin' });
    }
};

// @route   GET /api/admin/stats
// @desc    Get global system statistics
// @access  Super Admin
router.get('/stats', protect, superAdmin, async (req, res) => {
    try {
        const totalTenants = await Tenant.countDocuments();
        const activeTenants = await Tenant.countDocuments({ status: 'Active' });
        const trialTenants = await Tenant.countDocuments({ subscriptionStatus: 'Trial' });
        const totalUsers = await User.countDocuments();
        const totalTransactions = await Transaction.countDocuments();
        
        // Calculate estimated monthly revenue
        const revenueResult = await Tenant.aggregate([
            { $match: { subscriptionStatus: 'Active' } },
            { $group: { _id: null, total: { $sum: '$subscriptionAmount' } } }
        ]);
        const monthlyRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

        // Get recent activities
        const recentTenants = await Tenant.find().sort({ createdAt: -1 }).limit(5);

        // Get expiring trials (next 7 days)
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        const expiringTrials = await Tenant.find({
            subscriptionStatus: 'Trial',
            trialEndDate: { $lte: nextWeek, $gte: new Date() }
        }).limit(5);

        // Monthly Growth Analytics (Last 6 Months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        sixMonthsAgo.setDate(1); // Start of month

        const monthlyGrowth = await Tenant.aggregate([
            {
                $match: {
                    createdAt: { $gte: sixMonthsAgo }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                    newTenants: { $sum: 1 },
                    activeConversions: {
                        $sum: { $cond: [{ $eq: ["$subscriptionStatus", "Active"] }, 1, 0] }
                    },
                    trialSignups: {
                        $sum: { $cond: [{ $eq: ["$subscriptionStatus", "Trial"] }, 1, 0] }
                    }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.json({
            counts: {
                tenants: totalTenants,
                activeTenants,
                trialTenants,
                users: totalUsers,
                transactions: totalTransactions
            },
            financials: {
                monthlyRevenue
            },
            recentActivity: recentTenants,
            expiringTrials,
            monthlyGrowth
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   PUT /api/admin/tenants/:id
// @desc    Update tenant details
// @access  Super Admin
router.put('/tenants/:id', protect, superAdmin, async (req, res) => {
    try {
        const { 
            name, email, status, subscriptionPlan, 
            subscriptionStatus, trialEndDate, nextBillingDate, subscriptionAmount 
        } = req.body;
        
        const tenant = await Tenant.findById(req.params.id);

        if (!tenant) {
            return res.status(404).json({ message: 'Tenant not found' });
        }

        tenant.name = name || tenant.name;
        tenant.email = email || tenant.email;
        tenant.status = status || tenant.status;
        tenant.subscriptionPlan = subscriptionPlan || tenant.subscriptionPlan;
        
        if (subscriptionStatus) tenant.subscriptionStatus = subscriptionStatus;
        if (trialEndDate) tenant.trialEndDate = trialEndDate;
        if (nextBillingDate) tenant.nextBillingDate = nextBillingDate;
        if (subscriptionAmount !== undefined) tenant.subscriptionAmount = subscriptionAmount;

        const updatedTenant = await tenant.save();
        res.json(updatedTenant);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   GET /api/admin/tenants
// @desc    Get all tenants (companies) with stats
// @access  Super Admin
router.get('/tenants', protect, superAdmin, async (req, res) => {
    try {
        const tenants = await Tenant.find().sort({ createdAt: -1 });
        
        // Get user counts for each tenant
        const tenantsWithStats = await Promise.all(tenants.map(async (tenant) => {
            const userCount = await User.countDocuments({ tenantId: tenant._id });
            return {
                ...tenant.toObject(),
                userCount
            };
        }));

        res.json(tenantsWithStats);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   DELETE /api/admin/tenants/:id
// @desc    Delete a tenant and all associated data
// @access  Super Admin
router.delete('/tenants/:id', protect, superAdmin, async (req, res) => {
    try {
        const tenantId = req.params.id;
        
        // 1. Delete Tenant
        await Tenant.findByIdAndDelete(tenantId);
        
        // 2. Delete Users
        await User.deleteMany({ tenantId });
        
        // 3. Delete Accounts
        await Account.deleteMany({ tenantId });
        
        // TODO: Delete other related data (Invoices, Transactions, etc.) if needed in future
        
        res.json({ message: 'Company and all associated data deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   POST /api/admin/tenants
// @desc    Create a new tenant and admin user
// @access  Super Admin
router.post('/tenants', protect, superAdmin, async (req, res) => {
    const { companyName, name, email, password, address, phone, status, subscriptionPlan } = req.body;

    try {
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        // 1. Create Tenant
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 14); // 14-day trial default

        const tenant = await Tenant.create({
            name: companyName,
            email,
            address,
            phone,
            status: status || 'Active',
            subscriptionPlan: subscriptionPlan || 'Free',
            subscriptionStatus: 'Trial',
            trialEndDate: trialEndDate
        });

        // 2. Create Company Admin User
        const user = await User.create({
            tenantId: tenant._id,
            name,
            email,
            password,
            role: 'admin',
            businessRole: 'Organization Admin'
        });

        // 3. Seed Chart of Accounts for this Tenant
        const defaultAccounts = [
            { code: '101', name: 'Cash', type: 'Asset', category: 'Current Asset' },
            { code: '102', name: 'Bank', type: 'Asset', category: 'Current Asset' },
            { code: '120', name: 'Accounts Receivable', type: 'Asset', category: 'Current Asset' },
            { code: '140', name: 'Inventory Asset', type: 'Asset', category: 'Current Asset' },
            { code: '150', name: 'Equipment', type: 'Asset', category: 'Fixed Asset' },
            { code: '201', name: 'Accounts Payable', type: 'Liability', category: 'Current Liability' },
            { code: '205', name: 'Sales Tax Payable', type: 'Liability', category: 'Current Liability' },
            { code: '206', name: 'Payroll Tax Payable', type: 'Liability', category: 'Current Liability' },
            { code: '210', name: 'Bank Loan', type: 'Liability', category: 'Long-term Liability' },
            { code: '301', name: 'Owner Capital', type: 'Equity', category: 'Equity' },
            { code: '305', name: 'Opening Balance Equity', type: 'Equity', category: 'Equity' },
            { code: '350', name: 'Retained Earnings', type: 'Equity', category: 'Equity' },
            { code: '401', name: 'Sales Revenue', type: 'Revenue', category: 'Revenue' },
            { code: '402', name: 'Service Revenue', type: 'Revenue', category: 'Revenue' },
            { code: '501', name: 'Cost of Goods Sold', type: 'Expense', category: 'Cost of Sales' },
            { code: '502', name: 'Rent Expense', type: 'Expense', category: 'Operating Expense' },
            { code: '503', name: 'Utilities Expense', type: 'Expense', category: 'Operating Expense' },
            { code: '504', name: 'Salary Expense', type: 'Expense', category: 'Operating Expense' },
            { code: '505', name: 'Inventory Adjustment', type: 'Expense', category: 'Cost of Sales' },
            { code: '506', name: 'General Expense', type: 'Expense', category: 'Operating Expense' }
        ];

        const accountsWithTenant = defaultAccounts.map(acc => ({
            ...acc,
            tenantId: tenant._id
        }));

        await Account.insertMany(accountsWithTenant);

        res.status(201).json({
            message: 'Company created successfully',
            tenant,
            admin: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   GET /api/admin/settings
// @desc    Get global system settings
// @access  Super Admin
router.get('/settings', protect, superAdmin, async (req, res) => {
    try {
        let settings = await GlobalSettings.findOne();
        if (!settings) {
            settings = await GlobalSettings.create({});
        }
        res.json(settings);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   PUT /api/admin/settings
// @desc    Update global system settings
// @access  Super Admin
router.put('/settings', protect, superAdmin, async (req, res) => {
    try {
        const { 
            appName, supportEmail, trialDurationDays, 
            enableEmailNotifications, maintenanceMode, allowNewRegistrations 
        } = req.body;

        let settings = await GlobalSettings.findOne();
        if (!settings) {
            settings = new GlobalSettings();
        }

        settings.appName = appName || settings.appName;
        settings.supportEmail = supportEmail || settings.supportEmail;
        if (trialDurationDays !== undefined) settings.trialDurationDays = trialDurationDays;
        if (enableEmailNotifications !== undefined) settings.enableEmailNotifications = enableEmailNotifications;
        if (maintenanceMode !== undefined) settings.maintenanceMode = maintenanceMode;
        if (allowNewRegistrations !== undefined) settings.allowNewRegistrations = allowNewRegistrations;
        
        settings.updatedAt = Date.now();

        const updatedSettings = await settings.save();
        res.json(updatedSettings);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/users', protect, superAdmin, async (req, res) => {
    try {
        const { tenantId } = req.query;
        const filter = {};
        if (tenantId) {
            filter.tenantId = tenantId;
        }
        const users = await User.find(filter).sort({ createdAt: -1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put('/users/:id', protect, superAdmin, async (req, res) => {
    try {
        const { role, permissions } = req.body;
        const update = {};
        if (role) {
            update.role = role;
        }
        if (Array.isArray(permissions)) {
            update.permissions = permissions;
        }
        const user = await User.findByIdAndUpdate(req.params.id, update, { new: true });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
