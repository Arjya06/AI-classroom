package com.classroom;

import com.classroom.dto.AttendanceDtos.AttendanceMarkRequest;
import com.classroom.dto.AuthDtos.*;
import com.classroom.dto.ClassroomDtos.ClassroomRequest;
import com.classroom.dto.MonitoringDtos.*;
import com.classroom.dto.StudentDtos.StudentRequest;
import com.classroom.entity.TeacherSettings;
import com.classroom.service.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class ClassroomEngagementTests {

    @Autowired private AuthService authService;
    @Autowired private ClassroomService classroomService;
    @Autowired private StudentService studentService;
    @Autowired private MonitoringService monitoringService;
    @Autowired private AttendanceService attendanceService;
    @Autowired private AnalyticsService analyticsService;

    @Test
    void testAuthClassroomStudentMonitoringAttendanceAndAnalyticsFlow() {
        // 1. Register & Login
        AuthResponse reg = authService.register(new RegisterRequest(
                "Prof. Test User", "prof.test@university.edu", "Secret@123", "CSE"));
        assertNotNull(reg.token());
        AuthResponse login = authService.login(new LoginRequest("prof.test@university.edu", "Secret@123"));
        assertEquals("prof.test@university.edu", login.teacher().email());

        // 2. Classroom creation
        var classroom = classroomService.create(new ClassroomRequest(
                "CS-201 Operating Systems", "Operating Systems", "CSE-A", "2026-27", "Core OS course", false),
                "prof.test@university.edu");
        assertNotNull(classroom.id());

        // 3. Student creation
        var student = studentService.create(new StudentRequest(
                "Riya Sen", "riya.s@student.edu", "23CSE042", classroom.id(), LocalDate.now(), false),
                "prof.test@university.edu");
        assertEquals("23CSE042", student.rollNumber());

        // 4. Attendance calculation
        var att = attendanceService.markAttendance(new AttendanceMarkRequest(
                student.id(), classroom.id(), LocalDate.now(), "PRESENT"),
                "prof.test@university.edu");
        assertEquals("PRESENT", att.status());

        // 5. Monitoring session creation & metric calculation
        var session = monitoringService.startSession(new StartSessionRequest(
                classroom.id(), "Process Scheduling Lecture", "LIVE"),
                "prof.test@university.edu");
        assertEquals("ACTIVE", session.status());

        var record = monitoringService.recordMetrics(session.id(), new MetricPayloadRequest(
                student.id(), 100.0, 85.0, 70.0, 1, "RELIABLE"),
                "prof.test@university.edu");
        // (85 * 0.50) + (100 * 0.30) + (70 * 0.20) = 42.5 + 30 + 14 = 86.5
        assertEquals(86.5, record.finalEngagementScore(), 0.1);

        var stopped = monitoringService.stopSession(session.id(), new StopSessionRequest(120), "prof.test@university.edu");
        assertEquals("COMPLETED", stopped.status());

        // 6. Analytics endpoint aggregation
        Map<String, Object> dashboard = analyticsService.getDashboardAnalytics("prof.test@university.edu");
        assertEquals(1, dashboard.get("totalStudents"));
        assertEquals(1, dashboard.get("totalClassrooms"));
        assertEquals(1, dashboard.get("sessionsConducted"));
    }

    @Test
    void testEngagementScoreRenormalizationWithoutParticipation() {
        TeacherSettings settings = new TeacherSettings();
        settings.setAttentionWeight(50.0);
        settings.setPresenceWeight(30.0);
        settings.setParticipationWeight(20.0);
        settings.setIncludeParticipation(true);

        // Without participation, 50/(50+30)=0.625 and 30/(50+30)=0.375
        // 80 * 0.625 + 100 * 0.375 = 50 + 37.5 = 87.5
        double score = monitoringService.calculateEngagementScore(80.0, 100.0, null, settings);
        assertEquals(87.5, score, 0.1);
    }
}
