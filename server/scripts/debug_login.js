const mongoose = require('mongoose');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

const debugLogin = async () => {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb+srv://admin:admin123@cluster0.fm3ess7.mongodb.net/beinnovo_accounts?retryWrites=true&w=majority&appName=Cluster0';
        await mongoose.connect(uri);
        console.log('MongoDB Connected');

        const email = 'admin@beinnovo.com';
        const passwordToTest = 'admin';

        const user = await User.findOne({ email });

        if (user) {
            console.log('✅ User Found:', user.email);
            console.log('   Role:', user.role);
            console.log('   Stored Password Hash:', user.password);
            
            const isMatch = await bcrypt.compare(passwordToTest, user.password);
            console.log(`   Testing password "${passwordToTest}":`, isMatch ? '✅ MATCH' : '❌ NO MATCH');
            
            if (!isMatch) {
                // Try re-hashing to see what it should look like
                const salt = await bcrypt.genSalt(10);
                const newHash = await bcrypt.hash(passwordToTest, salt);
                console.log('   Expected Hash Format:', newHash);
            }
        } else {
            console.log('❌ User NOT Found');
        }

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
};

debugLogin();
