const Account = require('../models/Account');

const SYSTEM_ACCOUNTS = [
    // ASSETS
    { code: '1001', name: 'Cash', type: 'Asset', category: 'Current Asset', isSystemAccount: true },
    { code: '1002', name: 'Bank', type: 'Asset', category: 'Current Asset', isSystemAccount: true },
    { code: '1101', name: 'Accounts Receivable', type: 'Asset', category: 'Current Asset', isSystemAccount: true },
    
    // LIABILITIES
    { code: '2001', name: 'Accounts Payable', type: 'Liability', category: 'Current Liability', isSystemAccount: true },
    
    // EQUITY
    { code: '3001', name: 'Capital', type: 'Equity', category: 'Equity', isSystemAccount: true },
    
    // INCOME
    { code: '4001', name: 'Sales Revenue', type: 'Revenue', category: 'Operating Revenue', isSystemAccount: true },
    
    // EXPENSES
    { code: '5001', name: 'Rent Expense', type: 'Expense', category: 'Operating Expense', isSystemAccount: true },
    { code: '5002', name: 'Utilities Expense', type: 'Expense', category: 'Operating Expense', isSystemAccount: true },
    { code: '5003', name: 'Salaries Expense', type: 'Expense', category: 'Operating Expense', isSystemAccount: true }
];

const seedAccounts = async (tenantId) => {
    if (!tenantId) throw new Error('Tenant ID is required for seeding accounts');

    let createdCount = 0;
    for (const acc of SYSTEM_ACCOUNTS) {
        const exists = await Account.findOne({ tenantId, code: acc.code });
        if (!exists) {
            await Account.create({ ...acc, tenantId, created_by: 'system' });
            createdCount++;
        }
    }
    
    if (createdCount > 0) {
        console.log(`[Seeder] Seeded ${createdCount} system accounts for tenant ${tenantId}`);
    }
};

module.exports = { seedAccounts, SYSTEM_ACCOUNTS };
