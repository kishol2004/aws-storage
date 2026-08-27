import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchApi, documentsApi } from '../../lib/api';
import { formatAppDate } from '../../lib/dateUtils';
import { Document } from '../../types';
import { Search, FileText, Brain, Loader2, AlertCircle, Sparkles, ExternalLink } from 'lucide-react';

const formatBytes = (bytes: number) => {
  const mb = bytes / 1e6;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1e3).toFixed(0)} KB`;
};

export const AISearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['ai-search', submitted],
    queryFn: () => searchApi.search({ q: submitted }).then((r) => r.data),
    enabled: submitted.length > 0,
  });

  const results: Document[] = data?.items || [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) setSubmitted(query.trim());
  };

  const handleViewDoc = async (docId: string) => {
    try {
      const res = await documentsApi.download(docId);
      if (res.data?.downloadUrl) {
        window.open(res.data.downloadUrl, '_blank');
      }
    } catch (err) {
      console.error('Failed to view document:', err);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">AI Search</h1>
        <p className="text-sm text-slate-500 mt-0.5">Search your documents using natural language</p>
      </div>

      {/* Search box */}
      <form onSubmit={handleSearch}>
        <div className="relative">
          <Brain className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-violet-500 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Try "Q3 financial reports" or "signed contracts from August"…'
            className="input-field w-full rounded-2xl pl-12 pr-28 py-4 text-sm shadow-sm"
          />
          <button
            type="submit"
            disabled={!query.trim() || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 btn-primary rounded-xl px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </button>
        </div>
      </form>

      {/* Suggestions chips (pre-search) */}
      {!submitted && (
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Try searching for</p>
          <div className="flex flex-wrap gap-2">
            {[
              'Financial records',
              'Engineering specs',
              'Software architecture',
              'Reports',
              'Contracts',
              'Technical documentation',
            ].map((s) => (
              <button
                key={s}
                onClick={() => { setQuery(s); setSubmitted(s); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-50 border border-violet-100 text-sm text-violet-700 hover:bg-violet-100 transition-colors cursor-pointer"
              >
                <Sparkles className="h-3 w-3" />
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          Backend error while performing search. Please ensure API is running.
        </div>
      )}

      {submitted && !isLoading && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-400" />
            <span className="text-sm text-slate-600">
              {results.length > 0 ? `${results.length} results for` : 'No results for'}{' '}
              <span className="font-semibold text-slate-800">"{submitted}"</span>
            </span>
          </div>
          {results.length === 0 ? (
            <div className="py-16 flex flex-col items-center text-center">
              <Brain className="h-10 w-10 text-slate-200 mb-3" />
              <p className="text-sm font-semibold text-slate-600 mb-1">No documents found</p>
              <p className="text-xs text-slate-400">Try different keywords or upload documents first</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {results.map((doc) => (
                <div
                  key={doc.documentId}
                  onClick={() => handleViewDoc(doc.documentId)}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-violet-50/50 transition-colors cursor-pointer group"
                >
                  <div className="h-9 w-9 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center flex-shrink-0 group-hover:border-violet-200">
                    <FileText className="h-4 w-4 text-violet-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-800 truncate group-hover:text-violet-600 transition-colors">
                        {doc.originalFilename || doc.filename || 'Untitled'}
                      </p>
                      {doc.category && (
                        <span className="text-[10px] font-semibold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full uppercase">
                          {doc.category}
                        </span>
                      )}
                    </div>
                    {doc.summary && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{doc.summary}</p>}
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                      <span>{formatBytes(doc.fileSize ?? doc.size ?? 0)}</span>
                      <span>·</span>
                      <span>{formatAppDate(doc.updatedAt)}</span>
                    </p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs text-violet-600 font-semibold flex items-center gap-1 bg-violet-100/70 px-2.5 py-1 rounded-lg">
                      <ExternalLink className="h-3.5 w-3.5" /> View
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
