package com.classroom.controller;

import com.classroom.service.ReportService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/engagement")
    public ResponseEntity<Map<String, Object>> engagementReport(
            @RequestParam(required = false) Long classroomId,
            Authentication auth) {
        return ResponseEntity.ok(reportService.getEngagementReport(auth.getName(), classroomId));
    }

    @GetMapping("/attendance")
    public ResponseEntity<Map<String, Object>> attendanceReport(
            @RequestParam(required = false) Long classroomId,
            Authentication auth) {
        return ResponseEntity.ok(reportService.getAttendanceReport(auth.getName(), classroomId));
    }

    @GetMapping("/session/{sessionId}")
    public ResponseEntity<Map<String, Object>> sessionReport(@PathVariable Long sessionId, Authentication auth) {
        return ResponseEntity.ok(reportService.getSessionReport(sessionId, auth.getName()));
    }
}
