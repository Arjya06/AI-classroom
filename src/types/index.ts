export interface TeacherProfile {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string;
}

export interface AuthResponse {
  token: string;
  teacher: TeacherProfile;
}

export interface Classroom {
  id: number;
  classroomName: string;
  subject: string;
  section: string;
  academicYear: string;
  description: string;
  teacherName: string;
  studentCount: number;
  averageEngagement: number;
  attendancePercentage: number;
  isDemo: boolean;
}

export interface Student {
  id: number;
  studentName: string;
  email: string;
  rollNumber: string;
  classroomId: number;
  classroomName: string;
  section: string;
  enrollmentDate: string;
  averageEngagement: number;
  attendancePercentage: number;
  sessionsAttended: number;
  engagementCategory: 'High' | 'Moderate' | 'Low' | 'No Data';
  isDemo: boolean;
}

export interface EngagementRecord {
  id: number;
  sessionId: number;
  studentId: number | null;
  studentName: string | null;
  timestamp: string;
  facePresenceScore: number;
  attentionOrientationScore: number;
  participationScore: number | null;
  finalEngagementScore: number;
  detectedFacesCount: number;
  dataQualityStatus: string;
}

export interface MonitoringSession {
  id: number;
  sessionTitle: string;
  classroomId: number;
  classroomName: string;
  subject: string;
  startTime: string;
  endTime: string | null;
  duration: number;
  averageEngagement: number;
  attendancePercentage: number;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  mode: 'LIVE' | 'DEMO';
  isDemo: boolean;
  records?: EngagementRecord[];
}

export interface AttendanceRecord {
  id: number;
  studentId: number;
  studentName: string;
  rollNumber: string;
  classroomId: number;
  classroomName: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE';
  isDemo: boolean;
}

export interface TeacherSettings {
  attentionWeight: number;
  presenceWeight: number;
  participationWeight: number;
  includeParticipation: boolean;
  highThreshold: number;
  moderateThreshold: number;
  samplingInterval: number;
  preferredCameraLabel: string;
  retentionDays: number;
}

export interface DashboardAnalytics {
  totalStudents: number;
  totalClassrooms: number;
  averageEngagement: number;
  averageAttendance: number;
  sessionsConducted: number;
  hasDemoData: boolean;
  distribution: Array<{ name: string; value: number }>;
  recentSessions: Array<{
    id: number;
    sessionTitle: string;
    classroomId: number;
    classroomName: string;
    startTime: string;
    duration: number;
    averageEngagement: number;
    attendancePercentage: number;
    status: string;
    mode: string;
    isDemo: boolean;
  }>;
  studentsRequiringAttention: Student[];
}
