import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { foldersApi, documentsApi } from '../../lib/api';
import { FolderOpen, FolderPlus, Trash2, FileText, Loader2, AlertCircle, X, Upload, Download } from 'lucide-react';
import { UploadModal } from '../../components/UploadModal';
import { NewFolderModal } from '../../components/NewFolderModal';
import { ConfirmDeleteModal } from '../../components/ConfirmDeleteModal';

const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`skeleton rounded-lg ${className}`} />
);

export const Folders: React.FC = () => {
  const [showNew, setShowNew] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<{ id: string; name: string } | null>(null);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['folders'],
    queryFn: () => foldersApi.list().then((r) => r.data),
  });

  const { data: docsData, isLoading: docsLoading } = useQuery({
    queryKey: ['documents', { folder: selected }],
    queryFn: () => documentsApi.list({ folderId: selected! }).then((r) => r.data),
    enabled: !!selected,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => foldersApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders'] });
      setSelected(null);
      setFolderToDelete(null);
    },
  });

  const handleDownload = async (docId: string) => {
    try {
      const res = await documentsApi.download(docId);
      window.open(res.data.downloadUrl, '_blank');
    } catch {
      alert('Download failed. Please try again.');
    }
  };

  const folders = Array.isArray(data) ? data : data?.items || data?.folders || [];
  const folderDocs = docsData?.items || [];
  const activeFolder = folders.find((f: any) => f.folderId === selected);

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {showNew && <NewFolderModal onClose={() => setShowNew(false)} />}
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} folderId={selected || undefined} />}
      {folderToDelete && (
        <ConfirmDeleteModal
          title={`Delete Folder "${folderToDelete.name}"?`}
          message="Are you sure you want to delete this folder? Documents in this folder will not be erased."
          confirmLabel="Delete Folder"
          isLoading={deleteMutation.isPending}
          onClose={() => setFolderToDelete(null)}
          onConfirm={() => deleteMutation.mutate(folderToDelete.id)}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Folders</h1>
          <p className="text-sm text-slate-500 mt-0.5">Organise your documents into folders</p>
        </div>
        <div className="flex items-center gap-2">
          {selected && (
            <button onClick={() => setShowUpload(true)} className="btn-secondary rounded-xl px-4 py-2.5 text-sm flex items-center gap-2">
              <Upload className="h-4 w-4" /> Add Files to Folder
            </button>
          )}
          <button onClick={() => setShowNew(true)} className="btn-primary rounded-xl px-4 py-2.5 text-sm flex items-center gap-2">
            <FolderPlus className="h-4 w-4" /> New Folder
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          Backend not connected. Folders will load once your API is configured.
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-2.5 w-16" />
            </div>
          ))}
        </div>
      ) : folders.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl py-24 flex flex-col items-center text-center">
          <div className="h-16 w-16 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center mb-4">
            <FolderOpen className="h-8 w-8 text-violet-400" />
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">No folders yet</p>
          <p className="text-xs text-slate-400 mb-4">Create a folder to organise your documents</p>
          <button onClick={() => setShowNew(true)} className="btn-primary rounded-xl px-4 py-2 text-sm flex items-center gap-2">
            <FolderPlus className="h-4 w-4" /> Create Folder
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {folders.map((folder: any) => (
            <div
              key={folder.folderId}
              onClick={() => setSelected(selected === folder.folderId ? null : folder.folderId)}
              className={`bg-white border rounded-2xl p-5 cursor-pointer group hover:border-violet-300 hover:shadow-md transition-all duration-200 ${selected === folder.folderId ? 'border-violet-400 bg-violet-50/60' : 'border-slate-200'}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${selected === folder.folderId ? 'bg-violet-100' : 'bg-amber-50'}`}>
                  <FolderOpen className={`h-5 w-5 ${selected === folder.folderId ? 'text-violet-500' : 'text-amber-500'}`} />
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setFolderToDelete({ id: folder.folderId, name: folder.folderName }); }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                  title="Delete Folder"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-sm font-semibold text-slate-800 truncate">{folder.folderName}</p>
              <p className="text-xs text-slate-400 mt-0.5">{folder.documentCount ?? 0} files</p>
            </div>
          ))}
        </div>
      )}

      {/* Selected folder contents */}
      {selected && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                {activeFolder?.folderName}
              </h3>
              <p className="text-xs text-slate-400">{folderDocs.length} files in folder</p>
            </div>
            <button
              onClick={() => setShowUpload(true)}
              className="btn-primary rounded-xl px-3 py-1.5 text-xs flex items-center gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" /> Upload File to Folder
            </button>
          </div>
          {docsLoading ? (
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <div className="space-y-1.5 flex-1"><Skeleton className="h-3 w-40" /><Skeleton className="h-2.5 w-16" /></div>
                </div>
              ))}
            </div>
          ) : folderDocs.length === 0 ? (
            <div className="py-12 flex flex-col items-center">
              <FileText className="h-10 w-10 text-slate-200 mb-2" />
              <p className="text-sm font-medium text-slate-600 mb-1">This folder is empty</p>
              <p className="text-xs text-slate-400 mb-4">Upload documents directly into this folder</p>
              <button
                onClick={() => setShowUpload(true)}
                className="btn-primary rounded-xl px-4 py-2 text-xs flex items-center gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" /> Upload File Now
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {folderDocs.map((doc: any) => {
                const name = doc.originalFilename || doc.filename || 'Untitled';
                const size = doc.fileSize ?? doc.size ?? 0;
                return (
                  <div key={doc.documentId} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                    <FileText className="h-4 w-4 text-violet-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{name}</p>
                      <p className="text-[11px] text-slate-400">{new Date(doc.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className="text-xs text-slate-400 mr-2">{(size / 1e6).toFixed(1)} MB</span>
                    <button
                      onClick={() => handleDownload(doc.documentId)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                      title="Download File"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
