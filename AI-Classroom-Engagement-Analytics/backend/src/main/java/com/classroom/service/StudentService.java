package com.classroom.service;

import com.classroom.dto.StudentDtos.*;
import com.classroom.entity.*;
import com.classroom.exception.BadRequestException;
import com.classroom.exception.ResourceNotFoundException;
import com.classroom.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
public class StudentService {

    private final StudentRepository studentRepository;
    private final EngagementRecordRepository engagementRecordRepository;
    private final AttendanceRepository attendanceRepository;
    private final ClassroomService classroomService;
    private final AuthService authService;
    private final SettingsService settingsService;

    public StudentService(StudentRepository studentRepository,
                          EngagementRecordRepository engagementRecordRepository,
                          AttendanceRepository attendanceRepository,
                          ClassroomService classroomService,
                          AuthService authService,
                          SettingsService settingsService) {
        this.studentRepository = studentRepository;
        this.engagementRecordRepository = engagementRecordRepository;
        this.attendanceRepository = attendanceRepository;
        this.classroomService = classroomService;
        this.authService = authService;
        this.settingsService = settingsService;
    }

    public List<StudentResponse> listForTeacher(String email) {
        Teacher teacher = authService.getTeacherByEmail(email);
        TeacherSettings settings = settingsService.getOrCreateSettings(teacher);
        return studentRepository.findByClassroomTeacherIdOrderByStudentNameAsc(teacher.getId())
                .stream()
                .map(s -> toResponse(s, settings))
                .toList();
    }

    public StudentResponse getById(Long id, String email) {
        Student student = findOwnedStudent(id, email);
        TeacherSettings settings = settingsService.getOrCreateSettings(student.getClassroom().getTeacher());
        return toResponse(student, settings);
    }

    @Transactional
    public StudentResponse create(StudentRequest request, String email) {
        Classroom classroom = classroomService.findOwnedClassroom(request.classroomId(), email);
        if (studentRepository.existsByRollNumberAndClassroomId(request.rollNumber().trim(), classroom.getId())) {
            throw new BadRequestException("A student with this roll number already exists in the selected classroom.");
        }
        Student s = new Student();
        s.setStudentName(request.studentName().trim());
        s.setEmail(request.email().trim().toLowerCase());
        s.setRollNumber(request.rollNumber().trim());
        s.setClassroom(classroom);
        s.setEnrollmentDate(request.enrollmentDate() != null ? request.enrollmentDate() : LocalDate.now());
        s.setDemo(Boolean.TRUE.equals(request.isDemo()) || classroom.isDemo());
        s = studentRepository.save(s);
        return toResponse(s, settingsService.getOrCreateSettings(classroom.getTeacher()));
    }

    @Transactional
    public StudentResponse update(Long id, StudentRequest request, String email) {
        Student s = findOwnedStudent(id, email);
        Classroom classroom = classroomService.findOwnedClassroom(request.classroomId(), email);
        s.setStudentName(request.studentName().trim());
        s.setEmail(request.email().trim().toLowerCase());
        s.setRollNumber(request.rollNumber().trim());
        s.setClassroom(classroom);
        if (request.enrollmentDate() != null) {
            s.setEnrollmentDate(request.enrollmentDate());
        }
        return toResponse(studentRepository.save(s), settingsService.getOrCreateSettings(classroom.getTeacher()));
    }

    @Transactional
    public void delete(Long id, String email) {
        Student s = findOwnedStudent(id, email);
        studentRepository.delete(s);
    }

    public Student findOwnedStudent(Long id, String email) {
        Teacher teacher = authService.getTeacherByEmail(email);
        Student student = studentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found."));
        if (!student.getClassroom().getTeacher().getId().equals(teacher.getId())) {
            throw new ResourceNotFoundException("Student not found for current teacher.");
        }
        return student;
    }

    private StudentResponse toResponse(Student s, TeacherSettings settings) {
        List<EngagementRecord> records = engagementRecordRepository.findByStudentIdOrderByTimestampAsc(s.getId());
        double avgEng = records.stream()
                .mapToDouble(EngagementRecord::getFinalEngagementScore)
                .average()
                .orElse(0.0);

        List<Attendance> attendances = attendanceRepository.findByStudentIdOrderByDateDesc(s.getId());
        long presentOrLate = attendances.stream()
                .filter(a -> "PRESENT".equalsIgnoreCase(a.getStatus()) || "LATE".equalsIgnoreCase(a.getStatus()))
                .count();
        double attPct = attendances.isEmpty() ? 0.0 : (presentOrLate * 100.0) / attendances.size();
        int sessionsCount = (int) records.stream().map(r -> r.getSession().getId()).distinct().count();

        String category = "No Data";
        if (!records.isEmpty()) {
            if (avgEng >= settings.getHighThreshold()) category = "High";
            else if (avgEng >= settings.getModerateThreshold()) category = "Moderate";
            else category = "Low";
        }

        return new StudentResponse(
                s.getId(),
                s.getStudentName(),
                s.getEmail(),
                s.getRollNumber(),
                s.getClassroom().getId(),
                s.getClassroom().getClassroomName(),
                s.getClassroom().getSection(),
                s.getEnrollmentDate(),
                Math.round(avgEng * 10.0) / 10.0,
                Math.round(attPct * 10.0) / 10.0,
                sessionsCount,
                category,
                s.isDemo()
        );
    }
}
