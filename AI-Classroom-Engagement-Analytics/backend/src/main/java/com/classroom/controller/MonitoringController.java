package com.classroom.controller;

import com.classroom.dto.MonitoringDtos.*;
import com.classroom.service.MonitoringService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sessions")
public class MonitoringController {

    private final MonitoringService monitoringService;

    public MonitoringController(MonitoringService monitoringService) {
        this.monitoringService = monitoringService;
    }

    @PostMapping("/start")
    public ResponseEntity<SessionResponse> start(@Valid @RequestBody StartSessionRequest req, Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED).body(monitoringService.startSession(req, auth.getName()));
    }

    @PostMapping("/{id}/metrics")
    public ResponseEntity<EngagementRecordDto> recordMetrics(
            @PathVariable Long id,
            @Valid @RequestBody MetricPayloadRequest req,
            Authentication auth) {
        return ResponseEntity.ok(monitoringService.recordMetrics(id, req, auth.getName()));
    }

    @PostMapping("/{id}/participation")
    public ResponseEntity<Map<String, String>> recordParticipation(
            @PathVariable Long id,
            @Valid @RequestBody ParticipationRequest req,
            Authentication auth) {
        monitoringService.recordParticipation(id, req, auth.getName());
        return ResponseEntity.ok(Map.of("message", "Participation event recorded."));
    }

    @PostMapping("/{id}/pause")
    public ResponseEntity<SessionResponse> pause(@PathVariable Long id, Authentication auth) {
        return ResponseEntity.ok(monitoringService.pauseSession(id, auth.getName()));
    }

    @PostMapping("/{id}/resume")
    public ResponseEntity<SessionResponse> resume(@PathVariable Long id, Authentication auth) {
        return ResponseEntity.ok(monitoringService.resumeSession(id, auth.getName()));
    }

    @PostMapping("/{id}/stop")
    public ResponseEntity<SessionResponse> stop(
            @PathVariable Long id,
            @RequestBody(required = false) StopSessionRequest req,
            Authentication auth) {
        return ResponseEntity.ok(monitoringService.stopSession(id, req, auth.getName()));
    }

    @GetMapping
    public ResponseEntity<List<SessionResponse>> list(Authentication auth) {
        return ResponseEntity.ok(monitoringService.listSessions(auth.getName()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<SessionResponse> get(@PathVariable Long id, Authentication auth) {
        return ResponseEntity.ok(monitoringService.getSession(id, auth.getName()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Authentication auth) {
        monitoringService.deleteSession(id, auth.getName());
        return ResponseEntity.noContent().build();
    }
}
