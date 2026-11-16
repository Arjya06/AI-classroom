package com.classroom.service;

import com.classroom.dto.MonitoringDtos.*;
import com.classroom.entity.*;
import com.classroom.exception.BadRequestException;
import com.classroom.exception.ResourceNotFoundException;
import com.classroom.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Service
public class MonitoringService {

    private final MonitoringSessionRepository sessionRepository;
    private final EngagementRecordRepository recordRepository;
    private final ParticipationEventRepository participationRepository;
    private final AttendanceRepository attendanceRepository;
    private final ClassroomService classroomService;
    private final StudentRepository studentRepository;
    private final AuthService authService;
    private final SettingsService settingsService;

    public MonitoringService(MonitoringSessionRepository sessionRepository,
                             EngagementRecordRepository recordRepository,
                             ParticipationEventRepository participationRepository,
                             AttendanceRepository attendanceRepository,
                             ClassroomService classroomService,
                             StudentRepository studentRepository,
                             AuthService authService,
                             SettingsService settingsService) {
        this.sessionRepository = sessionRepository;
        this.recordRepository = recordRepository;
        this.participationRepository = participationRepository;
        this.attendanceRepository = attendanceRepository;
        this.classroomService = classroomService;
        this.studentRepository = studentRepository;
        this.authService = authService;
        this.settingsService = settingsService;
    }

    /**
     * Transparent, configurable engagement formula:
     * Default weights: 50% Attention Orientation, 30% Face Presence, 20% Participation.
     * If participation data is unavailable or disabled, weights are renormalized over
     * the available indicators rather than assigning an arbitrary participation score.
     */
    public double calculateEngagementScore(double attentionOrientation,
                                           double facePresence,
                                           Double participationScore,
                                           TeacherSettings settings) {
        double wAtt = settings.getAttentionWeight();
        double wPres = settings.getPresenceWeight();
        double wPart = settings.getParticipationWeight();

        if (Boolean.TRUE.equals(settings.getIncludeParticipation()) && participationScore != null) {
            double totalWeight = wAtt + wPres + wPart;
            if (totalWeight <= 0) return 0.0;
            double score = (attentionOrientation * wAtt + facePresence * wPres + participationScore * wPart) / totalWeight;
            return Math.round(score * 10.0) / 10.0;
        } else {
            double availableWeight = wAtt + wPres;
            if (availableWeight <= 0) return 0.0;
            double score = (attentionOrientation * wAtt + facePresence * wPres) / availableWeight;
            return Math.round(score * 10.0) / 10.0;
        }
    }

    @Transactional
    public SessionResponse startSession(StartSessionRequest request, String email) {
        Teacher teacher = authService.getTeacherByEmail(email);
        Classroom classroom = classroomService.findOwnedClassroom(request.classroomId(), email);
        String mode = "DEMO".equalsIgnoreCase(request.mode()) ? "DEMO" : "LIVE";

        MonitoringSession session = new MonitoringSession();
        session.setSessionTitle(request.sessionTitle().trim());
        session.setClassroom(classroom);
        session.setTeacher(teacher);
        session.setStartTime(Instant.now());
        session.setStatus("ACTIVE");
        session.setMode(mode);
        session.setDemo("DEMO".equals(mode) || classroom.isDemo());

        // Compute current classroom attendance percentage for today if logged
        List<Attendance> todayAtt = attendanceRepository.findByClassroomIdAndDate(classroom.getId(), LocalDate.now());
        if (!todayAtt.isEmpty()) {
            long present = todayAtt.stream()
                    .filter(a -> "PRESENT".equalsIgnoreCase(a.getStatus()) || "LATE".equalsIgnoreCase(a.getStatus()))
                    .count();
            session.setAttendancePercentage(Math.round((present * 1000.0) / todayAtt.size()) / 10.0);
        }

        return toResponse(sessionRepository.save(session), false);
    }

    @Transactional
    public EngagementRecordDto recordMetrics(Long sessionId, MetricPayloadRequest request, String email) {
        MonitoringSession session = findOwnedSession(sessionId, email);
        if (!"ACTIVE".equals(session.getStatus())) {
            throw new BadRequestException("Cannot record metrics because session is " + session.getStatus());
        }
        TeacherSettings settings = settingsService.getOrCreateSettings(session.getTeacher());
        Student student = request.studentId() != null ? studentRepository.findById(request.studentId()).orElse(null) : null;

        double finalScore = calculateEngagementScore(
                request.attentionOrientationScore(),
                request.facePresenceScore(),
                request.participationScore(),
                settings
        );

        EngagementRecord record = new EngagementRecord();
        record.setSession(session);
        record.setStudent(student);
        record.setTimestamp(Instant.now());
        record.setFacePresenceScore(request.facePresenceScore());
        record.setAttentionOrientationScore(request.attentionOrientationScore());
        record.setParticipationScore(request.participationScore());
        record.setFinalEngagementScore(finalScore);
        record.setDetectedFacesCount(request.detectedFacesCount() != null ? request.detectedFacesCount() : 0);
        record.setDataQualityStatus(request.dataQualityStatus() != null ? request.dataQualityStatus() : "RELIABLE");
        record = recordRepository.save(record);

        // Update session rolling average over reliable/demo records
        List<EngagementRecord> allRecords = recordRepository.findBySessionIdOrderByTimestampAsc(sessionId);
        double avg = allRecords.stream()
                .filter(r -> !"INSUFFICIENT_VISUAL_DATA".equals(r.getDataQualityStatus()))
                .mapToDouble(EngagementRecord::getFinalEngagementScore)
                .average()
                .orElse(finalScore);
        session.setAverageEngagement(Math.round(avg * 10.0) / 10.0);
        sessionRepository.save(session);

        return toRecordDto(record);
    }

    @Transactional
    public void recordParticipation(Long sessionId, ParticipationRequest request, String email) {
        MonitoringSession session = findOwnedSession(sessionId, email);
        Student student = request.studentId() != null ? studentRepository.findById(request.studentId()).orElse(null) : null;
        ParticipationEvent event = new ParticipationEvent();
        event.setSession(session);
        event.setStudent(student);
        event.setEventType(request.eventType());
        event.setScoreValue(request.scoreValue() != null ? request.scoreValue() : 85.0);
        event.setRecordedBy(session.getTeacher());
        participationRepository.save(event);
    }

    @Transactional
    public SessionResponse pauseSession(Long sessionId, String email) {
        MonitoringSession session = findOwnedSession(sessionId, email);
        if ("COMPLETED".equals(session.getStatus())) {
            throw new BadRequestException("Session is already stopped.");
        }
        session.setStatus("PAUSED");
        return toResponse(sessionRepository.save(session), true);
    }

    @Transactional
    public SessionResponse resumeSession(Long sessionId, String email) {
        MonitoringSession session = findOwnedSession(sessionId, email);
        if ("COMPLETED".equals(session.getStatus())) {
            throw new BadRequestException("Session is already stopped.");
        }
        session.setStatus("ACTIVE");
        return toResponse(sessionRepository.save(session), true);
    }

    @Transactional
    public SessionResponse stopSession(Long sessionId, StopSessionRequest request, String email) {
        MonitoringSession session = findOwnedSession(sessionId, email);
        if ("COMPLETED".equals(session.getStatus())) {
            throw new BadRequestException("Session is already stopped.");
        }
        Instant now = Instant.now();
        session.setEndTime(now);
        int elapsed = request != null && request.durationSeconds() != null
                ? request.durationSeconds()
                : (int) Math.max(1, Duration.between(session.getStartTime(), now).getSeconds());
        session.setDuration(elapsed);
        session.setStatus("COMPLETED");
        return toResponse(sessionRepository.save(session), true);
    }

    public List<SessionResponse> listSessions(String email) {
        Teacher teacher = authService.getTeacherByEmail(email);
        return sessionRepository.findByTeacherIdOrderByStartTimeDesc(teacher.getId())
                .stream()
                .map(s -> toResponse(s, false))
                .toList();
    }

    public SessionResponse getSession(Long id, String email) {
        return toResponse(findOwnedSession(id, email), true);
    }

    @Transactional
    public void deleteSession(Long id, String email) {
        MonitoringSession session = findOwnedSession(id, email);
        sessionRepository.delete(session);
    }

    public MonitoringSession findOwnedSession(Long id, String email) {
        Teacher teacher = authService.getTeacherByEmail(email);
        MonitoringSession session = sessionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Monitoring session not found."));
        if (!session.getTeacher().getId().equals(teacher.getId())) {
            throw new ResourceNotFoundException("Monitoring session not found for current teacher.");
        }
        return session;
    }

    private SessionResponse toResponse(MonitoringSession s, boolean includeRecords) {
        List<EngagementRecordDto> records = includeRecords
                ? recordRepository.findBySessionIdOrderByTimestampAsc(s.getId()).stream().map(this::toRecordDto).toList()
                : List.of();
        return new SessionResponse(
                s.getId(),
                s.getSessionTitle(),
                s.getClassroom().getId(),
                s.getClassroom().getClassroomName(),
                s.getClassroom().getSubject(),
                s.getStartTime(),
                s.getEndTime(),
                s.getDuration(),
                s.getAverageEngagement(),
                s.getAttendancePercentage(),
                s.getStatus(),
                s.getMode(),
                s.isDemo(),
                records
        );
    }

    private EngagementRecordDto toRecordDto(EngagementRecord r) {
        return new EngagementRecordDto(
                r.getId(),
                r.getSession().getId(),
                r.getStudent() != null ? r.getStudent().getId() : null,
                r.getStudent() != null ? r.getStudent().getStudentName() : null,
                r.getTimestamp(),
                r.getFacePresenceScore(),
                r.getAttentionOrientationScore(),
                r.getParticipationScore(),
                r.getFinalEngagementScore(),
                r.getDetectedFacesCount(),
                r.getDataQualityStatus()
        );
    }
}
