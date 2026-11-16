import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { analyticsApi, extractErrorMessage, monitoringApi, studentApi } from '../services/api';
import type { Classroom, DashboardAnalytics, MonitoringSession, Student } from '../types';
import { EmptyState, ErrorBanner, LoadingSkeleton } from '../components/StateViews';
import { formatDuration } from '../utils/exportUtils';

const PIE_COLORS = ['#4F46E5', '#0284C7', '#D97706'];

export function AnalyticsPage() {
  const [dashboard, setDashboard] = useState<DashboardAnalytics | null>(null);
  const [trends, setTrends] = useState<
    Array<{
      sessionId: number;
      sessionTitle: string;
      classroomName: string;
      date: string;
      averageEngagement: number;
      attendancePercentage: number;
      duration: number;
      isDemo: boolean;
    }>
  >([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [sessions, setSessions] = useState<MonitoringSession[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentHistory, setStudentHistory] = useState<Array<{ label: string; score: number }>>([]);
  const [timeframe, setTimeframe] = useState<'session' | 'daily'>('session');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [dash, tr, cls, sess, sts] = await Promise.all([
          analyticsApi.dashboard(),
          analyticsApi.engagementTrends(),
          analyticsApi.classrooms(),
          monitoringApi.list(),
          studentApi.list(),
        ]);
        setDashboard(dash);
        setTrends(tr.trends);
        setClassrooms(cls);
        setSessions(sess);
        setStudents(sts);
        if (sts.length > 0) {
          setSelectedStudentId(String(sts[0].id));
        }
      } catch (err) {
        setError(extractErrorMessage(err, 'Failed to load analytics.'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!selectedStudentId) {
      setStudentHistory([]);
      return;
    }
    analyticsApi
      .student(Number(selectedStudentId))
      .then((res) => {
        setStudentHistory(
          res.history.map((h) => ({
            label: h.sessionTitle.replace(' [DEMO]', '').slice(0, 18),
            score: h.finalEngagementScore,
          }))
        );
      })
      .catch(() => setStudentHistory([]));
  }, [selectedStudentId]);

  if (loading) return <LoadingSkeleton rows={6} />;
  if (error) return <ErrorBanner message={error} onDismiss={() => setError('')} />;
  if (!dashboard) return null;

  if (sessions.length === 0 && classrooms.length === 0) {
    return (
      <EmptyState
        title="No analytics data available yet"
        description="Conduct a live monitoring session or load sample demonstration data to inspect engagement trends and comparisons."
      />
    );
  }

  const trendChartData =
    timeframe === 'session'
      ? trends.map((t) => ({
          label: t.sessionTitle.replace(' [DEMO]', '').slice(0, 18),
          engagement: t.averageEngagement,
          attendance: t.attendancePercentage,
        }))
      : Object.values(
          trends.reduce<Record<string, { label: string; sumEng: number; sumAtt: number; count: number }>>((acc, t) => {
            const day = t.date.slice(0, 10);
            if (!acc[day]) acc[day] = { label: day, sumEng: 0, sumAtt: 0, count: 0 };
            acc[day].sumEng += t.averageEngagement;
            acc[day].sumAtt += t.attendancePercentage;
            acc[day].count += 1;
            return acc;
          }, {})
        ).map((d) => ({
          label: d.label,
          engagement: Math.round((d.sumEng / d.count) * 10) / 10,
          attendance: Math.round((d.sumAtt / d.count) * 10) / 10,
        }));

  const classroomComparisonData = classrooms.map((c) => ({
    name: c.classroomName.replace(' [DEMO]', '').slice(0, 20),
    engagement: c.averageEngagement,
    attendance: c.attendancePercentage,
  }));

  const highestEng = trends.length ? Math.max(...trends.map((t) => t.averageEngagement)) : 0;
  const lowestEng = trends.length ? Math.min(...trends.map((t) => t.averageEngagement)) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Engagement Analytics</h1>
          <p className="mt-1 text-sm text-slate-600">
            Historical engagement trends, classroom comparisons, and attendance correlations computed from stored records.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setTimeframe('session')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              timeframe === 'session' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            By Session
          </button>
          <button
            type="button"
            onClick={() => setTimeframe('daily')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              timeframe === 'daily' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Daily Average
          </button>
        </div>
      </div>

      {dashboard.hasDemoData && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
          <strong>Demo Data Notice:</strong> Charts include <code className="font-mono">[DEMO]</code> sessions clearly marked in the session table below.
        </div>
      )}

      {/* Session Analysis Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">Overall Avg Engagement</div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono-tabular">{dashboard.averageEngagement}%</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">Highest Session Score</div>
          <div className="mt-2 text-2xl font-bold text-emerald-700 font-mono-tabular">{highestEng}%</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">Lowest Session Score</div>
          <div className="mt-2 text-2xl font-bold text-amber-700 font-mono-tabular">{lowestEng}%</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">Average Attendance</div>
          <div className="mt-2 text-2xl font-bold text-indigo-700 font-mono-tabular">{dashboard.averageAttendance}%</div>
        </div>
      </div>

      {/* Row 1: Trends & Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-slate-900">Engagement & Attendance Trend</h2>
          <p className="text-xs text-slate-500 mt-0.5 mb-4">Attendance percentage vs average engagement across sessions.</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendChartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#FFF', borderColor: '#E2E8F0', borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="engagement" name="Engagement (%)" stroke="#4F46E5" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="attendance" name="Attendance (%)" stroke="#0284C7" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col">
          <h2 className="text-base font-semibold text-slate-900">Student Engagement Tiers</h2>
          <p className="text-xs text-slate-500 mt-0.5">Prototype score category distribution.</p>
          <div className="flex-1 min-h-[210px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dashboard.distribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={78} paddingAngle={3}>
                  {dashboard.distribution.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#FFF', borderColor: '#E2E8F0', borderRadius: '8px', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 pt-3 border-t border-slate-100">
            {dashboard.distribution.map((d, idx) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                  <span>{d.name}</span>
                </span>
                <span className="font-mono-tabular font-semibold text-slate-900">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Classroom Comparison & Individual Student Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-slate-900">Classroom Comparison</h2>
          <p className="text-xs text-slate-500 mt-0.5 mb-4">Average engagement and attendance rate per classroom.</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classroomComparisonData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#FFF', borderColor: '#E2E8F0', borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="engagement" name="Avg Engagement (%)" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="attendance" name="Attendance (%)" fill="#0284C7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Individual Student Trend</h2>
              <p className="text-xs text-slate-500 mt-0.5">Shown only when individual station records exist.</p>
            </div>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
            >
              {students.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.studentName} ({st.rollNumber})
                </option>
              ))}
            </select>
          </div>
          {studentHistory.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-slate-500">
              No individual monitoring station records exist for this student yet.
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={studentHistory} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#FFF', borderColor: '#E2E8F0', borderRadius: '8px', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="score" name="Engagement Score (%)" stroke="#4F46E5" strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Session Analysis Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Session Analysis Log</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="py-3 px-6">Session Title</th>
                <th className="py-3 px-4">Classroom</th>
                <th className="py-3 px-4 text-right">Duration</th>
                <th className="py-3 px-4 text-right">Avg Engagement</th>
                <th className="py-3 px-4 text-right">Attendance</th>
                <th className="py-3 px-6">Source Mode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {sessions.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/80">
                  <td className="py-3 px-6 font-medium text-slate-900">{s.sessionTitle}</td>
                  <td className="py-3 px-4 text-slate-600">{s.classroomName}</td>
                  <td className="py-3 px-4 text-right font-mono-tabular text-slate-700">{formatDuration(s.duration)}</td>
                  <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-slate-900">{s.averageEngagement}%</td>
                  <td className="py-3 px-4 text-right font-mono-tabular text-slate-700">{s.attendancePercentage}%</td>
                  <td className="py-3 px-6 text-xs text-slate-600">{s.isDemo ? 'DEMO MODE' : 'LIVE WEBCAM'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
