const mongoose = require('mongoose');
const User = require('./models/User');

const seedAdmin = async () => {
    try {
        const email = 'admin@beinnovo.com';
        const password = 'admin'; // Change this in production!

        // Check if exists
        let user = await User.findOne({ email });
        
        if (user) {
            console.log('Checking Super Admin status...');
            if (user.role !== 'super_admin') {
                user.role = 'super_admin';
                await user.save();
                console.log('User updated to Super Admin');
            } else {
                console.log('Super Admin already exists.');
            }
        } else {
            user = new User({
                name: 'Beinnovo Admin',
                email,
                passwordHash: password, // Use new field
                // role: 'super_admin' // Legacy string role, ignore for now or map if needed
                // Note: Strictly we should set roleId, but since we might not have Roles seeded here, we skip strict check
            });
            await user.save();
            console.log('Super Admin Created: admin@beinnovo.com / admin');
        }
    } catch (err) {
        console.error('Seed Admin Failed:', err);
    }
};

if (require.main === module) {
    // Run as script
    const dotenv = require('dotenv');
    dotenv.config();
    mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/acctsys')
        .then(async () => {
            await seedAdmin();
            process.exit();
        })
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}

module.exports = seedAdmin;
