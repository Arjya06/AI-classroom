import axios from 'axios';
import type {
  TeacherProfile,
  Classroom,
  Student,
  MonitoringSession,
  EngagementRecord,
  AttendanceRecord,
  TeacherSettings,
  DashboardAnalytics,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

export function extractErrorMessage(err: unknown, fallback = 'An unexpected error occurred.'): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) {
      return 'Unable to reach backend server. Please verify the API service is running.';
    }
    const data = err.response.data as { message?: string; error?: string } | undefined;
    return data?.message || data?.error || fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

export const authApi = {
  me: () => apiClient.get<TeacherProfile>('/auth/me').then((r) => r.data),
  updateProfile: (payload: { name: string; department: string }) =>
    apiClient.put<TeacherProfile>('/auth/profile', payload).then((r) => r.data),
};

export const classroomApi = {
  list: () => apiClient.get<Classroom[]>('/classrooms').then((r) => r.data),
  get: (id: number) => apiClient.get<Classroom>(`/classrooms/${id}`).then((r) => r.data),
  create: (payload: {
    classroomName: string;
    subject: string;
    section: string;
    academicYear: string;
    description: string;
    isDemo?: boolean;
  }) => apiClient.post<Classroom>('/classrooms', payload).then((r) => r.data),
  update: (
    id: number,
    payload: {
      classroomName: string;
      subject: string;
      section: string;
      academicYear: string;
      description: string;
    }
  ) => apiClient.put<Classroom>(`/classrooms/${id}`, payload).then((r) => r.data),
  delete: (id: number) => apiClient.delete(`/classrooms/${id}`),
};

export const studentApi = {
  list: () => apiClient.get<Student[]>('/students').then((r) => r.data),
  get: (id: number) => apiClient.get<Student>(`/students/${id}`).then((r) => r.data),
  create: (payload: {
    studentName: string;
    email: string;
    rollNumber: string;
    classroomId: number;
    enrollmentDate?: string;
    isDemo?: boolean;
  }) => apiClient.post<Student>('/students', payload).then((r) => r.data),
  update: (
    id: number,
    payload: {
      studentName: string;
      email: string;
      rollNumber: string;
      classroomId: number;
      enrollmentDate?: string;
    }
  ) => apiClient.put<Student>(`/students/${id}`, payload).then((r) => r.data),
  delete: (id: number) => apiClient.delete(`/students/${id}`),
};

export const monitoringApi = {
  start: (payload: { classroomId: number; sessionTitle: string; mode: 'LIVE' | 'DEMO' }) =>
    apiClient.post<MonitoringSession>('/sessions/start', payload).then((r) => r.data),
  recordMetrics: (
    sessionId: number,
    payload: {
      studentId?: number | null;
      facePresenceScore: number;
      attentionOrientationScore: number;
      participationScore?: number | null;
      detectedFacesCount: number;
      dataQualityStatus: string;
    }
  ) => apiClient.post<EngagementRecord>(`/sessions/${sessionId}/metrics`, payload).then((r) => r.data),
  recordParticipation: (
    sessionId: number,
    payload: { studentId?: number | null; eventType: string; scoreValue?: number }
  ) => apiClient.post(`/sessions/${sessionId}/participation`, payload).then((r) => r.data),
  pause: (sessionId: number) => apiClient.post<MonitoringSession>(`/sessions/${sessionId}/pause`).then((r) => r.data),
  resume: (sessionId: number) => apiClient.post<MonitoringSession>(`/sessions/${sessionId}/resume`).then((r) => r.data),
  stop: (sessionId: number, durationSeconds?: number) =>
    apiClient.post<MonitoringSession>(`/sessions/${sessionId}/stop`, { durationSeconds }).then((r) => r.data),
  list: () => apiClient.get<MonitoringSession[]>('/sessions').then((r) => r.data),
  get: (sessionId: number) => apiClient.get<MonitoringSession>(`/sessions/${sessionId}`).then((r) => r.data),
  delete: (sessionId: number) => apiClient.delete(`/sessions/${sessionId}`),
};

export const attendanceApi = {
  list: (params?: { classroomId?: number; date?: string }) =>
    apiClient.get<AttendanceRecord[]>('/attendance', { params }).then((r) => r.data),
  byClassroom: (classroomId: number) =>
    apiClient.get<AttendanceRecord[]>(`/attendance/classroom/${classroomId}`).then((r) => r.data),
  mark: (payload: { studentId: number; classroomId: number; date: string; status: 'PRESENT' | 'ABSENT' | 'LATE' }) =>
    apiClient.post<AttendanceRecord>('/attendance', payload).then((r) => r.data),
  update: (id: number, status: 'PRESENT' | 'ABSENT' | 'LATE') =>
    apiClient.put<AttendanceRecord>(`/attendance/${id}`, { status }).then((r) => r.data),
};

export const analyticsApi = {
  dashboard: () => apiClient.get<DashboardAnalytics>('/analytics/dashboard').then((r) => r.data),
  engagementTrends: () =>
    apiClient.get<{
      trends: Array<{
        sessionId: number;
        sessionTitle: string;
        classroomName: string;
        date: string;
        averageEngagement: number;
        attendancePercentage: number;
        duration: number;
        isDemo: boolean;
      }>;
    }>('/analytics/engagement').then((r) => r.data),
  classrooms: () => apiClient.get<Classroom[]>('/analytics/classrooms').then((r) => r.data),
  student: (studentId: number) =>
    apiClient.get<{
      student: Student;
      history: Array<{
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
      }>;
    }>(`/analytics/students/${studentId}`).then((r) => r.data),
  session: (sessionId: number) => apiClient.get(`/analytics/sessions/${sessionId}`).then((r) => r.data),
};

export const reportApi = {
  engagement: (classroomId?: number) =>
    apiClient.get('/reports/engagement', { params: classroomId ? { classroomId } : undefined }).then((r) => r.data),
  attendance: (classroomId?: number) =>
    apiClient.get('/reports/attendance', { params: classroomId ? { classroomId } : undefined }).then((r) => r.data),
  session: (sessionId: number) => apiClient.get(`/reports/session/${sessionId}`).then((r) => r.data),
};

export const settingsApi = {
  get: () => apiClient.get<TeacherSettings>('/settings').then((r) => r.data),
  update: (payload: TeacherSettings) => apiClient.put<TeacherSettings>('/settings', payload).then((r) => r.data),
};

export const demoApi = {
  seed: () => apiClient.post<{ message: string }>('/demo/seed').then((r) => r.data),
};
