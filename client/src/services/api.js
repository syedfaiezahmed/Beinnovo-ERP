import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000, // Timeout after 15 seconds
});

// Add a request interceptor to include the JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const login = (email, password) => api.post('/auth/login', { email, password });
export const register = (userData) => api.post('/auth/register', userData); // If needed

// Super Admin Routes
export const createTenant = (tenantData) => api.post('/admin/tenants', tenantData);
export const getTenants = () => api.get('/admin/tenants');
export const updateTenant = (id, data) => api.put(`/admin/tenants/${id}`, data);
export const deleteTenant = (id) => api.delete(`/admin/tenants/${id}`);
export const getSystemStats = () => api.get('/admin/stats');
export const getGlobalSettings = () => api.get('/admin/settings');
export const updateGlobalSettings = (settings) => api.put('/admin/settings', settings);

export const getTransactions = (params) => api.get('/transactions', { params });
export const createTransaction = (transaction) => api.post('/transactions', transaction);
export const updateTransaction = (id, transaction) => api.put(`/transactions/${id}`, transaction);
export const deleteTransaction = (id) => api.delete(`/transactions/${id}`);
export const getAccounts = () => api.get('/accounts');
export const createAccount = (account) => api.post('/accounts', account);
export const updateAccount = (code, account) => api.put(`/accounts/${code}`, account);
export const deleteAccount = (code) => api.delete(`/accounts/${code}`);
export const getLedger = (params) => api.get('/ledger', { params });
export const getTrialBalance = (params) => api.get('/trial-balance', { params });
export const getProfitLoss = (params) => api.get('/profit-loss', { params });
export const getBalanceSheet = (params) => api.get('/balance-sheet', { params });
export const getCashFlow = (params) => api.get('/cash-flow', { params });

// Tenant Settings
export const getTenantSettings = () => api.get('/tenant');
export const updateTenantSettings = (settings) => api.put('/tenant', settings);

// User Dashboard Layout
export const getDashboardLayout = () => api.get('/user/dashboard-layout');
export const saveDashboardLayout = (layout) => api.put('/user/dashboard-layout', layout);

// Analytics
export const getAnalyticsSum = (params) => api.get('/analytics/sum', { params });
export const getAnalyticsMonthly = (params) => api.get('/analytics/monthly', { params });
export const aiDesignDashboard = (prompt) => api.post('/ai/design-dashboard', { prompt });

// AI Endpoints
export const aiParseTransaction = (description, date) => api.post('/ai/parse-transaction', { description, date });
export const aiForecast = () => api.get('/ai/forecast');
export const aiAssist = (prompt, context) => api.post('/ai/assist', { prompt, context });

export default api;
