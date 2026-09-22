import { ReactNode } from 'react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: { value: number; label: string };
  color?: 'indigo' | 'green' | 'amber' | 'red' | 'blue' | 'purple';
  size?: 'default' | 'large';
}

const colorMap = {
  indigo: { bg: 'bg-indigo-600/10', border: 'border-indigo-500/20', icon: 'text-indigo-400', text: 'text-indigo-300' },
  green: { bg: 'bg-emerald-600/10', border: 'border-emerald-500/20', icon: 'text-emerald-400', text: 'text-emerald-300' },
  amber: { bg: 'bg-amber-600/10', border: 'border-amber-500/20', icon: 'text-amber-400', text: 'text-amber-300' },
  red: { bg: 'bg-red-600/10', border: 'border-red-500/20', icon: 'text-red-400', text: 'text-red-300' },
  blue: { bg: 'bg-blue-600/10', border: 'border-blue-500/20', icon: 'text-blue-400', text: 'text-blue-300' },
  purple: { bg: 'bg-purple-600/10', border: 'border-purple-500/20', icon: 'text-purple-400', text: 'text-purple-300' },
};

export function KPICard({ title, value, subtitle, icon, trend, color = 'indigo', size = 'default' }: KPICardProps) {
  const c = colorMap[color];

  return (
    <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-5 hover:border-[#2d2d40] transition-colors">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</p>
        {icon && (
          <div className={`w-8 h-8 rounded-lg ${c.bg} border ${c.border} flex items-center justify-center ${c.icon}`}>
            {icon}
          </div>
        )}
      </div>

      <p className={`font-bold text-white ${size === 'large' ? 'text-3xl' : 'text-2xl'} leading-none mb-1`}>
        {value}
      </p>

      {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}

      {trend && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${
          trend.value >= 0 ? 'text-emerald-400' : 'text-red-400'
        }`}>
          <span>{trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%</span>
          <span className="text-slate-600">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
