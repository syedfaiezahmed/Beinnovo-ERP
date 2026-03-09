const mongoose = require('mongoose');
const connectDB = require('../config/db');

const dbCheck = async (req, res, next) => {
    // If we are already connected, proceed
    if (mongoose.connection.readyState === 1) {
        return next();
    }

    // If connecting, wait a bit (optional, but let's try to connect)
    if (mongoose.connection.readyState === 2) {
        // Connecting... let's wait a moment or just try to await connectDB which handles promises
    }

    try {
        console.log('Middleware: DB not connected. Attempting reconnection...');
        await connectDB();
        next();
    } catch (error) {
        console.error('Middleware: DB Connection Failed:', error.message);
        
        // If it's a login request, allow Offline Mode ONLY in non-production
        if ((req.path === '/api/auth/login' || req.path === '/login') && process.env.NODE_ENV !== 'production') {
            console.log('⚠️ Enabling Offline Mode for Login Request');
            req.isOffline = true;
            req.dbError = error;
            return next();
        }

        // For other requests, return 503 Service Unavailable
        return res.status(503).json({ 
            message: 'Database connection is currently unavailable. Please try again later.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            details: 'Ensure MONGODB_URI is correctly set in your environment variables.'
        });
    }
};

module.exports = dbCheck;
