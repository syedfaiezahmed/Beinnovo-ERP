import React, { useState, useEffect, useRef } from 'react';
import { 
  Search as LuSearch, 
  Bell as LuBell, 
  HelpCircle as LuHelpCircle, 
  ChevronDown as LuChevronDown, 
  Menu as LuMenu, 
  LogOut as LuLogOut,
  User as LuUser,
  Settings as LuSettings,
  Command as LuCommand,
  Sun as LuSun,
  Moon as LuMoon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

const Navbar = () => {
  const { theme, toggleTheme } = useTheme();
  const [user] = useState(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        return { name: 'User', role: 'Guest' };
      }
    }
    return { name: 'User', role: 'Guest' };
  });

  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Click outside to close
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const getInitials = (name) => {
    return name ? name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : 'U';
  };

  return (
    <header className="bg-[var(--color-surface)]/80 backdrop-blur-xl border-b border-[var(--color-border)] h-11 flex items-center justify-between px-3 z-50 sticky top-0 transition-colors duration-300">
      {/* Search Area */}
      <div className="flex items-center gap-3 flex-1 max-w-2xl">
        <button className="text-[var(--color-text-muted)] hover:text-primary lg:hidden transition-colors">
            <LuMenu className="text-lg" />
        </button>
        <div className="relative group w-full max-w-sm hidden md:block">
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-primary transition-colors">
              <LuSearch size={12} />
            </div>
            <input 
                type="text" 
                placeholder="Search anything..." 
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] focus:bg-[var(--color-input-bg)] focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-xs outline-none placeholder:text-[var(--color-text-muted)] text-[var(--color-text)]" 
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
              <span className="text-xs bg-[var(--color-surface)] text-[var(--color-text-muted)] px-1 py-0.5 rounded border border-[var(--color-border)] font-mono shadow-sm flex items-center gap-0.5">
                <LuCommand size={9} /> K
              </span>
            </div>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <button 
          onClick={toggleTheme}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text-heading)] hover:bg-[var(--color-surface-hover)] transition-all p-1.5 rounded-lg border border-transparent hover:border-[var(--color-border)]"
        >
            {theme === 'dark' ? <LuSun size={14} /> : <LuMoon size={14} />}
        </button>

        {/* Notifications */}
        <button className="relative text-[var(--color-text-muted)] hover:text-[var(--color-text-heading)] hover:bg-[var(--color-surface-hover)] transition-all p-1.5 rounded-lg group border border-transparent hover:border-[var(--color-border)]">
            <LuBell size={14} />
            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 bg-danger rounded-full border border-[var(--color-background)] group-hover:scale-110 transition-transform shadow-lg shadow-danger/50"></span>
        </button>
        
        {/* Help */}
        <button className="text-[var(--color-text-muted)] hover:text-[var(--color-text-heading)] hover:bg-[var(--color-surface-hover)] transition-all p-1.5 rounded-lg hidden sm:block border border-transparent hover:border-[var(--color-border)]">
            <LuHelpCircle size={14} />
        </button>

        <div className="h-5 w-px bg-[var(--color-border)] mx-1 hidden sm:block"></div>
        
        {/* Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
            <button 
                className={`flex items-center gap-2 p-1 pr-2 rounded-lg transition-all border ${showDropdown ? 'bg-[var(--color-surface-hover)] border-[var(--color-border)] shadow-lg' : 'border-transparent hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-border)]'}`}
                onClick={() => setShowDropdown(!showDropdown)}
            >
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-secondary text-white flex items-center justify-center font-bold shadow-lg shadow-primary/20 text-xs">
                    {getInitials(user.name)}
                </div>
                <div className="hidden md:block text-left">
                    <p className="text-xs font-bold text-[var(--color-text-heading)] leading-none mb-0.5">{user.name}</p>
                    <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] font-semibold leading-none">{user.role}</p>
                </div>
                <LuChevronDown className={`text-[var(--color-text-muted)] text-xs ml-0.5 transition-transform duration-200 ${showDropdown ? 'rotate-180 text-[var(--color-text-heading)]' : ''}`} size={12} />
            </button>

            {/* Dropdown Menu */}
            {showDropdown && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-[var(--color-surface)] rounded-2xl shadow-2xl border border-[var(--color-border)] animate-fade-in overflow-hidden z-[999] ring-1 ring-white/5">
                    <div className="p-4 border-b border-[var(--color-border)] bg-[var(--color-surface-hover)]/50">
                        <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Account</p>
                        <p className="text-sm font-medium text-[var(--color-text)] truncate">{user.email || 'user@example.com'}</p>
                    </div>
                    <div className="p-2 space-y-1">
                        <button className="w-full text-left px-3 py-2.5 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-heading)] rounded-xl flex items-center gap-3 transition-colors font-medium">
                            <LuUser size={16} /> Profile
                        </button>
                        <button className="w-full text-left px-3 py-2.5 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-heading)] rounded-xl flex items-center gap-3 transition-colors font-medium">
                            <LuSettings size={16} /> Settings
                        </button>
                    </div>
                    <div className="h-px bg-[var(--color-border)] my-1 mx-3"></div>
                    <div className="p-2 pb-2">
                        <button 
                            onClick={handleLogout}
                            className="w-full text-left px-3 py-2.5 text-sm text-danger hover:bg-danger/10 hover:text-danger-light rounded-xl flex items-center gap-3 transition-colors font-medium"
                        >
                            <LuLogOut size={16} /> Logout
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
