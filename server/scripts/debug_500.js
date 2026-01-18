
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account'); // Added Account
require('dotenv').config({ path: '../.env' });

const MONGO_URI = 'mongodb+srv://faiezwaseem:faiez123@cluster0.xp8rw.mongodb.net/beinnovo_accounts?retryWrites=true&w=majority&appName=Cluster0';

const debug = async () => {
    try {
        console.log('Connecting to DB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected to DB');

        const tenantIdStr = '69600ca8a0c73985220e23d8'; // Use a known valid ObjectId from previous logs if possible, or query one.
        // Wait, the log said "Tenant ID resolved: 69600ca8a0c73985220e23d8" but that looks like a fake/generated ID or I misread. 
        // Standard Mongo IDs are 24 hex chars. 
        // 69600ca8a0c73985220e23d8 is 24 chars. It seems valid.
        
        const tenantId = new mongoose.Types.ObjectId(tenantIdStr);

        console.log('1. Testing Account.find...');
        const accounts = await Account.find({ tenantId }).sort({ code: 1 });
        console.log(`Found ${accounts.length} accounts`);

        console.log('2. Testing Aggregation with ObjectId...');
        try {
            const balances = await Transaction.aggregate([
                { $match: { tenantId: tenantId, status: 'Posted' } },
                { $unwind: '$entries' },
                { $group: {
                    _id: '$entries.accountCode',
                    debit: { $sum: '$entries.debit' },
                    credit: { $sum: '$entries.credit' }
                }}
            ]);
            console.log('Aggregation (ObjectId) Success:', balances.length);
        } catch (e) {
            console.error('Aggregation (ObjectId) Failed:', e.message);
        }

        console.log('3. Testing Aggregation with String converted to ObjectId...');
        try {
            const tId = new mongoose.Types.ObjectId(String(tenantIdStr));
            const balances = await Transaction.aggregate([
                { $match: { tenantId: tId, status: 'Posted' } },
                { $unwind: '$entries' },
                { $group: {
                    _id: '$entries.accountCode',
                    debit: { $sum: '$entries.debit' },
                    credit: { $sum: '$entries.credit' }
                }}
            ]);
            console.log('Aggregation (String->ObjectId) Success:', balances.length);
        } catch (e) {
            console.error('Aggregation (String->ObjectId) Failed:', e.message);
        }

    } catch (err) {
        console.error('Global Error:', err);
    } finally {
        await mongoose.disconnect();
    }
};

debug();
