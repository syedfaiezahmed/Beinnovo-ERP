const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const compression = require('compression');
const dns = require('node:dns');
require('dotenv').config();

// Fix for Node 17+ DNS resolution issues with MongoDB Atlas
try {
    dns.setDefaultResultOrder('ipv4first');
} catch (error) {
    console.warn('Could not set default result order for DNS:', error);
}

const serverless = require('serverless-http');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

// Middleware
app.use(compression()); // Compress all responses
app.use(cors());
app.use(express.json());

const seedAdmin = require('./seedAdmin');

// Database Connection (Cached for Serverless)
let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
    // console.log('Attempting to connect to DB...'); // Verbose logging
    if (cached.conn) {
        // console.log('Using cached connection'); 
        return cached.conn;
    }

    if (!MONGODB_URI) {
        console.error('MONGODB_URI is missing!');
        throw new Error('MONGODB_URI environment variable is not defined');
    }

    if (!cached.promise) {
        console.log('Creating new connection promise...');
        const opts = {
            serverSelectionTimeoutMS: 5000, // Fail faster to retry or show error
            connectTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            family: 4 // Force IPv4
        };

        cached.promise = mongoose.connect(MONGODB_URI, opts).then(async (mongoose) => {
            console.log('✅ MongoDB Connected Successfully (Atlas)');
            
            // Seed Super Admin
            try {
                await seedAdmin();
            } catch (seedErr) {
                console.error('⚠️ Failed to seed super admin:', seedErr.message);
            }

            return mongoose;
        }).catch(err => {
            console.error('❌ MongoDB Atlas Connection Failed:', err.message);
            
            // Fallback to Local MongoDB if Atlas fails (Only in Development)
            if (process.env.NODE_ENV !== 'production') {
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

// Routes
app.get('/api/status', (req, res) => {
    res.json({
        status: 'running',
        dbState: mongoose.connection.readyState,
        dbName: mongoose.connection.name,
        env: process.env.NODE_ENV,
        uriConfigured: !!process.env.MONGODB_URI
    });
});

app.get('/api/ping', (req, res) => {
    res.send('pong');
});

app.get('/', (req, res) => {
    res.send('Beinnovo ERP API is running');
});

const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');

// Middleware to ensure DB connection (Soft Fail)
app.use((req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
        connectDB().catch((error) => {
            console.error('Database connection failed in middleware:', error.message);
            req.dbConnectionError = error;
        });
    }
    next();
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', apiRoutes);

if (require.main === module) {
    connectDB().then(() => {
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    }).catch(err => {
        console.error('Initial DB Connection Failed (Starting server anyway to allow retries):', err.message);
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT} (DB Disconnected)`);
        });
    });
}

module.exports = serverless(app);
