import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { documentsApi, adminApi, dashboardApi, IS_API_CONFIGURED } from '../../lib/api';
import { UploadModal } from '../../components/UploadModal';
import {
  FileText, HardDrive, Share2, Brain, TrendingUp,
  Upload, Clock, Star, ArrowUpRight, AlertCircle
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { Document } from '../../types';

// ─── Skeleton helpers ────────────────────────────────────────────────────────
const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`skeleton rounded-lg ${className}`} />
);

// ─── Stat Card ───────────────────────────────────────────────────────────────
const StatCard: React.FC<{
  label: string; value: string | number; sub: string;
  icon: React.ElementType; color: string;
}> = ({ label, value, sub, icon: Icon, color }) => (
  <div className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-violet-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-2xl font-bold mt-2 text-slate-800">{value}</p>
        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
          <TrendingUp className="h-3 w-3 text-emerald-500" />
          {sub}
        </p>
      </div>
      <div className={`p-2.5 rounded-xl ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

const StatCardSkeleton = () => (
  <div className="bg-white border border-slate-200 rounded-2xl p-5">
    <div className="flex items-start justify-between">
      <div className="space-y-2 flex-1">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-10 w-10 rounded-xl" />
    </div>
  </div>
);

// ─── Chart tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white rounded-xl px-3 py-2 shadow-lg border border-slate-200 text-xs">
        <p className="text-slate-500 mb-1">{label}</p>
        <p className="font-bold text-violet-600">{payload[0].value} docs</p>
      </div>
    );
  }
  return null;
};

// ─── Empty state ──────────────────────────────────────────────────────────────
const EmptyFiles: React.FC<{ onUpload: () => void }> = ({ onUpload }) => (
  <div className="py-16 flex flex-col items-center text-center">
    <div className="h-16 w-16 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center mb-4">
      <FileText className="h-8 w-8 text-violet-400" />
    </div>
    <p className="text-sm font-semibold text-slate-700 mb-1">No documents yet</p>
    <p className="text-xs text-slate-400 mb-4">Upload your first document to get started</p>
    <button
      onClick={onUpload}
      className="btn-primary rounded-xl px-4 py-2 text-sm flex items-center gap-2"
    >
      <Upload className="h-4 w-4" />
      Upload Files
    </button>
  </div>
);

// ─── File type colours ────────────────────────────────────────────────────────
const typeColors: Record<string, string> = {
  'application/pdf': 'bg-red-50 text-red-600 border-red-200',
  'application/msword': 'bg-blue-50 text-blue-600 border-blue-200',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'bg-blue-50 text-blue-600 border-blue-200',
  'image/png': 'bg-emerald-50 text-emerald-600 border-emerald-200',
  'image/jpeg': 'bg-emerald-50 text-emerald-600 border-emerald-200',
  'text/plain': 'bg-amber-50 text-amber-600 border-amber-200',
};

const pieColors = ['#7c3aed', '#6366f1', '#a78bfa', '#c4b5fd'];

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showUpload, setShowUpload] = useState(false);

  // Stats query
  const { data: statsData, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.getStats().then((r) => r.data),
  });

  // Recent files query
  const { data: recentData, isLoading: recentLoading } = useQuery({
    queryKey: ['dashboard-recent'],
    queryFn: () => documentsApi.list({ limit: 5 }).then((r) => r.data),
  });

  const stats = statsData as {
    totalDocuments: number;
    storageUsedBytes: number;
    storageQuotaBytes: number;
    sharedCount: number;
    aiProcessedPercent: number;
    processingCount: number;
    uploadsByMonth?: { month: string; docs: number }[];
    byType?: { name: string; value: number }[];
  } | undefined;

  const recentFiles: Document[] = recentData?.items || [];
  const uploadData = stats?.uploadsByMonth || [];
  const typeData = (stats?.byType || []).map((t, i) => ({ ...t, color: pieColors[i % pieColors.length] }));

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const gb = bytes / 1e9;
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / 1e6;
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${(bytes / 1e3).toFixed(0)} KB`;
  };

  const storageUsed = stats ? formatBytes(stats.storageUsedBytes) : '—';
  const storageQuota = stats ? formatBytes(stats.storageQuotaBytes) : '—';
  const storagePercent = stats ? Math.round((stats.storageUsedBytes / stats.storageQuotaBytes) * 100) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold gradient-text">
            Good morning, {user?.name?.split(' ')[0] || 'User'} 👋
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time statistics on encrypted document storage and AI pipelines
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="btn-primary rounded-xl px-4 py-2.5 text-sm flex items-center gap-2 self-start cursor-pointer hover:shadow-lg transition-all"
        >
          <Upload className="h-4 w-4" />
          Upload Files
        </button>
      </div>


      {/* Demo mode notice — shown only when backend is not yet connected */}
      {!IS_API_CONFIGURED && (
        <div className="flex items-start gap-3 rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-3.5 text-sm text-indigo-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Demo mode</strong> — No backend connected yet. All data shown below is placeholder.{' '}
            Create a <code className="text-xs bg-indigo-100 rounded px-1 py-0.5">.env</code> file with{' '}
            <code className="text-xs bg-indigo-100 rounded px-1 py-0.5">VITE_API_BASE_URL=https://your-api.com</code>{' '}
            to connect your AWS backend.
          </span>
        </div>
      )}


      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              label="Total Documents"
              value={stats?.totalDocuments ?? 0}
              sub={`Across your workspace`}
              icon={FileText}
              color="bg-violet-100 text-violet-600"
            />
            <StatCard
              label="Storage Used"
              value={`${storageUsed} / ${storageQuota}`}
              sub={`${storagePercent}% capacity`}
              icon={HardDrive}
              color="bg-blue-100 text-blue-600"
            />
            <StatCard
              label="Shared Files"
              value={stats?.sharedCount ?? 0}
              sub="Active share links"
              icon={Share2}
              color="bg-pink-100 text-pink-600"
            />
            <StatCard
              label="AI Processed"
              value={`${stats?.aiProcessedPercent ?? 0}%`}
              sub={`${stats?.processingCount ?? 0} files analyzing`}
              icon={Brain}
              color="bg-emerald-100 text-emerald-600"
            />
          </>
        )}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Upload trend */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Upload & Storage Growth</h3>
              <p className="text-xs text-slate-400 mt-0.5">Timeline monitoring of stored assets capacity in MB</p>
            </div>
          </div>
          <div className="h-52">
            {statsLoading ? (
              <Skeleton className="h-full w-full" />
            ) : uploadData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <TrendingUp className="h-8 w-8 text-slate-200 mb-2" />
                <p className="text-xs text-slate-400">Upload activity will appear here once documents are added</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={uploadData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.12)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="docs" stroke="#7c3aed" strokeWidth={2}
                    fill="url(#grad)" dot={false} activeDot={{ r: 4, fill: '#7c3aed' }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* File type donut */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-800">Storage by Type</h3>
            <p className="text-xs text-slate-400 mt-0.5">Distribution breakdown of stored files</p>
          </div>
          {statsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-36 w-full rounded-xl" />
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
            </div>
          ) : typeData.length === 0 ? (
            <div className="h-36 flex flex-col items-center justify-center">
              <HardDrive className="h-8 w-8 text-slate-200 mb-2" />
              <p className="text-xs text-slate-400 text-center">No storage data yet</p>
            </div>
          ) : (
            <>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={typeData} innerRadius={42} outerRadius={62} paddingAngle={3} dataKey="value" strokeWidth={0}>
                      {typeData.map((_, i) => <Cell key={i} fill={typeData[i].color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.75rem', fontSize: 12, color: '#1e293b' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 space-y-2">
                {typeData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-slate-500">{d.name}</span>
                    </div>
                    <span className="font-semibold text-slate-700">{d.value}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Recent files */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-bold text-slate-800">Recent Files</h3>
          </div>
          <button
            onClick={() => navigate('/documents')}
            className="text-xs text-violet-600 hover:text-violet-500 flex items-center gap-1 transition-colors font-medium cursor-pointer"
          >
            View all <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>

        {recentLoading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : recentFiles.length === 0 ? (
          <EmptyFiles onUpload={() => setShowUpload(true)} />
        ) : (
          <div className="divide-y divide-slate-100">
            {recentFiles.map((file) => {
              const fType = file.fileType || file.mimeType || '';
              const name = file.originalFilename || file.filename || 'Untitled';
              const bytes = file.fileSize ?? file.size ?? 0;
              return (
                <div key={file.documentId} className="flex items-center justify-between px-5 py-3.5 gap-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-9 w-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${typeColors[fType] || 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{name}</p>
                      <p className="text-xs text-slate-400">{(bytes / 1e6).toFixed(1)} MB</p>
                    </div>
                  </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <span className="text-xs text-slate-400 hidden sm:block">
                    {new Date(file.updatedAt).toLocaleDateString()}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${file.status === 'COMPLETED' ? 'badge-success' : file.status === 'FAILED' ? 'badge-error' : 'badge-warning'}`}>
                    {file.status === 'COMPLETED' ? 'Ready' : file.status === 'FAILED' ? 'Failed' : 'Processing'}
                  </span>
                  <button className="text-slate-300 hover:text-amber-500 transition-colors">
                    <Star className="h-4 w-4" fill={file.isFavorite ? 'currentColor' : 'none'} />
                  </button>
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>
    </div>
  );
};
