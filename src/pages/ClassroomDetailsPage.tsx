import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Video, ArrowUpRight } from 'lucide-react';
import { classroomApi, extractErrorMessage, monitoringApi, studentApi } from '../services/api';
import type { Classroom, MonitoringSession, Student } from '../types';
import { ErrorBanner, LoadingSkeleton } from '../components/StateViews';
import { formatDateTime, formatDuration } from '../utils/exportUtils';

export function ClassroomDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const classroomId = Number(id);

  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<MonitoringSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [c, allStudents, allSessions] = await Promise.all([
          classroomApi.get(classroomId),
          studentApi.list(),
          monitoringApi.list(),
        ]);
        setClassroom(c);
        setStudents(allStudents.filter((s) => s.classroomId === classroomId));
        setSessions(allSessions.filter((s) => s.classroomId === classroomId));
      } catch (err) {
        setError(extractErrorMessage(err, 'Failed to load classroom details.'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [classroomId]);

  if (loading) return <LoadingSkeleton rows={5} />;
  if (error) return <ErrorBanner message={error} />;
  if (!classroom) return null;

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate('/classrooms')}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Classrooms</span>
      </button>

      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{classroom.classroomName}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {classroom.subject} · Section {classroom.section} · {classroom.academicYear} · Instructor: {classroom.teacherName}
          </p>
          {classroom.description && <p className="mt-2 text-sm text-slate-500 max-w-2xl">{classroom.description}</p>}
        </div>
        <button
          type="button"
          onClick={() => navigate(`/monitoring?classroomId=${classroom.id}`)}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 whitespace-nowrap shrink-0"
        >
          <Video className="w-4 h-4" />
          <span>Start Monitoring</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Enrolled Students</div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono-tabular">{classroom.studentCount}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Average Engagement</div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono-tabular">{classroom.averageEngagement}%</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Attendance Percentage</div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono-tabular">{classroom.attendancePercentage}%</div>
        </div>
      </div>

      {/* Enrolled Students */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Enrolled Students</h2>
          <button
            type="button"
            onClick={() => navigate('/students')}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
          >
            Manage Students
          </button>
        </div>
        {students.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No students enrolled in this classroom yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-6">Student Name</th>
                  <th className="py-3 px-4">Roll Number</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4 text-right">Avg Engagement</th>
                  <th className="py-3 px-4 text-right">Attendance</th>
                  <th className="py-3 px-6 text-right">Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {students.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-6 font-medium text-slate-900">{st.studentName}</td>
                    <td className="py-3 px-4 font-mono-tabular text-slate-600">{st.rollNumber}</td>
                    <td className="py-3 px-4 text-slate-600">{st.email}</td>
                    <td className="py-3 px-4 text-right font-mono-tabular text-slate-900">{st.averageEngagement}%</td>
                    <td className="py-3 px-4 text-right font-mono-tabular text-slate-700">{st.attendancePercentage}%</td>
                    <td className="py-3 px-6 text-right">
                      <button
                        type="button"
                        onClick={() => navigate(`/students/${st.id}`)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        <span>View</span>
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

      {/* Previous Monitoring Sessions */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Previous Monitoring Sessions</h2>
        </div>
        {sessions.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No monitoring sessions conducted for this classroom yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-6">Session Title</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Duration</th>
                  <th className="py-3 px-4 text-right">Avg Engagement</th>
                  <th className="py-3 px-6">Mode & Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-6 font-medium text-slate-900">{s.sessionTitle}</td>
                    <td className="py-3 px-4 text-xs text-slate-500">{formatDateTime(s.startTime)}</td>
                    <td className="py-3 px-4 text-right font-mono-tabular text-slate-700">{formatDuration(s.duration)}</td>
                    <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-slate-900">{s.averageEngagement}%</td>
                    <td className="py-3 px-6 text-xs text-slate-600">{s.mode} · {s.status}</td>
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
