import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { User, Mail, Shield, Calendar, Edit2, Save, X, Loader2, KeyRound, CheckCircle2, Lock } from 'lucide-react';

export const Profile: React.FC = () => {
  const { user, switchRole } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Simstant save update
      await new Promise((r) => setTimeout(r, 600));
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const toggleRole = () => {
    const nextRole = user?.role === 'ADMIN' ? 'USER' : 'ADMIN';
    switchRole(nextRole);
  };

  const initial = user?.name?.[0]?.toUpperCase() || 'U';
  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Account & Permissions</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your profile details and view role-based authorization privileges</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        {/* Avatar & Header */}
        <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-5">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-violet-500/20 flex-shrink-0">
              {initial}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">{user?.name}</h2>
              <p className="text-sm text-slate-500">{user?.email}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full ${isAdmin ? 'bg-violet-100 text-violet-700 border border-violet-200' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                  <Shield className="h-3 w-3" />
                  {user?.role}
                </span>
                <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Active Session
                </span>
              </div>
            </div>
          </div>

          {/* Quick Role Switcher Button */}
          <button
            onClick={toggleRole}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100 rounded-xl transition-all cursor-pointer"
            title="Switch between Admin and User role for testing"
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>Switch to {isAdmin ? 'USER' : 'ADMIN'} Role</span>
          </button>
        </div>

        {/* Profile Fields */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> Full Name
            </label>
            {editing ? (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field w-full rounded-xl px-4 py-2.5 text-sm"
                autoFocus
              />
            ) : (
              <p className="text-sm font-medium text-slate-800 px-1">{user?.name}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> Email Address
            </label>
            <p className="text-sm font-medium text-slate-800 px-1">{user?.email}</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-violet-600" /> Active System Role
            </label>
            <div className="flex items-center justify-between px-1">
              <p className="text-sm font-semibold text-slate-800">{user?.role === 'ADMIN' ? 'System Administrator (ADMIN)' : 'Standard User (USER)'}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Member Since
            </label>
            <p className="text-sm font-medium text-slate-800 px-1">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
            </p>
          </div>
        </div>

        {/* Edit Actions */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex justify-end gap-3">
          {editing ? (
            <>
              <button onClick={() => { setEditing(false); setName(user?.name || ''); }} className="btn-ghost rounded-xl px-4 py-2 text-sm flex items-center gap-2">
                <X className="h-4 w-4" /> Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="btn-primary rounded-xl px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-60 cursor-pointer">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Changes
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="btn-ghost rounded-xl px-4 py-2 text-sm flex items-center gap-2 cursor-pointer">
              <Edit2 className="h-4 w-4" /> Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* RBAC Privileges Breakdown Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-violet-600" />
            <h3 className="text-sm font-bold text-slate-800">Role Privileges & Permissions</h3>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {isAdmin ? 'Administrator Level' : 'User Level'}
          </span>
        </div>

        <div className="space-y-3">
          {isAdmin ? (
            <>
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-violet-50/60 border border-violet-100">
                <CheckCircle2 className="h-4 w-4 text-violet-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-violet-950">Full Admin Console Access</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">Access system statistics, user lists, status updates, and security logs at `/admin`.</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-violet-50/60 border border-violet-100">
                <CheckCircle2 className="h-4 w-4 text-violet-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-violet-950">User Management & Status Control</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">Inspect user accounts and toggle active vs disabled statuses.</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-violet-50/60 border border-violet-100">
                <CheckCircle2 className="h-4 w-4 text-violet-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-violet-950">Security Audit Logs & Metrics</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">Review audit event logs and global storage usage across all users.</p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-slate-800">Personal Workspace Access</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">Full permission to upload, organize, search, and manage personal documents and folders.</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-slate-800">Granular Sharing Controls</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">Share documents securely with custom VIEW, DOWNLOAD, or EDIT permissions.</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <Lock className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-slate-800">Admin Console Restricted</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">Requires elevation to `ADMIN` role or authentication via Admin Portal.</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

