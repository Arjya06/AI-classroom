import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2, ArrowUpRight } from 'lucide-react';
import { classroomApi, extractErrorMessage, studentApi } from '../services/api';
import type { Classroom, Student } from '../types';
import { EmptyState, ErrorBanner, LoadingSkeleton } from '../components/StateViews';

export function StudentsPage() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [classroomFilter, setClassroomFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'engagement'>('name');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    studentName: '',
    email: '',
    rollNumber: '',
    classroomId: '',
    enrollmentDate: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [stList, clList] = await Promise.all([studentApi.list(), classroomApi.list()]);
      setStudents(stList);
      setClassrooms(clList);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load students.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = students.filter((s) => {
      const matchesClass = classroomFilter === 'ALL' || s.classroomId === Number(classroomFilter);
      const matchesQuery =
        !q ||
        s.studentName.toLowerCase().includes(q) ||
        s.rollNumber.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q);
      return matchesClass && matchesQuery;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'engagement') return b.averageEngagement - a.averageEngagement;
      return a.studentName.localeCompare(b.studentName);
    });
  }, [students, search, classroomFilter, sortBy]);

  const openCreate = () => {
    setEditingId(null);
    setForm({
      studentName: '',
      email: '',
      rollNumber: '',
      classroomId: classrooms[0] ? String(classrooms[0].id) : '',
      enrollmentDate: new Date().toISOString().slice(0, 10),
    });
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (st: Student) => {
    setEditingId(st.id);
    setForm({
      studentName: st.studentName,
      email: st.email,
      rollNumber: st.rollNumber,
      classroomId: String(st.classroomId),
      enrollmentDate: st.enrollmentDate,
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.studentName.trim() || !form.email.trim() || !form.rollNumber.trim() || !form.classroomId) {
      setFormError('All student fields and classroom selection are required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        studentName: form.studentName.trim(),
        email: form.email.trim(),
        rollNumber: form.rollNumber.trim(),
        classroomId: Number(form.classroomId),
        enrollmentDate: form.enrollmentDate,
      };
      if (editingId) {
        await studentApi.update(editingId, payload);
      } else {
        await studentApi.create(payload);
      }
      setModalOpen(false);
      await fetchData();
    } catch (err) {
      setFormError(extractErrorMessage(err, 'Could not save student.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (st: Student) => {
    setError('');
    try {
      await studentApi.delete(st.id);
      await fetchData();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to delete student.'));
    }
  };

  if (loading) return <LoadingSkeleton rows={6} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Students</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage enrolled students across classrooms and review individual engagement and attendance histories.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={classrooms.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Student</span>
        </button>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError('')} />

      {classrooms.length === 0 ? (
        <EmptyState
          title="Create a classroom first"
          description="Students must be enrolled into a classroom. Create a classroom before adding students."
          actionLabel="Go to Classrooms"
          onAction={() => navigate('/classrooms')}
        />
      ) : (
        <>
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by student name, roll number, or email..."
                className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={classroomFilter}
                onChange={(e) => setClassroomFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Classrooms</option>
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.classroomName}
                  </option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'name' | 'engagement')}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="name">Sort by Name</option>
                <option value="engagement">Sort by Engagement</option>
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title="No matching students"
              description={
                students.length === 0
                  ? 'Add students to your classroom roster to track attendance and engagement.'
                  : 'No students match your current search or filter.'
              }
              actionLabel={students.length === 0 ? 'Add First Student' : undefined}
              onAction={students.length === 0 ? openCreate : undefined}
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                      <th className="py-3 px-6">Student Name</th>
                      <th className="py-3 px-4">Roll No</th>
                      <th className="py-3 px-4">Classroom</th>
                      <th className="py-3 px-4">Enrollment Date</th>
                      <th className="py-3 px-4 text-right">Avg Engagement</th>
                      <th className="py-3 px-4 text-right">Attendance</th>
                      <th className="py-3 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filtered.map((st) => (
                      <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-6">
                          <div className="font-medium text-slate-900">{st.studentName}</div>
                          <div className="text-xs text-slate-500">{st.email}</div>
                        </td>
                        <td className="py-3 px-4 font-mono-tabular text-slate-700">{st.rollNumber}</td>
                        <td className="py-3 px-4 text-slate-600">
                          {st.classroomName}
                          {st.isDemo ? ' · Demo' : ''}
                        </td>
                        <td className="py-3 px-4 text-xs font-mono-tabular text-slate-500">{st.enrollmentDate}</td>
                        <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-slate-900">
                          {st.sessionsAttended > 0 ? `${st.averageEngagement}%` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular text-slate-700">
                          {st.attendancePercentage}%
                        </td>
                        <td className="py-3 px-6 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => navigate(`/students/${st.id}`)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-md"
                            >
                              <span>Profile</span>
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(st)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-md hover:bg-slate-100"
                              aria-label={`Edit ${st.studentName}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(st)}
                              className="p-1.5 text-slate-500 hover:text-red-600 rounded-md hover:bg-red-50"
                              aria-label={`Delete ${st.studentName}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6 space-y-5">
            <h2 className="text-lg font-semibold text-slate-900">
              {editingId ? 'Edit Student' : 'Add New Student'}
            </h2>
            <ErrorBanner message={formError} onDismiss={() => setFormError('')} />
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={form.studentName}
                  onChange={(e) => setForm({ ...form, studentName: e.target.value })}
                  placeholder="e.g., Riya Sen"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Roll Number</label>
                  <input
                    type="text"
                    value={form.rollNumber}
                    onChange={(e) => setForm({ ...form, rollNumber: e.target.value })}
                    placeholder="e.g., 23CSE042"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Enrollment Date</label>
                  <input
                    type="date"
                    value={form.enrollmentDate}
                    onChange={(e) => setForm({ ...form, enrollmentDate: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="student@university.edu"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Classroom</label>
                <select
                  value={form.classroomId}
                  onChange={(e) => setForm({ ...form, classroomId: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">Select classroom</option>
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.classroomName} ({c.section})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60"
                >
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
