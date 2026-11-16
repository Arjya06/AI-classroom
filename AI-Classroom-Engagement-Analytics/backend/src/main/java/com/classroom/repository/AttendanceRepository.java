package com.classroom.repository;

import com.classroom.entity.Attendance;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface AttendanceRepository extends JpaRepository<Attendance, Long> {
    List<Attendance> findByClassroomTeacherIdOrderByDateDesc(Long teacherId);
    List<Attendance> findByClassroomIdOrderByDateDesc(Long classroomId);
    List<Attendance> findByClassroomIdAndDate(Long classroomId, LocalDate date);
    List<Attendance> findByStudentIdOrderByDateDesc(Long studentId);
    Optional<Attendance> findByStudentIdAndDate(Long studentId, LocalDate date);
}
