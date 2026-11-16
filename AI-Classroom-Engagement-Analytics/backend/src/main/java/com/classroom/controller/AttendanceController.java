package com.classroom.controller;

import com.classroom.dto.AttendanceDtos.*;
import com.classroom.service.AttendanceService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/attendance")
public class AttendanceController {

    private final AttendanceService attendanceService;

    public AttendanceController(AttendanceService attendanceService) {
        this.attendanceService = attendanceService;
    }

    @GetMapping
    public ResponseEntity<List<AttendanceResponse>> list(
            @RequestParam(required = false) Long classroomId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            Authentication auth) {
        return ResponseEntity.ok(attendanceService.listAll(auth.getName(), classroomId, date));
    }

    @PostMapping
    public ResponseEntity<AttendanceResponse> mark(@Valid @RequestBody AttendanceMarkRequest req, Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED).body(attendanceService.markAttendance(req, auth.getName()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<AttendanceResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody AttendanceUpdateRequest req,
            Authentication auth) {
        return ResponseEntity.ok(attendanceService.updateAttendance(id, req, auth.getName()));
    }

    @GetMapping("/classroom/{classroomId}")
    public ResponseEntity<List<AttendanceResponse>> byClassroom(@PathVariable Long classroomId, Authentication auth) {
        return ResponseEntity.ok(attendanceService.listByClassroom(classroomId, auth.getName()));
    }
}
