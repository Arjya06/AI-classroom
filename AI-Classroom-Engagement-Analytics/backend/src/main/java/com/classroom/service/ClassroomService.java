package com.classroom.service;

import com.classroom.dto.ClassroomDtos.*;
import com.classroom.entity.Classroom;
import com.classroom.entity.MonitoringSession;
import com.classroom.entity.Teacher;
import com.classroom.exception.ResourceNotFoundException;
import com.classroom.repository.ClassroomRepository;
import com.classroom.repository.MonitoringSessionRepository;
import com.classroom.repository.StudentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ClassroomService {

    private final ClassroomRepository classroomRepository;
    private final StudentRepository studentRepository;
    private final MonitoringSessionRepository sessionRepository;
    private final AuthService authService;

    public ClassroomService(ClassroomRepository classroomRepository,
                            StudentRepository studentRepository,
                            MonitoringSessionRepository sessionRepository,
                            AuthService authService) {
        this.classroomRepository = classroomRepository;
        this.studentRepository = studentRepository;
        this.sessionRepository = sessionRepository;
        this.authService = authService;
    }

    public List<ClassroomResponse> listForTeacher(String email) {
        Teacher teacher = authService.getTeacherByEmail(email);
        return classroomRepository.findByTeacherIdOrderByCreatedAtDesc(teacher.getId())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public ClassroomResponse getById(Long id, String email) {
        Classroom classroom = findOwnedClassroom(id, email);
        return toResponse(classroom);
    }

    @Transactional
    public ClassroomResponse create(ClassroomRequest request, String email) {
        Teacher teacher = authService.getTeacherByEmail(email);
        Classroom c = new Classroom();
        c.setClassroomName(request.classroomName().trim());
        c.setSubject(request.subject().trim());
        c.setSection(request.section().trim());
        c.setAcademicYear(request.academicYear().trim());
        c.setDescription(request.description() != null ? request.description().trim() : "");
        c.setDemo(Boolean.TRUE.equals(request.isDemo()));
        c.setTeacher(teacher);
        return toResponse(classroomRepository.save(c));
    }

    @Transactional
    public ClassroomResponse update(Long id, ClassroomRequest request, String email) {
        Classroom c = findOwnedClassroom(id, email);
        c.setClassroomName(request.classroomName().trim());
        c.setSubject(request.subject().trim());
        c.setSection(request.section().trim());
        c.setAcademicYear(request.academicYear().trim());
        c.setDescription(request.description() != null ? request.description().trim() : "");
        return toResponse(classroomRepository.save(c));
    }

    @Transactional
    public void delete(Long id, String email) {
        Classroom c = findOwnedClassroom(id, email);
        classroomRepository.delete(c);
    }

    public Classroom findOwnedClassroom(Long id, String email) {
        Teacher teacher = authService.getTeacherByEmail(email);
        Classroom classroom = classroomRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Classroom not found."));
        if (!classroom.getTeacher().getId().equals(teacher.getId())) {
            throw new ResourceNotFoundException("Classroom not found for current teacher.");
        }
        return classroom;
    }

    private ClassroomResponse toResponse(Classroom c) {
        long studentCount = studentRepository.countByClassroomId(c.getId());
        List<MonitoringSession> sessions = sessionRepository.findByClassroomIdOrderByStartTimeDesc(c.getId());
        double avgEng = sessions.stream()
                .filter(s -> s.getAverageEngagement() > 0)
                .mapToDouble(MonitoringSession::getAverageEngagement)
                .average()
                .orElse(0.0);
        double avgAtt = sessions.stream()
                .filter(s -> s.getAttendancePercentage() > 0)
                .mapToDouble(MonitoringSession::getAttendancePercentage)
                .average()
                .orElse(0.0);

        return new ClassroomResponse(
                c.getId(),
                c.getClassroomName(),
                c.getSubject(),
                c.getSection(),
                c.getAcademicYear(),
                c.getDescription(),
                c.getTeacher().getName(),
                studentCount,
                Math.round(avgEng * 10.0) / 10.0,
                Math.round(avgAtt * 10.0) / 10.0,
                c.isDemo()
        );
    }
}
