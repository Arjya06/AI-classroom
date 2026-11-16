import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { analyticsApi, extractErrorMessage } from '../services/api';
import type { Student } from '../types';
import { ErrorBanner, LoadingSkeleton } from '../components/StateViews';
import { formatDateTime } from '../utils/exportUtils';

interface HistoryItem {
  recordId: number;
  sessionId: number;
  sessionTitle: string;
  timestamp: string;
  facePresenceScore: number;
  attentionOrientationScore: number;
  participationScore: number | null;
  finalEngagementScore: number;
  dataQualityStatus: string;
  isDemo: boolean;
}

export function StudentProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const studentId = Number(id);

  const [student, setStudent] = useState<Student | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await analyticsApi.student(studentId);
        setStudent(res.student);
        setHistory(res.history);
      } catch (err) {
        setError(extractErrorMessage(err, 'Failed to load student profile.'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [studentId]);

  if (loading) return <LoadingSkeleton rows={5} />;
  if (error) return <ErrorBanner message={error} />;
  if (!student) return null;

  const chartData = history.map((h) => ({
    label: h.sessionTitle.replace(' [DEMO]', '').slice(0, 18),
    engagement: h.finalEngagementScore,
    attention: h.attentionOrientationScore,
    presence: h.facePresenceScore,
  }));

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate('/students')}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Students</span>
      </button>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{student.studentName}</h1>
            <div className="mt-1 text-sm text-slate-600">
              Roll {student.rollNumber} · {student.email} · {student.classroomName} · Enrolled {student.enrollmentDate}
              {student.isDemo ? ' · Demo Record' : ''}
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Note: Engagement metrics reflect approximate visual attention orientation and face presence indicators recorded during monitored sessions. They do not measure intelligence, emotion, or internal focus.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Average Engagement</div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono-tabular">
            {student.sessionsAttended > 0 ? `${student.averageEngagement}%` : 'No Data'}
          </div>
          <div className="mt-1 text-xs text-slate-500">Category: {student.engagementCategory}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Attendance Percentage</div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono-tabular">{student.attendancePercentage}%</div>
          <div className="mt-1 text-xs text-slate-500">Based on logged roll calls</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Sessions Recorded</div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono-tabular">{student.sessionsAttended}</div>
          <div className="mt-1 text-xs text-slate-500">With individual station records</div>
        </div>
      </div>

      {/* Engagement Trend Chart */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-semibold text-slate-900">Engagement Trend</h2>
        <p className="text-xs text-slate-500 mt-0.5 mb-4">
          Session-by-session progression of composite engagement, attention orientation, and face presence.
        </p>
        {chartData.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            No individual engagement history recorded for this student yet.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#FFF', borderColor: '#E2E8F0', borderRadius: '8px', fontSize: '12px' }} />
                <Line type="monotone" dataKey="engagement" name="Engagement (%)" stroke="#4F46E5" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="attention" name="Attention Orientation" stroke="#0284C7" strokeWidth={1.8} />
                <Line type="monotone" dataKey="presence" name="Face Presence" stroke="#16A34A" strokeWidth={1.8} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Recent Session Records */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Engagement History Records</h2>
        </div>
        {history.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No session records available.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-6">Session</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4 text-right">Face Presence</th>
                  <th className="py-3 px-4 text-right">Attention Orientation</th>
                  <th className="py-3 px-4 text-right">Participation</th>
                  <th className="py-3 px-4 text-right">Final Score</th>
                  <th className="py-3 px-6">Data Quality</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {history.map((h) => (
                  <tr key={h.recordId} className="hover:bg-slate-50/80">
                    <td className="py-3 px-6 font-medium text-slate-900">{h.sessionTitle}</td>
                    <td className="py-3 px-4 text-xs text-slate-500">{formatDateTime(h.timestamp)}</td>
                    <td className="py-3 px-4 text-right font-mono-tabular text-slate-700">{h.facePresenceScore}%</td>
                    <td className="py-3 px-4 text-right font-mono-tabular text-slate-700">{h.attentionOrientationScore}%</td>
                    <td className="py-3 px-4 text-right font-mono-tabular text-slate-700">
                      {h.participationScore !== null ? `${h.participationScore}%` : 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-slate-900">
                      {h.finalEngagementScore}%
                    </td>
                    <td className="py-3 px-6 text-xs text-slate-600">{h.dataQualityStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
