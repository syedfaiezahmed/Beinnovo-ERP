const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Account = require('../models/Account');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'secret123', {
        expiresIn: '30d',
    });
};

// @route   GET /api/auth/seed
// @desc    Seed the database with a super admin user (Temporary for initial setup)
// @access  Public
router.get('/seed', async (req, res) => {
    try {
        const email = 'admin@beinnovo.com';
        const password = 'admin';

        let user = await User.findOne({ email });

        if (user) {
            let needsSave = false;

            if (user.role !== 'super_admin') {
                user.role = 'super_admin';
                needsSave = true;
            }

            if (!user.password && user.passwordHash) {
                user.password = user.passwordHash;
                user.passwordHash = undefined;
                needsSave = true;
            }

            if (!user.password) {
                user.password = password;
                needsSave = true;
            }

            if (needsSave) {
                await user.save();
            }

            return res.json({ 
                message: 'Super Admin verified/updated', 
                email,
                role: user.role 
            });
        }

        const created = await User.create({
            name: 'Beinnovo Admin',
            email,
            password,
            role: 'super_admin',
            permissions: ['*:*']
        });
        res.status(201).json({ message: 'Super Admin created successfully', email, password });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   GET /api/auth/check-admin
// @desc    Debug route to check if admin exists
router.get('/check-admin', async (req, res) => {
    try {
        const user = await User.findOne({ email: 'admin@beinnovo.com' });
        if (user) {
            res.json({ 
                status: 'Found', 
                id: user._id, 
                email: user.email, 
                role: user.role,
                passwordHashPrefix: user.password.substring(0, 10) + '...' // Show prefix to verify it's hashed
            });
        } else {
            res.json({ status: 'Not Found', message: 'Admin user not found in this database' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// @route   POST /api/auth/register
// @desc    Register a new tenant (company) and admin user
// @access  Public
router.post('/register', async (req, res) => {
    const { companyName, name, email, password } = req.body;

    try {
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // 1. Create Tenant
        const tenant = await Tenant.create({
            name: companyName
        });

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
            { code: '140', name: 'Inventory', type: 'Asset', category: 'Current Asset' },
            { code: '150', name: 'Equipment', type: 'Asset', category: 'Fixed Asset' },
            { code: '201', name: 'Accounts Payable', type: 'Liability', category: 'Current Liability' },
            { code: '205', name: 'Sales Tax Payable', type: 'Liability', category: 'Current Liability' },
            { code: '210', name: 'Bank Loan', type: 'Liability', category: 'Long-term Liability' },
            { code: '301', name: 'Owner Capital', type: 'Equity', category: 'Equity' },
            { code: '401', name: 'Sales Revenue', type: 'Revenue', category: 'Revenue' },
            { code: '402', name: 'Service Revenue', type: 'Revenue', category: 'Revenue' },
            { code: '501', name: 'Rent Expense', type: 'Expense', category: 'Operating Expense' },
            { code: '502', name: 'Utilities Expense', type: 'Expense', category: 'Operating Expense' },
            { code: '503', name: 'Salary Expense', type: 'Expense', category: 'Operating Expense' },
            { code: '504', name: 'COGS', type: 'Expense', category: 'Cost of Sales' }
        ];

        const accountsWithTenant = defaultAccounts.map(acc => ({
            ...acc,
            tenantId: tenant._id
        }));

        await Account.insertMany(accountsWithTenant);

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            tenantId: user.tenantId,
            role: user.role,
            token: generateToken(user._id),
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   POST /api/auth/login
// @desc    Auth user & get token
// @access  Public
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });

        if (user && (await user.matchPassword(password))) {
            let tenantName = '';
            let tenantDetails = null;
            if (user.tenantId) {
                const tenant = await Tenant.findById(user.tenantId);
                tenantName = tenant ? tenant.name : '';
                tenantDetails = tenant;
            } else if (user.role === 'super_admin') {
                tenantName = 'Beinnovo Admin';
                tenantDetails = { name: 'Beinnovo Admin' };
            }
            
            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                tenantId: user.tenantId,
                role: user.role,
                tenantName: tenantName,
                tenant: tenantDetails,
                token: generateToken(user._id),
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
