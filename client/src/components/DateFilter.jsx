import React, { useState } from 'react';
import { Calendar as LuCalendar, ChevronDown as LuChevronDown } from 'lucide-react';

const DateFilter = ({ onFilterChange, className = "" }) => {
  const [period, setPeriod] = useState('thisMonth');
  const [showCustom, setShowCustom] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const periods = [
    { value: 'thisMonth', label: 'This Month' },
    { value: 'lastMonth', label: 'Last Month' },
    { value: 'thisQuarter', label: 'This Quarter' },
    { value: 'lastQuarter', label: 'Last Quarter' },
    { value: 'firstHalf', label: 'First Half Year' },
    { value: 'secondHalf', label: 'Second Half Year' },
    { value: 'thisYear', label: 'This Year' },
    { value: 'lastYear', label: 'Last Year' },
    { value: 'custom', label: 'Custom Range' },
  ];

  const handlePeriodChange = (e) => {
    const value = e.target.value;
    setPeriod(value);
    if (value === 'custom') {
      setShowCustom(true);
    } else {
      setShowCustom(false);
      if (onFilterChange) {
        onFilterChange({ period: value });
      }
    }
  };

  const handleCustomSubmit = () => {
    if (onFilterChange) {
      onFilterChange({ period: 'custom', startDate, endDate });
    }
  };

  return (
    <div className={`flex flex-wrap gap-1 items-center ${className}`}>
        <div className="relative group">
            <div className="flex items-center bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] px-3 py-2.5 shadow-sm hover:border-primary transition-colors cursor-pointer">
                <LuCalendar size={14} className="text-[var(--color-text-muted)] mr-2 group-hover:text-primary transition-colors" />
                <select 
                value={period} 
                onChange={handlePeriodChange}
                className="bg-transparent text-xs font-medium text-[var(--color-text)] focus:outline-none cursor-pointer appearance-none pr-4 w-28"
                >
                    {periods.map(p => (
                        <option key={p.value} value={p.value} className="bg-[var(--color-surface)] text-[var(--color-text)]">{p.label}</option>
                    ))}
                </select>
                <LuChevronDown size={14} className="absolute right-3 text-[var(--color-text-muted)] pointer-events-none group-hover:text-primary transition-colors" />
            </div>
        </div>

        {showCustom && (
            <div className="flex items-center gap-2 animate-fade-in">
                <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] rounded-lg px-3 py-2.5 text-xs focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none shadow-sm transition-all"
                />
                <span className="text-[var(--color-text-muted)] text-xs">-</span>
                <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] rounded-lg px-3 py-2.5 text-xs focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none shadow-sm transition-all"
                />
                <button 
                    onClick={handleCustomSubmit}
                    className="bg-primary text-white px-4 py-2.5 rounded-lg text-xs hover:bg-primary-dark font-medium shadow-md shadow-primary/20 transition-all active:scale-95"
                >
                Apply
                </button>
            </div>
        )}
    </div>
  );
};

export default DateFilter;
