package com.classroom.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "teacher_settings")
public class TeacherSettings {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "teacher_id", nullable = false, unique = true)
    private Teacher teacher;

    @Column(name = "attention_weight", nullable = false)
    private Double attentionWeight = 50.0;

    @Column(name = "presence_weight", nullable = false)
    private Double presenceWeight = 30.0;

    @Column(name = "participation_weight", nullable = false)
    private Double participationWeight = 20.0;

    @Column(name = "include_participation", nullable = false)
    private Boolean includeParticipation = true;

    @Column(name = "high_threshold", nullable = false)
    private Double highThreshold = 75.0;

    @Column(name = "moderate_threshold", nullable = false)
    private Double moderateThreshold = 50.0;

    @Column(name = "sampling_interval", nullable = false)
    private Integer samplingInterval = 3;

    @Column(name = "preferred_camera_label", length = 160)
    private String preferredCameraLabel = "Default Classroom Camera";

    @Column(name = "retention_days", nullable = false)
    private Integer retentionDays = 90;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Teacher getTeacher() { return teacher; }
    public void setTeacher(Teacher teacher) { this.teacher = teacher; }
    public Double getAttentionWeight() { return attentionWeight; }
    public void setAttentionWeight(Double attentionWeight) { this.attentionWeight = attentionWeight; }
    public Double getPresenceWeight() { return presenceWeight; }
    public void setPresenceWeight(Double presenceWeight) { this.presenceWeight = presenceWeight; }
    public Double getParticipationWeight() { return participationWeight; }
    public void setParticipationWeight(Double participationWeight) { this.participationWeight = participationWeight; }
    public Boolean getIncludeParticipation() { return includeParticipation; }
    public void setIncludeParticipation(Boolean includeParticipation) { this.includeParticipation = includeParticipation; }
    public Double getHighThreshold() { return highThreshold; }
    public void setHighThreshold(Double highThreshold) { this.highThreshold = highThreshold; }
    public Double getModerateThreshold() { return moderateThreshold; }
    public void setModerateThreshold(Double moderateThreshold) { this.moderateThreshold = moderateThreshold; }
    public Integer getSamplingInterval() { return samplingInterval; }
    public void setSamplingInterval(Integer samplingInterval) { this.samplingInterval = samplingInterval; }
    public String getPreferredCameraLabel() { return preferredCameraLabel; }
    public void setPreferredCameraLabel(String preferredCameraLabel) { this.preferredCameraLabel = preferredCameraLabel; }
    public Integer getRetentionDays() { return retentionDays; }
    public void setRetentionDays(Integer retentionDays) { this.retentionDays = retentionDays; }
}
