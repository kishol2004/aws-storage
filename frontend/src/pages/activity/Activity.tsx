import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { activityApi } from '../../lib/api';
import { Activity, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`skeleton rounded-lg ${className}`} />
);

export const ActivityPage: React.FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['activity'],
    queryFn: () => activityApi.list({ limit: 50 }).then((r) => r.data),
  });

  const logs = data?.items || [];

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Activity</h1>
        <p className="text-sm text-slate-500 mt-0.5">Your recent document activity and events</p>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          Backend not connected. Activity log will appear once your API is configured.
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <Skeleton className="h-4 w-4 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-2.5 w-56" />
                </div>
                <Skeleton className="h-3 w-20 flex-shrink-0" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="py-24 flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
              <Activity className="h-8 w-8 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-600 mb-1">No activity yet</p>
            <p className="text-xs text-slate-400">Your document events will appear here as you use the platform</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {logs.map((log: any) => (
              <div key={log.eventId} className={`flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors ${log.status === 'FAILED' ? 'bg-red-50/40' : ''}`}>
                <div className="flex items-center gap-3">
                  {log.status === 'SUCCESS'
                    ? <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    : <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />}
                  <div>
                    <p className={`text-sm font-semibold ${log.status === 'FAILED' ? 'text-red-600' : 'text-slate-800'}`}>{log.action}</p>
                    <p className="text-xs text-slate-400">{log.resourceId}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400 flex-shrink-0">
                  <Clock className="h-3.5 w-3.5" />
                  {new Date(log.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
