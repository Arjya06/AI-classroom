package com.classroom.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "monitoring_sessions")
public class MonitoringSession {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_title", nullable = false, length = 200)
    private String sessionTitle;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "classroom_id", nullable = false)
    private Classroom classroom;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "teacher_id", nullable = false)
    private Teacher teacher;

    @Column(name = "start_time", nullable = false)
    private Instant startTime = Instant.now();

    @Column(name = "end_time")
    private Instant endTime;

    @Column(nullable = false)
    private Integer duration = 0;

    @Column(name = "average_engagement", nullable = false)
    private Double averageEngagement = 0.0;

    @Column(name = "attendance_percentage", nullable = false)
    private Double attendancePercentage = 0.0;

    @Column(nullable = false, length = 30)
    private String status = "ACTIVE";

    @Column(nullable = false, length = 20)
    private String mode = "LIVE";

    @Column(name = "is_demo", nullable = false)
    private boolean isDemo = false;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getSessionTitle() { return sessionTitle; }
    public void setSessionTitle(String sessionTitle) { this.sessionTitle = sessionTitle; }
    public Classroom getClassroom() { return classroom; }
    public void setClassroom(Classroom classroom) { this.classroom = classroom; }
    public Teacher getTeacher() { return teacher; }
    public void setTeacher(Teacher teacher) { this.teacher = teacher; }
    public Instant getStartTime() { return startTime; }
    public void setStartTime(Instant startTime) { this.startTime = startTime; }
    public Instant getEndTime() { return endTime; }
    public void setEndTime(Instant endTime) { this.endTime = endTime; }
    public Integer getDuration() { return duration; }
    public void setDuration(Integer duration) { this.duration = duration; }
    public Double getAverageEngagement() { return averageEngagement; }
    public void setAverageEngagement(Double averageEngagement) { this.averageEngagement = averageEngagement; }
    public Double getAttendancePercentage() { return attendancePercentage; }
    public void setAttendancePercentage(Double attendancePercentage) { this.attendancePercentage = attendancePercentage; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }
    public boolean isDemo() { return isDemo; }
    public void setDemo(boolean demo) { isDemo = demo; }
}
