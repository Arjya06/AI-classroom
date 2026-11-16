package com.classroom.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public class SettingsDtos {
    public record SettingsRequest(
        @NotNull @Min(0) @Max(100) Double attentionWeight,
        @NotNull @Min(0) @Max(100) Double presenceWeight,
        @NotNull @Min(0) @Max(100) Double participationWeight,
        @NotNull Boolean includeParticipation,
        @NotNull @Min(50) @Max(95) Double highThreshold,
        @NotNull @Min(20) @Max(74) Double moderateThreshold,
        @NotNull @Min(1) @Max(30) Integer samplingInterval,
        String preferredCameraLabel,
        @NotNull @Min(7) @Max(365) Integer retentionDays
    ) {}

    public record SettingsResponse(
        Double attentionWeight,
        Double presenceWeight,
        Double participationWeight,
        Boolean includeParticipation,
        Double highThreshold,
        Double moderateThreshold,
        Integer samplingInterval,
        String preferredCameraLabel,
        Integer retentionDays
    ) {}
}
