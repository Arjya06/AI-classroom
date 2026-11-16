import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  BookOpen,
  Activity,
  ClipboardCheck,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  Database,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { analyticsApi, demoApi, extractErrorMessage } from '../services/api';
import type { DashboardAnalytics } from '../types';
import { EmptyState, ErrorBanner, LoadingSkeleton } from '../components/StateViews';
import { formatDateTime, formatDuration } from '../utils/exportUtils';

const DIST_COLORS = ['#4F46E5', '#0284C7', '#D97706'];

export function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [trends, setTrends] = useState<Array<{ label: string; engagement: number; attendance: number; isDemo: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [seeding, setSeeding] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const [dash, eng] = await Promise.all([analyticsApi.dashboard(), analyticsApi.engagementTrends()]);
      setData(dash);
      setTrends(
        eng.trends.map((t) => ({
          label: t.sessionTitle.replace(' [DEMO]', '').slice(0, 20),
          engagement: t.averageEngagement,
          attendance: t.attendancePercentage,
          isDemo: t.isDemo,
        }))
      );
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load dashboard overview.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleSeedDemo = async () => {
    setSeeding(true);
    setError('');
    try {
      await demoApi.seed();
      await loadDashboard();
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not seed demonstration data.'));
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return <LoadingSkeleton rows={6} />;
  }

  if (error) {
    return <ErrorBanner message={error} onDismiss={() => setError('')} />;
  }

  if (!data) return null;

  const isEmpty = data.totalClassrooms === 0 && data.sessionsConducted === 0;

  const summaryCards = [
    {
      label: 'Total Students',
      value: String(data.totalStudents),
      sub: 'Enrolled across active rosters',
      icon: Users,
    },
    {
      label: 'Total Classrooms',
      value: String(data.totalClassrooms),
      sub: 'Configured course sections',
      icon: BookOpen,
    },
    {
      label: 'Average Engagement',
      value: `${data.averageEngagement}%`,
      sub: 'Weighted attention & presence',
      icon: Activity,
    },
    {
      label: 'Average Attendance',
      value: `${data.averageAttendance}%`,
      sub: 'Recorded class roll calls',
      icon: ClipboardCheck,
    },
    {
      label: 'Sessions Conducted',
      value: String(data.sessionsConducted),
      sub: 'Completed & live sessions',
      icon: Clock,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Classroom Overview</h1>
          <p className="mt-1 text-sm text-slate-600">
            Centralized summary of classroom engagement indicators, attendance rates, and recent sessions.
          </p>
        </div>

        {isEmpty && (
          <button
            type="button"
            onClick={handleSeedDemo}
            disabled={seeding}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors whitespace-nowrap shrink-0"
          >
            <Database className="w-4 h-4" />
            <span>{seeding ? 'Loading Sample Data...' : 'Load Demo Classroom Data'}</span>
          </button>
        )}
      </div>

      {data.hasDemoData && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2">
          <span>
            <strong>Demo Data Notice:</strong> This workspace includes clearly labelled <code className="font-mono">[DEMO]</code> sample records for demonstration purposes alongside any live webcam sessions you record.
          </span>
        </div>
      )}

      {/* 5 Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-500">{card.label}</span>
                <Icon className="w-4 h-4 text-indigo-600 shrink-0" />
              </div>
              <div className="mt-3 text-2xl font-bold text-slate-900 font-mono-tabular">
                {card.value}
              </div>
              <div className="mt-1 text-xs text-slate-500">{card.sub}</div>
            </div>
          );
        })}
      </div>

      {isEmpty ? (
        <EmptyState
          title="No classrooms or monitoring sessions yet"
          description="Create your first classroom to enroll students and run a live webcam or simulated demonstration session."
          actionLabel="Create First Classroom"
          onAction={() => navigate('/classrooms')}
        />
      ) : (
        <>
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Engagement Overview Across Sessions</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Comparison of average engagement score (%) and attendance percentage across recorded sessions.
                  </p>
                </div>
              </div>
              {trends.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-sm text-slate-500">
                  No session trend data recorded yet.
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trends} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                      <defs>
                        <linearGradient id="engGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.22} />
                          <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#FFFFFF',
                          borderColor: '#E2E8F0',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="engagement"
                        name="Engagement (%)"
                        stroke="#4F46E5"
                        strokeWidth={2}
                        fill="url(#engGrad)"
                      />
                      <Area
                        type="monotone"
                        dataKey="attendance"
                        name="Attendance (%)"
                        stroke="#0284C7"
                        strokeWidth={2}
                        fillOpacity={0}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col">
              <h2 className="text-base font-semibold text-slate-900">Engagement Distribution</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Prototype threshold breakdown (High &ge; 75, Moderate 50–74, Low &lt; 50).
              </p>
              <div className="flex-1 min-h-[210px] mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.distribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={78}
                      paddingAngle={3}
                    >
                      {data.distribution.map((_, idx) => (
                        <Cell key={idx} fill={DIST_COLORS[idx % DIST_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#E2E8F0',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 pt-3 border-t border-slate-100">
                {data.distribution.map((item, idx) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-slate-700">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: DIST_COLORS[idx % DIST_COLORS.length] }}
                      />
                      <span>{item.name}</span>
                    </div>
                    <span className="font-mono-tabular font-semibold text-slate-900">{item.value} students</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Sessions Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Recent Monitoring Sessions</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Latest classroom sessions saved in the database.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/analytics')}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 whitespace-nowrap"
              >
                View all analytics
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <th className="py-3 px-6">Session</th>
                    <th className="py-3 px-4">Classroom</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Duration</th>
                    <th className="py-3 px-4 text-right">Avg Engagement</th>
                    <th className="py-3 px-4 text-right">Attendance</th>
                    <th className="py-3 px-6">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {data.recentSessions.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-6 font-medium text-slate-900">
                        {s.sessionTitle}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{s.classroomName}</td>
                      <td className="py-3 px-4 text-slate-500 text-xs">{formatDateTime(s.startTime)}</td>
                      <td className="py-3 px-4 text-right font-mono-tabular text-slate-700">
                        {formatDuration(s.duration)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-slate-900">
                        {s.averageEngagement}%
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular text-slate-700">
                        {s.attendancePercentage}%
                      </td>
                      <td className="py-3 px-6 text-xs font-medium text-slate-700">
                        {s.status}
                        {s.isDemo ? ' · Demo' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Students Requiring Attention */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <h2 className="text-base font-semibold text-slate-900">Students Flagged for Teacher Review</h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Notice: A low engagement score is only an indicator for teacher review, never proof that a student is inattentive or disengaged mentally.
              </p>
            </div>
            {data.studentsRequiringAttention.length === 0 ? (
              <div className="p-6 text-sm text-slate-600">
                No students are currently below your configured review threshold.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                      <th className="py-3 px-6">Student Name</th>
                      <th className="py-3 px-4">Roll Number</th>
                      <th className="py-3 px-4">Classroom</th>
                      <th className="py-3 px-4 text-right">Avg Engagement</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-6 text-right">Profile</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {data.studentsRequiringAttention.map((st) => (
                      <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-6 font-medium text-slate-900">{st.studentName}</td>
                        <td className="py-3 px-4 font-mono-tabular text-slate-600">{st.rollNumber}</td>
                        <td className="py-3 px-4 text-slate-600">{st.classroomName}</td>
                        <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-amber-700">
                          {st.averageEngagement}%
                        </td>
                        <td className="py-3 px-4 text-xs font-medium text-amber-700">
                          Needs Review · {st.engagementCategory}
                        </td>
                        <td className="py-3 px-6 text-right">
                          <button
                            type="button"
                            onClick={() => navigate(`/students/${st.id}`)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 whitespace-nowrap"
                          >
                            <span>View Profile</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
