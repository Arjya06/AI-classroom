import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2, ArrowUpRight, Video } from 'lucide-react';
import { classroomApi, extractErrorMessage } from '../services/api';
import type { Classroom } from '../types';
import { EmptyState, ErrorBanner, LoadingSkeleton } from '../components/StateViews';

const EMPTY_FORM = {
  classroomName: '',
  subject: '',
  section: '',
  academicYear: '2026-27',
  description: '',
};

export function ClassroomsPage() {
  const navigate = useNavigate();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('ALL');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchClassrooms = async () => {
    setLoading(true);
    setError('');
    try {
      setClassrooms(await classroomApi.list());
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load classrooms.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassrooms();
  }, []);

  const sections = useMemo(() => {
    const set = new Set(classrooms.map((c) => c.section));
    return ['ALL', ...Array.from(set)];
  }, [classrooms]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return classrooms.filter((c) => {
      const matchesSection = sectionFilter === 'ALL' || c.section === sectionFilter;
      const matchesQuery =
        !q ||
        c.classroomName.toLowerCase().includes(q) ||
        c.subject.toLowerCase().includes(q) ||
        c.section.toLowerCase().includes(q);
      return matchesSection && matchesQuery;
    });
  }, [classrooms, search, sectionFilter]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (c: Classroom) => {
    setEditingId(c.id);
    setForm({
      classroomName: c.classroomName,
      subject: c.subject,
      section: c.section,
      academicYear: c.academicYear,
      description: c.description,
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.classroomName.trim() || !form.subject.trim() || !form.section.trim() || !form.academicYear.trim()) {
      setFormError('Classroom name, subject, section, and academic year are required.');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await classroomApi.update(editingId, form);
      } else {
        await classroomApi.create(form);
      }
      setModalOpen(false);
      await fetchClassrooms();
    } catch (err) {
      setFormError(extractErrorMessage(err, 'Could not save classroom.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: Classroom) => {
    setError('');
    try {
      await classroomApi.delete(c.id);
      await fetchClassrooms();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to delete classroom.'));
    }
  };

  if (loading) return <LoadingSkeleton rows={5} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Classrooms</h1>
          <p className="mt-1 text-sm text-slate-600">
            Create and organize course sections, inspect enrollment, and launch monitoring sessions.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create Classroom</span>
        </button>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError('')} />

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by classroom name, subject, or section..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="section-filter" className="text-xs font-medium text-slate-600 whitespace-nowrap">
            Section:
          </label>
          <select
            id="section-filter"
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {sections.map((sec) => (
              <option key={sec} value={sec}>
                {sec === 'ALL' ? 'All Sections' : sec}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No classrooms found"
          description={
            classrooms.length === 0
              ? 'Add your first classroom to begin enrolling students and tracking engagement.'
              : 'Try adjusting your search query or section filter.'
          }
          actionLabel={classrooms.length === 0 ? 'Create Classroom' : undefined}
          onAction={classrooms.length === 0 ? openCreate : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-5"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">{c.classroomName}</h2>
                    <div className="mt-1 text-xs text-slate-500">
                      {c.subject} · Section {c.section} · {c.academicYear}
                      {c.isDemo ? ' · Demo Classroom' : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      className="p-2 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition-colors"
                      aria-label={`Edit ${c.classroomName}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(c)}
                      className="p-2 text-slate-500 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                      aria-label={`Delete ${c.classroomName}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {c.description && <p className="mt-3 text-sm text-slate-600">{c.description}</p>}
              </div>

              <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-5 text-xs">
                  <div>
                    <div className="text-slate-500">Students</div>
                    <div className="font-mono-tabular font-semibold text-slate-900 mt-0.5">{c.studentCount}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Avg Engagement</div>
                    <div className="font-mono-tabular font-semibold text-slate-900 mt-0.5">{c.averageEngagement}%</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Attendance</div>
                    <div className="font-mono-tabular font-semibold text-slate-900 mt-0.5">{c.attendancePercentage}%</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/classrooms/${c.id}`)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap"
                  >
                    <span>Details</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/monitoring?classroomId=${c.id}`)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 whitespace-nowrap"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Monitor</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal for Create / Edit Classroom */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6 space-y-5">
            <h2 className="text-lg font-semibold text-slate-900">
              {editingId ? 'Edit Classroom' : 'Create New Classroom'}
            </h2>
            <ErrorBanner message={formError} onDismiss={() => setFormError('')} />
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Classroom Name</label>
                <input
                  type="text"
                  value={form.classroomName}
                  onChange={(e) => setForm({ ...form, classroomName: e.target.value })}
                  placeholder="e.g., CS-301 Data Structures"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                  <input
                    type="text"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="e.g., Algorithms"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Class Section</label>
                  <input
                    type="text"
                    value={form.section}
                    onChange={(e) => setForm({ ...form, section: e.target.value })}
                    placeholder="e.g., CSE-A"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Academic Year</label>
                <input
                  type="text"
                  value={form.academicYear}
                  onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
                  placeholder="2026-27"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Course notes or schedule details..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
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
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Classroom'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
