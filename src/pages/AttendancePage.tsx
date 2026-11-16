import React, { useEffect, useMemo, useState } from 'react';
import { Check, Clock, X as XIcon } from 'lucide-react';
import { attendanceApi, classroomApi, extractErrorMessage, studentApi } from '../services/api';
import type { AttendanceRecord, Classroom, Student } from '../types';
import { EmptyState, ErrorBanner, LoadingSkeleton } from '../components/StateViews';

export function AttendancePage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingStudentId, setSavingStudentId] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [cls, sts, att] = await Promise.all([
        classroomApi.list(),
        studentApi.list(),
        attendanceApi.list(),
      ]);
      setClassrooms(cls);
      setStudents(sts);
      setRecords(att);
      if (!selectedClassroomId && cls.length > 0) {
        setSelectedClassroomId(String(cls[0].id));
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load attendance records.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const classroomStudents = useMemo(() => {
    if (!selectedClassroomId) return students;
    return students.filter((s) => s.classroomId === Number(selectedClassroomId));
  }, [students, selectedClassroomId]);

  const dateRecords = useMemo(() => {
    return records.filter(
      (r) =>
        (!selectedClassroomId || r.classroomId === Number(selectedClassroomId)) &&
        r.date === selectedDate
    );
  }, [records, selectedClassroomId, selectedDate]);

  const statusByStudent = useMemo(() => {
    const map = new Map<number, AttendanceRecord>();
    for (const r of dateRecords) {
      map.set(r.studentId, r);
    }
    return map;
  }, [dateRecords]);

  const summary = useMemo(() => {
    const total = classroomStudents.length;
    let present = 0;
    let late = 0;
    let absent = 0;
    for (const st of classroomStudents) {
      const rec = statusByStudent.get(st.id);
      if (rec?.status === 'PRESENT') present++;
      else if (rec?.status === 'LATE') late++;
      else if (rec?.status === 'ABSENT') absent++;
    }
    const marked = present + late + absent;
    const pct = marked > 0 ? Math.round(((present + late) * 1000) / marked) / 10 : 0;
    return { total, present, late, absent, pct };
  }, [classroomStudents, statusByStudent]);

  const handleMark = async (student: Student, status: 'PRESENT' | 'ABSENT' | 'LATE') => {
    setSavingStudentId(student.id);
    setError('');
    try {
      const existing = statusByStudent.get(student.id);
      const updated = existing
        ? await attendanceApi.update(existing.id, status)
        : await attendanceApi.mark({
            studentId: student.id,
            classroomId: student.classroomId,
            date: selectedDate,
            status,
          });
      setRecords((prev) => {
        const idx = prev.findIndex((x) => x.id === updated.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = updated;
          return copy;
        }
        return [updated, ...prev];
      });
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not save attendance status.'));
    } finally {
      setSavingStudentId(null);
    }
  };

  if (loading) return <LoadingSkeleton rows={6} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Attendance Management</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manually record and edit student attendance. Attendance is tracked explicitly by the teacher and never inferred solely from webcam engagement scores.
        </p>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError('')} />

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-600 mb-1">Classroom</label>
          <select
            value={selectedClassroomId}
            onChange={(e) => setSelectedClassroomId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
          >
            <option value="">All Classrooms</option>
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.classroomName} ({c.section})
              </option>
            ))}
          </select>
        </div>

        <div className="sm:w-52">
          <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
        </div>
      </div>

      {/* Attendance Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Total Students</div>
          <div className="mt-1.5 text-2xl font-bold text-slate-900 font-mono-tabular">{summary.total}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Present</div>
          <div className="mt-1.5 text-2xl font-bold text-emerald-700 font-mono-tabular">{summary.present}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Late</div>
          <div className="mt-1.5 text-2xl font-bold text-amber-700 font-mono-tabular">{summary.late}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Absent</div>
          <div className="mt-1.5 text-2xl font-bold text-red-700 font-mono-tabular">{summary.absent}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 col-span-2 sm:col-span-1">
          <div className="text-xs text-slate-500">Attendance Rate</div>
          <div className="mt-1.5 text-2xl font-bold text-indigo-700 font-mono-tabular">{summary.pct}%</div>
        </div>
      </div>

      {/* Roll Call Table */}
      {classroomStudents.length === 0 ? (
        <EmptyState
          title="No students in selected classroom"
          description="Add students to this classroom to record daily attendance."
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Roll Call · {selectedDate}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-6">Student</th>
                  <th className="py-3 px-4">Roll No</th>
                  <th className="py-3 px-4">Classroom</th>
                  <th className="py-3 px-4">Current Status</th>
                  <th className="py-3 px-6 text-right">Mark Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {classroomStudents.map((st) => {
                  const current = statusByStudent.get(st.id)?.status;
                  const busy = savingStudentId === st.id;
                  return (
                    <tr key={st.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-6 font-medium text-slate-900">{st.studentName}</td>
                      <td className="py-3 px-4 font-mono-tabular text-slate-600">{st.rollNumber}</td>
                      <td className="py-3 px-4 text-slate-600">{st.classroomName}</td>
                      <td className="py-3 px-4 text-xs font-medium">
                        {current === 'PRESENT' && <span className="text-emerald-700">Present</span>}
                        {current === 'LATE' && <span className="text-amber-700">Late</span>}
                        {current === 'ABSENT' && <span className="text-red-700">Absent</span>}
                        {!current && <span className="text-slate-400">Not Marked</span>}
                      </td>
                      <td className="py-3 px-6 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleMark(st, 'PRESENT')}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                              current === 'PRESENT'
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Present</span>
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleMark(st, 'LATE')}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                              current === 'LATE'
                                ? 'bg-amber-600 text-white border-amber-600'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50'
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>Late</span>
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleMark(st, 'ABSENT')}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                              current === 'ABSENT'
                                ? 'bg-red-600 text-white border-red-600'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-red-50'
                            }`}
                          >
                            <XIcon className="w-3.5 h-3.5" />
                            <span>Absent</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Attendance History */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Attendance History</h2>
        </div>
        {records.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No attendance history recorded yet.</div>
        ) : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-6">Date</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Roll No</th>
                  <th className="py-3 px-4">Classroom</th>
                  <th className="py-3 px-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {records
                  .filter((r) => !selectedClassroomId || r.classroomId === Number(selectedClassroomId))
                  .slice(0, 40)
                  .map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-6 font-mono-tabular text-xs text-slate-600">{r.date}</td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">{r.studentName}</td>
                      <td className="py-2.5 px-4 font-mono-tabular text-slate-600">{r.rollNumber}</td>
                      <td className="py-2.5 px-4 text-slate-600">{r.classroomName}</td>
                      <td className="py-2.5 px-6 text-xs font-medium text-slate-800">
                        {r.status}
                        {r.isDemo ? ' · Demo' : ''}
                      </td>
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
