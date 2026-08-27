import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FolderPlus, Loader2, X } from 'lucide-react';
import { foldersApi } from '../lib/api';

export const NewFolderModal: React.FC<{ onClose: () => void; onSuccess?: (folderId: string) => void }> = ({ onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => foldersApi.create(name.trim()),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['folders'] });
      const newFolderId = res?.data?.folderId;
      if (onSuccess && newFolderId) {
        onSuccess(newFolderId);
      }
      onClose();
    },
    onError: (err: any) => setError(err.response?.data?.error || err.response?.data?.message || 'Failed to create folder'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-fade-in-up p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-800">New Folder</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Folder name"
            className="input-field w-full rounded-xl px-4 py-2.5 text-sm mb-3"
          />
          {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="btn-ghost rounded-xl px-4 py-2 text-sm">Cancel</button>
            <button
              type="submit"
              disabled={!name.trim() || mutation.isPending}
              className="btn-primary rounded-xl px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-60"
            >
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
