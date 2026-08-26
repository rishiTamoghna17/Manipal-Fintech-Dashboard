import React, { useState } from 'react';
import { Bell, Shield, Database, Palette, Globe, Link, Save, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { getApiBaseUrl, getAuthToken } from '../../utils/apiAuth';

interface SettingsTabProps {
  darkMode: boolean;
  toggleDark: () => void;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ darkMode, toggleDark }) => {
  const baseUrl = getApiBaseUrl();
  const [notifications, setNotifications] = useState({ email: true, slack: false, weekly: true, alerts: true });
  const [dataRefresh, setDataRefresh] = useState('5');
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');

  const [accentColor, setAccentColor] = useState('#3b82f6');
  const [lang, setLang] = useState('English (India)');
  const [currency, setCurrency] = useState('INR (₹)');
  const [tz, setTz] = useState('IST (UTC+5:30)');
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    try {
      const bearerToken = await getAuthToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bearerToken}`,
      };
      const cleanBase = baseUrl.replace(/\/+$/, '');
      const endpoint = `${cleanBase}/api/v2/onboarding/leads/list/`;
      const res = await fetch(endpoint, { headers });
      setTestStatus(res.ok ? 'ok' : 'fail');
    } catch {
      setTestStatus('fail');
    }
    setTimeout(() => setTestStatus('idle'), 4000);
  };

  const Section: React.FC<{ title: string; subtitle: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, subtitle, icon, children }) => (
    <div className={`rounded-2xl border p-5 ${darkMode ? 'bg-gray-800/60 border-gray-700' : 'bg-white border-gray-100'}`}>
      <div className="flex items-center gap-2 mb-4 pb-4 border-b border-dashed" style={{ borderColor: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
        <span className="text-brand-blue">{icon}</span>
        <div>
          <h3 className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
          <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );

  const Toggle: React.FC<{ checked: boolean; onChange: () => void; label: string; sub?: string }> = ({ checked, onChange, label, sub }) => (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{label}</p>
        {sub && <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{sub}</p>}
      </div>
      <button
        onClick={onChange}
        className={`relative w-10 h-5 rounded-full transition-all cursor-pointer ${checked ? 'bg-brand-blue' : darkMode ? 'bg-gray-600' : 'bg-gray-200'}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? 'left-5' : 'left-0.5'}`} />
      </button>
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      {/* API Configuration */}
      <Section title="API Configuration" subtitle="Connect to your Manipal Fintech backend" icon={<Link size={16} />}>
        <div className="space-y-4">
          <div>
            <label className={`text-xs font-medium block mb-1.5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Backend Base URL</label>
            <input
              value={baseUrl}
              readOnly
              className={`w-full px-3 py-2 rounded-xl border text-xs font-mono ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-600'} outline-none`}
            />
          </div>
          <div>
            <label className={`text-xs font-medium block mb-1.5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              OAuth2 Bearer Token <span className="text-brand-blue font-normal">(Authorization: Bearer header)</span>
            </label>
            <input
              type="password"
              value="Automatically obtained from /user/login/"
              readOnly
              className={`w-full px-3 py-2 rounded-xl border text-xs font-mono ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder:text-gray-500' : 'bg-white border-gray-200 text-gray-700 placeholder:text-gray-400'} outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20`}
            />
            <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Sent as <code className="font-mono">Authorization: Bearer &lt;token&gt;</code> header to live Manipal API endpoints.
            </p>
          </div>

          {/* Active Endpoints */}
          <div>
            <label className={`text-xs font-medium block mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Live Endpoints</label>
            <div className="space-y-1.5">
              {[
                { path: '/api/v2/onboarding/leads/list/', label: 'Live Leads List' },
                { path: '/api/v2/onboarding/applications/list/', label: 'Live Applications' },
                { path: '/loan/all/', label: 'Loan Portfolio & Disbursals' },
                { path: '/user/employee', label: 'Team & Field Officers' },
                { path: '/branch/data', label: 'Branch Analytics' },
              ].map(ep => (
                <div key={ep.path} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                  <code className={`text-xs font-mono flex-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{ep.path}</code>
                  <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{ep.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Test Connection */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleTestConnection}
              disabled={testStatus === 'testing'}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                darkMode
                  ? 'border-brand-blue/40 text-blue-400 hover:bg-brand-blue/10 disabled:opacity-50'
                  : 'border-brand-blue/20 text-brand-blue hover:bg-blue-50 disabled:opacity-50'
              }`}
            >
              {testStatus === 'testing' ? (
                <RefreshCw size={12} className="animate-spin" />
              ) : testStatus === 'ok' ? (
                <CheckCircle size={12} className="text-emerald-500" />
              ) : testStatus === 'fail' ? (
                <AlertCircle size={12} className="text-rose-500" />
              ) : (
                <RefreshCw size={12} />
              )}
              {testStatus === 'testing' ? 'Testing...' : testStatus === 'ok' ? 'Connected!' : testStatus === 'fail' ? 'Failed — Check Key' : 'Test Connection'}
            </button>
            {testStatus === 'ok' && <span className="text-xs text-emerald-500">Backend is reachable ✓</span>}
            {testStatus === 'fail' && <span className="text-xs text-rose-500">Cannot reach backend — check URL and API key</span>}
          </div>

          <div>
            <label className={`text-xs font-medium block mb-1.5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Auto-Refresh Interval</label>
            <select
              value={dataRefresh}
              onChange={e => setDataRefresh(e.target.value)}
              className={`px-3 py-2 rounded-xl border text-xs cursor-pointer ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-200 text-gray-700'} outline-none`}
            >
              {['1', '5', '10', '15', '30', '60'].map(v => (
                <option key={v} value={v}>{v} minute{v === '1' ? '' : 's'}</option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      {/* Appearance */}
      <Section title="Appearance" subtitle="Customize the dashboard look and feel" icon={<Palette size={16} />}>
        <div className="space-y-2">
          <Toggle
            checked={darkMode}
            onChange={toggleDark}
            label="Dark Mode"
            sub="Switch between light and dark theme"
          />
          <div className="py-2">
            <p className={`text-sm mb-3 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Accent Color</p>
            <div className="flex gap-2">
              {['#6366f1', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'].map(color => (
                <button
                  key={color}
                  onClick={() => setAccentColor(color)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                    accentColor === color ? 'border-white scale-110 ring-2 ring-brand-blue ring-offset-2' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ background: color }}
                />
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Notifications */}
      <Section title="Notifications" subtitle="Control your alert preferences" icon={<Bell size={16} />}>
        <div className="space-y-1 divide-y" style={{ borderColor: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}>
          <Toggle checked={notifications.email} onChange={() => setNotifications(n => ({ ...n, email: !n.email }))} label="Email Notifications" sub="Receive daily digest emails" />
          <Toggle checked={notifications.slack} onChange={() => setNotifications(n => ({ ...n, slack: !n.slack }))} label="Slack Notifications" sub="Push alerts to your Slack workspace" />
          <Toggle checked={notifications.weekly} onChange={() => setNotifications(n => ({ ...n, weekly: !n.weekly }))} label="Weekly Report" sub="Get weekly summary every Monday" />
          <Toggle checked={notifications.alerts} onChange={() => setNotifications(n => ({ ...n, alerts: !n.alerts }))} label="NPA Alerts" sub="Immediate alerts for loans exceeding 90 DPD" />
        </div>
      </Section>

      {/* Data & Privacy */}
      <Section title="Data & Privacy" subtitle="Data retention and privacy settings" icon={<Database size={16} />}>
        <div className="space-y-3">
          {[
            { label: 'Data Retention', value: '12 months' },
            { label: 'Export Format', value: 'CSV + Excel' },
            { label: 'Anonymize PII', value: 'Enabled' },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between">
              <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{item.label}</span>
              <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{item.value}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Security */}
      <Section title="Security" subtitle="Access control and security settings" icon={<Shield size={16} />}>
        <div className="space-y-3">
          {[
            { label: 'API Key Authentication', status: 'Active', color: 'text-emerald-500' },
            { label: 'HTTPS Enforcement', status: 'Active', color: 'text-emerald-500' },
            { label: 'IP Allowlist', status: 'Not configured', color: 'text-amber-500' },
            { label: 'Audit Log', status: 'Active', color: 'text-emerald-500' },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between">
              <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{item.label}</span>
              <span className={`text-xs font-semibold ${item.color}`}>{item.status}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Localization */}
      <Section title="Localization" subtitle="Language and regional settings" icon={<Globe size={16} />}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={`text-xs font-medium block mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Language</label>
            <select value={lang} onChange={e => setLang(e.target.value)} className={`w-full px-3 py-2 rounded-xl border text-xs cursor-pointer ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-200 text-gray-700'} outline-none`}>
              {['English (India)', 'Hindi (हिंदी)', 'Kannada (ಕನ್ನಡ)', 'Tamil (தமிழ்)'].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className={`text-xs font-medium block mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Currency</label>
            <select value={currency} onChange={e => setCurrency(e.target.value)} className={`w-full px-3 py-2 rounded-xl border text-xs cursor-pointer ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-200 text-gray-700'} outline-none`}>
              {['INR (₹)', 'USD ($)', 'EUR (€)'].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className={`text-xs font-medium block mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Timezone</label>
            <select value={tz} onChange={e => setTz(e.target.value)} className={`w-full px-3 py-2 rounded-xl border text-xs cursor-pointer ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-200 text-gray-700'} outline-none`}>
              {['IST (UTC+5:30)', 'UTC (UTC+0:00)', 'EST (UTC-5:00)'].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className={`text-xs font-medium block mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Date Format</label>
            <select value={dateFormat} onChange={e => setDateFormat(e.target.value)} className={`w-full px-3 py-2 rounded-xl border text-xs cursor-pointer ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-200 text-gray-700'} outline-none`}>
              {['DD/MM/YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY'].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>
      </Section>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            saved
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
              : 'bg-brand-blue hover:bg-brand-blue-hover text-white shadow-md shadow-brand-blue/10 hover:shadow-brand-blue/25 hover:scale-105 cursor-pointer'
          }`}
        >
          <Save size={15} />
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};

export default SettingsTab;
