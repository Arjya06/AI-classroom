package com.classroom.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "participation_events")
public class ParticipationEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id")
    private Student student;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_id", nullable = false)
    private MonitoringSession session;

    @Column(name = "event_type", nullable = false, length = 80)
    private String eventType;

    @Column(name = "score_value", nullable = false)
    private Double scoreValue = 85.0;

    @Column(nullable = false)
    private Instant timestamp = Instant.now();

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recorded_by", nullable = false)
    private Teacher recordedBy;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Student getStudent() { return student; }
    public void setStudent(Student student) { this.student = student; }
    public MonitoringSession getSession() { return session; }
    public void setSession(MonitoringSession session) { this.session = session; }
    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }
    public Double getScoreValue() { return scoreValue; }
    public void setScoreValue(Double scoreValue) { this.scoreValue = scoreValue; }
    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }
    public Teacher getRecordedBy() { return recordedBy; }
    public void setRecordedBy(Teacher recordedBy) { this.recordedBy = recordedBy; }
}
