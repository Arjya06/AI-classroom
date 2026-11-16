package com.classroom.service;

import com.classroom.dto.SettingsDtos.*;
import com.classroom.entity.Teacher;
import com.classroom.entity.TeacherSettings;
import com.classroom.exception.BadRequestException;
import com.classroom.repository.TeacherSettingsRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SettingsService {

    private final TeacherSettingsRepository settingsRepository;
    private final AuthService authService;

    public SettingsService(TeacherSettingsRepository settingsRepository, AuthService authService) {
        this.settingsRepository = settingsRepository;
        this.authService = authService;
    }

    public TeacherSettings getOrCreateSettings(Teacher teacher) {
        return settingsRepository.findByTeacherId(teacher.getId()).orElseGet(() -> {
            TeacherSettings s = new TeacherSettings();
            s.setTeacher(teacher);
            return settingsRepository.save(s);
        });
    }

    public SettingsResponse getSettings(String email) {
        Teacher teacher = authService.getTeacherByEmail(email);
        return toResponse(getOrCreateSettings(teacher));
    }

    @Transactional
    public SettingsResponse updateSettings(SettingsRequest request, String email) {
        if (Boolean.TRUE.equals(request.includeParticipation())) {
            double sum = request.attentionWeight() + request.presenceWeight() + request.participationWeight();
            if (Math.abs(sum - 100.0) > 0.01) {
                throw new BadRequestException("Scoring weights must sum to 100% when participation is enabled.");
            }
        } else {
            double sum = request.attentionWeight() + request.presenceWeight();
            if (Math.abs(sum - 100.0) > 0.01 && sum <= 0) {
                throw new BadRequestException("Attention and presence weights must be greater than 0%.");
            }
        }
        if (request.moderateThreshold() >= request.highThreshold()) {
            throw new BadRequestException("Moderate threshold must be lower than high engagement threshold.");
        }

        Teacher teacher = authService.getTeacherByEmail(email);
        TeacherSettings s = getOrCreateSettings(teacher);
        s.setAttentionWeight(request.attentionWeight());
        s.setPresenceWeight(request.presenceWeight());
        s.setParticipationWeight(request.participationWeight());
        s.setIncludeParticipation(request.includeParticipation());
        s.setHighThreshold(request.highThreshold());
        s.setModerateThreshold(request.moderateThreshold());
        s.setSamplingInterval(request.samplingInterval());
        s.setPreferredCameraLabel(request.preferredCameraLabel() != null ? request.preferredCameraLabel() : "Default Classroom Camera");
        s.setRetentionDays(request.retentionDays());

        return toResponse(settingsRepository.save(s));
    }

    private SettingsResponse toResponse(TeacherSettings s) {
        return new SettingsResponse(
                s.getAttentionWeight(),
                s.getPresenceWeight(),
                s.getParticipationWeight(),
                s.getIncludeParticipation(),
                s.getHighThreshold(),
                s.getModerateThreshold(),
                s.getSamplingInterval(),
                s.getPreferredCameraLabel(),
                s.getRetentionDays()
        );
    }
}
