package com.classroom.dto;

import jakarta.validation.constraints.NotBlank;

public class ClassroomDtos {
    public record ClassroomRequest(
        @NotBlank(message = "Classroom name is required") String classroomName,
        @NotBlank(message = "Subject is required") String subject,
        @NotBlank(message = "Section is required") String section,
        @NotBlank(message = "Academic year is required") String academicYear,
        String description,
        Boolean isDemo
    ) {}

    public record ClassroomResponse(
        Long id,
        String classroomName,
        String subject,
        String section,
        String academicYear,
        String description,
        String teacherName,
        long studentCount,
        double averageEngagement,
        double attendancePercentage,
        boolean isDemo
    ) {}
}
