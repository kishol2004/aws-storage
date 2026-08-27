import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, X, FileText, CheckCircle, Loader2, AlertCircle, Folder, RefreshCw, Edit3, SkipForward } from 'lucide-react';
import { documentsApi, foldersApi, api } from '../lib/api';

const formatBytes = (bytes: number) => {
  const mb = bytes / 1e6;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1e3;
  if (kb >= 1) return `${kb.toFixed(0)} KB`;
  return `${bytes} B`;
};

type ConflictChoice = 'rename' | 'replace' | 'skip';

interface DuplicateInfo {
  filename: string;
  suggestedName: string;
}

export const UploadModal: React.FC<{ onClose: () => void; folderId?: string }> = ({ onClose, folderId }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | undefined>(folderId);
  const [uploading, setUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [error, setError] = useState('');
  
  // Duplicate Conflict state
  const [conflicts, setConflicts] = useState<DuplicateInfo[]>([]);
  const [conflictChoices, setConflictChoices] = useState<Record<string, ConflictChoice>>({});
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [showConflictStep, setShowConflictStep] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const { data: foldersData } = useQuery({
    queryKey: ['folders'],
    queryFn: () => foldersApi.list().then((r) => r.data),
  });

  const folderList = Array.isArray(foldersData) ? foldersData : foldersData?.items || foldersData?.folders || [];

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files);
    setFiles((prev) => [...prev, ...dropped]);
    setShowConflictStep(false);
  };

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
      setShowConflictStep(false);
    }
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setShowConflictStep(false);
  };

  // Pre-check for duplicate files
  const initiateUpload = async () => {
    if (files.length === 0) return;
    setCheckingDuplicates(true);
    setError('');

    try {
      const res = await documentsApi.checkDuplicates(
        files.map((f) => f.name),
        selectedFolder
      );
      const dups: DuplicateInfo[] = res.data?.duplicates || [];

      if (dups.length > 0 && !showConflictStep) {
        setConflicts(dups);
        // Default choice to 'rename' for all detected duplicates
        const defaultChoices: Record<string, ConflictChoice> = {};
        dups.forEach((d) => {
          defaultChoices[d.filename] = 'rename';
        });
        setConflictChoices(defaultChoices);
        setShowConflictStep(true);
        setCheckingDuplicates(false);
        return;
      }

      // Proceed to actual upload execution
      await executeUpload();
    } catch (err: any) {
      console.error('[Duplicate Check Error]:', err);
      // Fallback to upload directly if check failed
      await executeUpload();
    } finally {
      setCheckingDuplicates(false);
    }
  };

  const executeUpload = async () => {
    setUploading(true);
    setError('');
    try {
      for (const file of files) {
        const choice = conflictChoices[file.name];
        if (choice === 'skip') {
          setUploadedCount((c) => c + 1);
          continue;
        }

        const mode: 'rename' | 'replace' = choice === 'replace' ? 'replace' : 'rename';
        const mime = file.type || 'application/octet-stream';

        // 1. Get presigned upload URL with chosen duplicate action mode
        const urlRes = await documentsApi.getUploadUrl(file.name, mime, file.size, selectedFolder, mode);
        const { uploadUrl } = urlRes.data;

        // 2. Upload file binary
        await api.put(uploadUrl, file, {
          headers: { 'Content-Type': mime },
        }).catch(async () => {
          await fetch(uploadUrl, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': mime },
          });
        });

        setUploadedCount((c) => c + 1);
      }

      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      qc.invalidateQueries({ queryKey: ['dashboard-recent'] });
      qc.invalidateQueries({ queryKey: ['recent-documents'] });
      qc.invalidateQueries({ queryKey: ['folders'] });
      setTimeout(onClose, 600);
    } catch (err: any) {
      console.error('[Upload Error]:', err);
      setError(err?.response?.data?.error || err?.message || 'Upload failed. Please check backend connection.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-bold text-slate-800">Upload Files</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {/* Destination Folder Selector */}
          <div className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-600">
            <span className="flex items-center gap-2 font-medium">
              <Folder className="h-4 w-4 text-violet-500" /> Destination Folder:
            </span>
            <select
              value={selectedFolder || ''}
              onChange={(e) => {
                setSelectedFolder(e.target.value || undefined);
                setShowConflictStep(false);
              }}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-700 outline-none focus:border-violet-400 cursor-pointer"
            >
              <option value="">(Root / No Folder)</option>
              {folderList.map((f: any) => (
                <option key={f.folderId} value={f.folderId}>
                  {f.folderName}
                </option>
              ))}
            </select>
          </div>

          {/* Duplicate Conflict Alert Step */}
          {showConflictStep && conflicts.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3 animate-fade-in">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                Duplicate File Detected ({conflicts.length})
              </div>
              <p className="text-xs text-amber-700">
                The following file(s) already exist in the destination. Please select an action:
              </p>
              <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                {conflicts.map((dup) => {
                  const currentChoice = conflictChoices[dup.filename] || 'rename';
                  return (
                    <div key={dup.filename} className="bg-white border border-amber-200 rounded-lg p-3 text-xs space-y-2">
                      <p className="font-semibold text-slate-800 truncate">📄 {dup.filename}</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setConflictChoices((prev) => ({ ...prev, [dup.filename]: 'rename' }))}
                          className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg font-medium transition-all ${
                            currentChoice === 'rename'
                              ? 'bg-violet-600 text-white shadow-sm'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                          title={`Rename to ${dup.suggestedName}`}
                        >
                          <Edit3 className="h-3 w-3" /> Rename ({dup.suggestedName.replace(/.*(\(\d+\)).*/, '$1')})
                        </button>
                        <button
                          type="button"
                          onClick={() => setConflictChoices((prev) => ({ ...prev, [dup.filename]: 'replace' }))}
                          className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg font-medium transition-all ${
                            currentChoice === 'replace'
                              ? 'bg-amber-600 text-white shadow-sm'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                          title="Overwrite existing document"
                        >
                          <RefreshCw className="h-3 w-3" /> Replace
                        </button>
                        <button
                          type="button"
                          onClick={() => setConflictChoices((prev) => ({ ...prev, [dup.filename]: 'skip' }))}
                          className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg font-medium transition-all ${
                            currentChoice === 'skip'
                              ? 'bg-slate-700 text-white shadow-sm'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                          title="Skip uploading this file"
                        >
                          <SkipForward className="h-3 w-3" /> Skip
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Drop zone */}
          {!showConflictStep && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-violet-400 hover:bg-violet-50 transition-colors"
            >
              <Upload className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-600 font-medium">Drop files here or click to browse</p>
              <p className="text-xs text-slate-400 mt-1">PDF, DOCX, PNG, JPG, TXT supported</p>
              <input
                ref={inputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleSelect}
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
              />
            </div>
          )}

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {files.map((f, i) => {
                const choice = conflictChoices[f.name];
                return (
                  <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5">
                    <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 truncate font-medium">{f.name}</p>
                      {choice && (
                        <p className="text-[10px] font-semibold text-violet-600">
                          {choice === 'replace' ? '🔄 Will Replace Existing' : choice === 'skip' ? '⏭️ Skipped' : '🏷️ Will Rename with (1)'}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 flex-shrink-0">{formatBytes(f.size)}</span>
                    {!uploading && (
                      <button onClick={() => removeFile(i)} className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {uploading && i < uploadedCount && <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />}
                    {uploading && i === uploadedCount && <Loader2 className="h-4 w-4 text-violet-500 animate-spin flex-shrink-0" />}
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="btn-ghost rounded-xl px-4 py-2 text-sm">Cancel</button>
          <button
            onClick={initiateUpload}
            disabled={files.length === 0 || uploading || checkingDuplicates}
            className="btn-primary rounded-xl px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {checkingDuplicates ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Checking…</>
            ) : uploading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
            ) : showConflictStep ? (
              <><Upload className="h-4 w-4" /> Confirm & Upload</>
            ) : (
              <><Upload className="h-4 w-4" /> Upload {files.length > 0 ? `(${files.length})` : ''}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
