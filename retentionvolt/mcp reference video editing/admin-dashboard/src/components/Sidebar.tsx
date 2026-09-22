'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  DollarSign,
  Cpu,
  LogOut,
  Terminal,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';

const navItems = [
  { href: '/', icon: LayoutDashboard, label: 'Overview' },
  { href: '/users', icon: Users, label: 'Utenti' },
  { href: '/revenue', icon: DollarSign, label: 'Revenue' },
  { href: '/mcp', icon: Cpu, label: 'Server MCP' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-60 bg-[#0d0d14] border-r border-[#1e1e2e] flex flex-col z-20">
      {/* Logo */}
      <div className="p-5 border-b border-[#1e1e2e]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
            <Terminal className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-white leading-none">RETENTIONVOLT</div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">Admin Panel</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                isActive
                  ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-300'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
              {label}
              {isActive && <ChevronRight className="w-3 h-3 ml-auto text-indigo-500/70" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-[#1e1e2e] space-y-2">
        <a
          href="https://retentionvolt.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Vai al Sito Live
        </a>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-500 hover:text-red-400 hover:bg-red-900/10 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          Disconnetti
        </button>
      </div>
    </aside>
  );
}
