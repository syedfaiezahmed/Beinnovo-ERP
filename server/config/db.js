const mongoose = require('mongoose');
const seedAdmin = require('../seedAdmin');

// Database Connection (Cached for Serverless)
let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
    const MONGODB_URI = process.env.MONGODB_URI;

    // console.log('Attempting to connect to DB...'); // Verbose logging
    if (cached.conn && mongoose.connection.readyState === 1) {
        // console.log('Using cached connection'); 
        return cached.conn;
    }

    if (!MONGODB_URI) {
        console.error('MONGODB_URI is missing!');
        // Fallback for development if URI is missing
        if (process.env.NODE_ENV !== 'production') {
             console.log('⚠️ using default local URI');
             process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/beinnovo_erp';
        } else {
             throw new Error('MONGODB_URI environment variable is not defined. Please check your deployment settings.');
        }
    }

    if (!cached.promise) {
        console.log('Creating new connection promise...');
        const opts = {
            serverSelectionTimeoutMS: 5000, // Fail faster to retry or show error
            connectTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            family: 4 // Force IPv4
        };

        cached.promise = mongoose.connect(process.env.MONGODB_URI, opts).then(async (mongoose) => {
            console.log('✅ MongoDB Connected Successfully');
            
            // Seed Super Admin
            try {
                await seedAdmin();
            } catch (seedErr) {
                console.error('⚠️ Failed to seed super admin:', seedErr.message);
            }

            return mongoose;
        }).catch(err => {
            console.error('❌ MongoDB Connection Failed:', err.message);
            
            // Fallback to Local MongoDB if Atlas fails (Only in Development)
            if (process.env.NODE_ENV !== 'production' && !process.env.MONGODB_URI.includes('127.0.0.1')) {
                console.log('⚠️ Attempting Local MongoDB Fallback...');
                const localUri = 'mongodb://127.0.0.1:27017/beinnovo_erp'; 
                return mongoose.connect(localUri, { ...opts, family: 4 }).then((mongoose) => {
                    console.log('✅ Connected to Local MongoDB Successfully');
                    return mongoose;
                }).catch(localErr => {
                     console.error('❌ Local MongoDB also failed:', localErr.message);
                     cached.promise = null; // Clear promise on failure
                     throw err; // Throw original error
                });
            } else {
                cached.promise = null;
                throw err;
            }
        });
    }

    try {
        // console.log('Awaiting connection promise...');
        cached.conn = await cached.promise;
        // console.log('Connection established.');
    } catch (e) {
        cached.promise = null;
        console.error('MongoDB Connection Error (in try/catch):', e.message);
        throw e;
    }

    return cached.conn;
};

module.exports = connectDB;
