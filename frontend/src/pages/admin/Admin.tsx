import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../lib/api';
import {
  Users, FileText, HardDrive, AlertCircle as AlertIcon, Activity,
  Clock, CheckCircle, XCircle, TrendingUp, Shield, Search, Loader2,
  Lock, Key, Eye, EyeOff
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`skeleton rounded-lg ${className}`} />
);

export const Admin: React.FC = () => {
  const navigate = useNavigate();
  const [isUnlocked, setIsUnlocked] = useState(() => sessionStorage.getItem('admin_unlocked') === 'true');
  const [passInput, setPassInput] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [passError, setPassError] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const qc = useQueryClient();

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    if (['admin123', 'admin', 'Admin@123'].includes(passInput.trim())) {
      sessionStorage.setItem('admin_unlocked', 'true');
      setIsUnlocked(true);
    } else {
      setPassError('Incorrect admin password. Access denied.');
    }
  };

  const handleLock = () => {
    sessionStorage.removeItem('admin_unlocked');
    setIsUnlocked(false);
    setPassInput('');
  };

  const { data: statsData, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.getStatistics().then((r) => r.data),
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users', userSearch],
    queryFn: () => adminApi.getUsers({ search: userSearch || undefined }).then((r) => r.data),
    placeholderData: (prev) => prev,
  });

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: () => adminApi.getAuditLogs({ limit: 10 }).then((r) => r.data),
  });

  const statusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: 'ACTIVE' | 'DISABLED' }) =>
      adminApi.updateUser(userId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const stats = statsData as {
    totalUsers: number;
    totalDocuments: number;
    storageUsedBytes: number;
    storageQuotaBytes: number;
    securityAlerts: number;
    activityByDay?: { day: string; uploads: number; downloads: number }[];
    services?: { label: string; ok: boolean }[];
  } | undefined;

  const users = usersData?.items || [];
  const auditLogs = logsData?.items || [];
  const activityData = stats?.activityByDay || [];

  const formatBytes = (bytes: number = 0) => {
    if (!bytes) return '0 KB';
    const gb = bytes / 1e9;
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / 1e6;
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    const kb = bytes / 1e3;
    return `${kb.toFixed(0)} KB`;
  };

  const metrics = [
    {
      label: 'Total Users', icon: Users, color: 'bg-blue-100 text-blue-600',
      value: stats?.totalUsers ?? 0, sub: 'Registered accounts',
    },
    {
      label: 'All Documents', icon: FileText, color: 'bg-violet-100 text-violet-600',
      value: stats?.totalDocuments ?? 0, sub: 'Across all users',
    },
    {
      label: 'Storage Used', icon: HardDrive, color: 'bg-emerald-100 text-emerald-600',
      value: formatBytes(stats?.storageUsedBytes), sub: `of ${formatBytes(stats?.storageQuotaBytes)} quota`,
    },
    {
      label: 'Security Alerts', icon: AlertIcon, color: 'bg-amber-100 text-amber-600',
      value: stats?.securityAlerts ?? 0, sub: stats?.securityAlerts === 0 ? 'All clear' : 'Needs review',
    },
  ];

  if (!isUnlocked) {
    return <Navigate to="/admin-login" replace />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-violet-100 border border-violet-200 flex items-center justify-center">
            <Shield className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Admin Console</h1>
            <p className="text-sm text-slate-500">System monitoring, users, and security events</p>
          </div>
        </div>
        <button
          onClick={handleLock}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-red-600 bg-white border border-slate-200 hover:border-red-200 hover:bg-red-50 rounded-xl transition-all cursor-pointer shadow-xs"
        >
          <Lock className="h-3.5 w-3.5" /> Lock Console
        </button>
      </div>

      {/* Error banner */}
      {statsError && (
        <div className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          <AlertIcon className="h-4 w-4 flex-shrink-0" />
          Backend not connected. Connect your AWS API to see real admin data.
        </div>
      )}

      {/* Metrics grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-16" />
                <Skeleton className="h-3 w-28" />
              </div>
            ))
          : metrics.map((m) => {
              const Icon = m.icon;
              return (
                <div key={m.label} className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-violet-300 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{m.label}</p>
                      <p className="text-2xl font-bold mt-2 text-slate-800">{m.value}</p>
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-emerald-500" /> {m.sub}
                      </p>
                    </div>
                    <div className={`p-2.5 rounded-xl ${m.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              );
            })}
      </div>

      {/* Charts + system health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Activity chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800">Weekly Activity</h3>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-violet-500" /> Uploads</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-indigo-400" /> Downloads</span>
            </div>
          </div>
          <div className="h-52">
            {statsLoading ? (
              <Skeleton className="h-full w-full" />
            ) : activityData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center">
                <Activity className="h-8 w-8 text-slate-200 mb-2" />
                <p className="text-xs text-slate-400">Activity data will appear here once users start uploading</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityData} margin={{ top: 0, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.12)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.75rem', fontSize: 12, color: '#1e293b' }} />
                  <Bar dataKey="uploads" fill="#7c3aed" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  <Bar dataKey="downloads" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* System health */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-4">System Health</h3>
          {statsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-4 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {(stats?.services || [
                { label: 'API Gateway', ok: stats ? true : null },
                { label: 'S3 Bucket', ok: stats ? true : null },
                { label: 'DynamoDB', ok: stats ? true : null },
                { label: 'Textract', ok: stats ? true : null },
                { label: 'Bedrock AI', ok: stats ? true : null },
                { label: 'CloudWatch', ok: stats ? true : null },
              ]).map((s: any) => (
                <div key={s.label} className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">{s.label}</span>
                  <div className={`flex items-center gap-1.5 text-xs font-semibold ${s.ok === true ? 'text-emerald-600' : s.ok === false ? 'text-red-500' : 'text-slate-400'}`}>
                    {s.ok === true ? <CheckCircle className="h-3.5 w-3.5" /> : s.ok === false ? <XCircle className="h-3.5 w-3.5" /> : <span className="h-3.5 w-3.5 rounded-full border-2 border-slate-300" />}
                    {s.ok === true ? 'Operational' : s.ok === false ? 'Degraded' : 'Pending'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Users table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-bold text-slate-800">Users</h3>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search users…"
              className="input-field rounded-xl pl-8 pr-4 py-1.5 text-sm w-48"
            />
          </div>
        </div>
        {usersLoading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-4 gap-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-2.5 w-40" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-14 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="py-12 flex flex-col items-center">
            <Users className="h-10 w-10 text-slate-200 mb-3" />
            <p className="text-sm text-slate-500">No users found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {users.map((u: any) => (
              <div key={u.id} className="flex items-center justify-between px-5 py-3.5 gap-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {u.name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{u.name}</p>
                    <p className="text-xs text-slate-400">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-slate-400 hidden md:block">{u.documentCount ?? 0} files</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${u.role === 'ADMIN' ? 'badge-info' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                    {u.role}
                  </span>
                  <button
                    onClick={() => statusMutation.mutate({ userId: u.id, status: u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' })}
                    disabled={statusMutation.isPending}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full cursor-pointer transition-opacity hover:opacity-75 ${u.status === 'ACTIVE' ? 'badge-success' : 'badge-error'}`}
                  >
                    {statusMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : u.status}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audit Log */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Activity className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-bold text-slate-800">Security Audit Log</h3>
        </div>
        {logsLoading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-4 gap-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-36" />
                    <Skeleton className="h-2.5 w-48" />
                  </div>
                </div>
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        ) : auditLogs.length === 0 ? (
          <div className="py-12 flex flex-col items-center">
            <Activity className="h-10 w-10 text-slate-200 mb-3" />
            <p className="text-sm text-slate-500">No audit events recorded yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {auditLogs.map((log: any) => (
              <div key={log.eventId} className={`flex items-center justify-between px-5 py-3.5 gap-4 hover:bg-slate-50 transition-colors ${log.status === 'FAILED' ? 'bg-red-50/50' : ''}`}>
                <div className="flex items-center gap-3">
                  {log.status === 'SUCCESS'
                    ? <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    : <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />}
                  <div>
                    <p className={`text-sm font-semibold ${log.status === 'FAILED' ? 'text-red-600' : 'text-slate-800'}`}>
                      {log.action}
                    </p>
                    <p className="text-xs text-slate-400">{log.userId} → {log.resourceId}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 flex-shrink-0">
                  <Clock className="h-3.5 w-3.5" />
                  {new Date(log.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
