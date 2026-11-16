package com.classroom.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public class AttendanceDtos {
    public record AttendanceMarkRequest(
        @NotNull(message = "Student ID is required") Long studentId,
        @NotNull(message = "Classroom ID is required") Long classroomId,
        @NotNull(message = "Date is required") LocalDate date,
        @NotBlank(message = "Status is required") String status
    ) {}

    public record AttendanceUpdateRequest(@NotBlank String status) {}

    public record AttendanceResponse(
        Long id,
        Long studentId,
        String studentName,
        String rollNumber,
        Long classroomId,
        String classroomName,
        LocalDate date,
        String status,
        boolean isDemo
    ) {}
}
