import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '../../lib/api';
import { Trash2, FileText, RotateCcw, AlertCircle } from 'lucide-react';
import { ConfirmDeleteModal } from '../../components/ConfirmDeleteModal';

const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`skeleton rounded-lg ${className}`} />
);

const formatBytes = (bytes: number) => {
  const mb = bytes / 1e6;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1e3).toFixed(0)} KB`;
};

export const Trash: React.FC = () => {
  const [docToDelete, setDocToDelete] = useState<{ id: string; name: string } | null>(null);
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);
  const qc = useQueryClient();

  // Fetch trashed documents (deleted=true)
  const { data, isLoading, error } = useQuery({
    queryKey: ['trash'],
    queryFn: () => documentsApi.list({ deleted: true }).then((r) => r.data),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => documentsApi.restore(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trash'] }),
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: (id: string) => documentsApi.permanentDelete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trash'] });
      setDocToDelete(null);
    },
  });

  const docs = data?.items || [];

  const emptyTrashMutation = useMutation({
    mutationFn: async () => {
      for (const doc of docs) {
        await documentsApi.permanentDelete(doc.documentId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trash'] });
      setShowEmptyConfirm(false);
    },
  });

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {docToDelete && (
        <ConfirmDeleteModal
          title={`Permanently delete "${docToDelete.name}"?`}
          message="This action CANNOT be undone. The file will be permanently deleted from database and storage."
          confirmLabel="Delete Forever"
          isLoading={permanentDeleteMutation.isPending}
          onClose={() => setDocToDelete(null)}
          onConfirm={() => permanentDeleteMutation.mutate(docToDelete.id)}
        />
      )}

      {showEmptyConfirm && (
        <ConfirmDeleteModal
          title="Empty Trash?"
          message={`Are you sure you want to permanently delete all ${docs.length} item(s) in trash? This action CANNOT be undone.`}
          confirmLabel="Empty Trash"
          isLoading={emptyTrashMutation.isPending}
          onClose={() => setShowEmptyConfirm(false)}
          onConfirm={() => emptyTrashMutation.mutate()}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Trash</h1>
          <p className="text-sm text-slate-500 mt-0.5">Files deleted in the last 30 days</p>
        </div>
        {docs.length > 0 && (
          <button
            onClick={() => setShowEmptyConfirm(true)}
            className="btn-ghost rounded-xl px-4 py-2 text-sm text-red-600 border-red-200 hover:bg-red-50 flex items-center gap-2 cursor-pointer font-semibold"
          >
            <Trash2 className="h-4 w-4 text-red-500" /> Empty Trash
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          Backend not connected. Trash will appear once your API is configured.
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-2.5 w-20" />
                </div>
                <Skeleton className="h-7 w-24 rounded-lg" />
              </div>
            ))}
          </div>
        ) : docs.length === 0 ? (
          <div className="py-24 flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
              <Trash2 className="h-8 w-8 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-600 mb-1">Trash is empty</p>
            <p className="text-xs text-slate-400">Files you delete will be kept here for 30 days</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {docs.map((doc: any) => {
              const name = doc.originalFilename || doc.filename || 'Untitled';
              const size = doc.fileSize ?? doc.size ?? 0;
              return (
                <div key={doc.documentId} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                  <div className="h-9 w-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-600 truncate line-through">{name}</p>
                    <p className="text-xs text-slate-400">{formatBytes(size)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => restoreMutation.mutate(doc.documentId)}
                      disabled={restoreMutation.isPending}
                      className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 font-medium px-3 py-1.5 rounded-lg hover:bg-violet-50 transition-colors"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Restore
                    </button>
                    <button
                      onClick={() => setDocToDelete({ id: doc.documentId, name })}
                      className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" /> Delete forever
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
