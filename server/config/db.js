const mongoose = require('mongoose');
const seedAdmin = require('../seedAdmin');

// Database Connection (Cached for Serverless)
let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
    // 1. Get URI
    let MONGODB_URI = process.env.MONGODB_URI;

    // 2. Require URI in all environments (no local fallback)
    if (!MONGODB_URI) {
        console.error('❌ FATAL: MONGODB_URI is missing!');
        throw new Error('MONGODB_URI environment variable is not defined.');
    }

    // 3. Return existing connection if ready
    if (cached.conn && mongoose.connection.readyState === 1) {
        return cached.conn;
    }

    // 4. Create new connection promise if none exists
    if (!cached.promise) {
        console.log(`Connecting to MongoDB... (URI starts with: ${MONGODB_URI.substring(0, 15)}...)`);
        
        const opts = {
            bufferCommands: false, // Disable Mongoose buffering to fail fast
            serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
            socketTimeoutMS: 45000,
        };

        // Note: Removed 'family: 4' to allow IPv6 on Vercel/Cloud environments
        cached.promise = mongoose.connect(MONGODB_URI, opts).then(async (mongoose) => {
            console.log('✅ MongoDB Connected Successfully');
            
            // Seed Super Admin (Non-blocking)
            seedAdmin().catch(err => console.error('⚠️ Seed Admin Failed (Non-fatal):', err.message));

            return mongoose;
        }).catch(err => {
            console.error('❌ MongoDB Connection Error:', err.message);
            // Don't cache failed promises
            cached.promise = null; 
            throw err;
        });
    }

    // 5. Await the promise
    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        throw e;
    }

    return cached.conn;
};

module.exports = connectDB;
