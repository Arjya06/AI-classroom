package com.classroom.service;

import com.classroom.dto.AuthDtos.*;
import com.classroom.entity.Teacher;
import com.classroom.entity.TeacherSettings;
import com.classroom.exception.BadRequestException;
import com.classroom.exception.ResourceNotFoundException;
import com.classroom.repository.TeacherRepository;
import com.classroom.repository.TeacherSettingsRepository;
import com.classroom.security.JwtTokenProvider;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final TeacherRepository teacherRepository;
    private final TeacherSettingsRepository settingsRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    public AuthService(TeacherRepository teacherRepository,
                       TeacherSettingsRepository settingsRepository,
                       PasswordEncoder passwordEncoder,
                       JwtTokenProvider jwtTokenProvider) {
        this.teacherRepository = teacherRepository;
        this.settingsRepository = settingsRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (teacherRepository.existsByEmail(request.email().trim().toLowerCase())) {
            throw new BadRequestException("An account with this email already exists.");
        }
        Teacher teacher = new Teacher();
        teacher.setName(request.name().trim());
        teacher.setEmail(request.email().trim().toLowerCase());
        teacher.setPassword(passwordEncoder.encode(request.password()));
        teacher.setDepartment(request.department() != null && !request.department().isBlank()
                ? request.department().trim() : "Computer Science & Engineering");
        teacher.setRole("TEACHER");
        teacher = teacherRepository.save(teacher);

        TeacherSettings defaults = new TeacherSettings();
        defaults.setTeacher(teacher);
        settingsRepository.save(defaults);

        String token = jwtTokenProvider.generateToken(teacher.getId(), teacher.getEmail(), teacher.getRole());
        return new AuthResponse(token, toProfile(teacher));
    }

    public AuthResponse login(LoginRequest request) {
        Teacher teacher = teacherRepository.findByEmail(request.email().trim().toLowerCase())
                .orElseThrow(() -> new BadRequestException("Invalid email or password."));
        if (!passwordEncoder.matches(request.password(), teacher.getPassword())) {
            throw new BadRequestException("Invalid email or password.");
        }
        String token = jwtTokenProvider.generateToken(teacher.getId(), teacher.getEmail(), teacher.getRole());
        return new AuthResponse(token, toProfile(teacher));
    }

    public Teacher getTeacherByEmail(String email) {
        return teacherRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Teacher account not found."));
    }

    @Transactional
    public void changePassword(String email, PasswordChangeRequest request) {
        Teacher teacher = getTeacherByEmail(email);
        if (!passwordEncoder.matches(request.currentPassword(), teacher.getPassword())) {
            throw new BadRequestException("Current password is incorrect.");
        }
        teacher.setPassword(passwordEncoder.encode(request.newPassword()));
        teacherRepository.save(teacher);
    }

    public TeacherProfileDto toProfile(Teacher t) {
        return new TeacherProfileDto(t.getId(), t.getName(), t.getEmail(), t.getRole(), t.getDepartment());
    }
}
