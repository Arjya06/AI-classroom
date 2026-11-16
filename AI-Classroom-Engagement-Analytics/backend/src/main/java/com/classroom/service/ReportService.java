package com.classroom.service;

import com.classroom.dto.AttendanceDtos.AttendanceResponse;
import com.classroom.dto.MonitoringDtos.SessionResponse;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class ReportService {

    private final AnalyticsService analyticsService;
    private final AttendanceService attendanceService;
    private final MonitoringService monitoringService;

    public ReportService(AnalyticsService analyticsService,
                         AttendanceService attendanceService,
                         MonitoringService monitoringService) {
        this.analyticsService = analyticsService;
        this.attendanceService = attendanceService;
        this.monitoringService = monitoringService;
    }

    public Map<String, Object> getEngagementReport(String email, Long classroomId) {
        Map<String, Object> dashboard = analyticsService.getDashboardAnalytics(email);
        List<SessionResponse> sessions = monitoringService.listSessions(email).stream()
                .filter(s -> classroomId == null || s.classroomId().equals(classroomId))
                .toList();

        Map<String, Object> report = new LinkedHashMap<>();
        report.put("reportType", "CLASSROOM_ENGAGEMENT_REPORT");
        report.put("summary", dashboard);
        report.put("sessions", sessions);
        report.put("methodology", "Engagement Score = 50% Attention Orientation + 30% Face Presence + 20% Participation (renormalized when participation is unavailable). Indicators are approximate and should never be used as sole evaluation criteria.");
        return report;
    }

    public Map<String, Object> getAttendanceReport(String email, Long classroomId) {
        List<AttendanceResponse> records = attendanceService.listAll(email, classroomId, null);
        long present = records.stream().filter(r -> "PRESENT".equals(r.status())).count();
        long late = records.stream().filter(r -> "LATE".equals(r.status())).count();
        long absent = records.stream().filter(r -> "ABSENT".equals(r.status())).count();
        double rate = records.isEmpty() ? 0.0 : Math.round(((present + late) * 1000.0) / records.size()) / 10.0;

        Map<String, Object> report = new LinkedHashMap<>();
        report.put("reportType", "ATTENDANCE_REPORT");
        report.put("totalRecords", records.size());
        report.put("presentCount", present);
        report.put("lateCount", late);
        report.put("absentCount", absent);
        report.put("attendanceRate", rate);
        report.put("records", records);
        return report;
    }

    public Map<String, Object> getSessionReport(Long sessionId, String email) {
        SessionResponse session = monitoringService.getSession(sessionId, email);
        Map<String, Object> analytics = analyticsService.getSessionAnalytics(sessionId, email);
        Map<String, Object> report = new LinkedHashMap<>();
        report.put("reportType", "SESSION_SUMMARY_REPORT");
        report.put("session", session);
        report.put("analytics", analytics);
        report.put("methodology", "MediaPipe Face Landmarker extracts facial presence and head orientation indicators in the browser without storing raw video frames.");
        return report;
    }
}
