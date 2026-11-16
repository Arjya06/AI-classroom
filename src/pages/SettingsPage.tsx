import React, { useEffect, useState } from 'react';
import { Save, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authApi, extractErrorMessage, settingsApi } from '../services/api';
import type { TeacherSettings } from '../types';
import { ErrorBanner, LoadingSkeleton } from '../components/StateViews';

export function SettingsPage() {
  const { teacher, refreshProfile } = useAuth();
  const [settings, setSettings] = useState<TeacherSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    if (teacher) {
      setFullName(teacher.name);
      setDepartment(teacher.department);
    }
  }, [teacher]);

  useEffect(() => {
    settingsApi
      .get()
      .then(setSettings)
      .catch((err) => setError(extractErrorMessage(err, 'Failed to load settings.')))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSkeleton rows={6} />;
  if (!settings) return <ErrorBanner message={error} />;

  const weightSum = settings.includeParticipation
    ? settings.attentionWeight + settings.presenceWeight + settings.participationWeight
    : settings.attentionWeight + settings.presenceWeight;

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (Math.abs(weightSum - 100) > 0.1) {
      setError(`Active scoring weights must sum to 100% (currently ${weightSum}%).`);
      return;
    }
    if (settings.moderateThreshold >= settings.highThreshold) {
      setError('Moderate threshold must be lower than the High engagement threshold.');
      return;
    }

    setSaving(true);
    try {
      const updated = await settingsApi.update(settings);
      setSettings(updated);
      setSuccessMsg('Monitoring & scoring settings saved successfully.');
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not save settings.'));
    } finally {
      setSaving(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileMsg('');
    if (!fullName.trim()) {
      setProfileError('Full name is required.');
      return;
    }
    setProfileSaving(true);
    try {
      await authApi.updateProfile({
        name: fullName.trim(),
        department: department.trim() || 'Computer Science & Engineering',
      });
      await refreshProfile();
      setProfileMsg('Teacher profile updated successfully.');
    } catch (err) {
      setProfileError(extractErrorMessage(err, 'Failed to update teacher profile.'));
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Configure transparent scoring weights, prototype engagement thresholds, sampling interval, and your teacher profile.
        </p>
      </div>

      {/* Teacher Profile Summary & Edit */}
      <form onSubmit={handleProfileSubmit} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-indigo-600" />
          <h2 className="text-base font-semibold text-slate-900">Teacher Profile</h2>
        </div>

        <ErrorBanner message={profileError} onDismiss={() => setProfileError('')} />
        {profileMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
            {profileMsg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Workspace Email</label>
            <input
              type="email"
              value={teacher?.email || ''}
              disabled
              className="w-full px-3 py-2 text-sm border border-slate-200 bg-slate-50 text-slate-500 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Department</label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={profileSaving}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-60"
        >
          {profileSaving ? 'Updating...' : 'Update Profile'}
        </button>
      </form>

      {/* Scoring Weights & Monitoring Config */}
      <form onSubmit={handleSaveSettings} className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Engagement Scoring & Camera Settings</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Active weights must sum to 100%. Default: 50% Attention + 30% Face Presence + 20% Participation.
            </p>
          </div>
          <span className="font-mono-tabular text-xs font-semibold text-slate-700">
            Total Weight: {weightSum}%
          </span>
        </div>

        <ErrorBanner message={error} onDismiss={() => setError('')} />
        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
            {successMsg}
          </div>
        )}

        <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.includeParticipation}
            onChange={(e) => {
              const inc = e.target.checked;
              setSettings({
                ...settings,
                includeParticipation: inc,
                attentionWeight: inc ? 50 : 62.5,
                presenceWeight: inc ? 30 : 37.5,
                participationWeight: inc ? 20 : 0,
              });
            }}
            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span>Include teacher-recorded participation events in composite engagement score</span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Attention Orientation Weight (%)</label>
            <input
              type="number"
              step="0.5"
              min="0"
              max="100"
              value={settings.attentionWeight}
              onChange={(e) => setSettings({ ...settings, attentionWeight: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-tabular"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Face Presence Weight (%)</label>
            <input
              type="number"
              step="0.5"
              min="0"
              max="100"
              value={settings.presenceWeight}
              onChange={(e) => setSettings({ ...settings, presenceWeight: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-tabular"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Participation Weight (%)</label>
            <input
              type="number"
              step="0.5"
              min="0"
              max="100"
              disabled={!settings.includeParticipation}
              value={settings.participationWeight}
              onChange={(e) => setSettings({ ...settings, participationWeight: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-tabular disabled:bg-slate-50"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">High Threshold (%)</label>
            <input
              type="number"
              min="50"
              max="95"
              value={settings.highThreshold}
              onChange={(e) => setSettings({ ...settings, highThreshold: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-tabular"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Moderate Threshold (%)</label>
            <input
              type="number"
              min="20"
              max="74"
              value={settings.moderateThreshold}
              onChange={(e) => setSettings({ ...settings, moderateThreshold: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-tabular"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Sampling Interval (sec)</label>
            <input
              type="number"
              min="1"
              max="30"
              value={settings.samplingInterval}
              onChange={(e) => setSettings({ ...settings, samplingInterval: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-tabular"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Data Retention (days)</label>
            <input
              type="number"
              min="7"
              max="365"
              value={settings.retentionDays}
              onChange={(e) => setSettings({ ...settings, retentionDays: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-tabular"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Preferred Camera Label</label>
          <input
            type="text"
            value={settings.preferredCameraLabel}
            onChange={(e) => setSettings({ ...settings, preferredCameraLabel: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
        </button>
      </form>
    </div>
  );
}
