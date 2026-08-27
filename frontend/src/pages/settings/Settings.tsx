import React, { useState, useEffect } from 'react';
import { Shield, Bell, Palette, Globe, Key, Trash2, ChevronRight, Check, Moon, Sun, CheckCircle } from 'lucide-react';

type Section = 'security' | 'notifications' | 'appearance' | 'language' | 'danger';

const sections: { id: Section; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'security', label: 'Security', icon: Shield, description: 'Password, 2FA, sessions' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Email and push alerts' },
  { id: 'appearance', label: 'Appearance', icon: Palette, description: 'Theme and display' },
  { id: 'language', label: 'Language & Region', icon: Globe, description: 'Language, timezone, date format' },
  { id: 'danger', label: 'Danger Zone', icon: Trash2, description: 'Account deletion' },
];

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none cursor-pointer ${checked ? 'bg-violet-500' : 'bg-slate-200'}`}
    role="switch"
    aria-checked={checked}
  >
    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
  </button>
);

export const Settings: React.FC = () => {
  const [active, setActive] = useState<Section>('security');

  // Security
  const [twoFA, setTwoFA] = useState(false);
  const [sessionAlert, setSessionAlert] = useState(true);

  // Notifications
  const [emailUploads, setEmailUploads] = useState(true);
  const [emailShares, setEmailShares] = useState(true);
  const [emailSecurity, setEmailSecurity] = useState(true);
  const [pushAll, setPushAll] = useState(false);

  // Appearance
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('theme') as 'light' | 'dark') || 'light');
  const [density, setDensity] = useState<'comfortable' | 'compact'>(() => (localStorage.getItem('density') as 'comfortable' | 'compact') || 'comfortable');
  const [savedToast, setSavedToast] = useState(false);

  // Sync theme changes globally to <html> tag & localStorage
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Sync density changes globally to <html> tag & localStorage
  useEffect(() => {
    if (density === 'compact') {
      document.documentElement.classList.add('compact-density');
    } else {
      document.documentElement.classList.remove('compact-density');
    }
    localStorage.setItem('density', density);
  }, [density]);

  // Language & Region
  const [language, setLanguage] = useState(() => localStorage.getItem('app_language') || 'en');
  const [timezone, setTimezone] = useState(() => localStorage.getItem('app_timezone') || 'Asia/Kolkata');
  const [dateFormat, setDateFormat] = useState(() => localStorage.getItem('app_date_format') || 'DD/MM/YYYY');

  useEffect(() => {
    localStorage.setItem('app_language', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('app_timezone', timezone);
  }, [timezone]);

  useEffect(() => {
    localStorage.setItem('app_date_format', dateFormat);
  }, [dateFormat]);

  const activeSection = sections.find((s) => s.id === active)!;

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your account preferences and security</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        {/* Sidebar */}
        <div className="sm:w-52 flex-shrink-0">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            {sections.map((s) => {
              const Icon = s.icon;
              const isActive = active === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
                  className={`w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors border-b border-slate-100 last:border-b-0 ${isActive ? 'bg-violet-50 text-violet-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 flex-shrink-0 ${s.id === 'danger' ? 'text-red-500' : isActive ? 'text-violet-600' : 'text-slate-400'}`} />
                    <span className={`text-sm font-medium ${s.id === 'danger' ? 'text-red-500' : ''}`}>{s.label}</span>
                  </div>
                  {isActive && <ChevronRight className="h-3.5 w-3.5 text-violet-400" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content panel */}
        <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-6">
          <div className="mb-5 pb-5 border-b border-slate-100">
            <h2 className="font-bold text-slate-800">{activeSection.label}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{activeSection.description}</p>
          </div>

          {/* Security */}
          {active === 'security' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Change Password</p>
                  <p className="text-xs text-slate-400">Update your account password</p>
                </div>
                <button className="btn-ghost rounded-xl px-3 py-1.5 text-sm flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5" /> Change
                </button>
              </div>
              <div className="flex items-center justify-between py-4 border-t border-slate-100">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Two-Factor Authentication</p>
                  <p className="text-xs text-slate-400">Add an extra layer of security to your account</p>
                </div>
                <Toggle checked={twoFA} onChange={setTwoFA} />
              </div>
              <div className="flex items-center justify-between py-4 border-t border-slate-100">
                <div>
                  <p className="text-sm font-semibold text-slate-700">New session alerts</p>
                  <p className="text-xs text-slate-400">Receive an email when a new device signs in</p>
                </div>
                <Toggle checked={sessionAlert} onChange={setSessionAlert} />
              </div>
              <div className="pt-4 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Active Sessions</p>
                <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Current browser session</p>
                    <p className="text-xs text-slate-400 mt-0.5">Windows — Chrome · {new Date().toLocaleDateString()}</p>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full badge-success">Active</span>
                </div>
              </div>
            </div>
          )}

          {/* Notifications */}
          {active === 'notifications' && (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email Notifications</p>
              {[
                { label: 'File uploads', sub: 'Get notified when files are uploaded', val: emailUploads, set: setEmailUploads },
                { label: 'Shares received', sub: 'When someone shares a document with you', val: emailShares, set: setEmailShares },
                { label: 'Security alerts', sub: 'Suspicious login or account changes', val: emailSecurity, set: setEmailSecurity },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-3.5 border-b border-slate-100 last:border-b-0">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{item.label}</p>
                    <p className="text-xs text-slate-400">{item.sub}</p>
                  </div>
                  <Toggle checked={item.val} onChange={item.set} />
                </div>
              ))}
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider pt-4">Push Notifications</p>
              <div className="flex items-center justify-between py-3.5 border-b border-slate-100">
                <div>
                  <p className="text-sm font-semibold text-slate-700">All push notifications</p>
                  <p className="text-xs text-slate-400">Requires browser permission</p>
                </div>
                <Toggle checked={pushAll} onChange={setPushAll} />
              </div>
            </div>
          )}

          {/* Appearance */}
          {active === 'appearance' && (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-3">Theme</p>
                <div className="grid grid-cols-2 gap-3">
                  {(['light', 'dark'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all ${theme === t ? 'border-violet-400 bg-violet-50' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                      {t === 'light' ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-indigo-400" />}
                      <span className="text-sm font-medium capitalize text-slate-700">{t} Mode</span>
                      {theme === t && <Check className="h-3.5 w-3.5 text-violet-500 ml-auto" />}
                    </button>
                  ))}
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <p className="text-sm font-semibold text-slate-700 mb-3">List Density</p>
                <div className="flex gap-3">
                  {(['comfortable', 'compact'] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDensity(d)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all ${density === d ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600'}`}
                    >
                      <span className="text-sm font-medium capitalize">{d}</span>
                      {density === d && <Check className="h-3.5 w-3.5" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Language */}
          {active === 'language' && (
            <div className="space-y-5">
              {[
                { label: 'Display Language', val: language, set: setLanguage, options: [['en', 'English'], ['es', 'Español'], ['fr', 'Français'], ['de', 'Deutsch'], ['hi', 'हिन्दी']] },
                { label: 'Timezone', val: timezone, set: setTimezone, options: [['Asia/Kolkata', 'Asia/Kolkata (IST)'], ['America/New_York', 'America/New_York (EST)'], ['Europe/London', 'Europe/London (GMT)'], ['Asia/Tokyo', 'Asia/Tokyo (JST)']] },
                { label: 'Date Format', val: dateFormat, set: setDateFormat, options: [['DD/MM/YYYY', 'DD/MM/YYYY'], ['MM/DD/YYYY', 'MM/DD/YYYY'], ['YYYY-MM-DD', 'YYYY-MM-DD']] },
              ].map(({ label, val, set, options }) => (
                <div key={label} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{label}</p>
                  </div>
                  <select
                    value={val as string}
                    onChange={(e) => (set as any)(e.target.value)}
                    className="input-field rounded-xl px-3 py-2 text-sm sm:w-56"
                  >
                    {(options as [string, string][]).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}

          {/* Danger Zone */}
          {active === 'danger' && (
            <div className="space-y-4">
              <div className="rounded-xl border-2 border-red-100 bg-red-50 p-5">
                <p className="text-sm font-bold text-red-700 mb-1">Delete Account</p>
                <p className="text-xs text-red-500 mb-4">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
                <button className="text-sm font-semibold px-4 py-2 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center gap-2">
                  <Trash2 className="h-4 w-4" /> Delete my account
                </button>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                <p className="text-sm font-bold text-amber-700 mb-1">Export All Data</p>
                <p className="text-xs text-amber-600 mb-4">
                  Download a copy of all your documents and account data in a ZIP archive.
                </p>
                <button className="text-sm font-semibold px-4 py-2 rounded-xl bg-white border border-amber-300 text-amber-700 hover:bg-amber-100 transition-colors">
                  Request data export
                </button>
              </div>
            </div>
          )}

          {/* Save changes */}
          {active !== 'danger' && active !== 'security' && (
            <div className="pt-5 mt-5 border-t border-slate-100 flex items-center justify-between">
              {savedToast ? (
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-xl animate-fade-in">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  <span>Preferences saved successfully!</span>
                </div>
              ) : <div />}
              <button
                onClick={() => {
                  setSavedToast(true);
                  setTimeout(() => setSavedToast(false), 2500);
                }}
                className="btn-primary rounded-xl px-5 py-2 text-sm flex items-center gap-2 cursor-pointer"
              >
                <Check className="h-4 w-4" /> Save Changes
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
