package com.classroom.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public class StudentDtos {
    public record StudentRequest(
        @NotBlank(message = "Student name is required") String studentName,
        @NotBlank(message = "Email is required") @Email(message = "Invalid email") String email,
        @NotBlank(message = "Roll number is required") String rollNumber,
        @NotNull(message = "Classroom ID is required") Long classroomId,
        LocalDate enrollmentDate,
        Boolean isDemo
    ) {}

    public record StudentResponse(
        Long id,
        String studentName,
        String email,
        String rollNumber,
        Long classroomId,
        String classroomName,
        String section,
        LocalDate enrollmentDate,
        double averageEngagement,
        double attendancePercentage,
        int sessionsAttended,
        String engagementCategory,
        boolean isDemo
    ) {}
}
