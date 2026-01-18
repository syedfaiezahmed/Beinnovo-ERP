import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail as LuMail, Lock as LuLock, LogIn as LuLogIn, LayoutDashboard as LuLayoutDashboard, Wallet as LuWallet } from 'lucide-react';
import { login } from '../services/api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await login(email, password);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data)); // Save full user object including role

      // Sync tenant details to appSettings for frontend components
      if (data.tenant) {
        const settings = {
            companyName: data.tenant.name,
            companyAddress: data.tenant.address || '',
            companyPhone: data.tenant.phone || '',
            companyEmail: data.tenant.email || '',
        };
        // Merge with existing settings if any (to keep local preferences like theme)
        const existingSettings = JSON.parse(localStorage.getItem('appSettings') || '{}');
        localStorage.setItem('appSettings', JSON.stringify({ ...existingSettings, ...settings }));
      }

      if (data.role === 'super_admin') {
        navigate('/super-admin');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute -top-[30%] -right-[10%] w-[70%] h-[70%] rounded-full bg-primary/20 blur-[120px] animate-pulse"></div>
        <div className="absolute -bottom-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-secondary/20 blur-[100px] animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="card-base w-full max-w-[480px] p-10 shadow-2xl backdrop-blur-md bg-[var(--color-surface)]/90 border border-[var(--color-border)]/50 animate-fade-in relative z-10">
        <div className="text-center mb-10">
            <div className="inline-flex p-5 rounded-2xl bg-gradient-to-br from-primary to-secondary text-white mb-6 shadow-xl shadow-primary/30 transform hover:scale-105 transition-transform duration-300">
                <LuWallet size={32} strokeWidth={2.5} />
            </div>
            <h2 className="text-3xl font-black text-[var(--color-text-heading)] tracking-tight">Welcome Back</h2>
            <p className="text-[var(--color-text-muted)] mt-3 text-base font-medium">Sign in to your Beinnovo Enterprise account</p>
        </div>

        {error && (
            <div className="mb-8 p-4 bg-danger/10 text-danger text-sm rounded-xl border border-danger/20 flex items-center gap-3 animate-fade-in font-medium">
                <span className="w-2 h-2 rounded-full bg-danger shrink-0"></span>
                {error}
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider ml-1 mb-2">Email Address</label>
            <div className="relative group">
                <LuMail className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-primary transition-colors" size={22} />    
                
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-14 pr-4 py-4 rounded-xl bg-[var(--color-input-bg)] border border-[var(--color-input-border)] focus:bg-[var(--color-surface)] focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-base outline-none placeholder:text-[var(--color-text-muted)] font-medium text-[var(--color-text)]"
                    placeholder="name@company.com"
                    required
                />
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center ml-1 mb-2">
                <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Password</label>
                <a href="#" className="text-xs font-bold text-primary hover:text-primary-dark transition-colors">Forgot password?</a>
            </div>
            <div className="relative group">
                <LuLock className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-primary transition-colors pointer-events-none" size={22} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-14 pr-4 py-4 rounded-xl bg-[var(--color-input-bg)] border border-[var(--color-input-border)] focus:bg-[var(--color-surface)] focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-base outline-none placeholder:text-[var(--color-text-muted)] font-medium text-[var(--color-text)]"
                  placeholder="••••••••"
                  required
                />
            </div>
          </div>

          <div className="pt-4">
            <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 shadow-xl shadow-primary/25 hover:shadow-primary/40 text-sm font-bold tracking-wide"
            >
                {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                    <>
                        <LuLogIn size={20} />
                        <span>Sign In</span>
                    </>
                )}
            </button>
          </div>
        </form>
        
        <div className="mt-6 text-center text-xs font-medium text-[var(--color-text-muted)]">
            &copy; {new Date().getFullYear()} Beinnovo ERP System. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default Login;