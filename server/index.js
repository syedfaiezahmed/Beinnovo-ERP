const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const compression = require('compression');
const dns = require('node:dns');
require('dotenv').config();

try {
    dns.setDefaultResultOrder('ipv4first');
} catch (error) {
    console.warn('Could not set default result order for DNS:', error);
}

const app = express();
const PORT = process.env.PORT || 5000;

// Import Config & Middleware
const connectDB = require('./config/db');
const dbCheck = require('./middleware/dbCheck');

// Middleware
app.use(compression()); // Compress all responses
app.use(cors());
app.use(express.json());

// Routes that don't need DB
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

// Import Routes
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');

// Apply DB Check Middleware + Routes
// This ensures that for these routes, we attempt to connect to DB if not already connected
app.use('/api/auth', dbCheck, authRoutes);
app.use('/api/admin', dbCheck, adminRoutes);
app.use('/api', dbCheck, apiRoutes);

// Server Startup Logic
if (require.main === module) {
    // Try to connect initially, but start server regardless
    connectDB().then(() => {
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    }).catch(err => {
        console.error('Initial DB Connection Failed (Starting server anyway to allow retries):', err.message);
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT} (DB Disconnected - Requests will trigger reconnection)`);
        });
    });
} else {
    // Serverless Handler
    module.exports = async (req, res) => {
        if (mongoose.connection.readyState !== 1) {
            try {
                await connectDB();
            } catch (err) {
                console.error('Handler DB connect failed:', err.message);
            }
        }
        return app(req, res);
    };
}
