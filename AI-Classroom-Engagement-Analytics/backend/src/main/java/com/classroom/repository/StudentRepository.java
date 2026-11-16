package com.classroom.repository;

import com.classroom.entity.Student;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface StudentRepository extends JpaRepository<Student, Long> {
    List<Student> findByClassroomTeacherIdOrderByStudentNameAsc(Long teacherId);
    List<Student> findByClassroomIdOrderByRollNumberAsc(Long classroomId);
    long countByClassroomId(Long classroomId);
    boolean existsByRollNumberAndClassroomId(String rollNumber, Long classroomId);
}
