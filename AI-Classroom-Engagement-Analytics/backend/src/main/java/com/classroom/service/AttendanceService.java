package com.classroom.service;

import com.classroom.dto.AttendanceDtos.*;
import com.classroom.entity.*;
import com.classroom.exception.BadRequestException;
import com.classroom.exception.ResourceNotFoundException;
import com.classroom.repository.AttendanceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

@Service
public class AttendanceService {

    private static final Set<String> VALID_STATUSES = Set.of("PRESENT", "ABSENT", "LATE");

    private final AttendanceRepository attendanceRepository;
    private final StudentService studentService;
    private final ClassroomService classroomService;
    private final AuthService authService;

    public AttendanceService(AttendanceRepository attendanceRepository,
                             StudentService studentService,
                             ClassroomService classroomService,
                             AuthService authService) {
        this.attendanceRepository = attendanceRepository;
        this.studentService = studentService;
        this.classroomService = classroomService;
        this.authService = authService;
    }

    public List<AttendanceResponse> listAll(String email, Long classroomId, LocalDate date) {
        Teacher teacher = authService.getTeacherByEmail(email);
        List<Attendance> records;
        if (classroomId != null && date != null) {
            classroomService.findOwnedClassroom(classroomId, email);
            records = attendanceRepository.findByClassroomIdAndDate(classroomId, date);
        } else if (classroomId != null) {
            classroomService.findOwnedClassroom(classroomId, email);
            records = attendanceRepository.findByClassroomIdOrderByDateDesc(classroomId);
        } else {
            records = attendanceRepository.findByClassroomTeacherIdOrderByDateDesc(teacher.getId());
        }
        return records.stream().map(this::toResponse).toList();
    }

    public List<AttendanceResponse> listByClassroom(Long classroomId, String email) {
        classroomService.findOwnedClassroom(classroomId, email);
        return attendanceRepository.findByClassroomIdOrderByDateDesc(classroomId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional
    public AttendanceResponse markAttendance(AttendanceMarkRequest request, String email) {
        String normalized = request.status().trim().toUpperCase();
        if (!VALID_STATUSES.contains(normalized)) {
            throw new BadRequestException("Status must be PRESENT, ABSENT, or LATE.");
        }
        Student student = studentService.findOwnedStudent(request.studentId(), email);
        Classroom classroom = classroomService.findOwnedClassroom(request.classroomId(), email);

        Attendance att = attendanceRepository.findByStudentIdAndDate(student.getId(), request.date())
                .orElseGet(Attendance::new);
        att.setStudent(student);
        att.setClassroom(classroom);
        att.setDate(request.date());
        att.setStatus(normalized);
        att.setDemo(classroom.isDemo() || student.isDemo());
        att.setUpdatedAt(Instant.now());

        return toResponse(attendanceRepository.save(att));
    }

    @Transactional
    public AttendanceResponse updateAttendance(Long id, AttendanceUpdateRequest request, String email) {
        String normalized = request.status().trim().toUpperCase();
        if (!VALID_STATUSES.contains(normalized)) {
            throw new BadRequestException("Status must be PRESENT, ABSENT, or LATE.");
        }
        Teacher teacher = authService.getTeacherByEmail(email);
        Attendance att = attendanceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Attendance record not found."));
        if (!att.getClassroom().getTeacher().getId().equals(teacher.getId())) {
            throw new ResourceNotFoundException("Attendance record not found.");
        }
        att.setStatus(normalized);
        att.setUpdatedAt(Instant.now());
        return toResponse(attendanceRepository.save(att));
    }

    private AttendanceResponse toResponse(Attendance a) {
        return new AttendanceResponse(
                a.getId(),
                a.getStudent().getId(),
                a.getStudent().getStudentName(),
                a.getStudent().getRollNumber(),
                a.getClassroom().getId(),
                a.getClassroom().getClassroomName(),
                a.getDate(),
                a.getStatus(),
                a.isDemo()
        );
    }
}
