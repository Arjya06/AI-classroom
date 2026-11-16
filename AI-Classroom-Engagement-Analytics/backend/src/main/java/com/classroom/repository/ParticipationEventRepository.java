package com.classroom.repository;

import com.classroom.entity.ParticipationEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ParticipationEventRepository extends JpaRepository<ParticipationEvent, Long> {
    List<ParticipationEvent> findBySessionIdOrderByTimestampDesc(Long sessionId);
    List<ParticipationEvent> findByStudentIdOrderByTimestampDesc(Long studentId);
}
