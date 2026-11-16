package com.classroom.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;

public class MonitoringDtos {
    public record StartSessionRequest(
        @NotNull(message = "Classroom ID is required") Long classroomId,
        @NotBlank(message = "Session title is required") String sessionTitle,
        String mode
    ) {}

    public record MetricPayloadRequest(
        Long studentId,
        @NotNull @Min(0) @Max(100) Double facePresenceScore,
        @NotNull @Min(0) @Max(100) Double attentionOrientationScore,
        @Min(0) @Max(100) Double participationScore,
        Integer detectedFacesCount,
        String dataQualityStatus
    ) {}

    public record ParticipationRequest(
        Long studentId,
        @NotBlank String eventType,
        @Min(0) @Max(100) Double scoreValue
    ) {}

    public record StopSessionRequest(Integer durationSeconds) {}

    public record EngagementRecordDto(
        Long id,
        Long sessionId,
        Long studentId,
        String studentName,
        Instant timestamp,
        double facePresenceScore,
        double attentionOrientationScore,
        Double participationScore,
        double finalEngagementScore,
        int detectedFacesCount,
        String dataQualityStatus
    ) {}

    public record SessionResponse(
        Long id,
        String sessionTitle,
        Long classroomId,
        String classroomName,
        String subject,
        Instant startTime,
        Instant endTime,
        int duration,
        double averageEngagement,
        double attendancePercentage,
        String status,
        String mode,
        boolean isDemo,
        List<EngagementRecordDto> records
    ) {}
}
