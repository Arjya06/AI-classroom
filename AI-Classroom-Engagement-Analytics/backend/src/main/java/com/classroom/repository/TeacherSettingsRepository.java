package com.classroom.repository;

import com.classroom.entity.TeacherSettings;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface TeacherSettingsRepository extends JpaRepository<TeacherSettings, Long> {
    Optional<TeacherSettings> findByTeacherId(Long teacherId);
}
