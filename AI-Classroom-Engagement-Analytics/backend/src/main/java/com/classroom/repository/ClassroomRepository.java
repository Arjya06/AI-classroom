package com.classroom.repository;

import com.classroom.entity.Classroom;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ClassroomRepository extends JpaRepository<Classroom, Long> {
    List<Classroom> findByTeacherIdOrderByCreatedAtDesc(Long teacherId);
}
