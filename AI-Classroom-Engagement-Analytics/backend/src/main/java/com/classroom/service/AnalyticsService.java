package com.classroom.service;

import com.classroom.dto.ClassroomDtos.ClassroomResponse;
import com.classroom.dto.StudentDtos.StudentResponse;
import com.classroom.entity.*;
import com.classroom.repository.*;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class AnalyticsService {

    private final ClassroomService classroomService;
    private final StudentService studentService;
    private final MonitoringSessionRepository sessionRepository;
    private final EngagementRecordRepository recordRepository;
    private final AttendanceRepository attendanceRepository;
    private final AuthService authService;
    private final SettingsService settingsService;

    public AnalyticsService(ClassroomService classroomService,
                            StudentService studentService,
                            MonitoringSessionRepository sessionRepository,
                            EngagementRecordRepository recordRepository,
                            AttendanceRepository attendanceRepository,
                            AuthService authService,
                            SettingsService settingsService) {
        this.classroomService = classroomService;
        this.studentService = studentService;
        this.sessionRepository = sessionRepository;
        this.recordRepository = recordRepository;
        this.attendanceRepository = attendanceRepository;
        this.authService = authService;
        this.settingsService = settingsService;
    }

    public Map<String, Object> getDashboardAnalytics(String email) {
        Teacher teacher = authService.getTeacherByEmail(email);
        TeacherSettings settings = settingsService.getOrCreateSettings(teacher);

        List<ClassroomResponse> classrooms = classroomService.listForTeacher(email);
        List<StudentResponse> students = studentService.listForTeacher(email);
        List<MonitoringSession> sessions = sessionRepository.findByTeacherIdOrderByStartTimeDesc(teacher.getId());
        List<Attendance> attendances = attendanceRepository.findByClassroomTeacherIdOrderByDateDesc(teacher.getId());

        double avgEngagement = sessions.stream()
                .filter(s -> s.getAverageEngagement() > 0)
                .mapToDouble(MonitoringSession::getAverageEngagement)
                .average()
                .orElse(0.0);

        long presentCount = attendances.stream()
                .filter(a -> "PRESENT".equalsIgnoreCase(a.getStatus()) || "LATE".equalsIgnoreCase(a.getStatus()))
                .count();
        double avgAttendance = attendances.isEmpty() ? 0.0 : (presentCount * 100.0) / attendances.size();

        long highCount = students.stream().filter(s -> "High".equals(s.engagementCategory())).count();
        long modCount = students.stream().filter(s -> "Moderate".equals(s.engagementCategory())).count();
        long lowCount = students.stream().filter(s -> "Low".equals(s.engagementCategory())).count();

        List<StudentResponse> attentionStudents = students.stream()
                .filter(s -> "Low".equals(s.engagementCategory()) || (s.sessionsAttended() > 0 && s.averageEngagement() < settings.getModerateThreshold()))
                .toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalStudents", students.size());
        result.put("totalClassrooms", classrooms.size());
        result.put("averageEngagement", Math.round(avgEngagement * 10.0) / 10.0);
        result.put("averageAttendance", Math.round(avgAttendance * 10.0) / 10.0);
        result.put("sessionsConducted", sessions.size());
        result.put("distribution", List.of(
                Map.of("name", "High Engagement", "value", highCount),
                Map.of("name", "Moderate Engagement", "value", modCount),
                Map.of("name", "Low Engagement", "value", lowCount)
        ));
        result.put("recentSessions", sessions.stream().limit(6).map(s -> Map.of(
                "id", s.getId(),
                "sessionTitle", s.getSessionTitle(),
                "classroomName", s.getClassroom().getClassroomName(),
                "startTime", s.getStartTime().toString(),
                "duration", s.getDuration(),
                "averageEngagement", s.getAverageEngagement(),
                "attendancePercentage", s.getAttendancePercentage(),
                "status", s.getStatus(),
                "isDemo", s.isDemo()
        )).toList());
        result.put("studentsRequiringAttention", attentionStudents);
        return result;
    }

    public Map<String, Object> getEngagementTrends(String email) {
        Teacher teacher = authService.getTeacherByEmail(email);
        List<MonitoringSession> sessions = sessionRepository.findByTeacherIdOrderByStartTimeDesc(teacher.getId());
        List<Map<String, Object>> trends = new ArrayList<>();
        for (int i = sessions.size() - 1; i >= 0; i--) {
            MonitoringSession s = sessions.get(i);
            trends.add(Map.of(
                    "sessionId", s.getId(),
                    "sessionTitle", s.getSessionTitle(),
                    "classroomName", s.getClassroom().getClassroomName(),
                    "date", s.getStartTime().toString(),
                    "averageEngagement", s.getAverageEngagement(),
                    "attendancePercentage", s.getAttendancePercentage(),
                    "isDemo", s.isDemo()
            ));
        }
        return Map.of("trends", trends);
    }

    public List<ClassroomResponse> getClassroomComparison(String email) {
        return classroomService.listForTeacher(email);
    }

    public Map<String, Object> getStudentAnalytics(Long studentId, String email) {
        StudentResponse student = studentService.getById(studentId, email);
        List<EngagementRecord> records = recordRepository.findByStudentIdOrderByTimestampAsc(studentId);
        List<Map<String, Object>> history = records.stream().map(r -> Map.<String, Object>of(
                "recordId", r.getId(),
                "sessionId", r.getSession().getId(),
                "sessionTitle", r.getSession().getSessionTitle(),
                "timestamp", r.getTimestamp().toString(),
                "facePresenceScore", r.getFacePresenceScore(),
                "attentionOrientationScore", r.getAttentionOrientationScore(),
                "participationScore", r.getParticipationScore() != null ? r.getParticipationScore() : 0.0,
                "finalEngagementScore", r.getFinalEngagementScore(),
                "dataQualityStatus", r.getDataQualityStatus()
        )).toList();
        return Map.of("student", student, "history", history);
    }

    public Map<String, Object> getSessionAnalytics(Long sessionId, String email) {
        Teacher teacher = authService.getTeacherByEmail(email);
        MonitoringSession session = sessionRepository.findById(sessionId)
                .filter(s -> s.getTeacher().getId().equals(teacher.getId()))
                .orElseThrow();
        List<EngagementRecord> records = recordRepository.findBySessionIdOrderByTimestampAsc(sessionId);
        double highest = records.stream().mapToDouble(EngagementRecord::getFinalEngagementScore).max().orElse(0.0);
        double lowest = records.stream().mapToDouble(EngagementRecord::getFinalEngagementScore).min().orElse(0.0);
        return Map.of(
                "sessionId", session.getId(),
                "sessionTitle", session.getSessionTitle(),
                "duration", session.getDuration(),
                "averageEngagement", session.getAverageEngagement(),
                "highestEngagement", highest,
                "lowestEngagement", lowest,
                "attendancePercentage", session.getAttendancePercentage(),
                "recordsCount", records.size()
        );
    }
}
