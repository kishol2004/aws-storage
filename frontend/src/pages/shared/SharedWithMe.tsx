import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { sharesApi, documentsApi } from '../../lib/api';
import { Share2, FileText, AlertCircle, User, Eye, Loader2, Download } from 'lucide-react';

const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`skeleton rounded-lg ${className}`} />
);

export const SharedWithMe: React.FC = () => {
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['shared-with-me'],
    queryFn: () => sharesApi.sharedWithMe().then((r) => r.data),
  });

  const shares = data?.items || [];

  const handleViewDocument = async (docId: string) => {
    try {
      setLoadingDocId(docId);
      const res = await documentsApi.download(docId);
      if (res.data?.downloadUrl) {
        window.open(res.data.downloadUrl, '_blank');
      } else {
        alert('Document download/preview URL not available');
      }
    } catch (err: any) {
      console.error('Failed to view document:', err);
      alert('Failed to load document preview. Please verify backend connection.');
    } finally {
      setLoadingDocId(null);
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Shared with me</h1>
        <p className="text-sm text-slate-500 mt-0.5">Documents that others have shared with you</p>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          Backend not connected. Shared files will appear once your API is configured.
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-2.5 w-32" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : shares.length === 0 ? (
          <div className="py-24 flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-4">
              <Share2 className="h-8 w-8 text-blue-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700 mb-1">Nothing shared with you yet</p>
            <p className="text-xs text-slate-400">When someone shares a document with you, it will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {shares.map((share: any) => (
              <div
                key={share.shareId}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer group"
                onClick={() => handleViewDocument(share.documentId)}
              >
                <div className="h-9 w-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                  <FileText className="h-4 w-4 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate group-hover:text-violet-600 transition-colors">
                    {share.documentName || share.documentId}
                  </p>
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <User className="h-3 w-3" /> Shared by {share.sharedWith || share.ownerId || 'Admin'}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${
                    share.permission === 'EDIT' ? 'badge-info' : share.permission === 'DOWNLOAD' ? 'badge-success' : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}>
                    {share.permission}
                  </span>
                  <button
                    onClick={() => handleViewDocument(share.documentId)}
                    disabled={loadingDocId === share.documentId}
                    className="btn-primary rounded-xl px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 shadow-sm hover:shadow transition-all disabled:opacity-50"
                  >
                    {loadingDocId === share.documentId ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : share.permission === 'DOWNLOAD' ? (
                      <Download className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
