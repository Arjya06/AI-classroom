import React, { useEffect, useState } from 'react';
import { Download, Printer, FileText } from 'lucide-react';
import {
  analyticsApi,
  classroomApi,
  extractErrorMessage,
  monitoringApi,
  reportApi,
  studentApi,
} from '../services/api';
import type { Classroom, MonitoringSession, Student } from '../types';
import { ErrorBanner, LoadingSkeleton } from '../components/StateViews';
import { downloadCsv, formatDateTime, formatDuration } from '../utils/exportUtils';

type ReportType = 'engagement' | 'student' | 'attendance' | 'session';

export function ReportsPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<MonitoringSession[]>([]);

  const [reportType, setReportType] = useState<ReportType>('engagement');
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [previewData, setPreviewData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [cls, sts, sess] = await Promise.all([
          classroomApi.list(),
          studentApi.list(),
          monitoringApi.list(),
        ]);
        setClassrooms(cls);
        setStudents(sts);
        setSessions(sess);
        if (sts.length > 0) setSelectedStudentId(String(sts[0].id));
        if (sess.length > 0) setSelectedSessionId(String(sess[0].id));
      } catch (err) {
        setError(extractErrorMessage(err, 'Failed to load report filters.'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const cid = selectedClassroomId ? Number(selectedClassroomId) : undefined;
      if (reportType === 'engagement') {
        const res = await reportApi.engagement(cid);
        if (startDate || endDate) {
          res.sessions = res.sessions.filter((s: MonitoringSession) => {
            const d = s.startTime.slice(0, 10);
            return (!startDate || d >= startDate) && (!endDate || d <= endDate);
          });
        }
        setPreviewData(res);
      } else if (reportType === 'attendance') {
        const res = await reportApi.attendance(cid);
        if (startDate || endDate) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          res.records = res.records.filter((r: any) => (!startDate || r.date >= startDate) && (!endDate || r.date <= endDate));
        }
        setPreviewData(res);
      } else if (reportType === 'student') {
        if (!selectedStudentId) {
          setError('Please select a student to generate an individual report.');
          setGenerating(false);
          return;
        }
        const res = await analyticsApi.student(Number(selectedStudentId));
        setPreviewData({ reportType: 'INDIVIDUAL_STUDENT_REPORT', generatedAt: new Date().toISOString(), ...res });
      } else if (reportType === 'session') {
        if (!selectedSessionId) {
          setError('Please select a session to generate a session summary report.');
          setGenerating(false);
          return;
        }
        const res = await reportApi.session(Number(selectedSessionId));
        setPreviewData(res);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to generate report.'));
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadCsv = () => {
    if (!previewData) return;

    if (previewData.reportType === 'CLASSROOM_ENGAGEMENT_REPORT') {
      downloadCsv(
        'classroom-engagement-report.csv',
        ['Session ID', 'Title', 'Classroom', 'Start Time', 'Duration (s)', 'Avg Engagement (%)', 'Attendance (%)', 'Mode', 'Status'],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        previewData.sessions.map((s: any) => [
          s.id,
          s.sessionTitle,
          s.classroomName,
          s.startTime,
          s.duration,
          s.averageEngagement,
          s.attendancePercentage,
          s.mode,
          s.status,
        ])
      );
    } else if (previewData.reportType === 'ATTENDANCE_REPORT') {
      downloadCsv(
        'attendance-report.csv',
        ['Date', 'Student Name', 'Roll Number', 'Classroom', 'Status', 'Demo Record'],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        previewData.records.map((r: any) => [r.date, r.studentName, r.rollNumber, r.classroomName, r.status, r.isDemo])
      );
    } else if (previewData.reportType === 'INDIVIDUAL_STUDENT_REPORT') {
      downloadCsv(
        `student-${previewData.student.rollNumber}-report.csv`,
        ['Session', 'Timestamp', 'Face Presence (%)', 'Attention Orientation (%)', 'Participation (%)', 'Final Score (%)', 'Data Quality'],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        previewData.history.map((h: any) => [
          h.sessionTitle,
          h.timestamp,
          h.facePresenceScore,
          h.attentionOrientationScore,
          h.participationScore ?? 'N/A',
          h.finalEngagementScore,
          h.dataQualityStatus,
        ])
      );
    } else if (previewData.reportType === 'SESSION_SUMMARY_REPORT') {
      downloadCsv(
        `session-${previewData.session.id}-summary.csv`,
        ['Timestamp', 'Detected Faces', 'Face Presence (%)', 'Attention Orientation (%)', 'Participation (%)', 'Final Engagement (%)', 'Data Quality'],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (previewData.session.records || []).map((r: any) => [
          r.timestamp,
          r.detectedFacesCount,
          r.facePresenceScore,
          r.attentionOrientationScore,
          r.participationScore ?? 'N/A',
          r.finalEngagementScore,
          r.dataQualityStatus,
        ])
      );
    }
  };

  if (loading) return <LoadingSkeleton rows={5} />;

  return (
    <div className="space-y-6">
      <div className="no-print">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Reports & Exports</h1>
        <p className="mt-1 text-sm text-slate-600">
          Generate, preview, and download classroom engagement, attendance, student, and session reports in CSV or PDF (print) format.
        </p>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError('')} />

      {/* Generator Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 no-print">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Report Type</label>
            <select
              value={reportType}
              onChange={(e) => {
                setReportType(e.target.value as ReportType);
                setPreviewData(null);
              }}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="engagement">Classroom Engagement Report</option>
              <option value="student">Individual Student Report</option>
              <option value="attendance">Attendance Report</option>
              <option value="session">Session Summary Report</option>
            </select>
          </div>

          {(reportType === 'engagement' || reportType === 'attendance') && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Classroom Filter</label>
              <select
                value={selectedClassroomId}
                onChange={(e) => setSelectedClassroomId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="">All Classrooms</option>
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.classroomName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {reportType === 'student' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Select Student</label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {students.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.studentName} ({st.rollNumber})
                  </option>
                ))}
              </select>
            </div>
          )}

          {reportType === 'session' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Select Session</label>
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.sessionTitle}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Start Date (Optional)</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">End Date (Optional)</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60"
          >
            <FileText className="w-4 h-4" />
            <span>{generating ? 'Generating...' : 'Generate Report'}</span>
          </button>

          {previewData && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download CSV</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Export PDF / Print</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Report Preview */}
      {previewData && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-lg font-bold text-slate-900">
              {previewData.reportType.replace(/_/g, ' ')}
            </h2>
            <div className="text-xs text-slate-500 mt-1">
              Generated {formatDateTime(previewData.generatedAt)} · AI Classroom Engagement Analytics
            </div>
          </div>

          {previewData.reportType === 'CLASSROOM_ENGAGEMENT_REPORT' && (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                      <th className="py-2.5 px-4">Session</th>
                      <th className="py-2.5 px-4">Classroom</th>
                      <th className="py-2.5 px-4 text-right">Duration</th>
                      <th className="py-2.5 px-4 text-right">Avg Engagement</th>
                      <th className="py-2.5 px-4 text-right">Attendance</th>
                      <th className="py-2.5 px-4">Mode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {previewData.sessions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-500">
                          No sessions match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      previewData.sessions.map((s: any) => (
                        <tr key={s.id}>
                          <td className="py-2.5 px-4 font-medium text-slate-900">{s.sessionTitle}</td>
                          <td className="py-2.5 px-4 text-slate-600">{s.classroomName}</td>
                          <td className="py-2.5 px-4 text-right font-mono-tabular">{formatDuration(s.duration)}</td>
                          <td className="py-2.5 px-4 text-right font-mono-tabular font-semibold">{s.averageEngagement}%</td>
                          <td className="py-2.5 px-4 text-right font-mono-tabular">{s.attendancePercentage}%</td>
                          <td className="py-2.5 px-4 text-xs text-slate-600">{s.mode}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {previewData.reportType === 'ATTENDANCE_REPORT' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="text-slate-500">Total Records</div>
                  <div className="text-lg font-bold font-mono-tabular text-slate-900">{previewData.totalRecords}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="text-slate-500">Present</div>
                  <div className="text-lg font-bold font-mono-tabular text-emerald-700">{previewData.presentCount}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="text-slate-500">Late</div>
                  <div className="text-lg font-bold font-mono-tabular text-amber-700">{previewData.lateCount}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="text-slate-500">Attendance Rate</div>
                  <div className="text-lg font-bold font-mono-tabular text-indigo-700">{previewData.attendanceRate}%</div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Student</th>
                      <th className="py-2.5 px-4">Roll No</th>
                      <th className="py-2.5 px-4">Classroom</th>
                      <th className="py-2.5 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {previewData.records.map((r: any) => (
                      <tr key={r.id}>
                        <td className="py-2.5 px-4 font-mono-tabular text-xs">{r.date}</td>
                        <td className="py-2.5 px-4 font-medium text-slate-900">{r.studentName}</td>
                        <td className="py-2.5 px-4 font-mono-tabular text-slate-600">{r.rollNumber}</td>
                        <td className="py-2.5 px-4 text-slate-600">{r.classroomName}</td>
                        <td className="py-2.5 px-4 text-xs font-medium">{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {previewData.reportType === 'INDIVIDUAL_STUDENT_REPORT' && (
            <div className="space-y-4">
              <div className="text-sm text-slate-700">
                <strong>{previewData.student.studentName}</strong> ({previewData.student.rollNumber}) ·{' '}
                {previewData.student.classroomName} · Avg Engagement:{' '}
                <span className="font-mono-tabular font-semibold">{previewData.student.averageEngagement}%</span> · Attendance:{' '}
                <span className="font-mono-tabular font-semibold">{previewData.student.attendancePercentage}%</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                      <th className="py-2.5 px-4">Session</th>
                      <th className="py-2.5 px-4 text-right">Face Presence</th>
                      <th className="py-2.5 px-4 text-right">Attention</th>
                      <th className="py-2.5 px-4 text-right">Participation</th>
                      <th className="py-2.5 px-4 text-right">Final Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {previewData.history.map((h: any) => (
                      <tr key={h.recordId}>
                        <td className="py-2.5 px-4 font-medium text-slate-900">{h.sessionTitle}</td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular">{h.facePresenceScore}%</td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular">{h.attentionOrientationScore}%</td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular">
                          {h.participationScore !== null ? `${h.participationScore}%` : 'N/A'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular font-semibold">{h.finalEngagementScore}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {previewData.reportType === 'SESSION_SUMMARY_REPORT' && (
            <div className="space-y-4">
              <div className="text-sm text-slate-700">
                <strong>{previewData.session.sessionTitle}</strong> · {previewData.session.classroomName} · Duration:{' '}
                <span className="font-mono-tabular">{formatDuration(previewData.session.duration)}</span> · Avg Engagement:{' '}
                <span className="font-mono-tabular font-semibold">{previewData.session.averageEngagement}%</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                      <th className="py-2.5 px-4">Timestamp</th>
                      <th className="py-2.5 px-4 text-right">Faces</th>
                      <th className="py-2.5 px-4 text-right">Presence</th>
                      <th className="py-2.5 px-4 text-right">Attention</th>
                      <th className="py-2.5 px-4 text-right">Score</th>
                      <th className="py-2.5 px-4">Quality</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(previewData.session.records || []).map((r: any) => (
                      <tr key={r.id}>
                        <td className="py-2.5 px-4 text-xs text-slate-500">{formatDateTime(r.timestamp)}</td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular">{r.detectedFacesCount}</td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular">{r.facePresenceScore}%</td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular">{r.attentionOrientationScore}%</td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular font-semibold">{r.finalEngagementScore}%</td>
                        <td className="py-2.5 px-4 text-xs">{r.dataQualityStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Methodology & Limitations */}
          <div className="pt-4 border-t border-slate-200 text-xs text-slate-500 space-y-1">
            <div className="font-semibold text-slate-700">Methodology & Limitations</div>
            <p>
              {previewData.methodology ||
                'Engagement indicators are computed from approximate browser-side MediaPipe facial landmark orientation and presence signals, combined with teacher-logged participation when available. They are intended solely as supplementary classroom indicators and must never be used as proof of student focus or academic ability.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
