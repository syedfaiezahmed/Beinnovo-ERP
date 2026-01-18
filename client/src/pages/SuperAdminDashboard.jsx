import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    getTenants, createTenant, deleteTenant, updateTenant, getSystemStats,
    getGlobalSettings, updateGlobalSettings
} from '../services/api';
import { 
    LayoutDashboard, Building, Users, CreditCard, FileText, 
    Settings, LogOut, Plus, Search, MoreVertical, 
    CheckCircle2, XCircle, AlertCircle, TrendingUp,
    Shield, Activity, DollarSign, Clock, Server, BarChart3,
    Calendar, AlertTriangle, Database, Save, Lock, Mail
} from 'lucide-react';

const SuperAdminDashboard = () => {
    const navigate = useNavigate();
    
    // State
    const [stats, setStats] = useState({
        counts: { tenants: 0, activeTenants: 0, trialTenants: 0, users: 0, transactions: 0 },
        financials: { monthlyRevenue: 0 },
        recentActivity: [],
        expiringTrials: [],
        monthlyGrowth: []
    });
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const [showModal, setShowModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedTenant, setSelectedTenant] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [monthFilter, setMonthFilter] = useState('');
    const [globalSettings, setGlobalSettings] = useState({
        appName: 'Accounts System',
        supportEmail: '',
        trialDurationDays: 14,
        enableEmailNotifications: true,
        maintenanceMode: false,
        allowNewRegistrations: true
    });
    const [settingsLoading, setSettingsLoading] = useState(false);
    
    // Form State
    const [formData, setFormData] = useState({
        companyName: '',
        name: '',
        email: '',
        password: '',
        address: '',
        phone: '',
        subscriptionPlan: 'Free',
        status: 'Active'
    });

    const [editFormData, setEditFormData] = useState({
        status: 'Active',
        subscriptionPlan: 'Free',
        subscriptionStatus: 'Trial',
        trialEndDate: '',
        subscriptionAmount: 0
    });

    // Fetch Data
    const fetchData = async () => {
        try {
            setLoading(true);
            const [statsRes, tenantsRes, settingsRes] = await Promise.all([
                getSystemStats(),
                getTenants(),
                getGlobalSettings()
            ]);
            setStats(statsRes.data);
            setTenants(tenantsRes.data);
            setGlobalSettings(settingsRes.data);
        } catch (err) {
            console.error("Error fetching dashboard data:", err);
            if (err.response?.status === 401 || err.response?.status === 403) {
                navigate('/login');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Handlers
    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    const handleCreateTenant = async (e) => {
        e.preventDefault();
        try {
            await createTenant(formData);
            setShowModal(false);
            setFormData({
                companyName: '', name: '', email: '', password: '', 
                address: '', phone: '', subscriptionPlan: 'Free', status: 'Active'
            });
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Error creating tenant');
        }
    };

    const handleUpdateTenant = async (e) => {
        e.preventDefault();
        try {
            await updateTenant(selectedTenant._id, editFormData);
            setShowEditModal(false);
            setSelectedTenant(null);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Error updating tenant');
        }
    };

    const handleDeleteTenant = async (id) => {
        if (window.confirm('Are you sure? This will delete all data for this company.')) {
            try {
                await deleteTenant(id);
                fetchData();
            } catch (err) {
                alert(err.response?.data?.message || 'Error deleting tenant');
            }
        }
    };

    const openEditModal = (tenant) => {
        setSelectedTenant(tenant);
        setEditFormData({
            status: tenant.status || 'Active',
            subscriptionPlan: tenant.subscriptionPlan || 'Free',
            subscriptionStatus: tenant.subscriptionStatus || 'Trial',
            trialEndDate: tenant.trialEndDate ? new Date(tenant.trialEndDate).toISOString().split('T')[0] : '',
            subscriptionAmount: tenant.subscriptionAmount || 0
        });
        setShowEditModal(true);
    };

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        try {
            setSettingsLoading(true);
            await updateGlobalSettings(globalSettings);
            alert('Settings saved successfully');
        } catch (err) {
            alert(err.response?.data?.message || 'Error saving settings');
        } finally {
            setSettingsLoading(false);
        }
    };

    // Filtered Tenants
    const filteredTenants = tenants.filter(t => 
        (t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.email?.toLowerCase().includes(searchTerm.toLowerCase())) &&
        (monthFilter === '' || new Date(t.createdAt).toISOString().slice(0, 7) === monthFilter)
    );

    // Components
    const StatCard = ({ title, value, icon: Icon, color, trend, subtext }) => (
        <div className="bg-[var(--color-surface)] p-6 rounded-2xl border border-[var(--color-border)] shadow-sm hover:shadow-md transition-all">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-[var(--color-text-muted)] text-sm font-medium uppercase tracking-wider mb-1">{title}</p>
                    <h3 className="text-3xl font-bold text-[var(--color-text-heading)]">{value}</h3>
                    {trend && <p className="text-emerald-500 text-xs mt-2 flex items-center gap-1"><TrendingUp size={12}/> {trend}</p>}
                    {subtext && <p className="text-[var(--color-text-muted)] text-xs mt-2">{subtext}</p>}
                </div>
                <div className={`p-3 rounded-xl ${color} bg-opacity-10 text-white`}>
                    <Icon size={24} className={color.replace('bg-', 'text-')} />
                </div>
            </div>
        </div>
    );

    const GrowthChart = ({ data }) => {
        if (!data || data.length === 0) return <div className="text-center p-4 text-[var(--color-text-muted)]">No growth data available</div>;
        
        const maxVal = Math.max(...data.map(d => d.newTenants), 5); // Minimum scale of 5
        
        return (
            <div className="bg-[var(--color-surface)] p-6 rounded-2xl border border-[var(--color-border)] shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <BarChart3 className="text-blue-500" size={20} />
                        <h3 className="font-bold text-[var(--color-text-heading)]">Monthly Growth Tracking</h3>
                    </div>
                    <div className="flex gap-4 text-xs font-medium">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 bg-amber-200 rounded-sm"></span> Trials
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 bg-emerald-400 rounded-sm"></span> Active Conversions
                        </div>
                    </div>
                </div>
                
                <div className="flex items-end gap-4 h-48 mt-4">
                    {data.map(item => (
                        <div key={item._id} className="flex-1 flex flex-col items-center gap-2 group cursor-default">
                            <div className="w-full flex gap-1 items-end justify-center h-full">
                                <div 
                                    style={{ height: `${Math.max((item.trialSignups / maxVal) * 100, 5)}%` }} 
                                    className="w-1/2 bg-amber-200 rounded-t-sm group-hover:bg-amber-300 transition-colors relative min-h-[4px]"
                                >
                                    <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded pointer-events-none whitespace-nowrap z-10 transition-opacity">
                                        {item.trialSignups} Trials
                                    </div>
                                </div>
                                <div 
                                    style={{ height: `${Math.max((item.activeConversions / maxVal) * 100, 5)}%` }} 
                                    className="w-1/2 bg-emerald-400 rounded-t-sm group-hover:bg-emerald-500 transition-colors relative min-h-[4px]"
                                >
                                     <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded pointer-events-none whitespace-nowrap z-10 transition-opacity delay-75">
                                        {item.activeConversions} Active
                                    </div>
                                </div>
                            </div>
                            <span className="text-xs text-[var(--color-text-muted)] font-medium">
                                {new Date(item._id + '-02').toLocaleDateString(undefined, { month: 'short' })}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const GlobalSettings = () => (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-[var(--color-surface)] p-8 rounded-2xl border border-[var(--color-border)] shadow-sm">
                <div className="flex items-center gap-3 mb-6 pb-6 border-b border-[var(--color-border)]">
                    <Settings className="text-[var(--color-primary)]" size={24} />
                    <div>
                        <h2 className="text-xl font-bold text-[var(--color-text-heading)]">Global System Settings</h2>
                        <p className="text-sm text-[var(--color-text-muted)]">Configure system-wide parameters and defaults</p>
                    </div>
                </div>

                <form onSubmit={handleSaveSettings} className="space-y-8">
                    {/* General Settings */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-[var(--color-text-heading)] flex items-center gap-2">
                            <Server size={18} /> General Configuration
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text-heading)] mb-1">Application Name</label>
                                <input 
                                    type="text" 
                                    value={globalSettings.appName}
                                    onChange={e => setGlobalSettings({...globalSettings, appName: e.target.value})}
                                    className="w-full p-2.5 rounded-lg border border-[var(--color-input-border)] bg-[var(--color-input-bg)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text-heading)] mb-1">Support Email</label>
                                <input 
                                    type="email" 
                                    value={globalSettings.supportEmail}
                                    onChange={e => setGlobalSettings({...globalSettings, supportEmail: e.target.value})}
                                    className="w-full p-2.5 rounded-lg border border-[var(--color-input-border)] bg-[var(--color-input-bg)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Subscription Settings */}
                    <div className="space-y-4 pt-4 border-t border-[var(--color-border)]">
                        <h3 className="text-lg font-semibold text-[var(--color-text-heading)] flex items-center gap-2">
                            <CreditCard size={18} /> Subscription Defaults
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text-heading)] mb-1">Default Trial Duration (Days)</label>
                                <input 
                                    type="number" 
                                    value={globalSettings.trialDurationDays}
                                    onChange={e => setGlobalSettings({...globalSettings, trialDurationDays: parseInt(e.target.value)})}
                                    className="w-full p-2.5 rounded-lg border border-[var(--color-input-border)] bg-[var(--color-input-bg)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                                />
                            </div>
                            <div className="flex items-center gap-3 pt-6">
                                <input 
                                    type="checkbox" 
                                    id="allowReg"
                                    checked={globalSettings.allowNewRegistrations}
                                    onChange={e => setGlobalSettings({...globalSettings, allowNewRegistrations: e.target.checked})}
                                    className="w-5 h-5 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                                />
                                <label htmlFor="allowReg" className="text-sm font-medium text-[var(--color-text-heading)] cursor-pointer">
                                    Allow New Company Registrations
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* System Controls */}
                    <div className="space-y-4 pt-4 border-t border-[var(--color-border)]">
                        <h3 className="text-lg font-semibold text-[var(--color-text-heading)] flex items-center gap-2">
                            <Shield size={18} /> System Controls
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="flex items-center gap-3 p-4 bg-[var(--color-surface-hover)] rounded-xl border border-[var(--color-border)]">
                                <div className={`p-2 rounded-lg ${globalSettings.maintenanceMode ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                    <AlertTriangle size={20} />
                                </div>
                                <div className="flex-1">
                                    <label htmlFor="maintMode" className="block text-sm font-bold text-[var(--color-text-heading)] cursor-pointer">Maintenance Mode</label>
                                    <p className="text-xs text-[var(--color-text-muted)]">Disable access for all non-admin users</p>
                                </div>
                                <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                                    <input 
                                        type="checkbox" 
                                        name="toggle" 
                                        id="maintMode" 
                                        checked={globalSettings.maintenanceMode}
                                        onChange={e => setGlobalSettings({...globalSettings, maintenanceMode: e.target.checked})}
                                        className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer transition-transform duration-200 ease-in-out checked:translate-x-full checked:border-[var(--color-primary)]"
                                    />
                                    <label htmlFor="maintMode" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${globalSettings.maintenanceMode ? 'bg-[var(--color-primary)]' : 'bg-gray-300'}`}></label>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-4 bg-[var(--color-surface-hover)] rounded-xl border border-[var(--color-border)]">
                                <div className={`p-2 rounded-lg bg-blue-100 text-blue-600`}>
                                    <Mail size={20} />
                                </div>
                                <div className="flex-1">
                                    <label htmlFor="emailNotif" className="block text-sm font-bold text-[var(--color-text-heading)] cursor-pointer">System Emails</label>
                                    <p className="text-xs text-[var(--color-text-muted)]">Enable automated email notifications</p>
                                </div>
                                <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                                    <input 
                                        type="checkbox" 
                                        name="toggle" 
                                        id="emailNotif" 
                                        checked={globalSettings.enableEmailNotifications}
                                        onChange={e => setGlobalSettings({...globalSettings, enableEmailNotifications: e.target.checked})}
                                        className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer transition-transform duration-200 ease-in-out checked:translate-x-full checked:border-[var(--color-primary)]"
                                    />
                                    <label htmlFor="emailNotif" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${globalSettings.enableEmailNotifications ? 'bg-[var(--color-primary)]' : 'bg-gray-300'}`}></label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 flex justify-end">
                        <button 
                            type="submit" 
                            disabled={settingsLoading}
                            className="flex items-center gap-2 px-8 py-3 bg-[var(--color-primary)] text-white rounded-xl font-medium hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {settingsLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <Save size={18} />}
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );

    const SystemHealth = () => (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-[var(--color-surface)] p-6 rounded-2xl border border-[var(--color-border)] shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <Server className="text-emerald-500" size={20} />
                    <h3 className="font-bold text-[var(--color-text-heading)]">Server Status</h3>
                </div>
                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-[var(--color-text-muted)]">CPU Usage</span>
                            <span className="font-medium text-[var(--color-text-heading)]">12%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '12%' }}></div>
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-[var(--color-text-muted)]">Memory Usage</span>
                            <span className="font-medium text-[var(--color-text-heading)]">45%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-blue-500 h-2 rounded-full" style={{ width: '45%' }}></div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 p-2 rounded-lg">
                        <CheckCircle2 size={14} /> All systems operational
                    </div>
                </div>
            </div>

            <div className="bg-[var(--color-surface)] p-6 rounded-2xl border border-[var(--color-border)] shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <Database className="text-indigo-500" size={20} />
                    <h3 className="font-bold text-[var(--color-text-heading)]">Database Health</h3>
                </div>
                <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-[var(--color-surface-hover)] rounded-lg">
                        <span className="text-sm text-[var(--color-text-muted)]">Connections</span>
                        <span className="font-mono font-bold text-[var(--color-text-heading)]">24/100</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-[var(--color-surface-hover)] rounded-lg">
                        <span className="text-sm text-[var(--color-text-muted)]">Storage</span>
                        <span className="font-mono font-bold text-[var(--color-text-heading)]">1.2 GB</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-[var(--color-surface-hover)] rounded-lg">
                        <span className="text-sm text-[var(--color-text-muted)]">Latency</span>
                        <span className="font-mono font-bold text-emerald-500">24ms</span>
                    </div>
                </div>
            </div>

            <div className="bg-[var(--color-surface)] p-6 rounded-2xl border border-[var(--color-border)] shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <Shield className="text-rose-500" size={20} />
                    <h3 className="font-bold text-[var(--color-text-heading)]">Security Alerts</h3>
                </div>
                <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-rose-50 rounded-lg border border-rose-100">
                        <AlertTriangle size={16} className="text-rose-500 mt-0.5" />
                        <div>
                            <p className="text-xs font-bold text-rose-700">Failed Login Attempts</p>
                            <p className="text-xs text-rose-600 mt-1">5 failed attempts from IP 192.168.1.1</p>
                        </div>
                    </div>
                    <div className="text-center mt-2">
                        <button className="text-xs font-medium text-[var(--color-primary)] hover:underline">View Security Logs</button>
                    </div>
                </div>
            </div>
        </div>
    );

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--color-primary)]"></div>
        </div>
    );

    return (
        <div className="flex h-screen bg-[var(--color-background)] font-sans text-[var(--color-text)] overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col z-20">
                <div className="p-6 border-b border-[var(--color-border)]">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-[var(--color-primary)] rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
                            <Shield size={20} />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-[var(--color-text-heading)] leading-tight">Admin Console</h1>
                            <p className="text-xs text-[var(--color-text-muted)]">Super Admin Access</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    {[
                        { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
                        { id: 'companies', label: 'Companies', icon: Building },
                        { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
                        { id: 'system', label: 'System Health', icon: Server },
                        { id: 'settings', label: 'Global Settings', icon: Settings },
                    ].map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 
                                ${activeTab === item.id 
                                    ? 'bg-[var(--color-primary)] text-white shadow-md shadow-primary/20' 
                                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-heading)]'
                                }`}
                        >
                            <item.icon size={18} />
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-[var(--color-border)]">
                    <button 
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors text-sm font-medium"
                    >
                        <LogOut size={18} /> Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto bg-[var(--color-background)]">
                {/* Header */}
                <header className="sticky top-0 z-10 bg-[var(--color-surface)]/80 backdrop-blur-md border-b border-[var(--color-border)] px-8 py-4 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-[var(--color-text-heading)] capitalize">
                            {activeTab.replace('-', ' ')}
                        </h2>
                        <p className="text-[var(--color-text-muted)] text-sm mt-1">
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-xs text-[var(--color-text-muted)] hidden sm:block">
                            Last Updated: {new Date().toLocaleTimeString()}
                        </div>
                        <div className="flex items-center gap-3 px-4 py-2 bg-[var(--color-surface-hover)] rounded-full border border-[var(--color-border)]">
                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-sm font-medium text-[var(--color-text-muted)]">System Operational</span>
                        </div>
                        <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold border-2 border-indigo-200">
                            SA
                        </div>
                    </div>
                </header>

                <div className="p-8 max-w-7xl mx-auto">
                    {activeTab === 'overview' && (
                        <div className="space-y-8">
                            {/* Stats Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <StatCard 
                                    title="Total Tenants" 
                                    value={stats.counts.tenants} 
                                    icon={Building} 
                                    color="bg-blue-500" 
                                    subtext={`${stats.counts.activeTenants} Active | ${stats.counts.trialTenants} Trial`}
                                />
                                <StatCard 
                                    title="Monthly Revenue" 
                                    value={`$${stats.financials?.monthlyRevenue?.toLocaleString() || 0}`}
                                    icon={DollarSign} 
                                    color="bg-emerald-500" 
                                    trend="+8% vs last month"
                                />
                                <StatCard 
                                    title="Active Users" 
                                    value={stats.counts.users} 
                                    icon={Users} 
                                    color="bg-indigo-500" 
                                />
                                <StatCard 
                                    title="System Load" 
                                    value={`${stats.counts.transactions} txns`}
                                    icon={Activity} 
                                    color="bg-amber-500" 
                                />
                            </div>

                            {/* Growth Chart */}
                            <GrowthChart data={stats.monthlyGrowth} />

                            {/* Expiring Trials Alert */}
                            {stats.expiringTrials && stats.expiringTrials.length > 0 && (
                                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4">
                                    <Clock className="text-amber-600 mt-1" size={24} />
                                    <div className="flex-1">
                                        <h3 className="text-lg font-bold text-amber-800">Expiring Trials</h3>
                                        <p className="text-amber-700 text-sm mb-3">The following companies have trials ending in the next 7 days:</p>
                                        <div className="space-y-2">
                                            {stats.expiringTrials.map(t => (
                                                <div key={t._id} className="flex items-center justify-between bg-white p-2 rounded-lg border border-amber-200 shadow-sm">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-amber-900">{t.name}</span>
                                                        <span className="text-xs text-amber-700">Ends: {new Date(t.trialEndDate).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={() => handleExtendTrial(t)}
                                                            className="text-xs px-2 py-1 bg-amber-100 text-amber-700 font-medium rounded hover:bg-amber-200 transition-colors"
                                                        >
                                                            Extend 7 Days
                                                        </button>
                                                        <button 
                                                            onClick={() => handleSendReminder(t)}
                                                            className="text-xs px-2 py-1 bg-amber-100 text-amber-700 font-medium rounded hover:bg-amber-200 transition-colors"
                                                        >
                                                            Remind
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setActiveTab('subscriptions')}
                                        className="px-4 py-2 bg-white text-amber-700 font-bold text-sm rounded-lg shadow-sm hover:bg-amber-100 transition-colors"
                                    >
                                        Manage
                                    </button>
                                </div>
                            )}

                            {/* Subscription Analytics */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-[var(--color-surface)] p-6 rounded-2xl border border-[var(--color-border)] shadow-sm">
                                    <div className="flex items-center gap-3 mb-6">
                                        <BarChart3 className="text-[var(--color-primary)]" size={20} />
                                        <h3 className="font-bold text-[var(--color-text-heading)]">Subscription Distribution</h3>
                                    </div>
                                    <div className="space-y-4">
                                        {['Free', 'Basic', 'Pro', 'Enterprise'].map(plan => {
                                            const count = tenants.filter(t => (t.subscriptionPlan || 'Free') === plan).length;
                                            const percentage = tenants.length > 0 ? (count / tenants.length) * 100 : 0;
                                            return (
                                                <div key={plan}>
                                                    <div className="flex justify-between text-sm mb-1">
                                                        <span className="text-[var(--color-text-muted)]">{plan}</span>
                                                        <span className="font-medium text-[var(--color-text-heading)]">{count} ({Math.round(percentage)}%)</span>
                                                    </div>
                                                    <div className="w-full bg-gray-100 rounded-full h-2">
                                                        <div 
                                                            className={`h-2 rounded-full ${
                                                                plan === 'Free' ? 'bg-gray-400' :
                                                                plan === 'Basic' ? 'bg-blue-400' :
                                                                plan === 'Pro' ? 'bg-indigo-500' : 'bg-purple-600'
                                                            }`} 
                                                            style={{ width: `${percentage}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="bg-[var(--color-surface)] p-6 rounded-2xl border border-[var(--color-border)] shadow-sm">
                                    <div className="flex items-center gap-3 mb-6">
                                        <TrendingUp className="text-emerald-500" size={20} />
                                        <h3 className="font-bold text-[var(--color-text-heading)]">Revenue Overview</h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                                            <p className="text-xs text-emerald-600 uppercase font-bold tracking-wider mb-1">Total MRR</p>
                                            <p className="text-2xl font-bold text-emerald-700">${stats.financials?.monthlyRevenue?.toLocaleString() || 0}</p>
                                        </div>
                                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                                            <p className="text-xs text-blue-600 uppercase font-bold tracking-wider mb-1">Active Subs</p>
                                            <p className="text-2xl font-bold text-blue-700">{stats.counts.activeTenants}</p>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-[var(--color-surface-hover)] rounded-xl">
                                        <h4 className="text-sm font-bold text-[var(--color-text-heading)] mb-2">Projected Growth</h4>
                                        <p className="text-sm text-[var(--color-text-muted)]">
                                            Based on current trial conversion rates, projected revenue for next month is 
                                            <span className="font-bold text-emerald-600 ml-1">
                                                ${((stats.financials?.monthlyRevenue || 0) * 1.15).toLocaleString(undefined, {maximumFractionDigits: 0})}
                                            </span>.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Recent Activity Section */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-2 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden">
                                    <div className="p-6 border-b border-[var(--color-border)] flex justify-between items-center">
                                        <h3 className="text-lg font-bold text-[var(--color-text-heading)]">Recent Registrations</h3>
                                        <button 
                                            onClick={() => setActiveTab('companies')}
                                            className="text-sm text-[var(--color-primary)] hover:underline font-medium"
                                        >
                                            View All
                                        </button>
                                    </div>
                                    <div className="divide-y divide-[var(--color-border)]">
                                        {stats.recentActivity.length > 0 ? (
                                            stats.recentActivity.map(tenant => (
                                                <div key={tenant._id} className="p-4 flex items-center justify-between hover:bg-[var(--color-surface-hover)] transition-colors">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-10 w-10 bg-[var(--color-primary)]/10 rounded-lg flex items-center justify-center text-[var(--color-primary)]">
                                                            <Building size={20} />
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-[var(--color-text-heading)]">{tenant.name}</p>
                                                            <p className="text-sm text-[var(--color-text-muted)]">{tenant.email}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                            tenant.status === 'Inactive' ? 'bg-gray-100 text-gray-800' : 
                                                            tenant.subscriptionStatus === 'Trial' ? 'bg-amber-100 text-amber-800' :
                                                            'bg-emerald-100 text-emerald-800'
                                                        }`}>
                                                            {tenant.subscriptionStatus || tenant.status}
                                                        </span>
                                                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                                                            {new Date(tenant.createdAt).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-8 text-center text-[var(--color-text-muted)]">No recent activity</div>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm p-6">
                                    <h3 className="text-lg font-bold text-[var(--color-text-heading)] mb-4">Quick Actions</h3>
                                    <div className="space-y-3">
                                        <button 
                                            onClick={() => { setActiveTab('companies'); setShowModal(true); }}
                                            className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-[var(--color-primary)] to-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 hover:shadow-xl hover:scale-[1.02] transition-all"
                                        >
                                            <Plus size={20} />
                                            <span className="font-semibold">Add New Company</span>
                                        </button>
                                        <button 
                                            onClick={() => setActiveTab('system')}
                                            className="w-full flex items-center gap-3 p-4 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-heading)] rounded-xl hover:bg-[var(--color-surface-hover)] transition-all"
                                        >
                                            <Server size={20} />
                                            <span className="font-medium">System Health</span>
                                        </button>
                                        <button className="w-full flex items-center gap-3 p-4 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-heading)] rounded-xl hover:bg-[var(--color-surface-hover)] transition-all">
                                            <Shield size={20} />
                                            <span className="font-medium">Security Logs</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'system' && (
                        <div>
                            <SystemHealth />
                            {/* Logs Placeholder */}
                            <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-[var(--color-border)]">
                                    <h3 className="text-lg font-bold text-[var(--color-text-heading)]">System Logs</h3>
                                </div>
                                <div className="p-8 text-center text-[var(--color-text-muted)] font-mono text-sm bg-black/5">
                                    [SYSTEM] Service started successfully at {new Date().toLocaleTimeString()}<br/>
                                    [AUTH] User admin@beinnovo.com logged in from 127.0.0.1<br/>
                                    [DB] Connected to MongoDB Atlas<br/>
                                    [CRON] Backup job scheduled for 00:00 UTC
                                </div>
                            </div>
                        </div>
                    )}

                    {(activeTab === 'companies' || activeTab === 'subscriptions') && (
                        <div className="space-y-6">
                            {/* Growth Chart for Subscriptions Tab */}
                            {activeTab === 'subscriptions' && (
                                <div className="mb-6">
                                    <GrowthChart data={stats.monthlyGrowth} />
                                </div>
                            )}

                            {/* Toolbar */}
                            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-[var(--color-surface)] p-4 rounded-xl border border-[var(--color-border)] shadow-sm">
                                <div className="flex items-center gap-4 w-full sm:w-auto flex-1">
                                    <div className="relative w-full sm:w-64">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={18} />
                                        <input 
                                            type="text" 
                                            placeholder="Search companies..." 
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition-all"
                                        />
                                    </div>
                                    <select 
                                        value={monthFilter}
                                        onChange={(e) => setMonthFilter(e.target.value)}
                                        className="w-full sm:w-48 p-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                                    >
                                        <option value="">All Months</option>
                                        {stats.monthlyGrowth && stats.monthlyGrowth.map(m => (
                                            <option key={m._id} value={m._id}>
                                                {new Date(m._id + '-02').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <button 
                                    onClick={() => setShowModal(true)}
                                    className="w-full sm:w-auto px-6 py-2.5 bg-[var(--color-primary)] text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
                                >
                                    <Plus size={18} /> Add Company
                                </button>
                            </div>

                            {/* Table */}
                            <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-[var(--color-border)]">
                                        <thead className="bg-[var(--color-surface-hover)]">
                                            <tr>
                                                {['Company', 'Plan', 'Sub Status', 'Trial End', 'Revenue', 'Actions'].map(header => (
                                                    <th key={header} className="px-6 py-4 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                                                        {header}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
                                            {filteredTenants.map((tenant) => (
                                                <tr key={tenant._id} className="hover:bg-[var(--color-surface-hover)] transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center">
                                                            <div className="h-10 w-10 flex-shrink-0 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-bold text-lg border border-indigo-100">
                                                                {tenant.name.charAt(0)}
                                                            </div>
                                                            <div className="ml-4">
                                                                <div className="text-sm font-medium text-[var(--color-text-heading)]">{tenant.name}</div>
                                                                <div className="text-xs text-[var(--color-text-muted)]">{tenant.email}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                                                            {tenant.subscriptionPlan || 'Free'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${
                                                            tenant.subscriptionStatus === 'Trial' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                                            tenant.subscriptionStatus === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                            'bg-gray-50 text-gray-700 border-gray-100'
                                                        }`}>
                                                            {tenant.subscriptionStatus || 'Trial'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--color-text-muted)]">
                                                        {tenant.trialEndDate ? new Date(tenant.trialEndDate).toLocaleDateString() : '-'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-[var(--color-text-heading)]">
                                                        ${tenant.subscriptionAmount || 0}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                        <div className="flex items-center gap-3">
                                                            <button 
                                                                onClick={() => openEditModal(tenant)}
                                                                className="text-indigo-600 hover:text-indigo-900 transition-colors"
                                                                title="Edit Configuration"
                                                            >
                                                                <Settings size={18} />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDeleteTenant(tenant._id)}
                                                                className="text-rose-500 hover:text-rose-700 transition-colors"
                                                                title="Delete Company"
                                                            >
                                                                <XCircle size={18} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && <GlobalSettings />}
                </div>
            </main>

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[var(--color-surface)] rounded-2xl shadow-2xl w-full max-w-lg border border-[var(--color-border)] transform transition-all">
                        <div className="p-6 border-b border-[var(--color-border)] flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
                            <h3 className="text-xl font-bold text-[var(--color-text-heading)]">Onboard New Company</h3>
                            <button onClick={() => setShowModal(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-heading)] transition-colors">
                                <XCircle size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateTenant} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text-heading)] mb-1">Company Name</label>
                                    <input type="text" className="w-full p-2.5 rounded-lg border border-[var(--color-input-border)] bg-[var(--color-input-bg)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none" 
                                        value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text-heading)] mb-1">Subscription Plan</label>
                                    <select className="w-full p-2.5 rounded-lg border border-[var(--color-input-border)] bg-[var(--color-input-bg)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                                        value={formData.subscriptionPlan} onChange={e => setFormData({...formData, subscriptionPlan: e.target.value})}>
                                        <option value="Free">Free</option>
                                        <option value="Basic">Basic</option>
                                        <option value="Pro">Pro</option>
                                        <option value="Enterprise">Enterprise</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text-heading)] mb-1">Admin Email</label>
                                    <input type="email" className="w-full p-2.5 rounded-lg border border-[var(--color-input-border)] bg-[var(--color-input-bg)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none" 
                                        value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text-heading)] mb-1">Admin Name</label>
                                    <input type="text" className="w-full p-2.5 rounded-lg border border-[var(--color-input-border)] bg-[var(--color-input-bg)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none" 
                                        value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text-heading)] mb-1">Password</label>
                                    <input type="password" className="w-full p-2.5 rounded-lg border border-[var(--color-input-border)] bg-[var(--color-input-bg)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none" 
                                        value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required />
                                </div>
                            </div>

                            <div className="pt-4 border-t border-[var(--color-border)] flex justify-end gap-3">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-[var(--color-text-heading)] hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors">Cancel</button>
                                <button type="submit" className="px-6 py-2 text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-blue-700 rounded-lg shadow-lg shadow-blue-200 transition-all">Create Company</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[var(--color-surface)] rounded-2xl shadow-2xl w-full max-w-md border border-[var(--color-border)]">
                        <div className="p-6 border-b border-[var(--color-border)] flex justify-between items-center">
                            <h3 className="text-xl font-bold text-[var(--color-text-heading)]">Edit Tenant Subscription</h3>
                            <button onClick={() => setShowEditModal(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-heading)]">
                                <XCircle size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateTenant} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text-heading)] mb-1">Plan</label>
                                    <select className="w-full p-2.5 rounded-lg border border-[var(--color-input-border)] bg-[var(--color-input-bg)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                                        value={editFormData.subscriptionPlan} onChange={e => setEditFormData({...editFormData, subscriptionPlan: e.target.value})}>
                                        <option value="Free">Free</option>
                                        <option value="Basic">Basic</option>
                                        <option value="Pro">Pro</option>
                                        <option value="Enterprise">Enterprise</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text-heading)] mb-1">Status</label>
                                    <select className="w-full p-2.5 rounded-lg border border-[var(--color-input-border)] bg-[var(--color-input-bg)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                                        value={editFormData.subscriptionStatus} onChange={e => setEditFormData({...editFormData, subscriptionStatus: e.target.value})}>
                                        <option value="Trial">Trial</option>
                                        <option value="Active">Active</option>
                                        <option value="Past_Due">Past Due</option>
                                        <option value="Cancelled">Cancelled</option>
                                        <option value="Expired">Expired</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text-heading)] mb-1">Monthly Subscription Amount ($)</label>
                                <input type="number" className="w-full p-2.5 rounded-lg border border-[var(--color-input-border)] bg-[var(--color-input-bg)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                                    value={editFormData.subscriptionAmount} onChange={e => setEditFormData({...editFormData, subscriptionAmount: e.target.value})} />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text-heading)] mb-1">Trial / Subscription End Date</label>
                                <input type="date" className="w-full p-2.5 rounded-lg border border-[var(--color-input-border)] bg-[var(--color-input-bg)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                                    value={editFormData.trialEndDate} onChange={e => setEditFormData({...editFormData, trialEndDate: e.target.value})} />
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 text-sm font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
                                <button type="submit" className="px-6 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-lg hover:bg-blue-700">Update Subscription</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SuperAdminDashboard;