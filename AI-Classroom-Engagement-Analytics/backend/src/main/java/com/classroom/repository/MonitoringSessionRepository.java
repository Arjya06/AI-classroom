package com.classroom.repository;

import com.classroom.entity.MonitoringSession;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface MonitoringSessionRepository extends JpaRepository<MonitoringSession, Long> {
    List<MonitoringSession> findByTeacherIdOrderByStartTimeDesc(Long teacherId);
    List<MonitoringSession> findByClassroomIdOrderByStartTimeDesc(Long classroomId);
}
