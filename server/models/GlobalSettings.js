const mongoose = require('mongoose');

const globalSettingsSchema = new mongoose.Schema({
    appName: { type: String, default: 'Accounts System' },
    supportEmail: { type: String, default: 'support@example.com' },
    trialDurationDays: { type: Number, default: 14 },
    enableEmailNotifications: { type: Boolean, default: true },
    maintenanceMode: { type: Boolean, default: false },
    allowNewRegistrations: { type: Boolean, default: true },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GlobalSettings', globalSettingsSchema);
