import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi, searchApi } from '../../lib/api';
import { formatAppDate } from '../../lib/dateUtils';
import { Document } from '../../types';
import { UploadModal } from '../../components/UploadModal';
import { NewFolderModal } from '../../components/NewFolderModal';
import { ConfirmDeleteModal } from '../../components/ConfirmDeleteModal';
import {
  FileText, Search, Upload, FolderPlus, MoreHorizontal,
  Share2, Trash2, Star, Download, Filter, Grid, List,
  ChevronDown, Eye, AlertCircle, Loader2, X, CheckCircle
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`skeleton rounded-lg ${className}`} />
);

const formatBytes = (bytes: number) => {
  const mb = bytes / 1e6;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1e3;
  if (kb >= 1) return `${kb.toFixed(0)} KB`;
  return `${bytes} B`;
};

const typeLabel = (mime?: string) => {
  if (!mime || typeof mime !== 'string') return 'FILE';
  const lower = mime.toLowerCase();
  if (lower.includes('pdf')) return 'PDF';
  if (lower.includes('word') || lower.includes('docx')) return 'DOCX';
  if (lower.includes('png')) return 'PNG';
  if (lower.includes('jpeg') || lower.includes('jpg')) return 'JPG';
  if (lower.includes('text')) return 'TXT';
  return lower.split('/')[1]?.toUpperCase() || 'FILE';
};

const typeColors: Record<string, string> = {
  PDF: 'bg-red-50 text-red-600 border-red-200',
  DOCX: 'bg-blue-50 text-blue-600 border-blue-200',
  PNG: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  JPG: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  TXT: 'bg-amber-50 text-amber-600 border-amber-200',
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  if (status === 'COMPLETED') return <span className="badge-success text-[10px] font-semibold px-2 py-0.5 rounded-full">✓ Ready</span>;
  if (status === 'FAILED') return <span className="badge-error text-[10px] font-semibold px-2 py-0.5 rounded-full">✕ Failed</span>;
  return <span className="badge-warning text-[10px] font-semibold px-2 py-0.5 rounded-full animate-pulse">⏳ Processing</span>;
};

// ─── Main Documents Page ──────────────────────────────────────────────────────
export const Documents: React.FC = () => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [docToDelete, setDocToDelete] = useState<Document | null>(null);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['documents', { search, filter }],
    queryFn: () => {
      if (search.trim()) {
        return searchApi.search({ q: search.trim(), fileType: filter !== 'all' ? filter : undefined }).then((r) => r.data);
      }
      return documentsApi.list({
        fileType: filter !== 'all' ? filter : undefined,
      }).then((r) => r.data);
    },
    placeholderData: (prev) => prev,
  });

  const docs: Document[] = data?.items || [];

  const starMutation = useMutation({
    mutationFn: (documentId: string) => documentsApi.toggleFavorite(documentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => documentsApi.softDelete(documentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setDocToDelete(null);
    },
  });

  const handleDownload = async (doc: Document) => {
    try {
      const res = await documentsApi.download(doc.documentId);
      window.open(res.data.downloadUrl, '_blank');
    } catch {
      alert('Download failed. Please try again.');
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
      {showNewFolder && <NewFolderModal onClose={() => setShowNewFolder(false)} />}
      {docToDelete && (
        <ConfirmDeleteModal
          title={`Move "${docToDelete.originalFilename || docToDelete.filename}" to Trash?`}
          message="This document will be moved to Trash. You can restore it anytime from the Trash section."
          confirmLabel="Move to Trash"
          isLoading={deleteMutation.isPending}
          onClose={() => setDocToDelete(null)}
          onConfirm={() => deleteMutation.mutate(docToDelete.documentId)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">All Files</h1>
          <p className="text-sm text-slate-500 mt-0.5">{docs.length} documents in your workspace</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowNewFolder(true)}
            className="btn-ghost rounded-xl px-3 py-2 text-sm flex items-center gap-2"
          >
            <FolderPlus className="h-4 w-4" />
            <span className="hidden sm:inline">New Folder</span>
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="btn-primary rounded-xl px-4 py-2 text-sm flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Upload
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, category, tag…"
            className="input-field w-full rounded-xl pl-9 pr-4 py-2 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="input-field rounded-xl pl-3 pr-8 py-2 text-sm appearance-none cursor-pointer font-medium"
            >
              <option value="all">All types</option>
              <option value="pdf">PDF</option>
              <option value="docx">DOCX</option>
              <option value="png">PNG</option>
              <option value="txt">TXT</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>
          <div className="flex border border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 transition-colors ${viewMode === 'list' ? 'bg-violet-50 text-violet-600' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-2 transition-colors ${viewMode === 'grid' ? 'bg-violet-50 text-violet-600' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              <Grid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          Backend not connected. Upload your AWS API key to see real documents.
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50">
            <span className="col-span-5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Name</span>
            <span className="col-span-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 hidden md:block">Category</span>
            <span className="col-span-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 hidden lg:block">Modified</span>
            <span className="col-span-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 hidden sm:block">Status</span>
            <span className="col-span-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-right">Actions</span>
          </div>

          {isLoading ? (
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="grid grid-cols-12 gap-4 px-5 py-4 items-center">
                  <div className="col-span-5 flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-3 w-40" />
                      <Skeleton className="h-2.5 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-20 rounded-full col-span-2 hidden md:block" />
                  <Skeleton className="h-3 w-24 col-span-2 hidden lg:block" />
                  <Skeleton className="h-5 w-16 rounded-full col-span-2 hidden sm:block" />
                  <Skeleton className="h-6 w-6 rounded-lg col-span-1 ml-auto" />
                </div>
              ))}
            </div>
          ) : docs.length === 0 ? (
            <div className="py-20 flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-violet-400" />
              </div>
              <p className="text-sm font-semibold text-slate-700 mb-1">No documents found</p>
              <p className="text-xs text-slate-400 mb-4">{search ? 'Try a different search term' : 'Upload your first document'}</p>
              {!search && (
                <button onClick={() => setShowUpload(true)} className="btn-primary rounded-xl px-4 py-2 text-sm flex items-center gap-2">
                  <Upload className="h-4 w-4" /> Upload Files
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {docs.map((doc) => {
                const label = typeLabel(doc.fileType || doc.mimeType);
                const name = doc.originalFilename || doc.filename || 'Untitled Document';
                const size = doc.fileSize ?? doc.size ?? 0;
                return (
                  <div key={doc.documentId} className="grid grid-cols-12 gap-4 px-5 py-3.5 items-center group relative hover:bg-slate-50 transition-colors">
                    <div className="col-span-5 flex items-center gap-3 min-w-0">
                      <div className={`h-8 w-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${typeColors[label] || 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                        <FileText className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{name}</p>
                        <p className="text-xs text-slate-400">{formatBytes(size)}</p>
                      </div>
                    </div>
                    <div className="col-span-2 hidden md:block">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {doc.category || label}
                      </span>
                    </div>
                    <div className="col-span-2 hidden lg:block">
                      <span className="text-xs text-slate-400">{formatAppDate(doc.updatedAt)}</span>
                    </div>
                    <div className="col-span-2 hidden sm:block">
                      <StatusBadge status={doc.status} />
                    </div>
                    <div className="col-span-1 flex items-center justify-end gap-1">
                      <button
                        onClick={() => starMutation.mutate(doc.documentId)}
                        className={`p-1.5 rounded-lg transition-colors ${doc.isFavorite ? 'text-amber-400' : 'text-slate-300 opacity-0 group-hover:opacity-100 hover:text-amber-400'}`}
                      >
                        <Star className="h-3.5 w-3.5" fill={doc.isFavorite ? 'currentColor' : 'none'} />
                      </button>
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenu(openMenu === doc.documentId ? null : doc.documentId)}
                          className="p-1.5 rounded-lg text-slate-400 opacity-0 group-hover:opacity-100 hover:text-slate-700 hover:bg-slate-100 transition-all"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                        {openMenu === doc.documentId && (
                          <div
                            className="absolute right-0 top-8 z-10 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 animate-fade-in"
                            onMouseLeave={() => setOpenMenu(null)}
                          >
                            {[
                              { icon: Eye, label: 'Preview / View', action: () => handleDownload(doc) },
                              { icon: Download, label: 'Download', action: () => handleDownload(doc) },
                              { icon: Share2, label: 'Share', action: () => {} },
                              { icon: Trash2, label: 'Move to Trash', action: () => setDocToDelete(doc), danger: true },
                            ].map(({ icon: Icon, label, action, danger }) => (
                              <button
                                key={label}
                                onClick={() => { action(); setOpenMenu(null); }}
                                className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm transition-colors ${danger ? 'text-red-500 hover:bg-red-50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}
                              >
                                <Icon className="h-3.5 w-3.5" />
                                {label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <>
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                  <Skeleton className="h-12 w-12 rounded-xl" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-2.5 w-16" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : docs.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl py-20 flex flex-col items-center text-center">
              <FileText className="h-12 w-12 text-slate-200 mb-3" />
              <p className="text-sm font-semibold text-slate-600 mb-1">No files found</p>
              <p className="text-xs text-slate-400">{search ? 'Try a different search term' : 'Upload your first file'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {docs.map((doc) => {
                const label = typeLabel(doc.fileType || doc.mimeType);
                const name = doc.originalFilename || doc.filename || 'Untitled Document';
                const size = doc.fileSize ?? doc.size ?? 0;
                return (
                  <div key={doc.documentId} className="bg-white border border-slate-200 rounded-2xl p-4 cursor-pointer group relative hover:border-violet-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                    <div className={`h-12 w-12 rounded-xl border flex items-center justify-center mb-3 ${typeColors[label] || 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                      <FileText className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-medium text-slate-800 truncate">{name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{formatBytes(size)}</p>
                    <div className="mt-2"><StatusBadge status={doc.status} /></div>
                    <button
                      onClick={() => starMutation.mutate(doc.documentId)}
                      className={`absolute top-3 right-3 p-1.5 rounded-lg transition-all ${doc.isFavorite ? 'text-amber-400' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`}
                    >
                      <Star className="h-3.5 w-3.5" fill={doc.isFavorite ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};
