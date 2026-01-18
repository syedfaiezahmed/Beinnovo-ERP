const mongoose = require('mongoose');
const User = require('../models/User');
const dotenv = require('dotenv');

dotenv.config();

const resetAdmin = async () => {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb+srv://admin:admin123@cluster0.fm3ess7.mongodb.net/beinnovo_accounts?retryWrites=true&w=majority&appName=Cluster0';
        await mongoose.connect(uri);
        console.log('MongoDB Connected');

        const email = 'admin@beinnovo.com';
        
        // 1. Delete existing admin
        await User.deleteOne({ email });
        console.log('Deleted existing admin user.');

        // 2. Create new admin with legacy structure
        const user = new User({
            name: 'Beinnovo Admin',
            email: email,
            password: 'admin', // Will be hashed by pre-save hook
            role: 'super_admin',
            businessRole: 'Organization Admin',
            // No tenantId for super admin
        });

        await user.save();
        console.log('✅ Super Admin Re-created successfully.');
        console.log('   Email:', user.email);
        console.log('   Role:', user.role);

        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
};

resetAdmin();
