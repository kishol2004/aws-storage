import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { documentsApi } from '../../lib/api';
import { Document } from '../../types';
import { Clock, FileText, AlertCircle, Eye, Loader2 } from 'lucide-react';

const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`skeleton rounded-lg ${className}`} />
);

const formatBytes = (bytes: number) => {
  const mb = bytes / 1e6;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1e3).toFixed(0)} KB`;
};

const relativeTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export const Recent: React.FC = () => {
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['recent-documents'],
    queryFn: () => documentsApi.list({ limit: 10 }).then((r) => r.data),
  });

  const handleOpenDoc = async (documentId: string) => {
    try {
      setLoadingDocId(documentId);
      const res = await documentsApi.download(documentId);
      if (res.data?.downloadUrl) {
        window.open(res.data.downloadUrl, '_blank');
      } else {
        alert('Failed to get file URL');
      }
    } catch (err) {
      console.error('Error opening document:', err);
      alert('Error opening file preview');
    } finally {
      setLoadingDocId(null);
    }
  };

  const docs: Document[] = data?.items || [];

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Recent</h1>
        <p className="text-sm text-slate-500 mt-0.5">Documents you've accessed recently</p>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          Backend not connected. Recent files will appear once your API is configured.
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-2.5 w-24" />
                </div>
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        ) : docs.length === 0 ? (
          <div className="py-24 flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
              <Clock className="h-8 w-8 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-600 mb-1">No recent activity</p>
            <p className="text-xs text-slate-400">Files you open or upload will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {docs.map((doc) => {
              const name = doc.originalFilename || doc.filename || 'Untitled';
              const isLoadingThis = loadingDocId === doc.documentId;
              return (
                <div
                  key={doc.documentId}
                  onClick={() => handleOpenDoc(doc.documentId)}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <div className="h-9 w-9 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-100 transition-colors">
                    <FileText className="h-4 w-4 text-violet-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate group-hover:text-violet-600 transition-colors">{name}</p>
                    <p className="text-xs text-slate-400">{formatBytes(doc.fileSize ?? doc.size ?? 0)}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {relativeTime(doc.updatedAt)}
                    </span>
                    <button
                      onClick={() => handleOpenDoc(doc.documentId)}
                      disabled={isLoadingThis}
                      className="btn-ghost rounded-xl px-3 py-1.5 text-xs font-semibold text-violet-600 hover:bg-violet-50 flex items-center gap-1.5 transition-colors ml-2"
                      title="View file"
                    >
                      {isLoadingThis ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                      View
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
