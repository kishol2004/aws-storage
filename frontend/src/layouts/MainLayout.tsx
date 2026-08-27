import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { documentsApi } from '../lib/api';
import {
  LayoutDashboard, FileText, FolderOpen, Share2, Clock, Heart,
  Trash2, Search, Activity, User, Settings, Shield, LogOut,
  Bell, Menu, X, ChevronRight, Zap, HardDrive
} from 'lucide-react';

const navGroups = [
  {
    label: 'Workspace',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/documents', label: 'All Files', icon: FileText },
      { to: '/folders', label: 'Folders', icon: FolderOpen },
      { to: '/recent', label: 'Recent', icon: Clock },
      { to: '/favorites', label: 'Favorites', icon: Heart },
    ],
  },
  {
    label: 'Sharing',
    items: [
      { to: '/shared-with-me', label: 'Shared with me', icon: Share2 },
      { to: '/trash', label: 'Trash', icon: Trash2 },
    ],
  },
  {
    label: 'Tools',
    items: [
      { to: '/search', label: 'AI Search', icon: Search },
      { to: '/activity', label: 'Activity', icon: Activity },
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/profile', label: 'Profile', icon: User },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

interface SidebarProps {
  onClose?: () => void;
}

const SidebarContent: React.FC<SidebarProps> = ({ onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const { data: docsData } = useQuery({
    queryKey: ['documents'],
    queryFn: () => documentsApi.list().then((r) => r.data),
  });

  const docs = docsData?.items || [];
  const totalBytes = docs.reduce((acc: number, d: any) => acc + (d.fileSize || d.size || 0), 0);
  const maxBytes = 10 * 1024 * 1024 * 1024; // 10 GB limit

  const formatStorageText = (bytes: number) => {
    if (!bytes) return '0 KB';
    const gb = bytes / 1e9;
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / 1e6;
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    const kb = bytes / 1e3;
    return `${kb.toFixed(0)} KB`;
  };

  const formattedUsed = formatStorageText(totalBytes);
  const percentUsed = Math.min(100, (totalBytes / maxBytes) * 100);
  const displayPercent = percentUsed === 0 ? '0%' : percentUsed < 1 ? '< 1%' : `${Math.round(percentUsed)}%`;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const initial = user?.name?.[0]?.toUpperCase() || 'U';

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Brand header */}
      <div className="flex items-center justify-between px-5 h-16 border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25 flex-shrink-0">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold tracking-wide text-slate-800">SecureDoc AI</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6 min-h-0">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-violet-50 text-violet-700 border border-violet-200/60'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  }
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}

        {/* Admin section */}
        <div>
          <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-violet-500 flex items-center justify-between">
            <span>Admin Control</span>
            {user?.role === 'ADMIN' ? (
              <span className="text-[9px] font-bold text-violet-600 bg-violet-100 px-1.5 py-0.2 rounded">Authorized</span>
            ) : (
              <span className="text-[9px] font-medium text-slate-400">Locked</span>
            )}
          </p>
          <div className="space-y-0.5">
            <NavLink
              to={user?.role === 'ADMIN' || sessionStorage.getItem('admin_unlocked') === 'true' ? "/admin" : "/login?mode=admin"}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-violet-50 text-violet-700 border border-violet-200/60'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Shield className="h-4 w-4 flex-shrink-0 text-violet-600" />
              <div className="flex items-center justify-between flex-1">
                <span>Admin Console</span>
                {!(user?.role === 'ADMIN' || sessionStorage.getItem('admin_unlocked') === 'true') && (
                  <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Login</span>
                )}
              </div>
            </NavLink>
          </div>
        </div>
      </nav>

      {/* Storage bar */}
      <div className="mx-3 mb-3 p-3 rounded-xl bg-slate-50 border border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <HardDrive className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
          <div className="flex items-center justify-between flex-1 text-xs">
            <span className="text-slate-500 font-medium">Storage</span>
            <span className="font-semibold text-slate-700">{formattedUsed} / 10 GB</span>
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-300"
            style={{ width: `${Math.max(1, percentUsed)}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-400 mt-1.5">{displayPercent} used</p>
      </div>

      {/* User footer */}
      <div className="p-3 border-t border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 transition-colors group cursor-pointer">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-semibold text-slate-800 truncate">{user?.name || 'User'}</p>
              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${user?.role === 'ADMIN' ? 'bg-violet-100 text-violet-700 border border-violet-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                {user?.role || 'USER'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Log out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const pageName = location.pathname.split('/').filter(Boolean).pop() || 'dashboard';
  const pageLabel = pageName.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const initial = user?.name?.[0]?.toUpperCase() || 'U';

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* ── Desktop Sidebar ───────────────────────────────────────────────── */}
      <aside className="hidden lg:flex lg:flex-col w-60 flex-shrink-0 h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {/* ── Mobile Sidebar Overlay ────────────────────────────────────────── */}
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 lg:hidden transition-opacity duration-300 ${
          sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)' }}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Drawer panel — slides in from left */}
      <div
        className={`fixed top-0 left-0 z-50 h-full w-64 lg:hidden transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent onClose={() => setSidebarOpen(false)} />
      </div>

      {/* ── Main content column ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top header */}
        <header className="h-16 flex-shrink-0 bg-white border-b border-slate-200 shadow-sm px-4 lg:px-6 flex items-center justify-between z-30">
          {/* Left: hamburger + breadcrumb */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-400 hidden sm:block">Home</span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-300 hidden sm:block" />
              <span className="font-semibold capitalize text-slate-800">{pageLabel}</span>
            </div>
          </div>

          {/* Right: notification + avatar */}
          <div className="flex items-center gap-2">
            <button className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-violet-500 ring-2 ring-white" />
            </button>
            <div className="w-px h-6 bg-slate-200 mx-1" />
            <Link
              to="/profile"
              className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                {initial}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-800 leading-tight">{user?.name}</span>
                <span className="text-[10px] text-slate-400 font-semibold">{user?.role || 'USER'}</span>
              </div>
            </Link>
          </div>
        </header>

        {/* Page content — scrollable independently */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
