const mongoose = require('mongoose');
const User = require('./models/User');

const seedAdmin = async () => {
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
                console.log('Super Admin repaired/updated successfully.');
            } else {
                console.log('Super Admin already exists and is valid.');
            }
        } else {
            await User.create({
                name: 'Beinnovo Admin',
                email,
                password,
                role: 'super_admin'
            });
            console.log('Super Admin created: admin@beinnovo.com / admin');
        }
    } catch (err) {
        console.error('Seed Admin Failed:', err);
    }
};

if (require.main === module) {
    const dotenv = require('dotenv');
    dotenv.config();
    mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/beinnovo_erp')
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
