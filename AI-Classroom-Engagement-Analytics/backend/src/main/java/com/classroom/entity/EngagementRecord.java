package com.classroom.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "engagement_records")
public class EngagementRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_id", nullable = false)
    private MonitoringSession session;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id")
    private Student student;

    @Column(nullable = false)
    private Instant timestamp = Instant.now();

    @Column(name = "face_presence_score", nullable = false)
    private Double facePresenceScore;

    @Column(name = "attention_orientation_score", nullable = false)
    private Double attentionOrientationScore;

    @Column(name = "participation_score")
    private Double participationScore;

    @Column(name = "final_engagement_score", nullable = false)
    private Double finalEngagementScore;

    @Column(name = "detected_faces_count", nullable = false)
    private Integer detectedFacesCount = 0;

    @Column(name = "data_quality_status", nullable = false, length = 40)
    private String dataQualityStatus = "RELIABLE";

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public MonitoringSession getSession() { return session; }
    public void setSession(MonitoringSession session) { this.session = session; }
    public Student getStudent() { return student; }
    public void setStudent(Student student) { this.student = student; }
    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }
    public Double getFacePresenceScore() { return facePresenceScore; }
    public void setFacePresenceScore(Double facePresenceScore) { this.facePresenceScore = facePresenceScore; }
    public Double getAttentionOrientationScore() { return attentionOrientationScore; }
    public void setAttentionOrientationScore(Double attentionOrientationScore) { this.attentionOrientationScore = attentionOrientationScore; }
    public Double getParticipationScore() { return participationScore; }
    public void setParticipationScore(Double participationScore) { this.participationScore = participationScore; }
    public Double getFinalEngagementScore() { return finalEngagementScore; }
    public void setFinalEngagementScore(Double finalEngagementScore) { this.finalEngagementScore = finalEngagementScore; }
    public Integer getDetectedFacesCount() { return detectedFacesCount; }
    public void setDetectedFacesCount(Integer detectedFacesCount) { this.detectedFacesCount = detectedFacesCount; }
    public String getDataQualityStatus() { return dataQualityStatus; }
    public void setDataQualityStatus(String dataQualityStatus) { this.dataQualityStatus = dataQualityStatus; }
}
