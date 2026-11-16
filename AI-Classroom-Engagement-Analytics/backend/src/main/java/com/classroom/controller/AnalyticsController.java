package com.classroom.controller;

import com.classroom.dto.ClassroomDtos.ClassroomResponse;
import com.classroom.service.AnalyticsService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @GetMapping("/dashboard")
    public ResponseEntity<Map<String, Object>> dashboard(Authentication auth) {
        return ResponseEntity.ok(analyticsService.getDashboardAnalytics(auth.getName()));
    }

    @GetMapping("/engagement")
    public ResponseEntity<Map<String, Object>> engagement(Authentication auth) {
        return ResponseEntity.ok(analyticsService.getEngagementTrends(auth.getName()));
    }

    @GetMapping("/classrooms")
    public ResponseEntity<List<ClassroomResponse>> classrooms(Authentication auth) {
        return ResponseEntity.ok(analyticsService.getClassroomComparison(auth.getName()));
    }

    @GetMapping("/students/{studentId}")
    public ResponseEntity<Map<String, Object>> student(@PathVariable Long studentId, Authentication auth) {
        return ResponseEntity.ok(analyticsService.getStudentAnalytics(studentId, auth.getName()));
    }

    @GetMapping("/sessions/{sessionId}")
    public ResponseEntity<Map<String, Object>> session(@PathVariable Long sessionId, Authentication auth) {
        return ResponseEntity.ok(analyticsService.getSessionAnalytics(sessionId, auth.getName()));
    }
}
