package com.classroom.repository;

import com.classroom.entity.EngagementRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface EngagementRecordRepository extends JpaRepository<EngagementRecord, Long> {
    List<EngagementRecord> findBySessionIdOrderByTimestampAsc(Long sessionId);
    List<EngagementRecord> findByStudentIdOrderByTimestampAsc(Long studentId);
}
