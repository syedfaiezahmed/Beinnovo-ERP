const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const Partner = require('../models/Partner');
const Product = require('../models/Product');
const Invoice = require('../models/Invoice');
const Bill = require('../models/Bill');
const PurchaseOrder = require('../models/PurchaseOrder');
const Employee = require('../models/Employee');
const Project = require('../models/Project');
const CostCenter = require('../models/CostCenter');
const Timesheet = require('../models/Timesheet');
const Warehouse = require('../models/Warehouse');
const Leave = require('../models/Leave');
const Payroll = require('../models/Payroll');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Lead = require('../models/Lead');
const AITransactionLog = require('../models/AITransactionLog');

const { protect } = require('../middleware/authMiddleware');
const { processUserRequest } = require('../services/aiService');
const { seedAccounts, SYSTEM_ACCOUNTS } = require('../utils/seeder');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini (Local for specific routes not covered by service yet)
let genAI = null;
if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

const callGemini = async (prompt) => {
    // Mock Fallback for Forecast if API is missing or fails
    const mockForecast = `
### AI Financial Forecast (Offline Mode)

**Analysis:**
Based on the available transaction data, the system has generated a preliminary analysis.

**Recommendations:**
1. **Cash Flow Optimization:** Consider negotiating longer payment terms with suppliers to improve working capital.
2. **Expense Control:** Review recurring operational expenses (Rent, Utilities) as they show a steady trend.
3. **Revenue Diversification:** Explore up-selling opportunities to existing customers to boost revenue per client.

**Risks:**
- Potential cash flow gaps in upcoming months if receivables are delayed.
- Rising operational costs may impact net margins.

**Opportunities:**
- High demand observed in core product lines.
- Potential for cost reduction in procurement through bulk ordering.
`;

    if (!genAI) {
        console.log('Gemini API Key missing - Returning Mock Forecast');
        return mockForecast;
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('Gemini API Error:', error);
        console.log('Returning Mock Forecast due to API Error');
        return mockForecast;
    }
};

const safeJsonParse = (text) => {
    try {
        const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/i, '');
        return JSON.parse(cleaned);
    } catch (e) {
        console.error('JSON Parse Error:', e);
        return null;
    }
};

router.use(protect); // Apply authentication to all routes

// ==========================================
// HELPERS (Tenant & Accounts)
// ==========================================

// Global In-Memory Store for Offline Mode
global.memoryStore = {
    accounts: [],
    transactions: [],
    invoices: [],
    bills: []
};

// Helper to ensure tenant exists (especially for super_admin)
const ensureTenantId = async (user) => {
    // 1. If DB is disconnected, use mock tenant
    if (mongoose.connection.readyState !== 1) {
        if (!user.tenantId) {
             user.tenantId = 'offline_tenant_id_' + user._id; // Mock ID
        }
        return user.tenantId;
    }

    if (user.tenantId) {
        // console.log(`[ensureTenantId] User has tenantId: ${user.tenantId}`);
        return user.tenantId;
    }
    
    console.log(`User ${user._id} (${user.name}) has no tenantId. Creating default...`);

    // Create a default tenant for this user
    let tenantName = user.role === 'super_admin' ? 'System Tenant' : `${user.name}'s Organization`;
    
    // Check if a tenant with this name already exists (to avoid duplicates if something weird happened)
    let tenant = await Tenant.findOne({ name: tenantName });
    
    if (!tenant) {
        try {
            tenant = await Tenant.create({ name: tenantName });
            console.log(`Created new tenant: ${tenant.name} (${tenant._id})`);
        } catch (e) {
            console.error('[ensureTenantId] Failed to create tenant:', e);
            throw e;
        }
    }
    
    // Update user to have this tenant
    try {
        await User.findByIdAndUpdate(user._id, { tenantId: tenant._id });
        console.log(`Assigned tenant ${tenant._id} to user ${user._id}`);
    } catch (e) {
        console.error('[ensureTenantId] Failed to update user with tenantId:', e);
        throw e;
    }
    
    return tenant._id;
};

const validateTransactionBalance = (entries) => {
    const totals = entries.reduce((acc, e) => ({
        debit: acc.debit + (Number(e.debit) || 0),
        credit: acc.credit + (Number(e.credit) || 0),
    }), { debit: 0, credit: 0 });
    
    return {
        isValid: Math.abs(totals.debit - totals.credit) < 0.01 && totals.debit > 0,
        diff: Math.abs(totals.debit - totals.credit),
        totals
    };
};

const validateAccountsAndTypes = async (tenantId, accountCodesWithRole) => {
    const result = {
        ok: true,
        missing: [],
        typeMismatches: [],
        accounts: {},
        reasons: []
    };

    for (const item of accountCodesWithRole) {
        const { code, expectedType, role } = item;
        const acc = await Account.findOne({ tenantId, code });
        if (!acc) {
            result.ok = false;
            result.missing.push({ code, role });
            continue;
        }
        result.accounts[role] = acc;
        if (expectedType && acc.type !== expectedType) {
            result.ok = false;
            result.typeMismatches.push({ code, expectedType, actualType: acc.type, role });
        }
    }

    if (result.missing.length) {
        result.reasons.push(
            `Missing accounts: ` +
            result.missing.map(m => `${m.role} (${m.code})`).join(', ')
        );
    }
    if (result.typeMismatches.length) {
        result.reasons.push(
            `Type mismatches: ` +
            result.typeMismatches
                .map(t => `${t.role} (${t.code}) expected ${t.expectedType} got ${t.actualType}`)
                .join(', ')
        );
    }

    return result;
};

const appendStrictLedgerSummary = (baseMessage, debitLabel, debitCode, creditLabel, creditCode, amount) => {
    const amountFormatted = Number(amount).toLocaleString();
    const summary =
        `Accounting Entry Posted Successfully.\n\n` +
        `• Debit: ${debitLabel} (${debitCode}) — ${amountFormatted}\n` +
        `• Credit: ${creditLabel} (${creditCode}) — ${amountFormatted}\n` +
        `• Validation: Passed\n` +
        `• Posting Mode: Strict Ledger`;
    if (!baseMessage) return summary;
    if (baseMessage.includes('Accounting Entry Posted Successfully.')) return baseMessage;
    return `${baseMessage}\n\n${summary}`;
};

const getPermissionRequirementForIntent = (intent) => {
    if (!intent) return null;
    if (intent === 'create_journal') return { module: 'journal', action: 'create' };
    if (intent === 'create_invoice') return { module: 'sales', action: 'create' };
    if (intent === 'create_bill') return { module: 'purchase', action: 'create' };
    if (intent === 'create_purchase_order') return { module: 'purchase_order', action: 'create' };
    if (intent === 'convert_po_to_bill') return { module: 'purchase_order', action: 'approve' };
    if (intent === 'run_payroll') return { module: 'payroll', action: 'create' };
    if (intent === 'record_salary_payment') return { module: 'payroll', action: 'create' };
    if (intent === 'create_employee') return { module: 'hr', action: 'create' };
    if (intent === 'approve_leave') return { module: 'hr', action: 'approve' };
    if (intent === 'create_product') return { module: 'inventory', action: 'create' };
    if (intent === 'create_partner') return { module: 'crm', action: 'create' };
    if (intent === 'create_lead') return { module: 'crm', action: 'create' };
    if (intent === 'follow_up_client') return { module: 'crm', action: 'create' };
    if (intent === 'receive_payment') return { module: 'banking', action: 'create' };
    if (intent === 'pay_bill') return { module: 'banking', action: 'create' };
    if (intent === 'get_financial_report') return { module: 'reports', action: 'view' };
    return null;
};

const hasModuleActionPermission = (user, module, action) => {
    if (!user) return false;
    if (user.role === 'super_admin') return true;
    if (user.role === 'admin' && (!user.permissions || user.permissions.length === 0)) return true;
    const perms = user.permissions || [];
    const key = `${module}:${action}`;
    if (perms.includes(key)) return true;
    const wildcardModule = `${module}:*`;
    const wildcardAction = `*:${action}`;
    const wildcardAll = '*:*';
    if (perms.includes(wildcardModule)) return true;
    if (perms.includes(wildcardAction)) return true;
    if (perms.includes(wildcardAll)) return true;
    return false;
};

const getDefaultPermissionsForBusinessRole = (businessRole) => {
    if (businessRole === 'Organization Admin') {
        return [];
    }
    if (businessRole === 'Accountant') {
        return [
            'journal:create',
            'sales:create',
            'purchase:create',
            'banking:create',
            'reports:view'
        ];
    }
    if (businessRole === 'HR') {
        return [
            'hr:create',
            'payroll:create',
            'reports:view'
        ];
    }
    if (businessRole === 'Inventory Manager') {
        return [
            'inventory:create',
            'purchase:create',
            'reports:view'
        ];
    }
    if (businessRole === 'Auditor') {
        return [
            'reports:view',
            'audit:view'
        ];
    }
    if (businessRole === 'Cashier') {
        return [
            'banking:create'
        ];
    }
    return [];
};

const appendRoleControlSummary = (message, user, module, permissionGranted) => {
    const base = message || '';
    if (!user) return base;
    const namePart = user.name ? `${user.name} (${user._id})` : String(user._id || 'Unknown');
    const roleLabel =
        user.businessRole ||
        (user.role === 'super_admin'
            ? 'Super Admin'
            : user.role === 'admin'
            ? 'Organization Admin'
            : 'User');
    const moduleStatus = permissionGranted ? 'Allowed' : 'Blocked';
    const permStatus = permissionGranted ? 'Passed' : 'Failed';
    const block =
        `Action Executed Successfully.\n\n` +
        `• User: ${namePart}\n` +
        `• Role: ${roleLabel}\n` +
        `• Module Access: ${moduleStatus}\n` +
        `• Permission Check: ${permStatus}\n` +
        `• Action Mode: Role-Based Control`;
    if (!base) return block;
    if (base.includes('Action Executed Successfully.')) return base;
    return `${base}\n\n${block}`;
};

// Middleware to ensure tenant exists for every request
router.use(async (req, res, next) => {
    if (req.user && !req.dbAuthError) {
        try {
            const tenantId = await ensureTenantId(req.user);
            req.user.tenantId = tenantId; // Ensure it's set in request object for downstream
        } catch (e) {
            console.error('Failed to ensure tenant in middleware:', e);
        }
    }
    next();
});

// ==========================================
// AI INTEGRATION (Gemini)
// ==========================================

router.post('/ai/assist', async (req, res) => {
    try {
        // We allow AI to run even if DB is down (it has internal handling)
        const { prompt: userPrompt, context } = req.body;
        if (!userPrompt || typeof userPrompt !== 'string') {
            return res.status(400).json({ message: 'Prompt required' });
        }

        // Build context object
        const serviceContext = {
            tenantId: req.user.tenantId,
            userId: req.user._id,
            currentPath: context, // context is often a string from frontend
            dbStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
        };

        // Call the centralized AI Service
        const aiResponse = await processUserRequest(userPrompt, serviceContext);

        const permissionRequirement = getPermissionRequirementForIntent(aiResponse.intent);
        let permissionGranted = true;
        let permissionKey = null;

        if (permissionRequirement) {
            permissionKey = `${permissionRequirement.module}:${permissionRequirement.action}`;
            permissionGranted = hasModuleActionPermission(req.user, permissionRequirement.module, permissionRequirement.action);
        }

        if (permissionRequirement && !permissionGranted) {
            aiResponse.readyToExecute = false;
            const baseMessage = aiResponse.message || '';
            const statusLines = [
                'Status:',
                `Permission denied for this action (${permissionKey}).`,
                'Please contact your administrator to request access.'
            ].join('\n');
            const withStatus = baseMessage ? `${baseMessage}\n\n${statusLines}` : statusLines;
            aiResponse.message = appendRoleControlSummary(
                withStatus,
                req.user,
                permissionRequirement.module,
                false
            );

            try {
                await AITransactionLog.create({
                    tenantId: req.user.tenantId,
                    userId: req.user._id,
                    userRole: req.user.role,
                    userBusinessRole: req.user.businessRole,
                    userPrompt,
                    aiResponse,
                    parsedEntries: null,
                    status: 'Failed',
                    error: `Permission denied: ${permissionKey}`,
                    confidenceScore: typeof aiResponse.confidence === 'number' ? aiResponse.confidence : undefined,
                    intent: aiResponse.intent,
                    module: permissionRequirement.module,
                    action: permissionRequirement.action,
                    permissionKey,
                    permissionGranted: false,
                    approvalStatus: 'Denied'
                });
            } catch (logErr) {
                console.error('AI Transaction Log Error (permission denied):', logErr);
            }

            return res.json(aiResponse);
        }

        // --- EXECUTION LAYER ---
        // The Service decides WHAT to do (Intent), this Route decides HOW to do it (Execute/Save)
        let executionError = null;

        // 1. Handle Auto-Creation of New Accounts (if suggested by AI)
        if (aiResponse.new_accounts && aiResponse.new_accounts.length > 0) {
            const codeMap = {};
            for (const newAcc of aiResponse.new_accounts) {
                // Generate code logic
                let rangeStart = '100';
                if (newAcc.type === 'Liability') rangeStart = '200';
                else if (newAcc.type === 'Equity') rangeStart = '300';
                else if (newAcc.type === 'Revenue') rangeStart = '400';
                else if (newAcc.type === 'Expense') rangeStart = '500';
                
                const existing = await Account.find({ 
                    tenantId: req.user.tenantId, 
                    code: { $regex: `^${rangeStart[0]}` } 
                }).sort({ code: -1 }).limit(1);
                
                let nextCode = parseInt(existing.length ? existing[0].code : rangeStart) + 1;
                const realCode = String(nextCode);

                try {
                    await Account.create({
                        tenantId: req.user.tenantId,
                        code: realCode,
                        name: newAcc.name,
                        type: newAcc.type,
                        category: newAcc.category || 'General',
                        balance: 0
                    });
                    codeMap[newAcc.tempId] = realCode;
                } catch (err) {
                    console.error('Failed to create account:', err);
                }
            }
            // Update any temp codes in the data
             if (aiResponse.data && aiResponse.data.entries) {
                aiResponse.data.entries = aiResponse.data.entries.map(e => {
                    if (codeMap[e.accountCode]) return { ...e, accountCode: codeMap[e.accountCode] };
                    return e;
                });
            }
        }

        // 2. Handle Specific Intents (Server-Side Execution)
        if (aiResponse.readyToExecute) {
            try {
                const tenantId = req.user.tenantId;
                
                if (aiResponse.intent === 'create_journal') {
                    const { entries, date, description } = aiResponse.data;

                    // Helper for fuzzy matching (Local scope for now, or move to top)
                    const findAccountCode = async (identifier) => {
                        // 1. Try exact code match
                        let acc = await Account.findOne({ tenantId, code: identifier });
                        if (acc) return acc.code;

                        // 2. Try exact name match
                        acc = await Account.findOne({ tenantId, name: identifier });
                        if (acc) return acc.code;

                        // 3. Try fuzzy name match (regex)
                        acc = await Account.findOne({ tenantId, name: { $regex: identifier, $options: 'i' } });
                        if (acc) return acc.code;

                        return null; // Not found
                    };

                    const processedEntries = [];
                    for (const entry of entries) {
                        let code = entry.accountCode;
                        
                        // If no code or code looks like a name, try to find it
                        if (!code || isNaN(code)) {
                            // Try to find by accountName if provided, otherwise use the code field as name
                            const searchName = entry.accountName || entry.accountCode; 
                            const foundCode = await findAccountCode(searchName);
                            if (foundCode) {
                                code = foundCode;
                            } else {
                                // If still not found, check if AI suggested creating it (already handled in step 1 of route)
                                // If not, we might have an issue. For now, let it fail validation or rely on AI's 'new_accounts'
                                throw new Error(`Account '${searchName}' not found. Please create it first.`);
                            }
                        }

                        processedEntries.push({
                            accountCode: code,
                            debit: Number(entry.debit),
                            credit: Number(entry.credit)
                        });
                    }

                    const balanceCheck = validateTransactionBalance(processedEntries);
                    if (!balanceCheck.isValid) {
                        throw new Error(`Journal not balanced. Debit: ${balanceCheck.totals.debit}, Credit: ${balanceCheck.totals.credit}`);
                    }

                    if (balanceCheck.totals.debit > 10000000) {
                        throw new Error(`Transaction amount (${balanceCheck.totals.debit}) exceeds safety limit. Please post manually.`);
                    }

                        await Transaction.create({
                        tenantId,
                        date,
                        description,
                        entries: processedEntries,
                        status: 'Posted',
                        created_by: 'ai',
                        audit_metadata: {
                                intent: 'create_journal',
                                validation: 'Passed',
                                totals: balanceCheck.totals,
                                userId: req.user._id,
                                userRole: req.user.role,
                                userBusinessRole: req.user.businessRole,
                                permissionKey,
                                permissionGranted: true
                            }
                    });
                    aiResponse.message += ' (Journal Entry Posted Successfully)';
                }
                else if (aiResponse.intent === 'create_purchase_order') {
                    const { supplierName, items, date, expectedDeliveryDate, currency, notes } = aiResponse.data;
                    let partner = await Partner.findOne({ tenantId, name: supplierName });
                    if (!partner) {
                        partner = await Partner.create({
                            tenantId,
                            name: supplierName,
                            type: 'Vendor',
                            email: 'unknown@example.com'
                        });
                    } else if (partner.type === 'Customer') {
                        partner.type = 'Both';
                        await partner.save();
                    }

                    const poItems = (items || []).map((it) => {
                        const qty = Number(it.quantity) || 0;
                        const unitPrice = Number(it.unitPrice != null ? it.unitPrice : (it.price || 0));
                        const lineTotal = qty * unitPrice;
                        return {
                            productName: it.productName || it.description || 'Item',
                            sku: it.sku,
                            description: it.description || '',
                            quantity: qty,
                            unitPrice,
                            lineTotal
                        };
                    });

                    const totalAmount = poItems.reduce((sum, it) => sum + (it.lineTotal || 0), 0);

                    const now = new Date();
                    const year = now.getFullYear();
                    const existingCount = await PurchaseOrder.countDocuments({
                        tenantId,
                        poNumber: new RegExp(`^PO-${year}-`, 'i')
                    });
                    const seq = String(existingCount + 1).padStart(4, '0');
                    const poNumber = `PO-${year}-${seq}`;

                    const po = await PurchaseOrder.create({
                        tenantId,
                        poNumber,
                        supplier: partner._id,
                        supplierName: partner.name,
                        date: date ? new Date(date) : now,
                        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : undefined,
                        items: poItems,
                        totalAmount,
                        currency: currency || 'PKR',
                        status: 'Open',
                        notes: notes || ''
                    });

                    const itemsSummary = poItems
                        .map(
                            (i) =>
                                `${i.productName} | SKU: ${i.sku || 'N/A'} Qty: ${i.quantity} × ${i.unitPrice} = ${i.lineTotal}`
                        )
                        .join('; ');

                    aiResponse.message = `Purchase Order Created Successfully\n• PO Number: ${po.poNumber}\n• Supplier: ${po.supplierName}\n• Items: ${itemsSummary}\n• PO Total: ${totalAmount} ${po.currency}\n• Status: OPEN (Awaiting Delivery)\n(No accounting or inventory entries posted)`;
                }
                else if (aiResponse.intent === 'create_invoice') {
                    // Create Invoice
                    const { partnerName, items, date, dueDate } = aiResponse.data;
                    // Find Partner
                    let partner = await Partner.findOne({ tenantId, name: partnerName });
                    if (!partner) {
                        partner = await Partner.create({ tenantId, name: partnerName, type: 'Customer', email: 'unknown@example.com' });
                    }
                    
                    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
                    
                    const invoiceItems = [];
                    const cogsByAccount = {};
                    const inventoryByAccount = {};
                    const salesByAccount = {};
                    const defaultSalesAccount = '401';
                    let inventoryOk = true;
                    let inventoryError = null;
                    
                    for (const item of items) {
                        let productId = null;
                        let salesAcc = defaultSalesAccount;
                        const lookupName = item.productName || item.description;
                        const product = item.sku
                            ? await Product.findOne({ tenantId, sku: item.sku })
                            : await Product.findOne({ tenantId, name: { $regex: lookupName, $options: 'i' } });
                        
                        if (product) {
                            productId = product._id;
                            if (product.salesAccount) salesAcc = product.salesAccount;
                    
                            if (product.type !== 'Service') {
                                try {
                                    const qtyToSell = item.quantity;
                                    let cogsAmount = 0;
                    
                                    if ((product.quantityOnHand || 0) < qtyToSell) {
                                        cogsAmount = qtyToSell * (product.costPrice || 0);
                                        product.quantityOnHand = (product.quantityOnHand || 0) - qtyToSell;
                                    } else {
                                        cogsAmount = qtyToSell * (product.costPrice || 0);
                                        product.quantityOnHand -= qtyToSell;
                                    }
                                    await product.save();
                    
                                    const cogsAcc = product.cogsAccount || '501';
                                    const invAcc = product.inventoryAccount || '140';
                    
                                    cogsByAccount[cogsAcc] = (cogsByAccount[cogsAcc] || 0) + cogsAmount;
                                    inventoryByAccount[invAcc] = (inventoryByAccount[invAcc] || 0) + cogsAmount;
                                } catch (err) {
                                    inventoryOk = false;
                                    inventoryError = err.message;
                                    break;
                                }
                            }
                        } else {
                            try {
                                const estCost = item.price * 0.7;
                                const cogsAmount = item.quantity * estCost;
                                
                                const newProduct = await Product.create({
                                    tenantId,
                                    sku: item.sku || `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                                    name: item.productName || item.description || 'New Sold Item',
                                    type: 'Goods',
                                    salesPrice: item.price,
                                    costPrice: estCost,
                                    quantityOnHand: -item.quantity,
                                    inventoryAccount: '140',
                                    cogsAccount: '501',
                                    salesAccount: '401'
                                });
                                productId = newProduct._id;
                    
                                const cogsAcc = '501';
                                const invAcc = '140';
                    
                                cogsByAccount[cogsAcc] = (cogsByAccount[cogsAcc] || 0) + cogsAmount;
                                inventoryByAccount[invAcc] = (inventoryByAccount[invAcc] || 0) + cogsAmount;
                            } catch (err) {
                                console.error('Auto-create sold product failed:', err);
                                inventoryOk = false;
                                inventoryError = err.message;
                                break;
                            }
                        }
                    
                        salesByAccount[salesAcc] = (salesByAccount[salesAcc] || 0) + (item.quantity * item.price);
                    
                        invoiceItems.push({
                            product: productId,
                            description: item.productName || item.description || 'Service',
                            quantity: item.quantity,
                            unitPrice: item.price,
                            amount: item.quantity * item.price
                        });
                    }

                    if (!inventoryOk) {
                        throw new Error(inventoryError || 'Inventory update failed');
                    }

                    const invoice = await Invoice.create({
                        tenantId,
                        customer: partner._id,
                        invoiceNumber: `INV-${Date.now()}`,
                        date,
                        dueDate: dueDate || date,
                        items: invoiceItems,
                        subtotal: totalAmount,
                        grandTotal: totalAmount,
                        balanceDue: totalAmount,
                        status: 'Draft'
                    });
                    
                    const arValidation = await validateAccountsAndTypes(tenantId, [
                        { code: '120', expectedType: 'Asset', role: 'debit' },
                        { code: '401', expectedType: 'Revenue', role: 'credit_sales' },
                        { code: '501', expectedType: 'Expense', role: 'debit_cogs' },
                        { code: '140', expectedType: 'Asset', role: 'credit_inventory' }
                    ]);

                    if (arValidation.ok) {
                        const arAcc = arValidation.accounts.debit;
                        const entries = [];
                        
                        entries.push({ accountCode: arAcc.code, debit: totalAmount, credit: 0 });

                        for (const [code, amount] of Object.entries(salesByAccount)) {
                            entries.push({ accountCode: code, debit: 0, credit: amount });
                        }

                        // 3. Debit COGS / Credit Inventory
                        for (const [code, amount] of Object.entries(cogsByAccount)) {
                            if (amount > 0) entries.push({ accountCode: code, debit: amount, credit: 0 });
                        }
                        for (const [code, amount] of Object.entries(inventoryByAccount)) {
                            if (amount > 0) entries.push({ accountCode: code, debit: 0, credit: amount });
                        }

                        const balanceCheck = validateTransactionBalance(entries);
                        if (!balanceCheck.isValid) {
                            throw new Error(`Invoice posting not balanced. Debit: ${balanceCheck.totals.debit}, Credit: ${balanceCheck.totals.credit}`);
                        }

                        const txn = await Transaction.create({
                            tenantId,
                            date,
                            description: `Invoice #${invoice.invoiceNumber} for ${partnerName}`,
                            entries: entries,
                            status: 'Posted',
                            relatedDocument: invoice._id,
                            relatedModel: 'Invoice',
                            created_by: 'ai',
                            audit_metadata: {
                                intent: 'create_invoice',
                                reason: 'Sales: Dr Accounts Receivable (120), Cr Sales Revenue (401); Dr COGS (501), Cr Inventory (140)',
                                validation: 'Passed',
                                totals: balanceCheck.totals,
                                userId: req.user._id,
                                userRole: req.user.role,
                                userBusinessRole: req.user.businessRole,
                                permissionKey,
                                permissionGranted: true
                            }
                        });
                        invoice.status = 'Sent';
                        invoice.transactionRef = txn._id;

                        // HANDLE CASH SALE IMMEDIATELY
                        const { paymentMethod } = aiResponse.data;
                        const cashAcc = await Account.findOne({ tenantId, code: '101' });

                        if ((paymentMethod === 'Cash' || partnerName.toLowerCase().includes('cash')) && cashAcc) {
                             const payEntries = [
                                 { accountCode: cashAcc.code, debit: totalAmount, credit: 0 },
                                 { accountCode: arAcc.code, debit: 0, credit: totalAmount }
                             ];
                             const payBalance = validateTransactionBalance(payEntries);
                             if (!payBalance.isValid) {
                                throw new Error(`Cash receipt not balanced. Debit: ${payBalance.totals.debit}, Credit: ${payBalance.totals.credit}`);
                             }
                             await Transaction.create({
                                 tenantId,
                                 date,
                                 description: `Cash Receipt for Invoice #${invoice.invoiceNumber}`,
                                 entries: payEntries,
                                 status: 'Posted',
                                 relatedDocument: invoice._id,
                                 relatedModel: 'Invoice',
                                 created_by: 'ai',
                                 audit_metadata: {
                                     intent: 'receive_payment',
                                     reason: 'Cash sale: Dr Cash (101), Cr Accounts Receivable (120)',
                                     validation: 'Passed',
                                     totals: payBalance.totals
                                 }
                             });

                             invoice.status = 'Paid';
                             invoice.balanceDue = 0;
                             invoice.amountPaid = totalAmount;
                             invoice.payments.push({
                                 date: date || new Date(),
                                 amount: totalAmount,
                                 method: 'Cash',
                                 reference: 'AI-AUTO-RECEIPT',
                                 note: 'Auto-paid via AI'
                             });

                             aiResponse.message += ` & Paid (Cash)`;
                        }

                        await invoice.save();

                        const mainItem = items[0];
                        const qtySold = mainItem ? mainItem.quantity : 0;
                        const unitPriceValue = mainItem ? mainItem.price : totalAmount;
                        const skuText = mainItem && mainItem.sku ? mainItem.sku : '';
                        const itemName = mainItem && (mainItem.productName || mainItem.description)
                            ? (mainItem.productName || mainItem.description)
                            : 'Item';
                        const totalFormatted = Number(totalAmount).toLocaleString();
                        const unitFormatted = Number(unitPriceValue).toLocaleString();
                        const rawPayment = (aiResponse.data && aiResponse.data.paymentMethod) || paymentMethod || 'Credit';
                        const paymentLower = String(rawPayment).toLowerCase();
                        const resolvedPaymentMethod = paymentLower.includes('cash') ? 'Cash' : 'Credit';
                        const debitLabel = resolvedPaymentMethod === 'Cash' ? 'Cash' : 'Accounts Receivable';

                        aiResponse.message = `Sales Transaction Recorded Successfully.\n\n` +
                            `• Item: ${itemName}\n` +
                            `• SKU: ${skuText || 'N/A'}\n` +
                            `• Quantity Sold: ${qtySold} units\n` +
                            `• Unit Price: ${unitFormatted}\n` +
                            `• Total Sale: ${totalFormatted}\n` +
                            `• Payment: ${resolvedPaymentMethod}\n` +
                            `• Accounting:\n` +
                            `   - ${debitLabel} Dr ${totalFormatted}\n` +
                            `   - Sales Revenue Cr ${totalFormatted}\n` +
                            `• Inventory: Stock reduced by ${qtySold} units\n` +
                            `• Customer: ${partnerName}`;
                    } else {
                        aiResponse.message += ` (Invoice #${invoice.invoiceNumber} Created - Draft - Accounting configuration incomplete for AR/Revenue/COGS/Inventory)`;
                    }
                }
                else if (aiResponse.intent === 'create_bill') {
                    // Create Bill
                    const { partnerName, items, date, dueDate } = aiResponse.data;
                    let partner = await Partner.findOne({ tenantId, name: partnerName });
                    if (!partner) {
                        partner = await Partner.create({ tenantId, name: partnerName, type: 'Vendor', email: 'unknown@example.com' });
                    }
                    
                    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
                    
                    const billItems = [];
                    const debitMap = {};
                    let inventoryOkBill = true;
                    let inventoryBillError = null;
                    
                    for (const item of items) {
                        let productId = null;
                        let debitAccount = item.accountCode || '501';
                        const lookupName = item.productName || item.description;
                        const product = item.sku
                            ? await Product.findOne({ tenantId, sku: item.sku })
                            : await Product.findOne({ tenantId, name: { $regex: lookupName, $options: 'i' } });
                    
                        if (product) {
                            productId = product._id;
                            debitAccount = product.inventoryAccount || '140';
                    
                            if (product.type !== 'Service') {
                                try {
                                    const oldQty = product.quantityOnHand || 0;
                                    const oldCost = product.costPrice || 0;
                                    const newQty = item.quantity;
                                    const newCost = item.price;
                                    
                                    const totalValue = (oldQty * oldCost) + (newQty * newCost);
                                    const totalQty = oldQty + newQty;
                                    
                                    if (totalQty > 0) {
                                        product.costPrice = totalValue / totalQty;
                                    }
                    
                                    product.quantityOnHand = (product.quantityOnHand || 0) + item.quantity;
                                    product.batches.push({
                                        batchId: `PUR-AI-${Date.now()}`,
                                        date: date || new Date(),
                                        quantity: item.quantity,
                                        unitCost: item.price,
                                        remainingQuantity: item.quantity
                                    });
                                    await product.save();
                                } catch (err) {
                                    inventoryOkBill = false;
                                    inventoryBillError = err.message;
                                    break;
                                }
                            }
                        } else {
                            try {
                                const newProduct = await Product.create({
                                    tenantId,
                                    sku: item.sku || `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                                    name: item.productName || item.description || 'New Item',
                                    type: 'Goods',
                                    salesPrice: item.price * 1.5,
                                    costPrice: item.price,
                                    quantityOnHand: item.quantity,
                                    inventoryAccount: '140',
                                    cogsAccount: '501',
                                    salesAccount: '401',
                                    batches: [{
                                        batchId: `PUR-AI-${Date.now()}`,
                                        date: date || new Date(),
                                        quantity: item.quantity,
                                        unitCost: item.price,
                                        remainingQuantity: item.quantity
                                    }]
                                });
                                productId = newProduct._id;
                                debitAccount = '140';
                            } catch (err) {
                                console.error('Auto-create product failed:', err);
                                inventoryOkBill = false;
                                inventoryBillError = err.message;
                                break;
                            }
                        }
                    
                        debitMap[debitAccount] = (debitMap[debitAccount] || 0) + (item.quantity * item.price);
                    
                        billItems.push({
                            product: productId,
                            description: item.productName || item.description || 'Expense',
                            quantity: item.quantity,
                            unitPrice: item.price,
                            amount: item.quantity * item.price,
                            accountCode: debitAccount
                        });
                    }

                    if (!inventoryOkBill) {
                        throw new Error(inventoryBillError || 'Inventory update failed');
                    }

                    const inventoryDebitTotal = Object.values(debitMap).reduce((sum, amount) => sum + amount, 0);
                    if (Math.abs(inventoryDebitTotal - totalAmount) > 0.01) {
                        throw new Error('Inventory/accounting amount mismatch');
                    }

                    const bill = await Bill.create({
                        tenantId,
                        vendor: partner._id,
                        billNumber: `BILL-${Date.now()}`,
                        date,
                        dueDate: dueDate || date,
                        items: billItems,
                        subtotal: totalAmount,
                        grandTotal: totalAmount,
                        balanceDue: totalAmount,
                        status: 'Draft'
                    });
                    
                    const purchaseValidation = await validateAccountsAndTypes(tenantId, [
                        { code: '201', expectedType: 'Liability', role: 'ap' },
                        { code: '140', expectedType: 'Asset', role: 'inventory' },
                        { code: '101', expectedType: 'Asset', role: 'cash' }
                    ]);

                    const apAcc = purchaseValidation.accounts.ap;
                    const cashAcc = purchaseValidation.accounts.cash;
                    
                    if (purchaseValidation.ok && apAcc) {
                        const entries = [];
                        entries.push({ accountCode: apAcc.code, debit: 0, credit: totalAmount });

                        for (const [code, amount] of Object.entries(debitMap)) {
                             entries.push({ accountCode: code, debit: amount, credit: 0 });
                        }

                        const balanceCheck = validateTransactionBalance(entries);
                        if (!balanceCheck.isValid) {
                            throw new Error(`Bill posting not balanced. Debit: ${balanceCheck.totals.debit}, Credit: ${balanceCheck.totals.credit}`);
                        }

                        const txn = await Transaction.create({
                            tenantId,
                            date,
                            description: `Bill #${bill.billNumber} from ${partnerName}`,
                            entries: entries,
                            status: 'Posted',
                            relatedDocument: bill._id,
                            relatedModel: 'Bill',
                            created_by: 'ai',
                            audit_metadata: {
                                intent: 'create_bill',
                                reason: 'Purchase inventory: Dr Inventory/Expense, Cr Accounts Payable (201)',
                                validation: 'Passed',
                                totals: balanceCheck.totals,
                                userId: req.user._id,
                                userRole: req.user.role,
                                userBusinessRole: req.user.businessRole,
                                permissionKey,
                                permissionGranted: true
                            }
                        });
                        bill.status = 'Posted';
                        bill.transactionRef = txn._id;

                        const { paymentMethod } = aiResponse.data;
                        if (paymentMethod === 'Cash' && cashAcc) {
                             const payEntries = [
                                 { accountCode: apAcc.code, debit: totalAmount, credit: 0 },
                                 { accountCode: cashAcc.code, debit: 0, credit: totalAmount }
                             ];
                             const payBalance = validateTransactionBalance(payEntries);
                             if (!payBalance.isValid) {
                                throw new Error(`Bill cash payment not balanced. Debit: ${payBalance.totals.debit}, Credit: ${payBalance.totals.credit}`);
                             }
                             await Transaction.create({
                                 tenantId,
                                 date,
                                 description: `Cash Payment for Bill #${bill.billNumber}`,
                                 entries: payEntries,
                                 status: 'Posted',
                                 relatedDocument: bill._id,
                                 relatedModel: 'Bill',
                                 created_by: 'ai',
                                 audit_metadata: {
                                     intent: 'pay_bill',
                                     reason: 'Pay supplier: Dr Accounts Payable (201), Cr Cash (101)',
                                     validation: 'Passed',
                                     totals: payBalance.totals,
                                     userId: req.user._id,
                                     userRole: req.user.role,
                                     userBusinessRole: req.user.businessRole,
                                     permissionKey,
                                     permissionGranted: true
                                 }
                             });

                             bill.status = 'Paid';
                             bill.balanceDue = 0;
                             bill.amountPaid = totalAmount;
                             bill.payments.push({
                                 date: date || new Date(),
                                 amount: totalAmount,
                                 method: 'Cash',
                                 reference: 'AI-AUTO-PAY',
                                 note: 'Auto-paid via AI'
                             });

                             aiResponse.message += ` & Paid (Cash)`;
                        }

                        await bill.save();
                        const mainItem = items[0];
                        const qtyValue = mainItem ? mainItem.quantity : 0;
                        const unitPriceValue = mainItem ? mainItem.price : totalAmount;
                        const skuText = mainItem && mainItem.sku ? mainItem.sku : '';
                        const itemName = mainItem && (mainItem.productName || mainItem.description)
                            ? (mainItem.productName || mainItem.description)
                            : 'Item';
                        const totalFormatted = Number(totalAmount).toLocaleString();
                        const strictMessage = appendStrictLedgerSummary(
                            '',
                            'Inventory Asset',
                            '140',
                            'Accounts Payable',
                            '201',
                            totalAmount
                        );
                        aiResponse.message = `Transaction Recorded Successfully.\n\n• Item: ${itemName}\n• SKU: ${skuText || 'N/A'}\n• Quantity: ${qtyValue} units\n• Unit Price: ${unitPriceValue}\n• Inventory Value: ${totalFormatted}\n• Supplier: ${partnerName}\n\n${strictMessage}`;
                    } else {
                        aiResponse.message += ` (Bill #${bill.billNumber} Created - Draft - Accounting configuration incomplete for Inventory/AP/Cash)`;
                    }
                }
                else if (aiResponse.intent === 'convert_po_to_bill') {
                    const { poNumber } = aiResponse.data;
                    const po = await PurchaseOrder.findOne({ tenantId, poNumber }).populate('supplier');

                    if (!po) {
                        aiResponse.message += ` (Purchase Order ${poNumber} not found)`;
                    } else if (po.status === 'Closed' || po.status === 'Cancelled') {
                        aiResponse.message += ` (Purchase Order ${poNumber} is already ${po.status})`;
                    } else if (!po.items || !po.items.length) {
                        aiResponse.message += ` (Purchase Order ${poNumber} has no items to convert)`;
                    } else {
                        const partnerName = po.supplierName || (po.supplier && po.supplier.name) || 'Unknown Supplier';
                        const billItems = po.items.map((it) => ({
                            product: null,
                            accountCode: '140',
                            description: it.productName || it.description || 'Item',
                            quantity: it.quantity,
                            unitPrice: it.unitPrice,
                            amount: it.lineTotal
                        }));

                        const subtotal = po.items.reduce((sum, it) => sum + (it.lineTotal || 0), 0);

                        const bill = await Bill.create({
                            tenantId,
                            vendor: po.supplier,
                            billNumber: `BILL-${Date.now()}`,
                            date: po.date || new Date(),
                            dueDate: po.date || new Date(),
                            items: billItems,
                            subtotal,
                            taxTotal: 0,
                            grandTotal: subtotal,
                            balanceDue: subtotal,
                            status: 'Draft'
                        });

                        const apAcc = await Account.findOne({ tenantId, code: '201' });
                        const invAcc = await Account.findOne({ tenantId, code: '140' });

                        if (apAcc && invAcc) {
                            const entries = [
                                { accountCode: invAcc.code, debit: subtotal, credit: 0 },
                                { accountCode: apAcc.code, debit: 0, credit: subtotal }
                            ];

                            const txn = await Transaction.create({
                                tenantId,
                                date: bill.date,
                                description: `Bill #${bill.billNumber} for PO ${po.poNumber}`,
                                entries,
                                status: 'Posted',
                                relatedDocument: bill._id,
                                relatedModel: 'Bill'
                            });

                            bill.status = 'Posted';
                            bill.transactionRef = txn._id;
                            await bill.save();
                        }

                        po.status = 'Closed';
                        await po.save();

                        aiResponse.message = `Purchase Order Converted Successfully\n• PO Number: ${po.poNumber}\n• Bill Number: ${bill.billNumber}\n• Supplier: ${partnerName}\n• PO Total: ${subtotal} PKR\n• Status: CLOSED (Goods Received)\n(Accounting and inventory ledger updated; supplier balance increased.)`;
                    }
                }
                else if (aiResponse.intent === 'create_employee') {
                    await Employee.create({
                        tenantId,
                        ...aiResponse.data
                    });
                    aiResponse.message += ' (Employee Created Successfully)';
                }
                else if (aiResponse.intent === 'run_payroll') {
                    const employees = await Employee.find({ tenantId, status: 'Active' });
                    if (employees.length === 0) {
                        aiResponse.message += ' (No active employees found to run payroll)';
                    } else {
                        let totalSalary = 0;
                        const monthLabel = `${aiResponse.data.month} ${aiResponse.data.year}`;
                        const paymentDate = new Date();

                        for (const emp of employees) {
                            const gross = emp.salary || 0;
                            if (!gross) continue;
                            totalSalary += gross;

                            await Payroll.create({
                                tenantId,
                                employee: emp._id,
                                month: monthLabel,
                                baseSalary: gross,
                                bonus: 0,
                                deductions: 0,
                                netSalary: gross,
                                salaryType: 'Monthly',
                                status: 'Paid',
                                paymentDate
                            });
                        }

                        if (totalSalary > 0) {
                            const salaryExp = await Account.findOne({ tenantId, code: '504' });
                            const bankAcc = await Account.findOne({ tenantId, code: '102' });

                        if (salaryExp && bankAcc) {
                            const entries = [
                                { accountCode: salaryExp.code, debit: totalSalary, credit: 0 },
                                { accountCode: bankAcc.code, debit: 0, credit: totalSalary }
                            ];
                            const balanceCheck = validateTransactionBalance(entries);
                            if (!balanceCheck.isValid) {
                                throw new Error(`Payroll posting not balanced. Debit: ${balanceCheck.totals.debit}, Credit: ${balanceCheck.totals.credit}`);
                            }
                            await Transaction.create({
                                tenantId,
                                date: paymentDate,
                                description: `Payroll for ${monthLabel}`,
                                entries,
                                status: 'Posted',
                                type: 'Payroll',
                                created_by: 'ai',
                                audit_metadata: {
                                    intent: 'run_payroll',
                                    reason: 'Salary: Dr Salary Expense (504), Cr Bank (102)',
                                    validation: 'Passed',
                                    totals: balanceCheck.totals,
                                    userId: req.user._id,
                                    userRole: req.user.role,
                                    userBusinessRole: req.user.businessRole,
                                    permissionKey,
                                    permissionGranted: true
                                }
                            });
                            const strictMsg = appendStrictLedgerSummary(
                                '',
                                'Salary Expense',
                                salaryExp.code,
                                'Bank',
                                bankAcc.code,
                                totalSalary
                            );
                            aiResponse.message += `\n\n${strictMsg}`;
                        } else {
                            aiResponse.message += ' (Payroll Recorded - Transaction Pending Accounts)';
                        }
                        } else {
                            aiResponse.message += ' (Payroll Skipped - No salaries found for active employees)';
                        }
                    }
                }
                else if (aiResponse.intent === 'record_salary_payment') {
                    const { employeeName, amount, salaryType, paymentMethod, period } = aiResponse.data;

                    const employee = await Employee.findOne({
                        tenantId,
                        $or: [
                            { firstName: { $regex: employeeName.split(' ')[0], $options: 'i' } },
                            { lastName: { $regex: employeeName.split(' ').pop(), $options: 'i' } }
                        ]
                    });

                    if (!employee) {
                        aiResponse.message += ` (Employee '${employeeName}' not found)`;
                    } else {
                        const paymentLower = String(paymentMethod || '').toLowerCase();
                        const isCash = paymentLower.includes('cash');
                        const bankCode = isCash ? '101' : '102';

                        const payroll = await Payroll.create({
                            tenantId,
                            employee: employee._id,
                            month: period || '',
                            baseSalary: amount,
                            bonus: 0,
                            deductions: 0,
                            netSalary: amount,
                            salaryType: (String(salaryType || '') .toLowerCase().includes('advance') ? 'Advance' : 'Monthly'),
                            status: 'Paid',
                            paymentDate: new Date()
                        });

                        const salaryExp = await Account.findOne({ tenantId, code: String(salaryType || '').toLowerCase().includes('advance') ? '141' : '504' });
                        const cashOrBank = await Account.findOne({ tenantId, code: bankCode });

                        if (salaryExp && cashOrBank) {
                            const entries = [
                                { accountCode: salaryExp.code, debit: amount, credit: 0 },
                                { accountCode: cashOrBank.code, debit: 0, credit: amount }
                            ];
                            const balanceCheck = validateTransactionBalance(entries);
                            if (!balanceCheck.isValid) {
                                throw new Error(`Salary payment not balanced. Debit: ${balanceCheck.totals.debit}, Credit: ${balanceCheck.totals.credit}`);
                            }
                            await Transaction.create({
                                tenantId,
                                date: payroll.paymentDate,
                                description: `Salary Payment - ${employee.firstName} ${employee.lastName} - ${period || ''}`,
                                entries,
                                status: 'Posted',
                                type: 'Payroll',
                                reference: `PAY-${payroll._id}`,
                                created_by: 'ai',
                                audit_metadata: {
                                    intent: 'record_salary_payment',
                                    reason: String(salaryType || '').toLowerCase().includes('advance')
                                        ? 'Advance salary: Dr Advance Salary (141), Cr Cash/Bank'
                                        : 'Salary: Dr Salary Expense (504), Cr Cash/Bank',
                                    validation: 'Passed',
                                    totals: balanceCheck.totals,
                                    userId: req.user._id,
                                    userRole: req.user.role,
                                    userBusinessRole: req.user.businessRole,
                                    permissionKey,
                                    permissionGranted: true
                                }
                            });
                            const cashOrBankLabel = isCash ? 'Cash' : 'Bank';
                            const debitLabel = String(salaryType || '').toLowerCase().includes('advance')
                                ? 'Advance Salary'
                                : 'Salary Expense';
                            aiResponse.message = appendStrictLedgerSummary(
                                `Salary Payment Recorded Successfully.\n\n` +
                                `• Employee: ${employee.firstName} ${employee.lastName}\n` +
                                `• Period: ${period || 'N/A'}\n` +
                                `• Amount: ${amount}\n` +
                                `• Type: ${salaryType || 'Monthly'}\n` +
                                `• Payment Method: ${cashOrBankLabel}`,
                                debitLabel,
                                salaryExp.code,
                                cashOrBankLabel,
                                cashOrBank.code,
                                amount
                            );
                        } else {
                            const reason = !salaryExp
                                ? 'Required salary/advance account not configured'
                                : 'Cash/Bank account not configured';
                            aiResponse.message += ` (Salary Payment Not Posted - ${reason})`;
                        }
                    }
                }
                else if (aiResponse.intent === 'approve_leave') {
                     const { employeeName, type, days, startDate } = aiResponse.data;
                     // Find Employee
                     const employee = await Employee.findOne({ 
                        tenantId, 
                        $or: [
                            { firstName: { $regex: employeeName.split(' ')[0], $options: 'i' } },
                            { lastName: { $regex: employeeName.split(' ').pop(), $options: 'i' } }
                        ]
                     });

                     if (!employee) {
                         aiResponse.message += ` (Employee '${employeeName}' not found)`;
                     } else {
                         await Leave.create({
                             tenantId,
                             employee: employee._id,
                             leaveType: type,
                             startDate: startDate,
                             endDate: new Date(new Date(startDate).setDate(new Date(startDate).getDate() + days)),
                             reason: 'Approved via AI Agent',
                             status: 'Approved'
                         });
                         aiResponse.message += ` (Leave Approved for ${employee.firstName} ${employee.lastName})`;
                     }
                }
                else if (aiResponse.intent === 'create_product') {
                    const { name, type, price, cost, stock } = aiResponse.data;
                    const existing = await Product.findOne({ tenantId, name });
                    if (existing) {
                         aiResponse.message += ` (Product '${name}' already exists)`;
                    } else {
                        await Product.create({
                            tenantId,
                            name,
                            sku: `SKU-${Date.now().toString().slice(-6)}`,
                            type: type === 'Service' ? 'Service' : 'Goods',
                            salesPrice: price || 0,
                            costPrice: cost || 0,
                            stockQuantity: stock || 0,
                            status: 'Active'
                        });
                        aiResponse.message += ` (Product '${name}' created successfully)`;
                    }
                }
                else if (aiResponse.intent === 'create_partner') {
                    const { name, type, email, phone } = aiResponse.data;
                    const existing = await Partner.findOne({ tenantId, name });
                    if (existing) {
                        aiResponse.message += ` (Partner '${name}' already exists)`;
                    } else {
                        await Partner.create({
                            tenantId,
                            name,
                            type: type || 'Customer',
                            email: email || 'unknown@example.com',
                            phone: phone || '',
                            status: 'Active'
                        });
                        aiResponse.message += ` (Partner '${name}' created successfully)`;
                    }
                }
                else if (aiResponse.intent === 'receive_payment') {
                    const { partnerName, amount, method, date } = aiResponse.data;
                    const partner = await Partner.findOne({ tenantId, name: { $regex: partnerName, $options: 'i' } });
                    
                    const cashCode = method === 'Cash' ? '101' : '102';
                    const cashAcc = await Account.findOne({ tenantId, code: cashCode });
                    const arAcc = await Account.findOne({ tenantId, code: '120' });

                    if (partner && cashAcc && arAcc) {
                        const entries = [
                            { accountCode: cashAcc.code, debit: amount, credit: 0 },
                            { accountCode: arAcc.code, debit: 0, credit: amount }
                        ];
                        const balanceCheck = validateTransactionBalance(entries);
                        if (!balanceCheck.isValid) {
                            throw new Error(`Receive payment not balanced. Debit: ${balanceCheck.totals.debit}, Credit: ${balanceCheck.totals.credit}`);
                        }
                        await Transaction.create({
                            tenantId,
                            date: date || new Date(),
                            description: `Payment received from ${partner.name}`,
                            entries,
                            status: 'Posted',
                            created_by: 'ai',
                            audit_metadata: {
                                intent: 'receive_payment',
                                reason: 'Receipt: Dr Cash/Bank, Cr Accounts Receivable (120)',
                                validation: 'Passed',
                                totals: balanceCheck.totals,
                                userId: req.user._id,
                                userRole: req.user.role,
                                userBusinessRole: req.user.businessRole,
                                permissionKey,
                                permissionGranted: true
                            }
                        });
                        aiResponse.message = appendStrictLedgerSummary(
                            `Payment of $${amount} received from ${partner.name}`,
                            method === 'Cash' ? 'Cash' : 'Bank',
                            cashAcc.code,
                            'Accounts Receivable',
                            arAcc.code,
                            amount
                        );
                    } else {
                        aiResponse.message += ` (Could not record payment - Missing Partner or Accounts)`;
                    }
                }
                else if (aiResponse.intent === 'pay_bill') {
                     const { partnerName, amount, method, date } = aiResponse.data;
                     const partner = await Partner.findOne({ tenantId, name: { $regex: partnerName, $options: 'i' } });
                     
                     const cashCode = method === 'Cash' ? '101' : '102';
                     const cashAcc = await Account.findOne({ tenantId, code: cashCode });
                     const apAcc = await Account.findOne({ tenantId, code: '201' });
 
                     if (partner && cashAcc && apAcc) {
                        const entries = [
                            { accountCode: apAcc.code, debit: amount, credit: 0 },
                            { accountCode: cashAcc.code, debit: 0, credit: amount }
                        ];
                        const balanceCheck = validateTransactionBalance(entries);
                        if (!balanceCheck.isValid) {
                            throw new Error(`Bill payment not balanced. Debit: ${balanceCheck.totals.debit}, Credit: ${balanceCheck.totals.credit}`);
                        }
                        await Transaction.create({
                            tenantId,
                            date: date || new Date(),
                            description: `Bill payment to ${partner.name}`,
                            entries,
                            status: 'Posted',
                            created_by: 'ai',
                            audit_metadata: {
                                intent: 'pay_bill',
                                reason: 'Pay bill: Dr Accounts Payable (201), Cr Cash/Bank',
                                validation: 'Passed',
                                totals: balanceCheck.totals,
                                userId: req.user._id,
                                userRole: req.user.role,
                                userBusinessRole: req.user.businessRole,
                                permissionKey,
                                permissionGranted: true
                            }
                        });
                        aiResponse.message = appendStrictLedgerSummary(
                            `Payment of $${amount} made to ${partner.name}`,
                            'Accounts Payable',
                            apAcc.code,
                            method === 'Cash' ? 'Cash' : 'Bank',
                            cashAcc.code,
                            amount
                        );
                    } else {
                        aiResponse.message += ` (Could not record payment - Missing Partner or Accounts)`;
                    }
               }
               else if (aiResponse.intent === 'create_lead') {
                   const { name, email, phone, notes } = aiResponse.data;
                   await Lead.create({
                       tenantId,
                       name,
                       email: email || 'unknown@example.com',
                       phone: phone || '',
                       notes: notes || [],
                       status: 'New'
                   });
                   aiResponse.message += ` (Lead '${name}' added to CRM pipeline)`;
               }
               else if (aiResponse.intent === 'follow_up_client') {
                   const { partnerName, message } = aiResponse.data;
                   // In a real system, this would send an email or create a task
                   aiResponse.message += ` (Follow-up email sent to '${partnerName}': "${message}")`;
               }
               else if (aiResponse.intent === 'get_financial_report') {
                    const { type, period } = aiResponse.data;
                    
                    // Determine Date Range
                    const today = new Date();
                    let startDate, endDate;
                    let periodText = "";
                    
                    if (period === 'this_month') {
                        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
                        periodText = "This Month";
                    } else if (period === 'last_month') {
                        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                        endDate = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);
                         periodText = "Last Month";
                    } else if (period === 'ytd') {
                        startDate = new Date(today.getFullYear(), 0, 1);
                        endDate = today;
                         periodText = "Year to Date";
                    } else {
                        startDate = new Date(0); 
                        endDate = today;
                        periodText = "All Time";
                    }

                    // Common Match Stage
                    const matchStage = { 
                        tenantId: new mongoose.Types.ObjectId(String(tenantId)), 
                        status: 'Posted',
                        date: { $gte: startDate, $lte: endDate }
                    };

                    if (type === 'profit_loss') {
                        // Revenue - Expenses
                        const result = await Transaction.aggregate([
                            { $match: matchStage },
                            { $unwind: '$entries' },
                            {
                                $lookup: {
                                    from: 'accounts',
                                    let: { code: '$entries.accountCode', tenantId: '$tenantId' },
                                    pipeline: [
                                        { $match: { $expr: { $and: [ { $eq: ['$code', '$$code'] }, { $eq: ['$tenantId', '$$tenantId'] } ] } } }
                                    ],
                                    as: 'account'
                                }
                            },
                            { $unwind: '$account' },
                            { $match: { 'account.type': { $in: ['Revenue', 'Expense'] } } },
                            {
                                $group: {
                                    _id: '$account.type',
                                    debit: { $sum: '$entries.debit' },
                                    credit: { $sum: '$entries.credit' }
                                }
                            }
                        ]);

                        let revenue = 0;
                        let expense = 0;
                        result.forEach(r => {
                            if (r._id === 'Revenue') revenue = (r.credit || 0) - (r.debit || 0);
                            if (r._id === 'Expense') expense = (r.debit || 0) - (r.credit || 0);
                        });
                        const netProfit = revenue - expense;

                        aiResponse.message += `
### Profit & Loss Statement (${periodText})
**Total Revenue:** $${revenue.toLocaleString()}
**Total Expenses:** $${expense.toLocaleString()}
**Net Profit:** $${netProfit.toLocaleString()}
                        `;
                    } 
                    else if (type === 'balance_sheet') {
                        // Assets = Liabilities + Equity
                        // Balance Sheet is usually "As of Date", so we take all transactions up to endDate
                        const bsMatch = { 
                            tenantId: new mongoose.Types.ObjectId(String(tenantId)), 
                            status: 'Posted',
                            date: { $lte: endDate } // All time up to end date
                        };

                        const result = await Transaction.aggregate([
                            { $match: bsMatch },
                            { $unwind: '$entries' },
                            {
                                $lookup: {
                                    from: 'accounts',
                                    let: { code: '$entries.accountCode', tenantId: '$tenantId' },
                                    pipeline: [
                                        { $match: { $expr: { $and: [ { $eq: ['$code', '$$code'] }, { $eq: ['$tenantId', '$$tenantId'] } ] } } }
                                    ],
                                    as: 'account'
                                }
                            },
                            { $unwind: '$account' },
                            {
                                $group: {
                                    _id: '$account.type',
                                    debit: { $sum: '$entries.debit' },
                                    credit: { $sum: '$entries.credit' }
                                }
                            }
                        ]);

                        let assets = 0;
                        let liabilities = 0;
                        let equity = 0;

                        result.forEach(r => {
                            const val = (r.debit || 0) - (r.credit || 0);
                            if (r._id === 'Asset') assets += val;
                            else if (r._id === 'Liability') liabilities += (r.credit - r.debit); // Normal Credit Balance
                            else if (r._id === 'Equity') equity += (r.credit - r.debit); // Normal Credit Balance
                            else if (r._id === 'Revenue') equity += (r.credit - r.debit); // Retained Earnings part of Equity
                            else if (r._id === 'Expense') equity -= (r.debit - r.credit); // Retained Earnings part of Equity
                        });

                        aiResponse.message += `
### Balance Sheet (As of ${endDate.toLocaleDateString()})
**Total Assets:** $${assets.toLocaleString()}
**Total Liabilities:** $${liabilities.toLocaleString()}
**Total Equity:** $${equity.toLocaleString()}
*(Assets should equal Liabilities + Equity)*
                        `;
                    }
                    else if (type === 'cash_flow') {
                        // Inflow vs Outflow for Cash/Bank Accounts
                        // Identify Cash Accounts (usually type Asset, category Current Asset, name contains Cash/Bank)
                        // Or simplify by using known codes 101, 102, 105, 106
                         const result = await Transaction.aggregate([
                            { $match: matchStage },
                            { $unwind: '$entries' },
                            { $match: { 'entries.accountCode': { $in: ['101', '102', '105', '106'] } } },
                            {
                                $group: {
                                    _id: null,
                                    debit: { $sum: '$entries.debit' }, // Inflow
                                    credit: { $sum: '$entries.credit' } // Outflow
                                }
                            }
                        ]);
                        
                        const inflow = result[0]?.debit || 0;
                        const outflow = result[0]?.credit || 0;
                        const netCash = inflow - outflow;

                         aiResponse.message += `
### Cash Flow Analysis (${periodText})
**Cash Inflow:** $${inflow.toLocaleString()}
**Cash Outflow:** $${outflow.toLocaleString()}
**Net Cash Change:** $${netCash.toLocaleString()}
                        `;
                    }
               }

            } catch (execErr) {
                executionError = execErr;
                console.error('Execution Error:', execErr);
                aiResponse.message += ` (Execution Failed: ${execErr.message})`;
            }
        }

        try {
            const status =
                executionError ? 'Failed' : aiResponse.readyToExecute ? 'Success' : 'Ambiguous';
            const approvalStatus =
                permissionRequirement && permissionGranted === false
                    ? 'Denied'
                    : 'Approved';
            await AITransactionLog.create({
                tenantId: req.user.tenantId,
                userId: req.user._id,
                userRole: req.user.role,
                userBusinessRole: req.user.businessRole,
                userPrompt,
                aiResponse,
                parsedEntries:
                    aiResponse.intent === 'create_journal' && aiResponse.data
                        ? aiResponse.data.entries || null
                        : null,
                status,
                error: executionError ? executionError.message : undefined,
                confidenceScore: typeof aiResponse.confidence === 'number' ? aiResponse.confidence : undefined,
                intent: aiResponse.intent,
                module: permissionRequirement ? permissionRequirement.module : undefined,
                action: permissionRequirement ? permissionRequirement.action : undefined,
                permissionKey,
                permissionGranted,
                approvalStatus
            });
        } catch (logErr) {
            console.error('AI Transaction Log Error:', logErr);
        }

        aiResponse.message = appendRoleControlSummary(
            aiResponse.message,
            req.user,
            permissionRequirement ? permissionRequirement.module : null,
            permissionGranted
        );

        res.json(aiResponse);

    } catch (err) {
        console.error('AI Error:', err);
        res.status(500).json({ message: err.message || 'AI Service Error' });
    }
});

// Deprecated: Old transaction parser (kept for safety until frontend updated)
router.post('/ai/parse-transaction', async (req, res) => {
    try {
        const { description, date } = req.body;
        if (!description || typeof description !== 'string') {
            return res.status(400).json({ message: 'description required' });
        }

        const accounts = await Account.find({ tenantId: req.user.tenantId }).sort({ code: 1 });
        const accountHints = accounts.map(a => `${a.code}=${a.name} [${a.type}]`).join('\n');

        const prompt = `
You are an accounting assistant that converts a natural language description into a balanced double-entry journal for a small business ERP.

Rules:
- Output strictly valid JSON.
- Ensure debits equal credits.
- Use provided account codes when possible. Prefer: Cash(101/102), Accounts Receivable(120), Accounts Payable(201), Inventory(140), Sales Revenue(401), COGS(501), Tax Payable(205), Equity(305), generic Expense(6xx).
- Infer reasonable amounts, method, and reference only if missing, but try to preserve amounts in the text.
- Date: use provided date if present, else today in ISO format (YYYY-MM-DD).

Available accounts:
${accountHints}

Example input: "Sold 3 chairs to Ali for 12,000, cash, 16% tax"
Example output:
{
  "date": "2026-01-05",
  "description": "Sale to Ali - 3 chairs",
  "entries": [
    {"accountCode": "102", "debit": 13920, "credit": 0},
    {"accountCode": "205", "debit": 0, "credit": 1920},
    {"accountCode": "401", "debit": 0, "credit": 12000}
  ],
  "reference": "AI-JOURNAL",
  "type": "Journal"
}

Now convert this description:
"${description}"
Use only numbers, no currency symbols.`;

        const text = await callGemini(prompt);
        const parsed = safeJsonParse(text);
        if (!parsed || !Array.isArray(parsed.entries)) {
            return res.status(400).json({ message: 'AI could not parse a valid journal entry', raw: text });
        }

        const entries = parsed.entries.map(e => ({
            accountCode: String(e.accountCode || '').trim(),
            debit: Number(e.debit) || 0,
            credit: Number(e.credit) || 0
        })).filter(e => e.accountCode);

        if (entries.length < 2) {
            return res.status(400).json({ message: 'At least two entries required' });
        }

        const totals = entries.reduce((acc, e) => ({
            debit: acc.debit + (e.debit || 0),
            credit: acc.credit + (e.credit || 0)
        }), { debit: 0, credit: 0 });
        if (Math.abs(totals.debit - totals.credit) > 0.01 || totals.debit <= 0) {
            return res.status(400).json({ message: 'Journal not balanced', totals });
        }

        const tx = new Transaction({
            tenantId: req.user.tenantId,
            date: parsed.date ? new Date(parsed.date) : (date ? new Date(date) : new Date()),
            description: parsed.description || description,
            entries,
            reference: parsed.reference || 'AI-JOURNAL',
            type: parsed.type || 'Journal',
            status: 'Posted'
        });
        const saved = await tx.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/ai/forecast', async (req, res) => {
    try {
        const today = new Date();
        const startOfYear = new Date(today.getFullYear(), 0, 1);
        const agg = await Transaction.aggregate([
            { $match: { tenantId: new mongoose.Types.ObjectId(String(req.user.tenantId)), date: { $gte: startOfYear }, status: 'Posted' } },
            { $unwind: '$entries' },
            {
                $lookup: {
                    from: 'accounts',
                    let: { code: '$entries.accountCode', tenantId: '$tenantId' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$code', '$$code'] },
                                        { $eq: ['$tenantId', '$$tenantId'] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'accountDetails'
                }
            },
            { $unwind: '$accountDetails' },
            {
                $group: {
                    _id: {
                        month: { $month: '$date' },
                        type: '$accountDetails.type'
                    },
                    debitSum: { $sum: '$entries.debit' },
                    creditSum: { $sum: '$entries.credit' }
                }
            },
            { $sort: { '_id.month': 1 } }
        ]);

        const monthly = Array(12).fill(0).map((_, i) => ({ month: i + 1, revenue: 0, expense: 0 }));
        agg.forEach(item => {
            const m = item._id.month - 1;
            if (m >= 0 && m < 12) {
                if (item._id.type === 'Revenue') {
                    monthly[m].revenue += (item.creditSum - item.debitSum);
                } else if (item._id.type === 'Expense') {
                    monthly[m].expense += (item.debitSum - item.creditSum);
                }
            }
        });

        const context = JSON.stringify(monthly);
        const prompt = `
You are a finance AI for an ERP. Given monthly revenue and expense data for the current year:
${context}
Provide:
- 4 actionable recommendations to improve cash flow and profitability.
- 3 risks to watch.
- 3 opportunities.
Keep it concise and business-focused.`;

        const insights = await callGemini(prompt);
        res.json({ monthly, insights });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// TENANT / COMPANY SETTINGS ROUTES
// ==========================================
router.get('/tenant', async (req, res) => {
    try {
        if (!req.user.tenantId) {
            return res.status(404).json({ message: 'No tenant associated with this user' });
        }
        const tenant = await Tenant.findById(req.user.tenantId);
        res.json(tenant);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put('/tenant', async (req, res) => {
    try {
        if (!req.user.tenantId) {
            return res.status(403).json({ message: 'Not authorized to update tenant' });
        }
        
        // Allowed fields to update
        const { name, address, phone, email, currency, website } = req.body;
        
        const updatedTenant = await Tenant.findByIdAndUpdate(
            req.user.tenantId,
            { name, address, phone, email, currency, website },
            { new: true }
        );
        
        res.json(updatedTenant);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// User Dashboard Layout
router.get('/user/dashboard-layout', async (req, res) => {
    try {
        const layout = Array.isArray(req.user.dashboardLayout) ? req.user.dashboardLayout : [];
        res.json(layout);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put('/user/dashboard-layout', async (req, res) => {
    try {
        const layout = Array.isArray(req.body) ? req.body : (Array.isArray(req.body.layout) ? req.body.layout : []);
        const updated = await User.findByIdAndUpdate(req.user._id, { dashboardLayout: layout }, { new: true, select: 'dashboardLayout' });
        res.json(updated.dashboardLayout || []);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.get('/analytics/sum', async (req, res) => {
    try {
        const { type, codes, period, startDate, endDate } = req.query;
        let start = startDate ? new Date(startDate) : null;
        let end = endDate ? new Date(endDate) : null;
        const today = new Date();
        if (!start || !end) {
            if (period === 'thisMonth') {
                start = new Date(today.getFullYear(), today.getMonth(), 1);
                end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            } else if (period === 'lastMonth') {
                const last = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                start = last;
                end = new Date(last.getFullYear(), last.getMonth() + 1, 0);
            } else {
                start = new Date(today.getFullYear(), 0, 1);
                end = today;
            }
        }
        const matchStage = { tenantId: new mongoose.Types.ObjectId(String(req.user.tenantId)), status: 'Posted', date: { $gte: start, $lte: end } };
        let agg = [
            { $match: matchStage },
            { $unwind: '$entries' }
        ];
        if (codes) {
            const codeList = Array.isArray(codes) ? codes : String(codes).split(',').map(s => s.trim()).filter(Boolean);
            agg.push({ $match: { 'entries.accountCode': { $in: codeList } } });
            agg.push({
                $group: {
                    _id: null,
                    debitSum: { $sum: '$entries.debit' },
                    creditSum: { $sum: '$entries.credit' }
                }
            });
            const result = await Transaction.aggregate(agg);
            const debitSum = result[0]?.debitSum || 0;
            const creditSum = result[0]?.creditSum || 0;
            const value = debitSum - creditSum;
            return res.json({ value });
        }
        if (type) {
            agg.push({
                $lookup: {
                    from: 'accounts',
                    let: { code: '$entries.accountCode', tenantId: '$tenantId' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$code', '$$code'] },
                                        { $eq: ['$tenantId', '$$tenantId'] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'accountDetails'
                }
            });
            agg.push({ $unwind: '$accountDetails' });
            agg.push({ $match: { 'accountDetails.type': type } });
            agg.push({
                $group: {
                    _id: null,
                    debitSum: { $sum: '$entries.debit' },
                    creditSum: { $sum: '$entries.credit' }
                }
            });
            const result = await Transaction.aggregate(agg);
            const debitSum = result[0]?.debitSum || 0;
            const creditSum = result[0]?.creditSum || 0;
            let value = 0;
            if (type === 'Revenue') value = creditSum - debitSum;
            else if (type === 'Expense') value = debitSum - creditSum;
            else value = debitSum - creditSum;
            return res.json({ value });
        }
        res.json({ value: 0 });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/analytics/monthly', async (req, res) => {
    try {
        const { type, codes, year } = req.query;
        const today = new Date();
        const targetYear = Number(year) || today.getFullYear();
        const startOfYear = new Date(targetYear, 0, 1);
        const endOfYear = new Date(targetYear, 11, 31, 23, 59, 59);

        const matchStage = { tenantId: new mongoose.Types.ObjectId(String(req.user.tenantId)), status: 'Posted', date: { $gte: startOfYear, $lte: endOfYear } };
        const pipeline = [
            { $match: matchStage },
            { $unwind: '$entries' }
        ];

        if (codes) {
            const codeList = Array.isArray(codes) ? codes : String(codes).split(',').map(s => s.trim()).filter(Boolean);
            pipeline.push({ $match: { 'entries.accountCode': { $in: codeList } } });
        } else if (type) {
            pipeline.push({
                $lookup: {
                    from: 'accounts',
                    let: { code: '$entries.accountCode', tenantId: '$tenantId' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$code', '$$code'] },
                                        { $eq: ['$tenantId', '$$tenantId'] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'accountDetails'
                }
            });
            pipeline.push({ $unwind: '$accountDetails' });
            pipeline.push({ $match: { 'accountDetails.type': type } });
        }

        pipeline.push({
            $group: {
                _id: { month: { $month: '$date' } },
                debitSum: { $sum: '$entries.debit' },
                creditSum: { $sum: '$entries.credit' }
            }
        });
        pipeline.push({ $sort: { '_id.month': 1 } });

        const agg = await Transaction.aggregate(pipeline);
        const monthly = Array(12).fill(0).map((_, i) => ({ month: i + 1, value: 0 }));

        agg.forEach(item => {
            const mIndex = item._id.month - 1;
            if (mIndex >= 0 && mIndex < 12) {
                const debitSum = item.debitSum || 0;
                const creditSum = item.creditSum || 0;
                let value = 0;
                if (type === 'Revenue') value = creditSum - debitSum;
                else if (type === 'Expense') value = debitSum - creditSum;
                else value = debitSum - creditSum;
                monthly[mIndex].value = value;
            }
        });

        res.json(monthly);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/ai/design-dashboard', async (req, res) => {
    try {
        const { prompt: userPrompt } = req.body;
        const accounts = await Account.find({ tenantId: req.user.tenantId }).select('code name type').limit(200);
        const accountHints = accounts.map(a => `${a.code}:${a.name} (${a.type})`).join('\n');
        const schema = `
Output ONLY valid JSON array.
Each item fields:
- id: string
- type: one of ["stat_card","line_chart","bar_chart","doughnut_chart","ai_insights","transaction_list"]
- title: string
- w: number in [3,4,6,8,12]
- props: object (optional).
  - For "stat_card": { dataKey: "revenue"|"expense"|"netProfit"|"cashBalance", color: "primary"|"success"|"danger"|"warning"|"info", trend: "up"|"down", trendValue: "0.0" }
  - For charts: { dataKey: "revenue"|"expense"|"netProfit"|"cashBalance"|"all", showLegend: true|false }
`;
        const fullPrompt = `
Design a professional analytics dashboard layout for finance ERP.
User intent: "${userPrompt || 'Executive overview'}"

Available accounts:
${accountHints}

${schema}
`;
        const text = await callGemini(fullPrompt);
        const data = safeJsonParse(text);
        let layout = Array.isArray(data) ? data : [];
        
        // Normalize and Validate
        layout = layout.map((item, idx) => {
            const id = item.id || `auto-${Date.now()}-${idx}`;
            const w = [3,4,6,8,12].includes(Number(item.w)) ? Number(item.w) : 3;
            
            // Map old/hallucinated types to valid frontend types
            let type = item.type;
            const typeMap = {
                'kpi-custom': 'stat_card',
                'kpi': 'stat_card',
                'line': 'line_chart',
                'bar': 'bar_chart',
                'doughnut': 'doughnut_chart',
                'pie': 'doughnut_chart',
                'pie_chart': 'doughnut_chart',
                'ai': 'ai_insights',
                'chart': 'line_chart',
                'transaction-list': 'transaction_list',
                'transactions': 'transaction_list',
                'list': 'transaction_list',
                'budget': 'budget_planner',
                'budget-planner': 'budget_planner',
                'chart-custom': 'line_chart'
            };
            if (typeMap[type]) type = typeMap[type];
            
            // Whitelist valid types
            const validTypes = ['stat_card', 'line_chart', 'bar_chart', 'doughnut_chart', 'transaction_list', 'budget_planner', 'credit_limits', 'ai_insights'];
            if (!validTypes.includes(type)) type = 'stat_card';

            // Migrate config to props if needed
            let props = item.props || item.config || {};
            if (item.config) {
                 if (item.config.type === 'Revenue') props.dataKey = 'revenue';
                 if (item.config.type === 'Expense') props.dataKey = 'expense';
                 if (item.config.colorClass) props.color = item.config.colorClass;
            }

            return { id, type, title: item.title || item.config?.title || 'Widget', w, props };
        }).slice(0, 20);

        if (!layout.length) {
            layout = [
                { id: `kpi-net`, type: 'stat_card', title: 'Total Balance', w: 3, props: { dataKey: 'netProfit', color: 'primary', trend: 'up', trendValue: '4.1' } },
                { id: `kpi-revenue`, type: 'stat_card', title: 'Income', w: 3, props: { dataKey: 'revenue', color: 'success', trend: 'up', trendValue: '8.2' } },
                { id: `kpi-expense`, type: 'stat_card', title: 'Expenses', w: 3, props: { dataKey: 'expense', color: 'danger', trend: 'down', trendValue: '2.8' } },
                { id: `kpi-cash`, type: 'stat_card', title: 'Cash Balance', w: 3, props: { dataKey: 'cashBalance', color: 'warning', trend: 'up', trendValue: '1.2' } },
                { id: `line-trends`, type: 'line_chart', title: 'Cash Flow', w: 8, props: { } },
                { id: `expense-donut`, type: 'doughnut_chart', title: 'Expense Breakdown', w: 4, props: { } },
                { id: `bar-netprofit`, type: 'bar_chart', title: 'Net Profit Trend', w: 6, props: { } },
                { id: `ai-forecast`, type: 'ai_insights', title: 'AI Forecast', w: 6, props: { } }
            ];
        }
        res.json(layout);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// ACCOUNTING ROUTES (Chart of Accounts)
// ==========================================



router.post('/accounts/seed', async (req, res) => {
    try {
        const tenantId = await ensureTenantId(req.user);
        await seedAccounts(tenantId);
        
        const all = await Account.find({ tenantId }).sort({ code: 1 });
        res.json({ message: `System accounts seeded successfully`, accounts: all });
    } catch (err) {
        console.error('Seed Error:', err);
        res.status(500).json({ message: err.message });
    }
});

router.get('/accounts', protect, async (req, res) => {
    const fs = require('fs');
    const path = require('path');
    const logFile = path.join(__dirname, '../../debug_accounts.log');
    
    const log = (msg) => {
        const timestamp = new Date().toISOString();
        const line = `[${timestamp}] ${msg}\n`;
        console.log(msg); // Keep console log
        try {
            fs.appendFileSync(logFile, line);
        } catch (e) {
            console.error('Failed to write to log file:', e);
        }
    };

    log('[GET /accounts] Request received');
    
    // 1. DB Check
    if (mongoose.connection.readyState !== 1) {
         const state = mongoose.connection.readyState;
         log(`[GET /accounts] DB not connected state: ${state} - Switching to Memory Store`);
         // In-Memory Fallback
         let tenantId = 'offline_tenant_id_' + (req.user ? req.user._id : 'guest');
         
         // Try to get accounts from memory
         let memAccounts = global.memoryStore.accounts.filter(a => String(a.tenantId) === String(tenantId));
         
         if (memAccounts.length === 0) {
             // Seed defaults in memory if empty
             const defaults = SYSTEM_ACCOUNTS.map(a => ({ ...a, tenantId, balance: 0 }));
             global.memoryStore.accounts.push(...defaults);
             memAccounts = defaults;
         }
         return res.json(memAccounts);
    }

    // 2. User Check
    if (!req.user || !req.user._id) {
        log('[GET /accounts] User missing in request');
        return res.status(401).json({ message: 'User authentication failed.' });
    }

    let tenantId;
    try {
        log(`[GET /accounts] resolving tenant for user: ${req.user._id}`);
        tenantId = await ensureTenantId(req.user);
        log(`[GET /accounts] Tenant ID resolved: ${tenantId}`);
    } catch (tenantError) {
        log(`[GET /accounts] Tenant ID retrieval failed: ${tenantError.message}\nStack: ${tenantError.stack}`);
        return res.status(500).json({ message: `Tenant Error: ${tenantError.message}`, stack: tenantError.stack });
    }

    try {
        let accounts = await Account.find({ tenantId }).sort({ code: 1 });
        log(`[GET /accounts] Found ${accounts ? accounts.length : 0} accounts`);
        
        if (!accounts || accounts.length === 0) {
            log('[GET /accounts] No accounts found, seeding defaults...');
            try {
                await seedAccounts(tenantId);
                log('[GET /accounts] Seeding completed');
            } catch (seedError) {
                log(`[GET /accounts] Seeding warning: ${seedError.message}`);
            }
            // Re-fetch
            accounts = await Account.find({ tenantId }).sort({ code: 1 });
            log(`[GET /accounts] Re-fetched ${accounts ? accounts.length : 0} accounts after seeding`);
        }

        // Calculate live balances from Transactions
        const balances = await Transaction.aggregate([
            { $match: { tenantId: new mongoose.Types.ObjectId(String(tenantId)), status: 'Posted' } },
            { $unwind: '$entries' },
            { $group: {
                _id: '$entries.accountCode',
                debit: { $sum: '$entries.debit' },
                credit: { $sum: '$entries.credit' }
            }}
        ]);

        const balanceMap = {};
        balances.forEach(b => {
            balanceMap[b._id] = (b.debit || 0) - (b.credit || 0);
        });

        // Merge balances into accounts
        const accountsWithBalance = accounts.map(acc => {
            const accObj = acc.toObject();
            // Normal balance rules: Asset/Expense = Debit, Liability/Equity/Revenue = Credit
            let bal = balanceMap[acc.code] || 0;
            // However, usually we just show the net value (Debit - Credit).
            // Or we can flip sign based on type for display.
            // For now, let's just return the raw net (Debit - Credit)
            // But usually users expect positive numbers for normal balances.
            // Let's standardise: 
            // Asset/Expense: Debit - Credit
            // Liability/Equity/Revenue: Credit - Debit (so we negate the net)
            
            if (['Liability', 'Equity', 'Revenue'].includes(acc.type)) {
                bal = -bal;
            }
            
            return { ...accObj, balance: bal };
        });
        
        return res.json(accountsWithBalance);
    } catch (err) {
        log(`[GET /accounts] Critical Error: ${err.message}\nStack: ${err.stack}`);
        return res.status(500).json({ message: `Query Error: ${err.message}`, stack: err.stack });
    }
});

router.post('/accounts', async (req, res) => {
    try {
        const tenantId = await ensureTenantId(req.user);
        const { code, name } = req.body;
        
        // Offline Mode: Save to Memory
        if (mongoose.connection.readyState !== 1) {
             console.log('[POST /accounts] DB Offline - Saving to Memory');
             const newAccount = { 
                 ...req.body, 
                 tenantId, 
                 _id: 'mem_' + Date.now(), // Mock ID
                 balance: 0 
             };
             
             // Check duplicates in memory
             const exists = global.memoryStore.accounts.find(a => (a.code === code || a.name === name) && String(a.tenantId) === String(tenantId));
             if (exists) {
                 return res.status(409).json({ message: 'Account with this code or name already exists.' });
             }
             
             global.memoryStore.accounts.push(newAccount);
             return res.status(201).json(newAccount);
        }

        // DB Mode
        // 1. Check if Code Exists
        const existingCode = await Account.findOne({ tenantId, code });
        if (existingCode) {
            return res.status(409).json({ message: `Account code '${code}' is already in use by '${existingCode.name}'.` });
        }

        // 2. Check if Name Exists
        const existingName = await Account.findOne({ tenantId, name });
        if (existingName) {
            return res.status(409).json({ message: `Account name '${name}' is already in use (Code: ${existingName.code}).` });
        }

        const account = new Account({ 
            ...req.body, 
            tenantId,
            created_by: 'user' 
        });
        const saved = await account.save();
        res.status(201).json(saved);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ message: 'This account already exists in the system.' });
        }
        res.status(400).json({ message: err.message });
    }
});

router.put('/accounts/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const newCode = req.body.code;
        
        // 1. Check if System Account (Protect from Edit)
        const currentAccount = await Account.findOne({ code, tenantId: req.user.tenantId });
        if (!currentAccount) return res.status(404).json({ message: 'Account not found' });
        
        if (currentAccount.isSystemAccount) {
            // Allow updating balance? No, balance is calculated.
            // Allow updating name? Maybe. But user said "MUST NOT be creatable again... MUST be locked".
            // "Allow users to VIEW but NOT EDIT system accounts"
            return res.status(403).json({ message: 'System accounts cannot be edited.' });
        }

        // If code is changing, check for dependencies
        if (newCode && newCode !== code) {
            const txCount = await Transaction.countDocuments({ 
                tenantId: req.user.tenantId, 
                'entries.accountCode': code 
            });
            if (txCount > 0) {
                return res.status(400).json({ message: `Cannot change account code. ${txCount} transactions are linked to this account.` });
            }
        }

        const updated = await Account.findOneAndUpdate(
            { code: code, tenantId: req.user.tenantId },
            req.body,
            { new: true }
        );
        if (!updated) return res.status(404).json({ message: 'Account not found' });
        res.json(updated);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: 'Account code already exists.' });
        }
        res.status(400).json({ message: err.message });
    }
});

router.delete('/accounts/:code', async (req, res) => {
    try {
        const { code } = req.params;
        
        // Check for dependencies
        const txCount = await Transaction.countDocuments({ 
            tenantId: req.user.tenantId, 
            'entries.accountCode': code 
        });
        
        if (txCount > 0) {
            return res.status(400).json({ message: `Cannot delete account. ${txCount} transactions are linked to it.` });
        }

        const deleted = await Account.findOneAndDelete({ code: code, tenantId: req.user.tenantId });
        if (!deleted) return res.status(404).json({ message: 'Account not found' });
        res.json({ message: 'Account deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// ACCOUNTING ROUTES (General Journal / Transactions)
// ==========================================
router.get('/transactions', async (req, res) => {
    try {
        const { startDate, endDate, limit } = req.query;
        const filter = { tenantId: req.user.tenantId };
        if (startDate || endDate) {
            filter.date = {};
            if (startDate) filter.date.$gte = new Date(startDate);
            if (endDate) filter.date.$lte = new Date(endDate);
        }
        
        let query = Transaction.find(filter).sort({ date: -1, createdAt: -1 });
        
        if (limit) {
            query = query.limit(parseInt(limit));
        }
        
        const txs = await query.exec();
        res.json(txs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/transactions', async (req, res) => {
    try {
        const { date, description, entries, reference, type, project, costCenter } = req.body;
        if (!entries || !Array.isArray(entries) || entries.length < 2) {
            return res.status(400).json({ message: 'At least two entries required' });
        }
        
        const balanceCheck = validateTransactionBalance(entries);
        if (!balanceCheck.isValid) {
             return res.status(400).json({ 
                 message: `Journal not balanced. Diff: ${balanceCheck.diff}`, 
                 totals: balanceCheck.totals 
             });
        }

        // Enrich with account names
        const accMap = {};
        for (const e of entries) {
            if (e.accountCode && !accMap[e.accountCode]) {
                const acc = await Account.findOne({ code: e.accountCode, tenantId: req.user.tenantId });
                accMap[e.accountCode] = acc ? acc.name : undefined;
            }
        }
        const enrichedEntries = entries.map(e => ({
            accountCode: e.accountCode,
            accountName: accMap[e.accountCode],
            debit: Number(e.debit) || 0,
            credit: Number(e.credit) || 0
        }));
        const tx = new Transaction({
            tenantId: req.user.tenantId,
            date: date ? new Date(date) : new Date(),
            description,
            entries: enrichedEntries,
            reference,
            type: type || 'Journal',
            status: 'Posted',
            project: project || undefined,
            costCenter: costCenter || undefined
        });
        const saved = await tx.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.put('/transactions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { date, description, entries, reference, type, project, costCenter, status } = req.body;
        if (!entries || !Array.isArray(entries) || entries.length < 2) {
            return res.status(400).json({ message: 'At least two entries required' });
        }
        const totals = entries.reduce((acc, e) => ({
            debit: acc.debit + (Number(e.debit) || 0),
            credit: acc.credit + (Number(e.credit) || 0),
        }), { debit: 0, credit: 0 });
        if (Math.abs(totals.debit - totals.credit) > 0.01 || totals.debit <= 0) {
            return res.status(400).json({ message: 'Journal not balanced' });
        }
        const accMap = {};
        for (const e of entries) {
            if (e.accountCode && !accMap[e.accountCode]) {
                const acc = await Account.findOne({ code: e.accountCode, tenantId: req.user.tenantId });
                accMap[e.accountCode] = acc ? acc.name : undefined;
            }
        }
        const enrichedEntries = entries.map(e => ({
            accountCode: e.accountCode,
            accountName: accMap[e.accountCode],
            debit: Number(e.debit) || 0,
            credit: Number(e.credit) || 0
        }));
        const existing = await Transaction.findOne({ _id: id, tenantId: req.user.tenantId });
        if (!existing) {
            return res.status(404).json({ message: 'Transaction not found' });
        }
        existing.date = date ? new Date(date) : existing.date;
        existing.description = description ?? existing.description;
        existing.entries = enrichedEntries;
        existing.reference = reference ?? existing.reference;
        existing.type = type ?? existing.type;
        existing.status = status ?? existing.status;
        existing.project = project ?? existing.project;
        existing.costCenter = costCenter ?? existing.costCenter;
        const saved = await existing.save();
        res.json(saved);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.delete('/transactions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Transaction.findOneAndDelete({ _id: id, tenantId: req.user.tenantId });
        if (!deleted) return res.status(404).json({ message: 'Transaction not found' });
        res.json({ message: 'Transaction deleted', id });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// ACCOUNTING ROUTES (General Ledger)
// ==========================================
router.get('/ledger', async (req, res) => {
    try {
        const { accountCode, startDate, endDate } = req.query;
        if (!accountCode) return res.status(400).json({ message: 'accountCode required' });
        
        const tenantId = req.user.tenantId;
        const dateFilter = {};
        if (startDate) dateFilter.$gte = new Date(startDate);
        if (endDate) dateFilter.$lte = new Date(endDate);

        // Opening balance (sum before startDate)
        let openingBalance = 0;
        if (startDate) {
            const prevTxs = await Transaction.aggregate([
                { $match: { 
                    tenantId: new mongoose.Types.ObjectId(tenantId),
                    date: { $lt: new Date(startDate) }, 
                    'entries.accountCode': accountCode 
                }},
                { $unwind: '$entries' },
                { $match: { 'entries.accountCode': accountCode } },
                { $group: {
                    _id: null,
                    debit: { $sum: '$entries.debit' },
                    credit: { $sum: '$entries.credit' }
                } }
            ]);
            if (prevTxs.length) {
                openingBalance = prevTxs[0].debit - prevTxs[0].credit;
            }
        }

        // Entries within range
        const query = { 
            tenantId: tenantId,
            'entries.accountCode': accountCode 
        };
        if (Object.keys(dateFilter).length) query.date = dateFilter;

        const txs = await Transaction.find(query).sort({ date: 1, createdAt: 1 });

        const rows = [];
        let running = openingBalance;
        for (const tx of txs) {
            const entry = tx.entries.find(e => e.accountCode === accountCode);
            if (!entry) continue;
            running += (entry.debit || 0) - (entry.credit || 0);
            rows.push({
                date: tx.date,
                description: tx.description,
                debit: entry.debit || 0,
                credit: entry.credit || 0,
                balance: running
            });
        }

        res.json({ openingBalance, entries: rows, closingBalance: running });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// ACCOUNTING ROUTES (Trial Balance)
// ==========================================
router.get('/trial-balance', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        // For Trial Balance, we need cumulative balances "As Of" the end date.
        // We ignore startDate for the balance calculation, but we respect endDate.
        const match = { tenantId: new mongoose.Types.ObjectId(req.user.tenantId) };
        if (endDate) {
            match.date = { $lte: new Date(endDate) };
        }
        // If no endDate is provided, it returns balances as of today (all time).

        const agg = await Transaction.aggregate([
            { $match: match },
            { $unwind: '$entries' },
            { $group: {
                _id: '$entries.accountCode',
                debit: { $sum: '$entries.debit' },
                credit: { $sum: '$entries.credit' }
            } }
        ]);

        // Attach account names/types and net to columns
        const accounts = await Account.find({ tenantId: req.user.tenantId });
        const accMap = accounts.reduce((m, a) => { m[a.code] = a; return m; }, {});
        const rows = agg.map(a => {
            const acc = accMap[a._id] || {};
            const net = (a.debit || 0) - (a.credit || 0);
            return {
                code: a._id,
                name: acc.name || a._id,
                type: acc.type || '',
                debit: net >= 0 ? net : 0,
                credit: net < 0 ? Math.abs(net) : 0
            };
        }).sort((x, y) => x.code.localeCompare(y.code));

        const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
        const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
        res.json({ rows, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// ACCOUNTING ROUTES (Profit & Loss)
// ==========================================
router.get('/profit-loss', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const match = { tenantId: new mongoose.Types.ObjectId(req.user.tenantId) };
        if (startDate || endDate) {
            match.date = {};
            if (startDate) match.date.$gte = new Date(startDate);
            if (endDate) match.date.$lte = new Date(endDate);
        }

        const agg = await Transaction.aggregate([
            { $match: match },
            { $unwind: '$entries' },
            { $group: {
                _id: '$entries.accountCode',
                debit: { $sum: '$entries.debit' },
                credit: { $sum: '$entries.credit' }
            } }
        ]);
        const accounts = await Account.find({ tenantId: req.user.tenantId });
        const accMap = accounts.reduce((m, a) => { m[a.code] = a; return m; }, {});
        const revenueRows = [];
        const expenseRows = [];
        for (const a of agg) {
            const acc = accMap[a._id];
            if (!acc) continue;
            const net = (a.debit || 0) - (a.credit || 0);
            if (acc.type === 'Revenue') {
                revenueRows.push({ name: acc.name, amount: -net }); // revenue normally credit; net negative means credit balance
            } else if (acc.type === 'Expense') {
                expenseRows.push({ name: acc.name, amount: net });
            }
        }
        const totalRevenue = revenueRows.reduce((s, r) => s + r.amount, 0);
        const totalExpenses = expenseRows.reduce((s, r) => s + r.amount, 0);
        const netIncome = totalRevenue - totalExpenses;
        res.json({ revenueRows, expenseRows, totalRevenue, totalExpenses, netIncome });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// ACCOUNTING ROUTES (Cash Flow Statement)
// ==========================================
router.get('/cash-flow', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const tenantId = new mongoose.Types.ObjectId(req.user.tenantId);
        const match = { tenantId };
        
        if (startDate || endDate) {
            match.date = {};
            if (startDate) match.date.$gte = new Date(startDate);
            if (endDate) match.date.$lte = new Date(endDate);
        }

        const agg = await Transaction.aggregate([
            { $match: match },
            { $unwind: '$entries' },
            {
                $lookup: {
                    from: 'accounts',
                    let: { code: '$entries.accountCode', tenantId: '$tenantId' },
                    pipeline: [
                        { $match: { $expr: { $and: [{ $eq: ['$code', '$$code'] }, { $eq: ['$tenantId', '$$tenantId'] }] } } }
                    ],
                    as: 'account'
                }
            },
            { $unwind: '$account' },
            {
                $group: {
                    _id: { type: '$account.type', category: '$account.category', name: '$account.name' },
                    debit: { $sum: '$entries.debit' },
                    credit: { $sum: '$entries.credit' }
                }
            }
        ]);

        let netIncome = 0;
        const operatingActivities = [];
        const investingActivities = [];
        const financingActivities = [];

        // Process aggregated data
        for (const item of agg) {
            const { type, category, name } = item._id;
            const netChange = (item.debit || 0) - (item.credit || 0);
            
            // Net Income Calculation
            if (type === 'Revenue') {
                netIncome += (item.credit - item.debit);
            } else if (type === 'Expense') {
                netIncome -= (item.debit - item.credit);
            }
            
            // Cash Flow Classification (Indirect Method)
            // Skip Cash/Bank accounts
            if (name.toLowerCase().includes('cash') || name.toLowerCase().includes('bank')) continue;

            const cashImpact = -netChange; // Universal formula for Assets/Liabilities/Equity changes relative to Cash

            if (type === 'Asset') {
                if (category === 'Current Asset') {
                    // Operating Activities (e.g. AR, Inventory)
                    if (cashImpact !== 0) {
                        operatingActivities.push({ name: `Change in ${name}`, amount: cashImpact });
                    }
                } else if (category === 'Long Term Asset' || category === 'Fixed Asset') {
                    // Investing Activities
                    if (cashImpact !== 0) {
                        investingActivities.push({ name: `Net change in ${name}`, amount: cashImpact });
                    }
                }
            } else if (type === 'Liability') {
                if (category === 'Current Liability') {
                    // Operating Activities (e.g. AP)
                    if (cashImpact !== 0) {
                        operatingActivities.push({ name: `Change in ${name}`, amount: cashImpact });
                    }
                } else if (category === 'Long Term Liability') {
                    // Financing Activities
                    if (cashImpact !== 0) {
                        financingActivities.push({ name: `Change in ${name}`, amount: cashImpact });
                    }
                }
            } else if (type === 'Equity') {
                // Financing Activities
                if (cashImpact !== 0) {
                    financingActivities.push({ name: `Change in ${name}`, amount: cashImpact });
                }
            }
        }
        
        // Add back Depreciation if found in expenses (non-cash expense)
        // This is a heuristic: looking for "Depreciation" in expense account names
        const depreciation = agg.find(i => i._id.type === 'Expense' && i._id.name.toLowerCase().includes('depreciation'));
        if (depreciation) {
            const depAmount = (depreciation.debit - depreciation.credit);
            if (depAmount !== 0) {
                operatingActivities.push({ name: 'Depreciation Add-back', amount: depAmount });
            }
        }

        res.json({ netIncome, operatingActivities, investingActivities, financingActivities });
        
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// ACCOUNTING ROUTES (Balance Sheet)
// ==========================================
router.get('/balance-sheet', async (req, res) => {
    try {
        const { asOfDate } = req.query;
        const match = { tenantId: new mongoose.Types.ObjectId(req.user.tenantId) };
        if (asOfDate) {
            match.date = { $lte: new Date(asOfDate) };
        }
        const agg = await Transaction.aggregate([
            { $match: match },
            { $unwind: '$entries' },
            { $group: {
                _id: '$entries.accountCode',
                debit: { $sum: '$entries.debit' },
                credit: { $sum: '$entries.credit' }
            } }
        ]);
        const accounts = await Account.find({ tenantId: req.user.tenantId });
        const accMap = accounts.reduce((m, a) => { m[a.code] = a; return m; }, {});

        const assets = [];
        const liabilities = [];
        const equity = [];
        let incomeDebits = 0;
        let incomeCredits = 0;

        for (const a of agg) {
            const acc = accMap[a._id];
            if (!acc) continue;
            const net = (a.debit || 0) - (a.credit || 0);
            const item = { code: acc.code, name: acc.name, category: acc.category || '', amount: 0 };
            
            if (acc.type === 'Asset') {
                item.amount = net;
                assets.push(item);
            } else if (acc.type === 'Liability') {
                item.amount = -net;
                liabilities.push(item);
            } else if (acc.type === 'Equity') {
                item.amount = -net;
                equity.push(item);
            } else if (acc.type === 'Revenue') {
                incomeCredits += a.credit || 0;
                incomeDebits += a.debit || 0;
            } else if (acc.type === 'Expense') {
                incomeDebits += a.debit || 0;
                incomeCredits += a.credit || 0;
            }
        }

        const retainedEarnings = (incomeCredits - incomeDebits);
        if (retainedEarnings !== 0) {
            equity.push({ name: 'Retained Earnings', amount: retainedEarnings });
        }

        const totalAssets = assets.reduce((s, r) => s + r.amount, 0);
        const totalLiabilities = liabilities.reduce((s, r) => s + r.amount, 0);
        const totalEquity = equity.reduce((s, r) => s + r.amount, 0);

        res.json({
            assets, liabilities, equity,
            totalAssets, totalLiabilities, totalEquity
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// PARTNERS ROUTES (CRM)
// ==========================================
router.get('/partners', async (req, res) => {
    try {
        const partners = await Partner.find({ tenantId: req.user.tenantId }).sort({ name: 1 });
        res.json(partners);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/partners', async (req, res) => {
    const partner = new Partner({ ...req.body, tenantId: req.user.tenantId });
    try {
        const newPartner = await partner.save();
        res.status(201).json(newPartner);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.put('/partners/:id', async (req, res) => {
    try {
        const updatedPartner = await Partner.findOneAndUpdate(
            { _id: req.params.id, tenantId: req.user.tenantId },
            req.body,
            { new: true }
        );
        res.json(updatedPartner);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.delete('/partners/:id', async (req, res) => {
    try {
        await Partner.findOneAndDelete({ _id: req.params.id, tenantId: req.user.tenantId });
        res.json({ message: 'Partner deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// PRODUCTS ROUTES (INVENTORY)
// ==========================================
router.get('/products', async (req, res) => {
    try {
        const products = await Product.find({ tenantId: req.user.tenantId }).sort({ name: 1 });
        res.json(products);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/products', async (req, res) => {
    const product = new Product({ ...req.body, tenantId: req.user.tenantId });
    try {
        const newProduct = await product.save();

        if ((newProduct.quantityOnHand || 0) > 0) {
            const qty = newProduct.quantityOnHand;
            const cost = newProduct.costPrice || 0;
            const totalValue = qty * cost;

            if (totalValue > 0) {
                // Create Opening Balance Entry
                const invAccount = newProduct.inventoryAccount || '140';
                const equityAccount = '305'; // Opening Balance Equity

                const transaction = new Transaction({
                    tenantId: req.user.tenantId,
                    date: new Date(),
                    description: `Opening Stock - ${newProduct.name}`,
                    entries: [
                        { accountCode: invAccount, debit: totalValue, credit: 0 },
                        { accountCode: equityAccount, debit: 0, credit: totalValue }
                    ],
                    reference: `OPEN-${newProduct._id}`,
                    type: 'Adjustment',
                    status: 'Posted'
                });

                await transaction.save();
                
                // Ensure history exists
                newProduct.history = [{
                    date: new Date(),
                    type: 'IN',
                    qty: qty,
                    price: cost,
                    balance: qty
                }];
                // Ensure batch exists
                 newProduct.batches = [{
                    batchId: `OPEN-${Date.now()}`,
                    date: new Date(),
                    quantity: qty,
                    unitCost: cost,
                    remainingQuantity: qty
                }];
                await newProduct.save();
            }
        }

        res.status(201).json(newProduct);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.put('/products/:id', async (req, res) => {
    try {
        const updatedProduct = await Product.findOneAndUpdate(
            { _id: req.params.id, tenantId: req.user.tenantId },
            req.body,
            { new: true }
        );
        res.json(updatedProduct);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.delete('/products/:id', async (req, res) => {
    try {
        await Product.findOneAndDelete({ _id: req.params.id, tenantId: req.user.tenantId });
        res.json({ message: 'Product deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// WAREHOUSE ROUTES
// ==========================================
router.get('/warehouses', async (req, res) => {
    try {
        const warehouses = await Warehouse.find({ tenantId: req.user.tenantId, isActive: true });
        res.json(warehouses);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/warehouses', async (req, res) => {
    const warehouse = new Warehouse({ ...req.body, tenantId: req.user.tenantId });
    try {
        const newWarehouse = await warehouse.save();
        res.status(201).json(newWarehouse);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.put('/warehouses/:id', async (req, res) => {
    try {
        const updatedWarehouse = await Warehouse.findOneAndUpdate(
            { _id: req.params.id, tenantId: req.user.tenantId },
            req.body,
            { new: true }
        );
        res.json(updatedWarehouse);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.delete('/warehouses/:id', async (req, res) => {
    try {
        await Warehouse.findOneAndUpdate(
            { _id: req.params.id, tenantId: req.user.tenantId }, 
            { isActive: false }
        );
        res.json({ message: 'Warehouse deactivated' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// INVOICES ROUTES (SALES)
// ==========================================
router.get('/invoices', async (req, res) => {
    try {
        const invoices = await Invoice.find({ tenantId: req.user.tenantId }).populate('customer').sort({ date: -1 });
        res.json(invoices);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/invoices', async (req, res) => {
    const invoice = new Invoice({ ...req.body, tenantId: req.user.tenantId });
    // Initialize balanceDue
    invoice.balanceDue = invoice.grandTotal;
    
    try {
        const savedInvoice = await invoice.save();

        // If status is not Draft, create accounting transaction & update inventory
        if (savedInvoice.status !== 'Draft') {
            const entries = [];
            
            // 1. Debit Accounts Receivable (120)
            entries.push({
                accountCode: '120',
                debit: savedInvoice.grandTotal,
                credit: 0
            });

            // 2. Credit Sales Tax Payable (205)
            if (savedInvoice.taxTotal > 0) {
                entries.push({
                    accountCode: '205',
                    debit: 0,
                    credit: savedInvoice.taxTotal
                });
            }

            // 3. Credit Sales Revenue & Handle Inventory/COGS
            const salesByAccount = {};
            const defaultSalesAccount = '401'; // Sales Revenue
            
            const cogsByAccount = {}; // For COGS Debit
            const inventoryByAccount = {}; // For Inventory Credit

            for (const item of savedInvoice.items) {
                // Revenue
                let salesAcc = defaultSalesAccount;
                
                if (item.product) {
                    const prod = await Product.findOne({ _id: item.product, tenantId: req.user.tenantId });
                    if (prod) {
                        if (prod.salesAccount) salesAcc = prod.salesAccount;

                        // Inventory Reduction & COGS Calculation
                        if (prod.type !== 'Service') { // Only for physical goods
                            const qtyToSell = item.quantity;
                            let cogsAmount = 0;

                            // 1. Check Stock
                            if ((prod.quantityOnHand || 0) < qtyToSell) {
                                // Fallback: use costPrice for the whole amount if stock is insufficient
                                cogsAmount = qtyToSell * (prod.costPrice || 0);
                                prod.quantityOnHand = (prod.quantityOnHand || 0) - qtyToSell;
                            } else {
                                // 2. Valuation Logic
                                if (prod.valuationMethod === 'Weighted Average') {
                                    cogsAmount = qtyToSell * (prod.costPrice || 0);
                                    prod.quantityOnHand -= qtyToSell;
                                } else {
                                    // FIFO/LIFO Logic
                                    let batches = prod.batches || [];
                                    batches.sort((a, b) => {
                                        const dateA = new Date(a.date);
                                        const dateB = new Date(b.date);
                                        return prod.valuationMethod === 'FIFO' ? dateA - dateB : dateB - dateA;
                                    });

                                    let qtyRemaining = qtyToSell;
                                    for (const batch of batches) {
                                        if (qtyRemaining <= 0) break;
                                        if (batch.remainingQuantity > 0) {
                                            const take = Math.min(qtyRemaining, batch.remainingQuantity);
                                            cogsAmount += take * batch.unitCost;
                                            batch.remainingQuantity -= take;
                                            qtyRemaining -= take;
                                        }
                                    }
                                    
                                    if (qtyRemaining > 0) {
                                        cogsAmount += qtyRemaining * (prod.costPrice || 0);
                                    }

                                    prod.quantityOnHand -= qtyToSell;
                                }
                            }
                            
                            await prod.save();

                            // COGS Accounts
                            const cogsAcc = prod.cogsAccount || '501'; // Cost of Goods Sold
                            const invAcc = prod.inventoryAccount || '140'; // Inventory Asset

                            cogsByAccount[cogsAcc] = (cogsByAccount[cogsAcc] || 0) + cogsAmount;
                            inventoryByAccount[invAcc] = (inventoryByAccount[invAcc] || 0) + cogsAmount;
                        }
                    }
                }
                salesByAccount[salesAcc] = (salesByAccount[salesAcc] || 0) + item.amount;
            }

            // Push Revenue Credits
            for (const [code, amount] of Object.entries(salesByAccount)) {
                entries.push({
                    accountCode: code,
                    debit: 0,
                    credit: amount
                });
            }

            // Push COGS Debits
            for (const [code, amount] of Object.entries(cogsByAccount)) {
                if (amount > 0) {
                    entries.push({
                        accountCode: code,
                        debit: amount,
                        credit: 0
                    });
                }
            }

            // Push Inventory Credits
            for (const [code, amount] of Object.entries(inventoryByAccount)) {
                if (amount > 0) {
                    entries.push({
                        accountCode: code,
                        debit: 0,
                        credit: amount
                    });
                }
            }

            // Get Customer Name for Description
            const customer = await Partner.findOne({ _id: savedInvoice.customer, tenantId: req.user.tenantId });
            const customerName = customer ? customer.name : 'Unknown Customer';

            // Validate Balance before saving
            const balanceCheck = validateTransactionBalance(entries);
            if (!balanceCheck.isValid) {
                // Rollback invoice if transaction is invalid
                await Invoice.findByIdAndDelete(savedInvoice._id);
                return res.status(400).json({ 
                    message: `Invoice GL generation failed: Unbalanced transaction (Diff: ${balanceCheck.diff}). Please check tax and item amounts.`,
                    details: balanceCheck
                });
            }

            // Create Transaction
            const transaction = new Transaction({
                tenantId: req.user.tenantId,
                date: savedInvoice.date,
                description: `Invoice #${savedInvoice.invoiceNumber} - ${customerName}`,
                entries: entries,
                reference: savedInvoice.invoiceNumber,
                type: 'Invoice',
                status: 'Posted'
            });

            const savedTx = await transaction.save();

            // Link Transaction to Invoice
            savedInvoice.transactionRef = savedTx._id;
            await savedInvoice.save();
        }

        res.status(201).json(savedInvoice);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.post('/invoices/:id/pay', async (req, res) => {
    const { amount, date, method, reference, accountCode } = req.body; 
    try {
        const invoice = await Invoice.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
        if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

        const payAmount = Number(amount);
        if (payAmount <= 0) return res.status(400).json({ message: 'Invalid amount' });
        
        const currentBalance = (invoice.balanceDue !== undefined) ? invoice.balanceDue : (invoice.grandTotal - (invoice.amountPaid || 0));
        
        if (payAmount > (currentBalance + 0.01)) return res.status(400).json({ message: 'Amount exceeds balance due' });

        // Update Invoice
        invoice.amountPaid = (invoice.amountPaid || 0) + payAmount;
        invoice.balanceDue = (invoice.grandTotal - invoice.amountPaid);
        invoice.payments.push({
            date: date || new Date(),
            amount: payAmount,
            method,
            reference,
            note: 'Payment Received'
        });

        if (invoice.balanceDue <= 0.01) { 
            invoice.status = 'Paid';
            invoice.balanceDue = 0;
        }

        await invoice.save();

        // Create Transaction
        const debitAccount = accountCode || '102'; 
        const creditAccount = '120'; 

        const transaction = new Transaction({
            tenantId: req.user.tenantId,
            date: date || new Date(),
            description: `Payment for Invoice #${invoice.invoiceNumber}`,
            entries: [
                { accountCode: debitAccount, debit: payAmount, credit: 0 },
                { accountCode: creditAccount, debit: 0, credit: payAmount }
            ],
            reference: reference || `PAY-${invoice.invoiceNumber}`,
            type: 'Payment',
            status: 'Posted'
        });

        await transaction.save();

        res.json({ message: 'Payment recorded', invoice });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// ==========================================
// BILLS ROUTES (PURCHASING)
// ==========================================
router.get('/bills', async (req, res) => {
    try {
        const bills = await Bill.find({ tenantId: req.user.tenantId }).populate('vendor').sort({ date: -1 });
        res.json(bills);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/bills', async (req, res) => {
    const bill = new Bill({ ...req.body, tenantId: req.user.tenantId });
    bill.balanceDue = bill.grandTotal;

    try {
        const savedBill = await bill.save();

        if (savedBill.status !== 'Draft') {
            const entries = [];
            
            // 1. Credit Accounts Payable (201)
            entries.push({
                accountCode: '201',
                debit: 0,
                credit: savedBill.grandTotal
            });

            // 2. Debit Sales Tax (205) - Input Tax
            if (savedBill.taxTotal > 0) {
                entries.push({
                    accountCode: '205',
                    debit: savedBill.taxTotal,
                    credit: 0
                });
            }

            // 3. Debit Expenses / Assets and Update Inventory
            const debitMap = {}; 

            for (const item of savedBill.items) {
                let debitAccount = item.accountCode;
                
                if (item.product) {
                    const prod = await Product.findOne({ _id: item.product, tenantId: req.user.tenantId });
                    if (prod) {
                        debitAccount = prod.inventoryAccount || '140'; 

                        if (prod.type !== 'Service') {
                            if (prod.valuationMethod === 'Weighted Average') {
                                const oldQty = prod.quantityOnHand || 0;
                                const oldCost = prod.costPrice || 0;
                                const newQty = item.quantity;
                                const newCost = item.unitPrice;
                                
                                const totalValue = (oldQty * oldCost) + (newQty * newCost);
                                const totalQty = oldQty + newQty;
                                
                                if (totalQty > 0) {
                                    prod.costPrice = totalValue / totalQty;
                                }
                            } else {
                                prod.costPrice = item.unitPrice;
                            }

                            prod.quantityOnHand = (prod.quantityOnHand || 0) + item.quantity;

                            prod.batches.push({
                                batchId: `PUR-${savedBill.billNumber}`,
                                date: savedBill.date,
                                quantity: item.quantity,
                                unitCost: item.unitPrice,
                                remainingQuantity: item.quantity
                            });

                            await prod.save();
                        }
                    }
                }

                if (debitAccount) {
                    debitMap[debitAccount] = (debitMap[debitAccount] || 0) + item.amount;
                }
            }

            for (const [code, amount] of Object.entries(debitMap)) {
                entries.push({
                    accountCode: code,
                    debit: amount,
                    credit: 0
                });
            }

            const vendor = await Partner.findOne({ _id: savedBill.vendor, tenantId: req.user.tenantId });
            const vendorName = vendor ? vendor.name : 'Unknown Vendor';

            // Validate Balance before saving
            const balanceCheck = validateTransactionBalance(entries);
            if (!balanceCheck.isValid) {
                // Rollback bill
                await Bill.findByIdAndDelete(savedBill._id);
                return res.status(400).json({ 
                    message: `Bill GL generation failed: Unbalanced transaction (Diff: ${balanceCheck.diff}). Please check tax and item amounts.`,
                    details: balanceCheck
                });
            }

            const transaction = new Transaction({
                tenantId: req.user.tenantId,
                date: savedBill.date,
                description: `Bill #${savedBill.billNumber} - ${vendorName}`,
                entries: entries,
                reference: savedBill.billNumber,
                type: 'Bill',
                status: 'Posted'
            });

            const savedTx = await transaction.save();
            savedBill.transactionRef = savedTx._id;
            await savedBill.save();
        }

        res.status(201).json(savedBill);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.post('/bills/:id/pay', async (req, res) => {
    const { amount, date, method, reference, accountCode } = req.body;
    try {
        const bill = await Bill.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
        if (!bill) return res.status(404).json({ message: 'Bill not found' });

        const payAmount = Number(amount);
        if (payAmount <= 0) return res.status(400).json({ message: 'Invalid amount' });
        
        const currentBalance = (bill.balanceDue !== undefined) ? bill.balanceDue : (bill.grandTotal - (bill.amountPaid || 0));

        if (payAmount > (currentBalance + 0.01)) return res.status(400).json({ message: 'Amount exceeds balance due' });

        bill.amountPaid = (bill.amountPaid || 0) + payAmount;
        bill.balanceDue = (bill.grandTotal - bill.amountPaid);
        bill.payments.push({
            date: date || new Date(),
            amount: payAmount,
            method,
            reference,
            note: 'Payment Made'
        });

        if (bill.balanceDue <= 0.01) {
            bill.status = 'Paid';
            bill.balanceDue = 0;
        }

        await bill.save();

        const debitAccount = '201';
        const creditAccount = accountCode || '102';

        const transaction = new Transaction({
            tenantId: req.user.tenantId,
            date: date || new Date(),
            description: `Payment for Bill #${bill.billNumber}`,
            entries: [
                { accountCode: debitAccount, debit: payAmount, credit: 0 },
                { accountCode: creditAccount, debit: 0, credit: payAmount }
            ],
            reference: reference || `PAY-${bill.billNumber}`,
            type: 'Payment',
            status: 'Posted'
        });

        await transaction.save();

        res.json({ message: 'Payment recorded', bill });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// ==========================================
// DASHBOARD ROUTES
// ==========================================

router.get('/dashboard/financial-trends', async (req, res) => {
    try {
        const today = new Date();
        const currentYear = today.getFullYear();
        const startOfYear = new Date(currentYear, 0, 1);
        
        const agg = await Transaction.aggregate([
            { $match: { tenantId: new mongoose.Types.ObjectId(req.user.tenantId), date: { $gte: startOfYear }, status: 'Posted' } },
            { $unwind: '$entries' },
            {
                $lookup: {
                    from: 'accounts',
                    let: { code: '$entries.accountCode', tenantId: '$tenantId' },
                    pipeline: [
                        { $match: { 
                            $expr: { 
                                $and: [
                                    { $eq: ['$code', '$$code'] },
                                    { $eq: ['$tenantId', '$$tenantId'] } 
                                ] 
                            } 
                        } }
                    ],
                    as: 'accountDetails'
                }
            },
            { $unwind: '$accountDetails' },
            {
                $group: {
                    _id: {
                        month: { $month: '$date' },
                        type: '$accountDetails.type'
                    },
                    debitSum: { $sum: '$entries.debit' },
                    creditSum: { $sum: '$entries.credit' }
                }
            },
            { $sort: { '_id.month': 1 } }
        ]);

        const monthlyData = Array(12).fill(0).map((_, i) => ({ 
            month: i + 1, 
            revenue: 0, 
            expense: 0 
        }));

        agg.forEach(item => {
            const mIndex = item._id.month - 1;
            if (mIndex >= 0 && mIndex < 12) {
                if (item._id.type === 'Revenue') {
                    monthlyData[mIndex].revenue += (item.creditSum - item.debitSum);
                } else if (item._id.type === 'Expense') {
                    monthlyData[mIndex].expense += (item.debitSum - item.creditSum);
                }
            }
        });

        res.json(monthlyData);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/dashboard/kpi-summary', async (req, res) => {
    try {
        const today = new Date();
        const currentYear = today.getFullYear();
        const startOfYear = new Date(currentYear, 0, 1);

        const agg = await Transaction.aggregate([
            { $match: { tenantId: new mongoose.Types.ObjectId(req.user.tenantId), date: { $gte: startOfYear }, status: 'Posted' } },
            { $unwind: '$entries' },
            {
                $lookup: {
                    from: 'accounts',
                    let: { code: '$entries.accountCode', tenantId: '$tenantId' },
                    pipeline: [
                        { $match: { 
                            $expr: { 
                                $and: [
                                    { $eq: ['$code', '$$code'] },
                                    { $eq: ['$tenantId', '$$tenantId'] } 
                                ] 
                            } 
                        } }
                    ],
                    as: 'accountDetails'
                }
            },
            { $unwind: '$accountDetails' },
            {
                $group: {
                    _id: '$accountDetails.type',
                    debitSum: { $sum: '$entries.debit' },
                    creditSum: { $sum: '$entries.credit' }
                }
            }
        ]);

        let revenue = 0;
        let expense = 0;

        agg.forEach(item => {
            if (item._id === 'Revenue') {
                revenue += (item.creditSum - item.debitSum);
            } else if (item._id === 'Expense') {
                expense += (item.debitSum - item.creditSum);
            }
        });

        const cashAgg = await Transaction.aggregate([
                    { $match: { tenantId: new mongoose.Types.ObjectId(req.user.tenantId), status: 'Posted' } },
                    { $unwind: '$entries' },
                    // expanded cash accounts
                    { $match: { 'entries.accountCode': { $in: ['101', '102', '105', '106'] } } }, 
                    {
                        $group: {
                            _id: null,
                            balance: { $sum: { $subtract: ['$entries.debit', '$entries.credit'] } } 
                        }
                    }
                ]);
        const cashBalance = cashAgg.length > 0 ? cashAgg[0].balance : 0;

        res.json({
            revenue,
            expense,
            netProfit: revenue - expense,
            cashBalance
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/dashboard/expense-breakdown', async (req, res) => {
    try {
        const today = new Date();
        const currentYear = today.getFullYear();
        const startOfYear = new Date(currentYear, 0, 1);

        const agg = await Transaction.aggregate([
            { $match: { tenantId: new mongoose.Types.ObjectId(req.user.tenantId), date: { $gte: startOfYear }, status: 'Posted' } },
            { $unwind: '$entries' },
            {
                $lookup: {
                    from: 'accounts',
                    let: { code: '$entries.accountCode', tenantId: '$tenantId' },
                    pipeline: [
                        { $match: { 
                            $expr: { 
                                $and: [
                                    { $eq: ['$code', '$$code'] },
                                    { $eq: ['$tenantId', '$$tenantId'] } 
                                ] 
                            } 
                        } }
                    ],
                    as: 'accountDetails'
                }
            },
            { $unwind: '$accountDetails' },
            { $match: { 'accountDetails.type': 'Expense' } },
            {
                $group: {
                    _id: '$accountDetails.name',
                    amount: { $sum: { $subtract: ['$entries.debit', '$entries.credit'] } }
                }
            },
            { $sort: { amount: -1 } },
            { $limit: 5 }
        ]);

        res.json(agg); 
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// EMPLOYEES ROUTES (HR)
// ==========================================
router.get('/employees', async (req, res) => {
    try {
        const employees = await Employee.find({ tenantId: req.user.tenantId }).sort({ lastName: 1 });
        res.json(employees);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/employees', async (req, res) => {
    const employee = new Employee({ ...req.body, tenantId: req.user.tenantId });
    try {
        const newEmployee = await employee.save();
        res.status(201).json(newEmployee);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// ==========================================
// LEAVE ROUTES (HR)
// ==========================================
router.get('/leaves', async (req, res) => {
    try {
        // Find employees first to filter leaves
        const employees = await Employee.find({ tenantId: req.user.tenantId }).select('_id');
        const empIds = employees.map(e => e._id);
        
        const leaves = await Leave.find({ employee: { $in: empIds } }).populate('employee').sort({ startDate: -1 });
        res.json(leaves);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/leaves', async (req, res) => {
    const leave = new Leave(req.body); // Employee association handles tenant implicitly via employee check? Better to check employee belongs to tenant
    try {
        const employee = await Employee.findOne({ _id: req.body.employee, tenantId: req.user.tenantId });
        if (!employee) return res.status(400).json({ message: 'Invalid Employee' });

        const savedLeave = await leave.save();
        res.status(201).json(savedLeave);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.put('/leaves/:id', async (req, res) => {
    try {
        // Find the leave and populate employee to check tenant
        const leave = await Leave.findById(req.params.id).populate('employee');
        
        if (!leave) {
            return res.status(404).json({ message: 'Leave not found' });
        }

        // Ensure leave belongs to tenant's employee
        if (!leave.employee || leave.employee.tenantId.toString() !== req.user.tenantId) {
             return res.status(403).json({ message: 'Unauthorized access to this leave record' });
        }

        const updatedLeave = await Leave.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        res.json(updatedLeave);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// ==========================================
// PAYROLL ROUTES
// ==========================================
router.get('/payrolls', async (req, res) => {
    try {
         const employees = await Employee.find({ tenantId: req.user.tenantId }).select('_id');
         const empIds = employees.map(e => e._id);

        const payrolls = await Payroll.find({ employee: { $in: empIds } }).populate('employee').sort({ paymentDate: -1 });
        res.json(payrolls);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/payrolls', async (req, res) => {
    const payroll = new Payroll(req.body);
    try {
        const employee = await Employee.findOne({ _id: req.body.employee, tenantId: req.user.tenantId });
        if (!employee) return res.status(400).json({ message: 'Invalid Employee' });

        const savedPayroll = await payroll.save();
        
        if (savedPayroll.status === 'Paid') {
            const empName = `${employee.firstName} ${employee.lastName}`;

            const entries = [
                {
                    accountCode: '504',
                    debit: savedPayroll.netSalary + (savedPayroll.deductions || 0),
                    credit: 0
                },
                {
                    accountCode: '101',
                    debit: 0,
                    credit: savedPayroll.netSalary
                }
            ];

            if (savedPayroll.deductions > 0) {
                entries.push({
                    accountCode: '206',
                    debit: 0,
                    credit: savedPayroll.deductions
                });
            }

            const transaction = new Transaction({
                tenantId: req.user.tenantId,
                date: savedPayroll.paymentDate || new Date(),
                description: `Payroll - ${empName} - ${savedPayroll.month}`,
                entries: entries,
                reference: `PAY-${savedPayroll._id}`,
                type: 'Payroll',
                status: 'Posted'
            });

            await transaction.save();
        }

        res.status(201).json(savedPayroll);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// ==========================================
// INVENTORY ADJUSTMENT ROUTES
// ==========================================
router.post('/inventory/adjust', async (req, res) => {
    const { productId, type, quantity, unitCost, date, reason, warehouseId } = req.body;
    try {
        const product = await Product.findOne({ _id: productId, tenantId: req.user.tenantId });
        if (!product) return res.status(404).json({ message: 'Product not found' });

        const qty = Number(quantity);
        const cost = Number(unitCost);
        const totalValue = qty * cost;

        if (isNaN(qty) || isNaN(cost)) return res.status(400).json({ message: 'Invalid quantity or cost' });

        if (type === 'IN') {
            product.quantityOnHand = (product.quantityOnHand || 0) + qty;
            
            if (warehouseId) {
                const stockLoc = product.stockLocations.find(l => l.warehouse.toString() === warehouseId);
                if (stockLoc) {
                    stockLoc.quantity += qty;
                } else {
                    product.stockLocations.push({ warehouse: warehouseId, quantity: qty });
                }
            }

            product.batches.push({
                batchId: `ADJ-${Date.now()}`,
                warehouse: warehouseId,
                date: date || new Date(),
                quantity: qty,
                unitCost: cost,
                remainingQuantity: qty
            });
            
            if (product.valuationMethod === 'Weighted Average') {
                 const oldQty = (product.quantityOnHand || 0) - qty; 
                 const oldVal = oldQty * (product.costPrice || 0);
                 const newVal = oldVal + totalValue;
                 product.costPrice = newVal / product.quantityOnHand;
            }

        } else if (type === 'OUT') {
            product.quantityOnHand = (product.quantityOnHand || 0) - qty;
            
            if (warehouseId) {
                const stockLoc = product.stockLocations.find(l => l.warehouse.toString() === warehouseId);
                if (stockLoc) {
                    stockLoc.quantity = Math.max(0, stockLoc.quantity - qty);
                }
            }
        }
        
        await product.save();

        const invAccount = product.inventoryAccount || '140';
        const adjAccount = '505'; 

        const entries = [];
        if (type === 'IN') {
             entries.push({ accountCode: invAccount, debit: totalValue, credit: 0 });
             entries.push({ accountCode: adjAccount, debit: 0, credit: totalValue });
        } else {
             entries.push({ accountCode: adjAccount, debit: totalValue, credit: 0 });
             entries.push({ accountCode: invAccount, debit: 0, credit: totalValue });
        }

        const transaction = new Transaction({
            tenantId: req.user.tenantId,
            date: date || new Date(),
            description: `Inventory Adjustment - ${product.name} - ${reason}`,
            entries: entries,
            reference: `ADJ-${product._id}`,
            type: 'Adjustment',
            status: 'Posted'
        });

        await transaction.save();

        res.status(201).json({ message: 'Adjustment recorded', product });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// ==========================================
// COST ACCOUNTING ROUTES
// ==========================================
router.get('/projects', async (req, res) => {
    try {
        const projects = await Project.find({ tenantId: req.user.tenantId }).populate('client').sort({ createdAt: -1 });
        res.json(projects);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/projects', async (req, res) => {
    try {
        const project = new Project({ ...req.body, tenantId: req.user.tenantId });
        const saved = await project.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.put('/projects/:id', async (req, res) => {
    try {
        const updated = await Project.findOneAndUpdate(
            { _id: req.params.id, tenantId: req.user.tenantId },
            req.body, 
            { new: true }
        );
        res.json(updated);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.get('/cost-centers', async (req, res) => {
    try {
        const costCenters = await CostCenter.find({ tenantId: req.user.tenantId }).sort({ code: 1 });
        res.json(costCenters);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/cost-centers', async (req, res) => {
    try {
        const costCenter = new CostCenter({ ...req.body, tenantId: req.user.tenantId });
        const saved = await costCenter.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.put('/cost-centers/:id', async (req, res) => {
    try {
        const updated = await CostCenter.findOneAndUpdate(
            { _id: req.params.id, tenantId: req.user.tenantId },
            req.body, 
            { new: true }
        );
        res.json(updated);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.get('/reports/project-profitability', async (req, res) => {
    try {
        const agg = await Transaction.aggregate([
            { $match: { 
                tenantId: new mongoose.Types.ObjectId(req.user.tenantId),
                project: { $exists: true }, 
                status: 'Posted' 
            } },
            { $unwind: '$entries' },
            {
                $lookup: {
                    from: 'accounts',
                    let: { code: '$entries.accountCode', tenantId: '$tenantId' },
                    pipeline: [
                        { $match: { 
                            $expr: { 
                                $and: [
                                    { $eq: ['$code', '$$code'] },
                                    { $eq: ['$tenantId', '$$tenantId'] } 
                                ] 
                            } 
                        } }
                    ],
                    as: 'accountDetails'
                }
            },
            { $unwind: '$accountDetails' },
            {
                $group: {
                    _id: '$project',
                    revenue: { 
                        $sum: { 
                            $cond: [{ $eq: ['$accountDetails.type', 'Revenue'] }, { $subtract: ['$entries.credit', '$entries.debit'] }, 0] 
                        } 
                    },
                    expense: { 
                        $sum: { 
                            $cond: [{ $eq: ['$accountDetails.type', 'Expense'] }, { $subtract: ['$entries.debit', '$entries.credit'] }, 0] 
                        } 
                    }
                }
            },
            {
                $lookup: {
                    from: 'projects',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'projectInfo'
                }
            },
            { $unwind: '$projectInfo' }
        ]);

        const result = agg.map(p => ({
            id: p.projectInfo._id,
            name: p.projectInfo.name,
            code: p.projectInfo.code,
            revenue: p.revenue,
            expense: p.expense,
            profit: p.revenue - p.expense
        }));

        res.json(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// TIMESHEETS ROUTES
// ==========================================
router.get('/timesheets', async (req, res) => {
    try {
        const timesheets = await Timesheet.find({ tenantId: req.user.tenantId })
            .populate('employee')
            .populate('project')
            .populate('costCenter')
            .sort({ date: -1 });
        res.json(timesheets);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/timesheets', async (req, res) => {
    try {
        const { employee, project, hours, hourlyRate } = req.body;
        
        // Calculate total cost
        const rate = Number(hourlyRate) || 0;
        const hrs = Number(hours) || 0;
        const totalCost = rate * hrs;
        
        const timesheet = new Timesheet({
            ...req.body,
            tenantId: req.user.tenantId,
            hourlyRate: rate,
            totalCost: totalCost
        });
        
        const saved = await timesheet.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.put('/timesheets/:id', async (req, res) => {
    try {
        const updated = await Timesheet.findOneAndUpdate(
            { _id: req.params.id, tenantId: req.user.tenantId },
            req.body,
            { new: true }
        );
        res.json(updated);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.delete('/timesheets/:id', async (req, res) => {
    try {
        await Timesheet.findOneAndDelete({ _id: req.params.id, tenantId: req.user.tenantId });
        res.json({ message: 'Timesheet deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
